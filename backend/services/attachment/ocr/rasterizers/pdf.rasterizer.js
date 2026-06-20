const path = require('path');
const fs = require('fs/promises');
const { createCanvas } = require('@napi-rs/canvas');

// pdfjs-dist v6.x es ESM puro (.mjs) — se carga con import() dinámico
// dentro de rasterizePdf(), no con require() a nivel de módulo.
// Cacheado tras la primera carga para no re-importar en cada llamada.
let _pdfjsLib = null;
async function getPdfjsLib() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return _pdfjsLib;
}

// pdfjs-dist v6.x espera un CanvasFactory explícito en Node — sin esto,
// el render() no falla pero tampoco dibuja nada (página queda en blanco).
// Replica el contrato interno que pdfjs-dist espera: create/reset/destroy.
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

// ─── Configuración ────────────────────────────────────────────────────────────

const MAX_PAGES = 5;
const DPI = 200;
const PDF_SCALE = DPI / 72; // pdfjs trabaja en puntos (72 dpi base)

// ─── Detección de motor (compatibilidad con checkPoppler) ────────────────────
// pdfjs-dist + canvas son dependencias npm (siempre presentes si están en
// node_modules) — no hay binario externo que detectar. Se mantiene la función
// por compatibilidad con cualquier código que la importe, pero ya no depende
// de un proceso de sistema operativo.

async function checkPoppler() {
  return true;
}

// ─── Detección de PDF escaneado ───────────────────────────────────────────────

/**
 * Detecta si un PDF es escaneado (sin texto extraíble).
 * Recibe el texto ya extraído por pdf2json.
 * @param {string} extractedText — texto que devolvió pdf2json
 * @returns {boolean}
 */
function isScannedPdf(extractedText) {
  if (!extractedText || extractedText.trim().length < 50) return true;
  return false;
}

// ─── Rasterización ────────────────────────────────────────────────────────────

/**
 * Convierte páginas de un PDF a imágenes PNG usando pdfjs-dist + canvas.
 * Sin dependencias de binarios del sistema operativo — 100% empaquetable.
 * @param {string} pdfPath   — ruta absoluta al PDF
 * @param {string} outDir    — directorio temporal de salida
 * @param {number} maxPages  — máximo de páginas a rasterizar
 * @returns {Promise<string[]>} — rutas absolutas a los PNGs generados
 */
async function rasterizePdf(pdfPath, outDir, maxPages = MAX_PAGES) {
  await fs.mkdir(outDir, { recursive: true });

  const pdfjsLib = await getPdfjsLib();
  const canvasFactory = new NodeCanvasFactory();

  const data = new Uint8Array(await fs.readFile(pdfPath));
  // pdfjs-dist espera esta ruta en formato URL (forward slashes), no backslashes
  // de Windows — path.join() en Windows usa '\', hay que normalizarlo.
  const standardFontDataUrl = path.join(
    path.dirname(require.resolve('pdfjs-dist/package.json')),
    'standard_fonts/'
  ).split(path.sep).join('/');
  const loadingTask = pdfjsLib.getDocument({ data, standardFontDataUrl, canvasFactory });
  const pdfDoc = await loadingTask.promise;

  const totalPages = Math.min(pdfDoc.numPages, maxPages);
  const files = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: PDF_SCALE });

    const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);

    await page.render({
      canvasContext: context,
      viewport,
      canvasFactory
    }).promise;

    // Mismo patrón de nombre que antes: page-1.png, page-2.png...
    const outPath = path.join(outDir, `page-${pageNum}.png`);
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(outPath, buffer);

    files.push(outPath);

    page.cleanup();
  }

  if (typeof pdfDoc.destroy === 'function') {
    await pdfDoc.destroy();
  }

  return files;
}

// ─── Limpieza ─────────────────────────────────────────────────────────────────

async function cleanupRasterDir(outDir) {
  try {
    const files = await fs.readdir(outDir);
    await Promise.all(files.map(f => fs.unlink(path.join(outDir, f)).catch(() => {})));
    await fs.rmdir(outDir).catch(() => {});
  } catch {
    // silencioso
  }
}

module.exports = {
  checkPoppler,
  isScannedPdf,
  rasterizePdf,
  cleanupRasterDir,
  MAX_PAGES,
  DPI
};