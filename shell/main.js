const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const http = require('http');

const BACKEND_PORT = 3005;

let mainWindow = null;

// ─── Lanzar backend Express en el mismo proceso ──────────────────────────────
function startBackend() {
  // Cargar .env ANTES de cualquier fallback: dotenv no sobreescribe variables
  // ya seteadas, así que si el fallback de MODELS_DIR corriera primero, el
  // valor del .env quedaría ignorado para siempre (bug ya visto en 2 sesiones)
  require(path.join(__dirname, '../backend/node_modules/dotenv'))
    .config({ path: path.join(__dirname, '../.env') });
  // Inyectar variables de entorno antes de cargar server.js
  process.env.IS_ELECTRON   = 'true';
  process.env.NODE_ENV      = process.env.NODE_ENV || 'production';
  // MODELS_DIR: usar variable de entorno si existe, si no construir ruta relativa al ejecutable
  if (!process.env.MODELS_DIR) {
    process.env.MODELS_DIR = app.isPackaged
      ? path.join(path.dirname(process.execPath), 'models-localai')  // junto al .exe en producción
      : path.join(__dirname, '..', 'models-localai');                 // desarrollo
  }

  require('../backend/server.js');
}

// ─── Esperar a que Express esté listo ───────────────────────────────────────
function waitForBackend(retries = 60, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      http.get(`http://localhost:${BACKEND_PORT}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      }).on('error', () => retry());
    };

    const retry = () => {
      attempts++;
      if (attempts >= retries) {
        reject(new Error(`Backend no respondió después de ${retries} intentos`));
      } else {
        setTimeout(check, interval);
      }
    };

    check();
  });
}

// ─── Crear ventana principal ─────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Tempest',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Ciclo de vida ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  startBackend();

  try {
    await waitForBackend();
    createWindow();
  } catch (err) {
    console.error('[shell] Error arrancando backend:', err.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ─── IPC: selector nativo de carpetas ────────────────────────────────────────
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Seleccionar carpeta del proyecto'
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ─── IPC: abrir carpeta de transcripciones en el explorador nativo ──────────
ipcMain.handle('open-transcriptions-folder', async () => {
  const transcriptionsDir = path.join(__dirname, '..', 'backend', 'outputs', 'transcriptions');
  const error = await shell.openPath(transcriptionsDir);
  return { ok: !error, error: error || null };
});