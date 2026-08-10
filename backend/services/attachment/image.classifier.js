/**
 * image.classifier.js
 * Decide qué pipeline usar para una imagen adjunta: confiar solo en el OCR,
 * combinar OCR + modelo de visión, o ignorar el OCR y usar solo visión.
 *
 * Contexto (ver DECISIONS.md → "Router de imágenes: documento vs. híbrido vs.
 * visual"): antes la decisión era binaria y dependía solo de la confianza del
 * OCR (`confidence < 60` → visión, si no → confiar ciegamente en el texto).
 * Eso fallaba con imágenes que no son documentos pero donde Tesseract igual
 * saca >60% de confianza sobre las pocas palabras que sí logra leer (ej. una
 * captura de un juego con HUD): el OCR "ganaba" la clasificación con texto
 * irrelevante, y esa imagen nunca llegaba a describeImage() — el único lugar
 * del código que realmente le manda los píxeles al modelo de visión.
 *
 * v1: 3 señales, sin densidad de bordes ni sistema de pesos (ver DECISIONS.md
 * para las alternativas descartadas y por qué). Los umbrales de abajo son
 * provisorios — no hay todavía suficientes imágenes reales de prueba para
 * calibrarlos con confianza. Igual que `token.profiles.js` con el
 * context_size de LLaVA: ajustar acá si en la práctica clasifica mal algo.
 */

'use strict';

const { Jimp } = require('jimp');

// ─── Umbrales (provisorios, ver comentario de arriba) ────────────────────────

const HIGH_CONFIDENCE = 75;
const MIN_CONFIDENCE = 60; // mismo valor que ocr.service.js — no importar de ahí para no acoplar los dos módulos a un único significado del número
const MIN_WORDS_DOCUMENT = 12; // un documento real normalmente tiene bastante más que un par de palabras sueltas
const MIN_WORDS_ANY_TEXT = 3;  // por debajo de esto, el texto no alcanza para nada útil
const LOW_VARIANCE = 35;       // fondo uniforme (papel, tarjeta) — escala de gris 0-255

// Lado chico para la miniatura usada en el cálculo de varianza — no necesita
// resolución real, solo una muestra representativa del fondo. Mantiene el
// cálculo rápido incluso en imágenes grandes.
const THUMBNAIL_SIZE = 64;

/**
 * Calcula qué tan uniforme es el fondo de una imagen (varianza de gris).
 * Fondo uniforme (papel, cartel simple) → varianza baja.
 * Fondo visualmente complejo (foto, captura de juego) → varianza alta.
 *
 * @param {string} filePath — ruta absoluta a la imagen original
 * @returns {Promise<number>} varianza en escala de gris (0-255)
 */
async function computeBackgroundVariance(filePath) {
  try {
    const image = await Jimp.read(filePath);
    image.greyscale().resize({ w: THUMBNAIL_SIZE, h: THUMBNAIL_SIZE });

    const values = [];
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      values.push(this.bitmap.data[idx]); // canal R == G == B tras greyscale()
    });

    if (values.length === 0) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance); // desvío estándar — más interpretable que la varianza cruda
  } catch (err) {
    console.warn(`[image.classifier] No se pudo calcular varianza: ${err.message}`);
    // Sin dato de varianza, no se puede afirmar "fondo uniforme" — se asume
    // complejo (valor alto) para no clasificar de más como DOCUMENTO por un
    // fallo técnico ajeno al contenido real de la imagen.
    return Infinity;
  }
}

/**
 * Clasifica una imagen en base a 3 señales: confianza OCR, cantidad de
 * palabras reconocidas, y uniformidad del fondo.
 *
 * @param {{ confidence: number, wordCount: number, variance: number }} signals
 * @returns {'document' | 'hybrid' | 'visual'}
 */
function classifyImage({ confidence, wordCount, variance }) {
  // Casi no hay texto confiable — no vale la pena mezclar OCR, directo a visión.
  if (wordCount < MIN_WORDS_ANY_TEXT || confidence < MIN_CONFIDENCE) {
    return 'visual';
  }

  // Mucho texto, bien leído, sobre un fondo simple — el OCR alcanza solo.
  if (confidence >= HIGH_CONFIDENCE && wordCount >= MIN_WORDS_DOCUMENT && variance <= LOW_VARIANCE) {
    return 'document';
  }

  // Todo lo demás: hay texto usable pero no se puede confiar ciegamente
  // (poco texto, fondo complejo, o confianza mediocre) — usar las dos señales.
  return 'hybrid';
}

module.exports = {
  computeBackgroundVariance,
  classifyImage,
  // Exportados para poder loguear/depurar con los mismos valores que usa la
  // función real, y para tests futuros — no para que otros módulos armen su
  // propio criterio con umbrales distintos.
  HIGH_CONFIDENCE,
  MIN_CONFIDENCE,
  MIN_WORDS_DOCUMENT,
  MIN_WORDS_ANY_TEXT,
  LOW_VARIANCE
};
