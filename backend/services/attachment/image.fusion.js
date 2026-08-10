/**
 * image.fusion.js
 * Etapa 5 del pipeline de imágenes: combina el resultado de OCR y del modelo
 * de visión en el texto final, según la categoría resuelta por
 * image.classifier.js. Sin llamadas a red ni a ningún modelo — solo texto y
 * reglas deterministas (ver DECISIONS.md → "Fusionador basado en reglas,
 * sin LLM").
 *
 * CONTRATO: recibe los objetos COMPLETOS que devuelven ocr.service.js
 * (`ocr`) y vision.service.js (`vision`), no campos sueltos. La v1 solo lee
 * `ocr.text`, `ocr.confidence`, `ocr.wordCount` y `vision.description` — el
 * resto de los campos (ej. si OCR suma `words`/`lines`/`blocks` de Tesseract,
 * o vision.service.js suma metadatos nuevos) ya viaja en el objeto sin que
 * haga falta tocar esta firma ni la de quien la llama (image.extractor.js).
 */

'use strict';

// Umbrales del extractor de tokens — provisorios, mismo criterio que
// image.classifier.js: valores de arranque razonados, no calibrados contra
// un conjunto amplio de imágenes reales.
//
// MIN_NAME_LENGTH=3 en vez de 2: en pantallas de UI densas (ej. un juego con
// varios paneles de texto — HUD, chat, lista de misiones) Tesseract deja
// bastante basura de 2 letras (fragmentos de palabras mal leídas, iniciales
// sueltas). Subir el mínimo a 3 caracteres totales corta la mayoría de ese
// ruido sin arriesgar nombres reales, que rara vez son de 2 letras.
//
// MAX_TOKENS=20: sin tope, una imagen con mucho texto (como esa misma UI
// densa) puede generar 100+ tokens — el bloque deja de resaltar los datos
// importantes y se vuelve ruido él mismo. Se prioriza mostrar números
// primero (son el dato "exacto" más probable de necesitarse — HP, nivel,
// estadísticas), el resto se corta y se avisa cuántos quedaron afuera en vez
// de descartarlos en silencio.
const MIN_NAME_LENGTH = 3;
const MAX_TOKENS = 20;

/**
 * Extrae "tokens factuales" de un texto OCR: números, palabras con mayúscula
 * inicial (candidatas a nombres propios o etiquetas de UI), y cadenas cortas
 * alfanuméricas (posibles códigos, ej. "GEAR5"). Todo por regex — no hay NLP
 * ni comprensión real del texto, es intencionalmente simple. Prioriza
 * números y limita el total para no saturar el bloque en imágenes con
 * mucho texto (ver constantes de arriba).
 *
 * @param {string} text
 * @returns {{ tokens: string[], omitted: number }}
 */
function extractFactualTokens(text) {
  if (!text) return { tokens: [], omitted: 0 };

  const numbers = [];
  const seenNumbers = new Set();
  for (const m of text.matchAll(/\b\d[\d.,]*\b/g)) {
    if (!seenNumbers.has(m[0])) { seenNumbers.add(m[0]); numbers.push(m[0]); }
  }

  const rest = [];
  const seenRest = new Set();
  for (const m of text.matchAll(new RegExp(`\\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{${MIN_NAME_LENGTH - 1},}\\b`, 'g'))) {
    if (!seenRest.has(m[0])) { seenRest.add(m[0]); rest.push(m[0]); }
  }
  for (const m of text.matchAll(/\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{3,10}\b/g)) {
    if (!seenRest.has(m[0]) && !seenNumbers.has(m[0])) { seenRest.add(m[0]); rest.push(m[0]); }
  }

  const all = [...numbers, ...rest];
  const tokens = all.slice(0, MAX_TOKENS);
  const omitted = Math.max(0, all.length - tokens.length);

  return { tokens, omitted };
}

/**
 * @param {{ category: 'document'|'hybrid'|'visual', ocr: object, vision?: object }} input
 * @returns {{ content: string, ocrTokens?: string[], ocrTokensOmitted?: number }}
 */
function fuseImageAnalysis({ category, ocr, vision }) {
  const ocrText = (ocr?.text || '').trim();

  if (category === 'document') {
    return { content: ocrText };
  }

  const description = (vision?.description || '').trim();

  if (category === 'visual') {
    return { content: description };
  }

  // hybrid — el cuerpo que ve el usuario es solo la descripción visual, en
  // prosa normal. El OCR se sigue extrayendo (extractFactualTokens) porque
  // sirve para corregir nombres/números que la visión puede leer mal, pero
  // ese bloque queda solo en meta (logs/trace vía image.extractor.js) — no
  // se manda en `content`. Motivo: para categorías hybrid/visual el chat
  // transmite `content` literal al usuario sin pasar por ningún LLM que lo
  // redacte (ver chat.controller.js, isVisionResponse), así que un bloque
  // pensado como nota interna para un modelo ("el texto detectado es la
  // fuente más confiable...") le llegaba tal cual al usuario, sonando a
  // log de depuración en medio de la respuesta. Decisión del usuario: eso
  // debe quedar en el log, no en el chat.
  const { tokens: ocrTokens, omitted: ocrTokensOmitted } = extractFactualTokens(ocrText);

  return { content: description, ocrTokens, ocrTokensOmitted };
}

module.exports = { fuseImageAnalysis, extractFactualTokens };
