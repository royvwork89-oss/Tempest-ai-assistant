const { recognizeImage, MIN_CONFIDENCE } = require('../ocr/ocr.service');

// ─── Extractor de imágenes con OCR ───────────────────────────────────────────

/**
 * Extrae texto de una imagen usando OCR (Tesseract).
 * Sigue el contrato estándar de extractores de attachment.service.js:
 * { name, type, content, truncated, original? }
 *
 * @param {object} file — objeto multer (diskStorage)
 * @returns {Promise<{ name, type, content, truncated, meta }>}
 */
async function extractImage(file) {
  const { originalname, mimetype, size, path: filePath } = file;
  const sizeKB = (size / 1024).toFixed(1);

  console.log(`[image.extractor] OCR iniciado: ${originalname}`);

  try {
    const { text, confidence, cached } = await recognizeImage(filePath);

    console.log(`[image.extractor] OCR completo: ${originalname} | confianza: ${confidence}% | cached: ${cached}`);

    // Confianza baja — texto probablemente basura
    if (confidence < MIN_CONFIDENCE || text.length === 0) {
      return {
        name: originalname,
        type: 'image',
        content:
          `[Imagen adjunta: ${originalname} | Tamaño: ${sizeKB} KB | Tipo: ${mimetype}]\n` +
          `[OCR procesado pero no se detectó texto legible (confianza: ${confidence}%). ` +
          `Si necesitas que analice esta imagen, descríbela con tus palabras.]`,
        truncated: false,
        meta: { confidence, cached, ocrAttempted: true }
      };
    }

    const content =
      `[Imagen adjunta: ${originalname} | Tamaño: ${sizeKB} KB | OCR confianza: ${confidence}%]\n\n` +
      text;

    return {
      name: originalname,
      type: 'image',
      content,
      truncated: false,
      meta: { confidence, cached, ocrAttempted: true }
    };

  } catch (err) {
    console.error(`[image.extractor] Error OCR: ${originalname}`, err.message);

    // Fallback al placeholder original si OCR falla
    return {
      name: originalname,
      type: 'image',
      content:
        `[Imagen adjunta: ${originalname} | Tamaño: ${sizeKB} KB | Tipo: ${mimetype}]\n` +
        `[Error al procesar OCR: ${err.message}. ` +
        `Si necesitas que analice esta imagen, descríbela con tus palabras.]`,
      truncated: false,
      meta: { ocrAttempted: true, error: err.message }
    };
  }
}

module.exports = { extractImage };