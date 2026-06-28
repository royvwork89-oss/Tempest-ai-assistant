'use strict';

// ─── CHUNK SERVICE ────────────────────────────────────────────────────────────
// Divide el contenido de un archivo en fragmentos de ~1750 chars (~500 tokens).
// Respeta líneas — nunca corta en medio de una línea.

const CHUNK_SIZE    = 3500; // chars por chunk (~500 tokens en español/código)
const CHUNK_OVERLAP = 100;  // chars de solapamiento entre chunks

/**
 * Divide un texto en chunks con solapamiento.
 * @param {string} text
 * @param {string} relPath - ruta relativa del archivo (para identificación)
 * @returns {{ chunkId: string, relPath: string, text: string, charStart: number }[]}
 */
function chunkText(text, relPath) {
  if (!text || text.length === 0) return [];

  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = start + CHUNK_SIZE;

    // Si no estamos al final, buscar el último salto de línea antes del límite
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end);
      if (lastNewline > start + CHUNK_OVERLAP) {
        end = lastNewline + 1;
      }
    } else {
      end = text.length;
    }

    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({
        chunkId:  `${relPath}::${index}`,
        relPath,
        text:     chunkText,
        charStart: start,
      });
      index++;
    }

    // Avanzar con solapamiento
    start = end - CHUNK_OVERLAP;
    if (start <= 0 || start >= text.length) break;
  }

  return chunks;
}

module.exports = { chunkText, CHUNK_SIZE, CHUNK_OVERLAP };