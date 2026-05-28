const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');

// ─── Configuración ────────────────────────────────────────────────────────────

const MAX_PAGES = 5;
const DPI = 200;

// ─── Detección de Poppler ─────────────────────────────────────────────────────

let popplerAvailable = null;

async function checkPoppler() {
  if (popplerAvailable !== null) return popplerAvailable;

  return new Promise((resolve) => {
    const p = spawn('pdftoppm', ['-v'], { windowsHide: true });
    p.on('close', code => {
      popplerAvailable = true;
      resolve(true);
    });
    p.on('error', () => {
      popplerAvailable = false;
      console.warn('[pdf.rasterizer] pdftoppm no encontrado — PDF OCR deshabilitado');
      resolve(false);
    });
  });
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
 * Convierte páginas de un PDF a imágenes PNG usando pdftoppm.
 * @param {string} pdfPath   — ruta absoluta al PDF
 * @param {string} outDir    — directorio temporal de salida
 * @param {number} maxPages  — máximo de páginas a rasterizar
 * @returns {Promise<string[]>} — rutas absolutas a los PNGs generados
 */
async function rasterizePdf(pdfPath, outDir, maxPages = MAX_PAGES) {
  await fs.mkdir(outDir, { recursive: true });

  const outPrefix = path.join(outDir, 'page');

  await new Promise((resolve, reject) => {
    const args = [
      '-png',
      '-r', String(DPI),
      '-l', String(maxPages), // solo primeras N páginas
      pdfPath,
      outPrefix
    ];

    const p = spawn('pdftoppm', args, { windowsHide: true });

    let stderr = '';
    p.stderr.on('data', d => (stderr += d.toString()));

    p.on('close', code => {
      if (code === 0) return resolve();
      reject(new Error(`pdftoppm falló (código ${code}): ${stderr}`));
    });

    p.on('error', err => {
      reject(new Error(`pdftoppm no disponible: ${err.message}`));
    });
  });

  // pdftoppm genera: page-1.png, page-2.png, etc.
  const files = (await fs.readdir(outDir))
    .filter(f => f.startsWith('page-') && f.endsWith('.png'))
    .sort((a, b) => {
      const na = Number(a.match(/page-(\d+)\.png/)?.[1] || 0);
      const nb = Number(b.match(/page-(\d+)\.png/)?.[1] || 0);
      return na - nb;
    })
    .map(f => path.join(outDir, f));

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