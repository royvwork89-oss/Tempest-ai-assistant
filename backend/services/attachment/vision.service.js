/**
 * vision.service.js
 * Cliente para modelo multimodal (LLaVA / Qwen2-VL) vía LocalAI.
 * Interfaz reemplazable — contrato:
 *   describeImage(filePath: string) → Promise<{ description: string, model: string }>
 *
 * Notas de migración:
 * - En Electron: reemplazar implementación sin cambiar el contrato.
 * - Para API externa (OpenAI Vision, Google Vision): mismo contrato, distinto transporte.
 * - VISION_MODEL debe coincidir con el name: de llava.yaml en models-localai/.
 */

const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp'); // migrado desde sharp en v2.18.1 — ver DECISIONS.md
const os = require('os');
const crypto = require('crypto');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
function getVisionModel() {
  const profile = process.env.HARDWARE_PROFILE || 'desktop';
  return process.env.VISION_MODEL ||
    (profile === 'laptop' ? 'llava-1.6:latest' : 'qwen2.5-vl-7b-q4:latest');
}

function getVisionParams() {
  const profile = process.env.HARDWARE_PROFILE || 'desktop';
  if (profile === 'laptop') {
    return { max_tokens: 512, temperature: 0.1, repeat_penalty: 2.0, frequency_penalty: 1.5, presence_penalty: 1.0 };
  }
  return { max_tokens: 1024, temperature: 0.1, repeat_penalty: 1.8, frequency_penalty: 1.2 };
}

const VISION_TIMEOUT_MS = 180_000;

/**
 * Convierte una imagen a base64 data URL.
 * Soporta PNG, JPEG, WEBP, GIF.
 */
function toBase64DataURL(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
  const mime = mimeMap[ext] || 'image/png';
  const data = fs.readFileSync(filePath);
  return `data:${mime};base64,${data.toString('base64')}`;
}

/**
 * Envía la imagen al modelo multimodal y devuelve su descripción.
 * @param {string} filePath - ruta absoluta a la imagen
 * @param {string} [hint]   - pista opcional del usuario (ej. "es un diagrama de flujo")
 * @returns {Promise<{ description: string, model: string }>}
 */

function removeLoops(text) {
  const paragraphs = text.split(/\n+/);
  const seen = new Set();
  const result = [];

  for (const para of paragraphs) {
    const clean = para.trim();
    if (!clean) continue;
    const key = clean.toLowerCase().replace(/\s+/g, ' ');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
  }

  const joined = result.join('\n');
  const sentences = joined.split(/(?<=[.!?])\s+/);
  const seenSentences = new Set();
  const finalSentences = [];

  for (const sentence of sentences) {
    const key = sentence.trim().toLowerCase();
    if (key.length < 20) { finalSentences.push(sentence); continue; }
    if (!seenSentences.has(key)) {
      seenSentences.add(key);
      finalSentences.push(sentence);
    }
  }

  const output = finalSentences.join(' ').trim();
  return output.length > 2000 ? output.slice(0, 2000).replace(/\s+\S*$/, '…') : output;
}

async function describeImage(filePath, hint = '') {
  // Redimensionar a máximo 1024px y comprimir para no superar límite gRPC de 4MB
  const tmpPath = path.join(os.tmpdir(), `vision_${crypto.randomBytes(6).toString('hex')}.jpg`);
  try {
    const image = await Jimp.read(filePath);
    const maxDim = 1024;
    // Equivalente a fit:'inside' + withoutEnlargement:true — solo achica, nunca agranda
    const factor = Math.min(maxDim / image.bitmap.width, maxDim / image.bitmap.height);
    if (factor < 1) {
      image.scaleToFit({ w: maxDim, h: maxDim });
    }
    await image.write(tmpPath, { quality: 70 });
  } catch {
    // Si jimp falla, usar imagen original
  }
  const effectivePath = fs.existsSync(tmpPath) ? tmpPath : filePath;
  const dataURL = toBase64DataURL(effectivePath);

  // Antes solo pedía describir la escena — el modelo priorizaba narrar lo que
  // ve (personajes, paisaje) y nunca transcribía texto en pantalla (HUD,
  // carteles, botones) aunque fuera legible para él. Encontrado en pruebas
  // de v3.0.0 (ver DECISIONS.md). Se agrega el pedido explícito de texto
  // visible como instrucción aparte, sin volverlo obligatorio (si no hay
  // texto, simplemente no hay nada que listar).
  const prompt = hint
    ? `Describe en detalle lo que ves en esta imagen. Contexto: ${hint}. Si hay texto visible en la imagen (carteles, títulos, botones, interfaz), transcribilo también.`
    : 'Describe brevemente lo que ves en esta imagen en español. Si hay texto visible (carteles, títulos, botones, interfaz), transcribilo también.';

  const params = getVisionParams();
  const body = {
  model: getVisionModel(),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataURL } },
        { type: 'text', text: prompt }
      ]
    }
  ],
  ...params,
  stream: false,
};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Vision API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const choice = data?.choices?.[0];
    const description = removeLoops(choice?.message?.content?.trim() || '');
    const truncated = choice?.finish_reason === 'length';
    return { description, model: getVisionModel(), truncated };

  } finally {
    clearTimeout(timeout);
    // Limpiar temporal
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
}

/**
 * Verifica si el modelo multimodal está disponible en LocalAI.
 * Útil para degradación elegante: si no está disponible, saltarse sin error.
 */
async function isVisionAvailable() {
  try {
    const res = await fetch(`${OLLAMA_URL}/v1/models`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const data = await res.json();
    const models = data?.data?.map(m => m.id) || [];
    const visionModel = getVisionModel();
    return models.some(m => m === visionModel || m.startsWith(visionModel.replace(':latest', '')));
  } catch {
    return false;
  }
}

module.exports = { describeImage, isVisionAvailable, getVisionModel };