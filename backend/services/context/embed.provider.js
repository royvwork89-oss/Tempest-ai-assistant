'use strict';

// ─── EMBED PROVIDER ───────────────────────────────────────────────────────────
// Genera embeddings 100% local via node-llama-cpp, con un modelo GGUF chico
// dedicado (nomic-embed-text-v1.5, ~80MB) — reemplaza a Ollama (ver
// DECISIONS.md v2.14.0). Decisión de producto: Tempest no debe requerir
// instalar ninguna app externa para esta función.
//
// Estado propio, INDEPENDIENTE de llama.provider.js (_model/_activeModelPath,
// switchModel): este módulo mantiene su propio LlamaModel + LlamaEmbeddingContext,
// cargado una sola vez (lazy, primera llamada) y residente el resto del
// proceso — no compite por el slot de "un modelo de chat a la vez", así que
// no hay swap de modelo en cada mensaje. gpuLayers alto es seguro porque el
// modelo es minúsculo comparado con los modelos de chat (80MB vs 4-8GB).
//
// Nota histórica (DECISIONS.md v2.14.0): un intento anterior de usar
// node-llama-cpp para embeddings crasheó por límite de heap V8 (~3.8GB,
// pointer compression). Esa vez no había un modelo dedicado chico — con
// nomic-embed-text-v1.5.Q4_K_M.gguf (80MB) el footprint es muchísimo menor;
// igual, si este camino vuelve a fallar en la práctica, hay que revisar esta
// nota antes de reintentarlo.

const path = require('path');

const EMBED_MODEL_FILENAME = 'nomic-embed-text-v1.5.Q4_K_M.gguf';

function _resolveEmbedModelPath() {
  const modelsDir = process.env.MODELS_DIR
    ? path.resolve(process.env.MODELS_DIR)
    : path.join(__dirname, '../../../models-localai');
  return path.join(modelsDir, EMBED_MODEL_FILENAME);
}

let _embedModel   = null;
let _embedContext = null;
let _initPromise  = null;
let _status       = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
let _error        = null;

function getEmbedStatus() { return { status: _status, error: _error }; }

async function _ensureReady() {
  if (_status === 'ready') return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    _status = 'loading';
    try {
      const { getLlama } = await import('node-llama-cpp');
      // getLlama() reutiliza el backend nativo ya inicializado por
      // llama.provider.js (singleton interno de node-llama-cpp) — cargar un
      // segundo modelo con él es independiente de _model/switchModel.
      const llama = await getLlama({ gpu: 'auto' });

      const modelPath = _resolveEmbedModelPath();
      console.log('[embed.provider] Cargando modelo de embeddings local (sin Ollama):', modelPath);

      _embedModel   = await llama.loadModel({ modelPath, gpuLayers: 99 });
      _embedContext = await _embedModel.createEmbeddingContext();

      _status = 'ready';
      console.log('[embed.provider] Modelo de embeddings listo ✅ (residente, separado del modelo de chat)');
    } catch (err) {
      _status = 'error';
      _error  = err.message;
      console.error('[embed.provider] Error cargando modelo de embeddings local:', err.message);
      throw err;
    }
  })();

  return _initPromise;
}

/**
 * Genera embedding para un texto — local, via node-llama-cpp.
 * Devuelve Array de floats o null si falla.
 */
async function getEmbedding(text) {
  try {
    await _ensureReady();
    const embedding = await _embedContext.getEmbeddingFor(String(text || ''));
    return Array.from(embedding.vector);
  } catch (err) {
    console.error('[embed.provider] Error generando embedding local:', err.message);
    return null;
  }
}

/**
 * Alias para compatibilidad — el modelo local queda residente en memoria,
 * no hay nada que "liberar" entre llamadas (a diferencia de Ollama, stateless
 * por ser HTTP).
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

module.exports = { getEmbedding, getEmbeddingAndRelease, cosineSimilarity, getEmbedStatus };