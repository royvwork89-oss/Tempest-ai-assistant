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
 * Interfaz reemplazable — sharp puede swappearse por jimp, OpenCV, etc.
 * sin tocar ocr.service.js.
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

  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    // sharp no disponible — pasar sin preprocesar
    console.warn('[preprocessor] sharp no disponible — saltando preprocesado');
    return { outputPath: inputPath, wasProcessed: false };
  }

  try {
    // Leer metadata para decidir si necesita upscaling
    const meta = await sharp(inputPath).metadata();
    const needsUpscale = meta.width && meta.width < MIN_WIDTH_FOR_UPSCALE;

    const outputPath = inputPath + '.preprocessed.png';

    let pipeline = sharp(inputPath);

    // 1. Escala de grises — reduce ruido de color
    pipeline = pipeline.grayscale();

    // 2. Normalizar contraste — mejora texto claro sobre fondo claro
    pipeline = pipeline.normalize();

    // 3. Upscaling si la imagen es pequeña — Tesseract trabaja mejor con imágenes grandes
    if (needsUpscale) {
      pipeline = pipeline.resize(MIN_WIDTH_FOR_UPSCALE, null, {
        fit: 'inside',
        kernel: 'lanczos3'  // mejor para texto
      });
    }

    // 4. Exportar como PNG sin compresión para máxima calidad
    await pipeline.png({ compressionLevel: 0 }).toFile(outputPath);

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