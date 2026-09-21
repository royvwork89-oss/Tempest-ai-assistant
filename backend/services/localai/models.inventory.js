'use strict';

const fs = require('fs');
const { getAllModelIds, resolveCatalogPath, resolveCatalogExtraPaths, isRequiredForProfile } = require('./models.catalog');

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
    // Un modelId puede necesitar mas de un archivo (ver EXTRA_MODELS →
    // extraPaths en models.catalog.js). Si falta cualquiera de ellos el item
    // cuenta como faltante: reportarlo "instalado" a medias es lo que dejo
    // pasar el hueco de los mmproj y el de ffprobe.
    const extraPaths = resolveCatalogExtraPaths(modelId);
    const exists = fs.existsSync(filePath) && extraPaths.every((p) => fs.existsSync(p));
    return {
      modelId,
      path: filePath,
      exists,
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