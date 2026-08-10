//
// Contraparte liviana de linked-folder.service.js: solo lee lo que el service ya
// escaneó y cacheó (manifest + content/*.txt). Nunca toca el filesystem original de
// la carpeta vinculada — así el costo de crawl/OCR/extracción no se paga por mensaje.
//
// Contrato de salida idéntico al resto de providers:
// { id, name, relPath, alwaysInclude, includeWhenMentioned, priority, content }

const { loadLinkedFolderManifest, readLinkedFolderFileContent } = require('../linked-folder.service');

async function provide({ items, projectDataPath }) {
  const linkedItems = (items || [])
    .filter(i => i.source === 'linked-folder' && i.enabled !== false);

  if (linkedItems.length === 0) return [];

  const manifest = loadLinkedFolderManifest(projectDataPath);
  if (!manifest || !manifest.files) return [];

  const blocks = [];

  for (const item of linkedItems) {
    const fileEntry = manifest.files[item.relPath];
    if (!fileEntry) continue; // el archivo salió del scan (borrado/excluido) — item queda huérfano en el index

    const content = readLinkedFolderFileContent(projectDataPath, fileEntry.contentId);
    if (content === null) continue;

    blocks.push({
      id: item.id,
      name: item.name,
      relPath: item.relPath,
      alwaysInclude: item.alwaysInclude || false,
      includeWhenMentioned: item.includeWhenMentioned !== false,
      priority: item.priority || 'normal',
      content,
      source: 'linked-folder',
    });
  }

  return blocks;
}

module.exports = { provide };
