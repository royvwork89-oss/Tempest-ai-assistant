// backend/services/context/providers/upload.provider.js
const fs = require('fs');
const path = require('path');

/**
 * Contrato de salida: { label, name, relPath, alwaysInclude, includeWhenMentioned, priority, content }
 */
async function provide({ items, projectDataPath }) {
  const results = [];

  for (const item of items) {
    if (item.source !== 'upload') continue;
    if (!item.enabled) continue;
    if (!item.contentRef) continue;

    const filePath = path.join(projectDataPath, 'context', item.contentRef);

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const maxChars = 3000;
      const content = raw.length > maxChars ? raw.slice(0, maxChars) + '\n... [truncado]' : raw;
      results.push({
        id: item.id,
        name: item.name,
        relPath: item.relPath,
        alwaysInclude: item.alwaysInclude,
        includeWhenMentioned: item.includeWhenMentioned,
        priority: item.priority,
        content,
      });
    } catch (err) {
      console.warn(`[UploadProvider] No se pudo leer ${filePath}:`, err.message);
    }
  }

  return results;
}

module.exports = { provide };