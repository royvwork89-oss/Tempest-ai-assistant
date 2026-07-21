// Asegurar que el PATH del sistema esté disponible (necesario para Poppler en Windows)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
console.log('[env] MODELS_DIR:', process.env.MODELS_DIR);

// Asegurar que el PATH del sistema esté disponible (necesario para Poppler en Windows)
if (process.platform === 'win32') {
  try {
    const syspath = require('child_process')
      .execSync('powershell -command "[System.Environment]::GetEnvironmentVariable(\'Path\', \'Machine\')"', { timeout: 5000 })
      .toString().trim();
    process.env.PATH = syspath + ';' + (process.env.PATH || '');
  } catch (e) {
    console.warn('[env] No se pudo leer PATH del sistema via PowerShell:', e.message);
  }
}

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { UPLOADS_DIR, OUTPUTS_DIR } = require('./config/appPaths');

const chatRoutes          = require('./routes/chat.routes');
const transcriptionRoutes = require('./routes/transcription.routes');
const documentRoutes      = require('./routes/document.routes');
const contextRoutes       = require('./routes/context.routes');
const { startCleanupJob } = require('./services/attachment.service');
const devRoutes = require('./routes/dev.routes');
const authRoutes = require('./routes/auth.routes');
const gpuRoutes = require('./routes/gpu.routes');
const metricsRoutes = require('./routes/metrics.routes');
const searchRoutes  = require('./routes/search.routes');
const modelsRoutes  = require('./routes/models.routes');
const { initDefaultAdmin } = require('./services/auth.service');
const llamaProvider = require('./services/localai/llama.provider');
const { resolveModelPath } = require('./services/localai.service');
const { checkModelsInventory } = require('./services/localai/models.inventory');
const { downloadModel, getDownloadState, markQueued } = require('./services/localai/model.downloader.service');

let _modelsInventory = null; // cache — se calcula una vez al arrancar, /health lo reutiliza

// Estado de la descarga automática de modelos requeridos en el primer
// arranque (hermes-q4 + whisper-large-v3 hoy). El progreso de bytes en sí
// vive en model.downloader.service (_state) — acá solo se trackea qué
// modelo toca y cuántos van, /health mezcla ambos.
let _requiredDownload = { inProgress: false, current: null, index: 0, total: 0, error: null };

// ─── Descarga secuencial de los modelos requeridos que falten. Se llama una
// sola vez al arrancar, antes de intentar cargar el modelo de chat en VRAM
// — si el .gguf default no existe todavía, llamaProvider.init() fallaría de
// entrada. Secuencial (no en paralelo) a propósito: dos descargas grandes
// simultáneas saturan el ancho de banda del usuario sin bajar más rápido en
// total, y complica el progreso que ve el splash.
async function ensureRequiredModels(missingRequired) {
  if (!missingRequired || missingRequired.length === 0) return;

  // Marcar todos como "en cola" de entrada — así el panel/splash puede
  // distinguir "todavía no le tocó el turno" de "no hay nada pendiente",
  // en vez de mostrar el segundo modelo como si no existiera hasta que
  // termine el primero.
  missingRequired.forEach(({ modelId }) => markQueued(modelId));

  _requiredDownload = { inProgress: true, current: null, index: 0, total: missingRequired.length, error: null };

  for (let i = 0; i < missingRequired.length; i++) {
    const { modelId } = missingRequired[i];
    _requiredDownload = { ..._requiredDownload, current: modelId, index: i + 1 };
    console.log(`[model.downloader] Descargando modelo requerido (${i + 1}/${missingRequired.length}): ${modelId}...`);
    try {
      await downloadModel(modelId);
      console.log(`[model.downloader] "${modelId}" descargado ✅`);
    } catch (err) {
      console.error(`[model.downloader] Falló la descarga de "${modelId}":`, err.message);
      _requiredDownload = { ..._requiredDownload, inProgress: false, error: `${modelId}: ${err.message}` };
      throw err; // sin este modelo no tiene sentido seguir con el resto
    }
  }

  _requiredDownload = { ..._requiredDownload, inProgress: false, current: null };
}

const app  = express();
const PORT = 3005;

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true
}));
app.use(express.json());

