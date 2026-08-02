// Asegurar que el PATH del sistema esté disponible (necesario para Poppler en Windows)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Logging de errores a disco — antes de CUALQUIER otro require, para que
// ningún console.error()/console.warn() temprano (ej. el bloque de PATH de
// abajo) quede afuera de la captura. Ver DECISIONS.md → "Logger de errores
// centralizado — hallazgo de logs incompletos para diagnóstico post-release".
const { initErrorLogging, logError, cleanupOldLogs } = require('./utils/logger');
initErrorLogging();
cleanupOldLogs(30);

// Errores que de otra forma tumbarían el proceso en silencio (sin terminal
// visible, en el .exe empaquetado, el usuario solo vería la app "colgada" o
// cerrada, sin ningún rastro de qué pasó). Se loguean pero NO se hace
// process.exit() — mismo criterio que Express ya usa en sus catch: preferir
// que seguir corriendo con un error registrado, a un crash total silencioso.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

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
const { getHardwareProfile } = require('./services/settings.service');
const { resolve: resolveCapability } = require('./services/model.router/capability.matrix');

// Perfil de hardware activo — se lee una sola vez al arrancar (viene de
// app-settings.json, con fallback a .env y luego 'desktop', ver
// settings.service.js). Determina qué modelo de chat es "requerido" en el
// primer arranque y cuál se carga por default: antes esto era hermes-q4 fijo
// sin importar la máquina, lo cual hacía que una laptop con 6GB de VRAM
// bajara y tratara de cargar un modelo de 8B pensado para desktop. Ver
// DECISIONS.md → "Perfil de hardware: laptop no debe bajar hermes-q4".
const HARDWARE_PROFILE = getHardwareProfile();
console.log(`[server] Perfil de hardware activo: ${HARDWARE_PROFILE}`);

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
// limit: el default de express.json() es 1mb y se queda corto para los
// endpoints de importación, que mandan el archivo entero como string en el
// body — /chat/import el .md de un chat, /project/import el .tempestproj con
// TODO el árbol del proyecto (chats + contexto + embeddings, que solos pueden
// ser varios MB). Sin esto fallarían con un 413 sin explicación en cuanto el
// respaldo es mediano. Al ser una app local, con el body llegando del propio
// frontend, no hay riesgo de abuso.
app.use(express.json({ limit: '100mb' }));

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

// Catch-all de errores de Express — red de seguridad para cualquier ruta que
// no tenga su propio try/catch (la mayoría sí lo tiene; esto cubre lo que se
// escape). Debe ir DESPUÉS de montar todas las rutas — Express solo lo trata
// como error handler por tener 4 parámetros (err, req, res, next).
app.use((err, req, res, next) => {
  console.error(`[express] Error no manejado en ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
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
    _modelsInventory = checkModelsInventory(HARDWARE_PROFILE);
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
      _modelsInventory = checkModelsInventory(HARDWARE_PROFILE); // refrescar tras descargar
    }
  } catch (err) {
    // No cortamos el proceso: llamaProvider.init() va a fallar de forma
    // visible (ai.status = 'error') igual, y modelsDownload.error en /health
    // ya le da al splash el motivo específico (falló la descarga, no la carga).
    console.error('[model.downloader] No se pudieron completar las descargas requeridas:', err.message);
  }

  // Cargar modelo en segundo plano — no bloquea el arranque del servidor.
  // Antes: resolveModelPath('hermes-q4') fijo, sin importar el perfil. Ahora
  // usa el mismo alias 'general-fast' que ya resuelve capability.matrix.js
  // para el resto del router — hermes-q4 en desktop, qwen2.5-3b-q4 en
  // laptop — así nunca diverge de lo que el router elegiría en modo 'auto'.
  const defaultChatModelId = resolveCapability('general-fast', HARDWARE_PROFILE).modelId;
  console.log(`[server] Cargando modelo de chat por defecto: ${defaultChatModelId} (perfil ${HARDWARE_PROFILE})`);
  llamaProvider.init(resolveModelPath(defaultChatModelId), 99);
});