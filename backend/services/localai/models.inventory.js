'use strict';

const fs = require('fs');
const { resolveModelPath, getKnownModelIds } = require('../localai.service');

// ─── Chequeo de existencia — NO carga modelos, solo verifica que el archivo
// esté en disco. Barato: unos pocos fs.existsSync(), corre en milisegundos
// aunque haya 20 modelos registrados.
function checkModelsInventory() {
  const checked = getKnownModelIds().map((modelId) => {
    const filePath = resolveModelPath(modelId);
    return { modelId, path: filePath, exists: fs.existsSync(filePath) };
  });

  const missing = checked.filter((m) => !m.exists);

  return {
    ok: missing.length === 0,
    total: checked.length,
    missing,
    checked
  };
}

module.exports = { checkModelsInventory };