app.use('/outputs', express.static(OUTPUTS_DIR));
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use('/', chatRoutes);
app.use('/', transcriptionRoutes);
app.use('/', documentRoutes);
app.use('/', contextRoutes);
app.use('/', devRoutes);
app.use('/', authRoutes);
app.use('/', gpuRoutes);
app.use('/', metricsRoutes);
app.use('/', searchRoutes);
app.use('/', modelsRoutes);
app.get('/health', (req, res) => {
  const ai = llamaProvider.getStatus();

  // Progreso en vivo del modelo que se está bajando ahora (si hay uno) —
  // model.downloader.service es la única fuente de verdad de bytes, acá
  // solo se combina con el índice/total que lleva ensureRequiredModels().
  let modelsDownload = null;
  if (_requiredDownload.total > 0) {
    const live = _requiredDownload.current ? getDownloadState(_requiredDownload.current) : null;
    modelsDownload = {
      inProgress: _requiredDownload.inProgress,
      current: _requiredDownload.current,
      index: _requiredDownload.index,
      total: _requiredDownload.total,
      error: _requiredDownload.error,
      downloadedBytes: live?.downloadedBytes ?? null,
      totalBytes: live?.totalBytes ?? null,
      progress: live?.totalBytes ? live.downloadedBytes / live.totalBytes : null
    };
  }

  res.status(200).json({
    status: 'ok',
    ai: ai.status,
    aiError: ai.error || undefined,
    aiProgress: ai.progress ?? 0,
    modelsInventory: _modelsInventory,
    modelsDownload
  });
});

const attachmentsDir = path.join(UPLOADS_DIR, 'attachments');
const cleanupJob     = startCleanupJob(attachmentsDir, 24);
setInterval(cleanupJob, 6 * 60 * 60 * 1000);
cleanupJob();

initDefaultAdmin().then(async () => {
  app.listen(PORT, () => {
    console.log(`Tempest activo en http://localhost:${PORT}`);
  });

  // Chequeo de inventario — solo verifica que los .gguf/.bin existan en
  // disco, no carga ninguno. Envuelto en try/catch: si esto falla, NO debe
  // impedir que el modelo principal se cargue (bug real encontrado en
  // v2.16.2: un error acá tumbaba silenciosamente initDefaultAdmin().then()
  // completo y dejaba llamaProvider.init() sin ejecutar nunca).
  try {
    _modelsInventory = checkModelsInventory();
    if (!_modelsInventory.ok) {
      console.warn(`[models.inventory] Faltan ${_modelsInventory.missing.length}/${_modelsInventory.total} modelos:`);
      _modelsInventory.missing.forEach(m => console.warn(`  - ${m.modelId} → ${m.path}`));
    } else {
      console.log(`[models.inventory] ${_modelsInventory.total} modelos verificados, todos presentes ✅`);
    }
  } catch (err) {
    console.error('[models.inventory] Chequeo falló, se ignora y se continúa:', err.message);
  }

  // Si falta algún modelo REQUERIDO (chat default + Whisper), descargarlo
  // antes de seguir — sin esto, llamaProvider.init() fallaría de entrada
  // porque el .gguf no existe. Los modelos opcionales (missing pero no
  // required) no bloquean nada acá: quedan para el panel de descarga manual.
  try {
    if (_modelsInventory && !_modelsInventory.okRequired) {
      await ensureRequiredModels(_modelsInventory.missingRequired);
      _modelsInventory = checkModelsInventory(); // refrescar tras descargar
    }
  } catch (err) {
    // No cortamos el proceso: llamaProvider.init() va a fallar de forma
    // visible (ai.status = 'error') igual, y modelsDownload.error en /health
    // ya le da al splash el motivo específico (falló la descarga, no la carga).
    console.error('[model.downloader] No se pudieron completar las descargas requeridas:', err.message);
  }

  // Cargar modelo en segundo plano — no bloquea el arranque del servidor.
  // resolveModelPath('hermes-q4') en vez de la ruta hardcodeada anterior:
  // misma fuente de verdad que usa el catálogo de descarga, evita que
  // diverjan si el nombre de archivo cambia algún día.
  llamaProvider.init(resolveModelPath('hermes-q4'), 99);
});