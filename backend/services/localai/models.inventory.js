'use strict';

const fs = require('fs');
const { getAllModelIds, resolveCatalogPath, isRequiredForProfile } = require('./models.catalog');

// ─── Chequeo de existencia — NO carga modelos, solo verifica que el archivo
// esté en disco. Barato: unos pocos fs.existsSync(), corre en milisegundos
// aunque haya 20 modelos registrados.
//
// Usa models.catalog.js (no localai.service directo) para que Whisper quede
// cubierto también — antes este chequeo solo veía los modelos de chat
// (MODEL_FILES) y un Whisper faltante pasaba desapercibido hasta que
// transcripción fallaba en producción.
//
// profile determina qué modelo de chat cuenta como "requerido" (ver
// models.catalog.js → getRequiredModelIdsForProfile). Default 'desktop' por
// compatibilidad con callers que todavía no pasan perfil.
function checkModelsInventory(profile = 'desktop') {
  const checked = getAllModelIds().map((modelId) => {
    const filePath = resolveCatalogPath(modelId);
    return {
      modelId,
      path: filePath,
      exists: fs.existsSync(filePath),
      required: isRequiredForProfile(modelId, profile)
    };
  });

  const missing = checked.filter((m) => !m.exists);
  const missingRequired = missing.filter((m) => m.required);

  return {
    ok: missing.length === 0,
    okRequired: missingRequired.length === 0,
    total: checked.length,
    missing,
    missingRequired,
    checked
  };
}

module.exports = { checkModelsInventory };