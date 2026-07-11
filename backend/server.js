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
const { initDefaultAdmin } = require('./services/auth.service');
const llamaProvider = require('./services/localai/llama.provider');
const { checkModelsInventory } = require('./services/localai/models.inventory');

let _modelsInventory = null; // cache — se calcula una vez al arrancar, /health lo reutiliza

const app  = express();
const PORT = 3005;

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true
}));
app.use(express.json());

app.use('/outputs', express.static(path.join(__dirname, 'outputs')));
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
app.get('/health', (req, res) => {
  const ai = llamaProvider.getStatus();
  res.status(200).json({
    status: 'ok',
    ai: ai.status,
    aiError: ai.error || undefined,
    aiProgress: ai.progress ?? 0,
    modelsInventory: _modelsInventory
  });
});

const attachmentsDir = path.join(__dirname, 'uploads', 'attachments');
const cleanupJob     = startCleanupJob(attachmentsDir, 24);
setInterval(cleanupJob, 6 * 60 * 60 * 1000);
cleanupJob();

initDefaultAdmin().then(() => {
  app.listen(PORT, () => {
    console.log(`Tempest activo en http://localhost:${PORT}`);
  });

  // Chequeo de inventario — solo verifica que los .gguf existan en disco,
  // no carga ninguno. Envuelto en try/catch: si esto falla, NO debe impedir
  // que el modelo principal se cargue (bug real encontrado en v2.16.2: un
  // error acá tumbaba silenciosamente initDefaultAdmin().then() completo y
  // dejaba llamaProvider.init() sin ejecutar nunca).
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

  // Cargar modelo en segundo plano — no bloquea el arranque del servidor
  const modelsDir = process.env.MODELS_DIR || path.join(__dirname, '../models-localai');
  const modelPath = path.join(modelsDir, 'Hermes-3-Llama-3.1-8B-Q4_K_M.gguf');
  llamaProvider.init(modelPath, 99);
});