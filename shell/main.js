const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const BACKEND_PORT = 3005;
const BACKEND_ENTRY = path.join(__dirname, '..', 'backend', 'server.js');

let mainWindow = null;
let backendProcess = null;

// ─── Lanzar backend Express como proceso hijo ───────────────────────────────
function startBackend() {
  const nodeBin = process.execPath;

  backendProcess = spawn(nodeBin, [BACKEND_ENTRY], {
    env: {
      ...process.env,
      IS_ELECTRON: 'true',
      NODE_ENV: process.env.NODE_ENV || 'production',
      ELECTRON_RUN_AS_NODE: '1',
      MODELS_DIR: 'H:\\Proyectos\\IA\\Tempest\\models-localai'
    }
  });

  backendProcess.stdout?.on('data', (data) => process.stdout.write(data));
  backendProcess.stderr?.on('data', (data) => process.stderr.write(data));

  backendProcess.on('exit', (code) => {
    console.log(`[shell] Backend terminó con código ${code}`);
  });
}

// ─── Esperar a que Express esté listo ───────────────────────────────────────
function waitForBackend(retries = 30, interval = 500) {
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

  mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);

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
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
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