const path = require('path');
const fs = require('fs/promises');

// ─── Configuración ────────────────────────────────────────────────────────────

/**
 * Habilitar/deshabilitar preprocesado globalmente.
 * En el futuro esto puede venir de projectSettings.json o config del usuario.
 */
const PREPROCESSING_ENABLED = true;

/**
 * Resolución mínima para considerar que la imagen necesita upscaling.
 * Imágenes menores a este ancho se escalan para mejorar OCR.
 */
const MIN_WIDTH_FOR_UPSCALE = 1000;

// ─── Interfaz pública ─────────────────────────────────────────────────────────

/**
 * Preprocesa una imagen para mejorar la precisión de OCR.
 * Interfaz reemplazable — jimp puede swappearse por OpenCV, etc. sin tocar
 * ocr.service.js. (Migrado desde sharp en v2.18.1 — ver DECISIONS.md.)
 *
 * @param {string} inputPath  — ruta absoluta a la imagen original
 * @returns {Promise<{ outputPath: string, wasProcessed: boolean }>}
 *   outputPath  — ruta de la imagen procesada (puede ser la misma si no se procesó)
 *   wasProcessed — true si se generó un archivo nuevo (requiere limpieza posterior)
 */
async function preprocessImage(inputPath) {
  if (!PREPROCESSING_ENABLED) {
    return { outputPath: inputPath, wasProcessed: false };
  }

  let Jimp;
  try {
    ({ Jimp } = require('jimp'));
  } catch {
    // jimp no disponible — pasar sin preprocesar
    console.warn('[preprocessor] jimp no disponible — saltando preprocesado');
    return { outputPath: inputPath, wasProcessed: false };
  }

  try {
    const image = await Jimp.read(inputPath);
    const needsUpscale = image.bitmap.width && image.bitmap.width < MIN_WIDTH_FOR_UPSCALE;

    const outputPath = inputPath + '.preprocessed.png';

    // 1. Escala de grises — reduce ruido de color
    image.greyscale();

    // 2. Normalizar contraste — mejora texto claro sobre fondo claro
    image.normalize();

    // 3. Upscaling si la imagen es pequeña — Tesseract trabaja mejor con imágenes grandes
    //    (solo se pasa el ancho: jimp calcula el alto manteniendo el aspect ratio)
    if (needsUpscale) {
      image.resize({ w: MIN_WIDTH_FOR_UPSCALE });
    }

    // 4. Exportar como PNG (jimp no soporta compressionLevel 0 explícito — usa su
    //    compresión PNG por defecto, sin pérdida de datos de imagen)
    await image.write(outputPath);

    return { outputPath, wasProcessed: true };

  } catch (err) {
    console.warn(`[preprocessor] Error preprocesando ${path.basename(inputPath)}: ${err.message}`);
    return { outputPath: inputPath, wasProcessed: false };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  preprocessImage,
  PREPROCESSING_ENABLED
};