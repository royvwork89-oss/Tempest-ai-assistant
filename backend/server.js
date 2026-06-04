// Asegurar que el PATH del sistema esté disponible (necesario para Poppler en Windows)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Asegurar que el PATH del sistema esté disponible (necesario para Poppler en Windows)
process.env.PATH = require('child_process')
  .execSync('powershell -command "[System.Environment]::GetEnvironmentVariable(\'Path\', \'Machine\')"')
  .toString().trim() + ';' + (process.env.PATH || '');

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const chatRoutes          = require('./routes/chat.routes');
const transcriptionRoutes = require('./routes/transcription.routes');
const documentRoutes      = require('./routes/document.routes');
const contextRoutes       = require('./routes/context.routes');
const { startCleanupJob } = require('./services/attachment.service');
const devRoutes = require('./routes/dev.routes');

const app  = express();
const PORT = 3005;

app.use(cors());
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

const attachmentsDir = path.join(__dirname, 'uploads', 'attachments');
const cleanupJob     = startCleanupJob(attachmentsDir, 24);
setInterval(cleanupJob, 6 * 60 * 60 * 1000);
cleanupJob();

app.listen(PORT, () => {
  console.log(`Tempest activo en http://localhost:${PORT}`);
});