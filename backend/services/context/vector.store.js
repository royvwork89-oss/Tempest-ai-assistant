'use strict';

// ─── VECTOR STORE ─────────────────────────────────────────────────────────────
// Guarda y lee embeddings de chunks en disco (JSON por proyecto).
// No usa base de datos — simplicidad sobre performance para proyectos medianos.

const fs   = require('fs');
const path = require('path');

const STORE_FILENAME = 'embeddings.json';

/**
 * Ruta del store para un proyecto.
 */
function _storePath(projectDataPath) {
  return path.join(projectDataPath, 'context', STORE_FILENAME);
}

/**
 * Carga el store existente o devuelve uno vacío.
 * Estructura: { version: 1, chunks: { chunkId: { relPath, text, charStart, vector, mtimeMs } } }
 */
function loadStore(projectDataPath) {
  const p = _storePath(projectDataPath);
  if (!fs.existsSync(p)) return { version: 1, chunks: {} };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return { version: 1, chunks: {} };
  }
}

/**
 * Guarda el store en disco.
 */
function saveStore(projectDataPath, store) {
  const p = _storePath(projectDataPath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(store, null, 2));
}

/**
 * Inserta o actualiza chunks de un archivo en el store.
 */
function upsertChunks(store, chunks, mtimeMs) {
  const relPath = chunks[0]?.relPath;
  if (!relPath) return;

  for (const key of Object.keys(store.chunks)) {
    if (store.chunks[key].relPath === relPath) {
      delete store.chunks[key];
    }
  }

  for (const chunk of chunks) {
    store.chunks[chunk.chunkId] = {
      relPath:   chunk.relPath,
      text:      chunk.text,
      charStart: chunk.charStart,
      vector:    chunk.vector ? Array.from(chunk.vector) : null, // Float32Array → Array normal
      mtimeMs,
    };
  }
}

/**
 * Elimina todos los chunks de archivos que ya no están en el manifest.
 */
function pruneStore(store, activeRelPaths) {
  const active = new Set(activeRelPaths);
  for (const key of Object.keys(store.chunks)) {
    if (!active.has(store.chunks[key].relPath)) {
      delete store.chunks[key];
    }
  }
}

/**
 * Busca los N chunks más relevantes por similitud coseno con el queryVector.
 * @param {object} store
 * @param {Float32Array} queryVector
 * @param {number} topN
 * @returns {{ chunkId, relPath, text, charStart, score }[]}
 */
function searchSimilar(store, queryVector, topN = 8) {
  if (!queryVector || Object.keys(store.chunks).length === 0) return [];

  const scored = [];

  for (const [chunkId, chunk] of Object.entries(store.chunks)) {
    if (!chunk.vector) continue;

    // Calcular similitud coseno inline (evita importar embed.provider aquí)
    const a = queryVector;
    const b = chunk.vector;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot   += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const score = (normA === 0 || normB === 0)
      ? 0
      : dot / (Math.sqrt(normA) * Math.sqrt(normB));

    scored.push({ chunkId, relPath: chunk.relPath, text: chunk.text, charStart: chunk.charStart, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

module.exports = { loadStore, saveStore, upsertChunks, pruneStore, searchSimilar };