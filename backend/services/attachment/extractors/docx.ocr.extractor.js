const path = require('path');
const fs = require('fs/promises');
const JSZip = require('jszip');
const { recognizeImage, MIN_CONFIDENCE } = require('../ocr/ocr.service');

// ─── Configuración ────────────────────────────────────────────────────────────

const MAX_IMAGES = 15;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDocxMediaImage(zipPath) {
  if (!zipPath.startsWith('word/media/')) return false;
  const ext = path.extname(zipPath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

// ─── Extractor ────────────────────────────────────────────────────────────────

/**
 * Extrae texto de imágenes embebidas en un DOCX usando OCR.
 * Sigue el contrato estándar de extractores de attachment.service.js:
 * { name, type, content, truncated, meta }
 *
 * @param {object} file     — objeto multer (diskStorage)
 * @param {string} rawText  — texto ya extraído por mammoth
 * @returns {Promise<{ name, type, content, truncated, meta }>}
 */
async function extractDocxImagesOCR(file, rawText = '') {
  const { originalname, path: filePath } = file;

  console.log(`[docx.ocr.extractor] Buscando imágenes en: ${originalname}`);

  try {
    const buffer = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(buffer);

    const mediaPaths = Object.keys(zip.files).filter(isDocxMediaImage);

    if (mediaPaths.length === 0) {
      console.log(`[docx.ocr.extractor] Sin imágenes embebidas: ${originalname}`);
      return null; // Sin imágenes — usar flujo normal de mammoth
    }

    const limited = mediaPaths.slice(0, MAX_IMAGES);
    const truncatedImages = mediaPaths.length > MAX_IMAGES;

    console.log(`[docx.ocr.extractor] ${mediaPaths.length} imágenes encontradas, procesando ${limited.length}`);

    const imageResults = [];

    for (let i = 0; i < limited.length; i++) {
      const zipPath = limited[i];
      try {
        // Escribir imagen a temp file para ocr.service (necesita path en disco)
        const imgBuffer = await zip.file(zipPath).async('nodebuffer');
        const tempPath = filePath + `.img_${i}${path.extname(zipPath)}`;

        await fs.writeFile(tempPath, imgBuffer);

        try {
          const { text, confidence } = await recognizeImage(tempPath);

          console.log(`[docx.ocr.extractor] Imagen ${i + 1}/${limited.length} | confianza: ${confidence}%`);

          if (confidence >= MIN_CONFIDENCE && text.length > 0) {
            imageResults.push(`--- Imagen ${i + 1} (${path.basename(zipPath)}) ---\n${text.trim()}`);
          } else {
            imageResults.push(`--- Imagen ${i + 1} (${path.basename(zipPath)}) --- [sin texto legible | confianza: ${confidence}%]`);
          }
        } finally {
          // Limpiar temp siempre
          await fs.unlink(tempPath).catch(() => {});
        }

      } catch (imgErr) {
        console.warn(`[docx.ocr.extractor] Error en imagen ${i + 1}:`, imgErr.message);
        imageResults.push(`--- Imagen ${i + 1} --- [error: ${imgErr.message}]`);
      }
    }

    // Combinar texto de mammoth + texto OCR de imágenes
    const parts = [];

    if (rawText && rawText.trim().length > 0) {
      parts.push(`[Texto del documento]\n${rawText.trim()}`);
    }

    if (imageResults.length > 0) {
      const ocrHeader = truncatedImages
        ? `[Texto extraído de imágenes embebidas — primeras ${MAX_IMAGES} de ${mediaPaths.length}]`
        : `[Texto extraído de imágenes embebidas — ${mediaPaths.length} imagen(es)]`;
      parts.push(`${ocrHeader}\n\n${imageResults.join('\n\n')}`);
    }

    const content = parts.join('\n\n');

    return {
      name: originalname,
      type: 'docx',
      content,
      truncated: truncatedImages,
      meta: {
        imagesFound: mediaPaths.length,
        imagesProcessed: limited.length,
        hasTextContent: rawText.trim().length > 0,
        ocrAttempted: true
      }
    };

  } catch (err) {
    console.error(`[docx.ocr.extractor] Error:`, err.message);
    return null; // Falló — usar flujo normal de mammoth
  }
}

module.exports = { extractDocxImagesOCR };
