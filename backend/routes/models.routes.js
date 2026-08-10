'use strict';

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const { getCatalog, getCompanionModelIds } = require('../services/localai/models.catalog');
const { checkModelsInventory } = require('../services/localai/models.inventory');
const { getDownloadState, queueDownload } = require('../services/localai/model.downloader.service');
const { getHardwareProfile } = require('../services/settings.service');
const { getVisionSetupStatus, ensureVisionModelRegistered } = require('../services/attachment/vision.service');

// ─── GET /models/catalog — catálogo completo (chat + Whisper) con estado:
// si existe en disco, si es requerido para el primer arranque (según el
// perfil de hardware activo), de qué perfil es cada modelo (para que el
// frontend filtre), y progreso de descarga si hay una en curso. Alimenta el
// panel de descarga manual. Devuelve TODO el catálogo (no solo el perfil
// activo) — el filtrado por perfil lo hace el frontend con el campo
// `profile` de cada entrada, mismo patrón que ya usa MODEL_PROFILES en
// frontend/modules/models.js para el selector de chat.
router.get('/models/catalog', authMiddleware, (req, res) => {
  const profile = getHardwareProfile();
  const catalog = getCatalog(profile);
  const inventory = checkModelsInventory(profile);
  const existsByModelId = new Map(inventory.checked.map((m) => [m.modelId, m.exists]));

  const models = catalog.map((entry) => ({
    ...entry,
    exists: existsByModelId.get(entry.modelId) ?? false,
    download: getDownloadState(entry.modelId)
  }));

  res.json({ ok: true, hardwareProfile: profile, models });
});

// ─── POST /models/:id/download — encola la descarga y responde de
// inmediato (no espera a que termine). Pasa por queueDownload() — máximo 2
// descargas simultáneas en todo el proceso, así que si ya hay 2 corriendo
// este modelo queda "en cola" hasta que le toque. El cliente sigue el
// progreso con GET /models/:id/download/status — mismo patrón de polling
// que splash.html ya usa contra /health, para no meter un mecanismo de
// tiempo real distinto.
// Un modelo de visión son dos archivos (pesos + proyector mmproj) y no sirve
// de nada con uno solo — así que su acompañante se encola junto, sin que el
// usuario tenga que saber que existe. Ver COMPANION_MODELS en models.catalog.js.
router.post('/models/:id/download', authMiddleware, (req, res) => {
  const modelId = req.params.id;
  queueDownload(modelId);
  const companions = getCompanionModelIds(modelId);
  companions.forEach((id) => queueDownload(id));
  res.json({ ok: true, started: true, companions });
});

// ─── POST /models/download-all — encola todos los modelos del catálogo que
// falten y tengan fuente configurada (hasSource). Los que ya están
// descargados o no tienen url no se tocan. Igual que el click individual,
// respeta el límite de 2 concurrentes — el resto queda en estado 'queued'
// hasta que le toque turno.
router.post('/models/download-all', authMiddleware, (req, res) => {
  const profile = getHardwareProfile();
  const catalog = getCatalog(profile);
  const inventory = checkModelsInventory(profile);
  const existsByModelId = new Map(inventory.checked.map((m) => [m.modelId, m.exists]));

  // Solo modelos del perfil activo (+ 'both') — evita que "Descargar todos"
  // en una laptop encole también los modelos de 5-9GB de desktop que ni
  // siquiera se muestran en el panel filtrado.
  const queued = [];
  catalog.forEach((entry) => {
    const exists = existsByModelId.get(entry.modelId) ?? false;
    const relevant = entry.profile === profile || entry.profile === 'both';
    if (!exists && entry.hasSource && relevant) {
      queueDownload(entry.modelId);
      queued.push(entry.modelId);
    }
  });

  res.json({ ok: true, queued });
});

// ─── GET /models/vision/setup — estado del análisis de imágenes: si Ollama
// está, si los .gguf (pesos + proyector) están, si el modelo ya quedó
// registrado, y cuánto espacio extra ocupará registrarlo. Alimenta la fila de
// visión del panel de Modelos.
//
// Nota de ruteo: ninguna de las rutas con `:id` de este archivo puede capturar
// estas dos ("vision" caería en `:id`, pero el segmento siguiente tendría que
// ser literalmente "download"), así que el orden acá no es crítico. Vale
// tenerlo presente igual si se agregan rutas más genéricas: Express matchea
// por orden de declaración.
router.get('/models/vision/setup', authMiddleware, async (req, res) => {
  try {
    res.json({ ok: true, setup: await getVisionSetupStatus() });
  } catch (err) {
    console.error('[models.routes] error consultando setup de visión:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /models/vision/register — dispara el `ollama create` y responde de
// inmediato, sin esperar: la importación copia varios GB y puede tardar
// minutos. El cliente sigue el progreso con GET /models/vision/setup, mismo
// patrón de polling que ya usan las descargas.
//
// Antes esto solo pasaba solo, escondido dentro del primer mensaje con imagen
// — funcionaba, pero el usuario veía un chat colgado sin explicación. El
// registro automático SIGUE existiendo como respaldo (cubre el caso de
// instalar Ollama después de bajar el modelo); esto le da además una vía
// visible y deliberada. Ver DECISIONS.md.
router.post('/models/vision/register', authMiddleware, (req, res) => {
  ensureVisionModelRegistered().catch((err) => {
    console.error('[models.routes] registro de visión falló:', err.message);
  });
  res.json({ ok: true, started: true });
});

// ─── GET /models/:id/download/status — progreso de una descarga puntual.
router.get('/models/:id/download/status', authMiddleware, (req, res) => {
  const state = getDownloadState(req.params.id);
  res.json({ ok: true, state });
});

module.exports = router;
