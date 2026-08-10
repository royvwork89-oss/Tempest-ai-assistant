const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { createWorker } = require('tesseract.js');
const { DATA_DIR } = require('../../../config/appPaths');

// ─── Configuración ────────────────────────────────────────────────────────────

const MAX_OCR_MS = 45_000;
const DEFAULT_LANG = 'spa+eng';
// Antes: path.join(process.cwd(), 'backend', 'data', 'ocr-cache') — dependía
// del directorio de trabajo del proceso (frágil en Electron empaquetado,
// donde cwd no siempre es la carpeta de instalación). Ahora usa DATA_DIR,
// la misma fuente de verdad que el resto de datos escribibles.
const CACHE_DIR = path.join(DATA_DIR, 'ocr-cache');
const MIN_CONFIDENCE = 60;

// ─── Worker singleton ─────────────────────────────────────────────────────────

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      const worker = await createWorker(DEFAULT_LANG);
      console.log('[OCR] Worker Tesseract iniciado');
      return worker;
    })();
  }
  return workerPromise;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

function sha1(filePath) {
  return new Promise((resolve, reject) => {
    const crypto = require('crypto');
    const fsSync = require('fs');
    const hash = crypto.createHash('sha1');
    const stream = fsSync.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ─── Reconocimiento ───────────────────────────────────────────────────────────

/**
 * Extrae texto de una imagen en disco usando Tesseract.
 * @param {string} filePath  — ruta absoluta al archivo (de multer diskStorage)
 * @param {object} meta      — metadata extra para adjuntar al resultado
 * @returns {Promise<{ text: string, confidence: number, cached: boolean, hash: string }>}
 */
async function recognizeImage(filePath, meta = {}) {
  const hash = await sha1(filePath);
  const cachePath = path.join(CACHE_DIR, `${hash}.json`);

  // Cache hit — evita re-OCR si el usuario reenvía la misma imagen
  try {
    const cached = JSON.parse(await fs.readFile(cachePath, 'utf8'));
    console.log(`[OCR] Cache hit: ${hash}`);
    // Entradas de cache escritas antes de agregar wordCount no lo tienen —
    // recalcular desde el texto ya cacheado en vez de dejarlo undefined
    // (afectaría a image.classifier.js, que lo usa para clasificar).
    const wordCount = typeof cached.wordCount === 'number'
      ? cached.wordCount
      : String(cached.text || '').split(/\s+/).filter(Boolean).length;
    return { ...cached, wordCount, cached: true };
  } catch {
    // no existe cache, continuar
  }

const { preprocessImage } = require('./preprocessor');
  const { outputPath, wasProcessed } = await preprocessImage(filePath);

  const worker = await getWorker();

  const job = worker.recognize(outputPath);
  const timeout = new Promise((_, rej) =>
    setTimeout(() => rej(new Error('OCR_TIMEOUT')), MAX_OCR_MS)
  );

  let result;
  try {
    result = await Promise.race([job, timeout]);
  } finally {
    if (wasProcessed) {
      await fs.unlink(outputPath).catch(() => {});
    }
  }

  const text = (result?.data?.text || '').trim();
  const confidence = result?.data?.confidence || 0;
  // wordCount: preferir el conteo de Tesseract (result.data.words) — cuenta
  // palabras reconocidas individualmente, más preciso que partir el string
  // final por espacios (que puede fusionar/perder tokens en el post-proceso
  // de Tesseract). Fallback a split si por algún motivo `words` no viene.
  const wordCount = Array.isArray(result?.data?.words)
    ? result.data.words.length
    : text.split(/\s+/).filter(Boolean).length;

  const output = { text, confidence, wordCount, cached: false, hash };

  // Guardar cache solo si hay texto útil
  if (text.length > 0) {
    await fs.writeFile(cachePath, JSON.stringify(output), 'utf8').catch(() => {});
  }

  return output;
}

// ─── Shutdown limpio ──────────────────────────────────────────────────────────

async function terminateWorker() {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
  console.log('[OCR] Worker Tesseract terminado');
}

module.exports = {
  recognizeImage,
  terminateWorker,
  MIN_CONFIDENCE
};