// backend/services/context/assembler.js
const uploadProvider   = require('./providers/upload.provider');
const fsProvider       = require('./providers/fs.provider');
const snapshotProvider = require('./providers/snapshot.provider');
const { budget }       = require('./budgeter');

/**
 * Junta todos los providers y aplica presupuesto.
 * Devuelve string listo para inyectar en el system prompt.
 */
async function assemble({ items, projectDataPath, settings, userMessage }) {
  const rules = settings?.contextRules || {};

  const [uploadBlocks, fsBlocks, snapshotBlocks] = await Promise.all([
    uploadProvider.provide({ items, projectDataPath }),
    fsProvider.provide({ items, settings }),
    snapshotProvider.provide({ items, projectDataPath }),
  ]);

  const allBlocks = [...uploadBlocks, ...fsBlocks, ...snapshotBlocks];
  if (allBlocks.length === 0) return '';

  const selected = budget(allBlocks, rules, userMessage);
  if (selected.length === 0) return '';

  const lines = ['### CONTEXT: PROJECT FILES ###'];
  for (const block of selected) {
    lines.push(`\n--- ${block.relPath || block.name} ---`);
    lines.push(block.content);
  }
  lines.push('\n### CONTEXT: END ###');

  return lines.join('\n');
}

module.exports = { assemble };