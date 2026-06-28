'use strict';

// ─── EMBED PROVIDER ───────────────────────────────────────────────────────────
// Usa Ollama para generar embeddings — sin límite de memoria de V8.
// Requiere: ollama pull nomic-embed-text

const OLLAMA_URL = 'http://localhost:11434/api/embeddings';
const EMBED_MODEL = 'nomic-embed-text';

/**
 * Genera embedding para un texto via Ollama.
 * Devuelve Array de floats o null si falla.
 */
async function getEmbedding(text) {
  try {
    const response = await fetch(OLLAMA_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: EMBED_MODEL, prompt: text || '' }),
    });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const data = await response.json();
    return data.embedding || null;
  } catch (err) {
    console.error('[embed.provider] Error generando embedding via Ollama:', err.message);
    return null;
  }
}

/**
 * Alias para compatibilidad — Ollama no retiene estado entre llamadas.
 */
const getEmbeddingAndRelease = getEmbedding;

/**
 * Similitud coseno entre dos vectores.
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = { getEmbedding, getEmbeddingAndRelease, cosineSimilarity };