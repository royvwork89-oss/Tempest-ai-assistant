// backend/services/context/providers/snapshot.provider.js
const { loadManifest, readFileContent } = require('../snapshot.service');
const { getEmbedding }                  = require('../embed.provider');
const { loadStore, searchSimilar }      = require('../vector.store');

const MAX_CHUNKS_PER_REQUEST = 8;   // chunks semánticos a recuperar
const MAX_CHARS_PER_CHUNK    = 1750; // chars máximos por chunk

/**
 * Provider que sirve chunks semánticos del Context Snapshot.
 * Si hay embeddings disponibles, usa búsqueda semántica.
 * Si no, usa fallback al comportamiento anterior (primeros 5 archivos).
 */
async function provide({ items, projectDataPath, userMessage }) {
  const manifest = loadManifest(projectDataPath);
  if (!manifest || !manifest.files) return [];

  const snapshotItems = (items || [])
    .filter(i => i.source === 'snapshot' && i.enabled !== false);

  if (snapshotItems.length === 0) return [];

  // ── Intentar búsqueda semántica ──────────────────────────────────────────
  const store = loadStore(projectDataPath);
  const hasEmbeddings = Object.keys(store.chunks).length > 0;

  if (hasEmbeddings && userMessage) {
    try {
      const queryVector = await getEmbedding(userMessage);
      if (queryVector) {
        const topChunks = searchSimilar(store, queryVector, MAX_CHUNKS_PER_REQUEST);
        if (topChunks.length > 0) {
          console.log(`[snapshot.provider] modo semántico — ${topChunks.length} chunks recuperados`);

          // Agrupar chunks por archivo para el bloque de contexto
          const byFile = new Map();
          for (const chunk of topChunks) {
            if (!byFile.has(chunk.relPath)) byFile.set(chunk.relPath, []);
            byFile.get(chunk.relPath).push(chunk);
          }

          const blocks = [];
          for (const [relPath, chunks] of byFile.entries()) {
            const fileEntry = manifest.files[relPath];
            const content = chunks
              .sort((a, b) => a.charStart - b.charStart)
              .map(c => c.text)
              .join('\n...\n');

            blocks.push({
              id:   relPath,
              name: relPath.split('/').pop(),
              relPath,
              alwaysInclude:        false,
              includeWhenMentioned: true,
              priority: 'normal',
              content:  content.slice(0, MAX_CHARS_PER_CHUNK * chunks.length),
              source:   'snapshot',
            });
          }
          return blocks;
        }
      }
    } catch (err) {
      console.warn('[snapshot.provider] Error en búsqueda semántica, usando fallback:', err.message);
    }
  }

  // ── Fallback: comportamiento anterior ─────────────────────────────────────
  console.log('[snapshot.provider] modo fallback (sin embeddings o sin mensaje)');
  const fallbackItems = snapshotItems.slice(0, 5);
  const blocks = [];

  for (const item of fallbackItems) {
    const fileEntry = manifest.files[item.relPath];
    if (!fileEntry) continue;

    const raw = readFileContent(fileEntry.absolutePath);
    if (!raw) continue;

    const content = raw.length > 500 ? raw.slice(0, 500) + '\n... [truncado]' : raw;
    blocks.push({
      id:   item.id,
      name: item.name,
      relPath: item.relPath,
      alwaysInclude:        item.alwaysInclude || false,
      includeWhenMentioned: item.includeWhenMentioned !== false,
      priority: item.priority || 'normal',
      content,
      source: 'snapshot',
    });
  }

  return blocks;
}

module.exports = { provide };