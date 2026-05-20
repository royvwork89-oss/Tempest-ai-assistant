// backend/services/context/providers/snapshot.provider.js
const { loadManifest, readFileContent } = require('../snapshot.service');

/**
 * Provider que sirve archivos del Context Snapshot.
 * Contrato idéntico al de upload.provider — devuelve array de bloques.
 *
 * Solo incluye archivos del snapshot con source='snapshot'.
 * El assembler/budgeter los trata igual que cualquier otro bloque.
 */
async function provide({ items, projectDataPath }) {
    const manifest = loadManifest(projectDataPath);
    if (!manifest || !manifest.files) return [];

    // Filtrar items del índice con source='snapshot' y enabled=true
    const snapshotItems = (items || [])
        .filter(i => i.source === 'snapshot' && i.enabled !== false)
        .slice(0, 5); // máximo 5 archivos leídos por request

    if (snapshotItems.length === 0) return [];

    const blocks = [];

    for (const item of snapshotItems) {
        const fileEntry = manifest.files[item.relPath];
        if (!fileEntry) continue;

        const raw = readFileContent(fileEntry.absolutePath);
        if (!raw) continue;
        // Truncar a 2000 chars por archivo para no saturar el contexto
        const content = raw.length > 2000 ? raw.slice(0, 2000) + '\n... [truncado]' : raw;

        blocks.push({
            id: item.id,
            name: item.name,
            relPath: item.relPath,
            alwaysInclude: item.alwaysInclude || false,
            includeWhenMentioned: item.includeWhenMentioned !== false,
            priority: item.priority || 'normal',
            content,
            source: 'snapshot',
        });
    }

    return blocks;
}

module.exports = { provide };