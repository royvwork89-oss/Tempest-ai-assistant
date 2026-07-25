'use strict';

// backend/services/patch/intent.resolver.js
//
// Decide si un mensaje del usuario, dentro de un proyecto con Context
// Snapshot, implica una edición de código existente — SIN depender de que
// mencione un verbo de modificación explícito ni el nombre del archivo.
// Reusa el mismo store de embeddings por proyecto que generate-embeddings.js
// ya arma y que snapshot.provider.js ya consume para inyectar contexto en
// modos normales (v2.14.0) — acá se usa para decidir el MODO, no solo para
// elegir qué texto inyectar.
//
// Diseño (ver DECISIONS.md): esto es la primera pieza de la arquitectura de
// "modo Proyecto" — dentro de un proyecto, se asume que el mensaje se refiere
// al proyecto salvo que la similitud semántica con el snapshot sea baja, en
// cuyo caso el mensaje sigue el flujo normal (general/explain/etc.) sin forzar
// nada. No reemplaza los triggers explícitos existentes (PATCH_TRIGGERS,
// verbo+archivo) — es una tercera vía, más amplia, que corre en paralelo.

const { loadStore, searchSimilar } = require('../context/vector.store');
const { getEmbedding } = require('../context/embed.provider');

// Umbral de similitud coseno (nomic-embed-text) para considerar que un
// mensaje corresponde a una funcionalidad/archivo real del proyecto.
// Punto de partida basado en cómo se comporta nomic-embed-text en general
// (texto genuinamente relacionado suele superar ~0.5; charla sin relación
// queda claramente por debajo) — NO es un valor final. Cada decisión queda
// logueada con el score real via [PATCH INTENT], a propósito, para poder
// subir/bajar este número con datos de uso real en vez de a ciegas.
const SEMANTIC_PATCH_THRESHOLD = 0.5;

// Mensajes muy cortos (saludos, "ok", "gracias") no ameritan gastar una
// llamada a Ollama — nunca van a ser una petición de edición real.
const MIN_MESSAGE_LENGTH = 6;

/**
 * @param {string} userMessage
 * @param {string} projectDataPath - ruta absoluta a los datos del proyecto (para leer embeddings.json)
 * @param {Array}  items - items de context/index.json ya filtrados a source==='snapshot' && enabled
 * @returns {Promise<{ relPath: string, score: number } | null>}
 *          null cuando no hay relación semántica clara — el mensaje debe
 *          seguir el flujo normal de detección de modo, no forzar patch.
 */
async function resolvePatchIntent(userMessage, projectDataPath, items) {
  const text = String(userMessage || '').trim();
  if (text.length < MIN_MESSAGE_LENGTH) return null;
  if (!items || items.length === 0) return null;

  try {
    const store = loadStore(projectDataPath);
    if (!store || Object.keys(store.chunks).length === 0) {
      console.log('[PATCH INTENT] sin embeddings generados todavía — se omite el gate semántico');
      return null;
    }

    const queryVector = await getEmbedding(text);
    if (!queryVector) return null;

    const topChunks = searchSimilar(store, queryVector, 5);
    if (topChunks.length === 0) return null;

    const best = topChunks[0];
    console.log(`[PATCH INTENT] mejor match: ${best.relPath} score=${best.score.toFixed(3)} (umbral=${SEMANTIC_PATCH_THRESHOLD})`);

    if (best.score < SEMANTIC_PATCH_THRESHOLD) return null;

    // El chunk más relevante tiene que seguir siendo un item activo del
    // snapshot — el store puede tener restos de archivos ya deshabilitados
    // o eliminados que todavía no se podaron (pruneStore).
    const match = items.find(i => i.relPath === best.relPath);
    if (!match) return null;

    return { relPath: best.relPath, score: best.score };
  } catch (e) {
    console.warn('[PATCH INTENT] búsqueda semántica falló, sin forzar modo:', e.message);
    return null;
  }
}

module.exports = { resolvePatchIntent, SEMANTIC_PATCH_THRESHOLD };
