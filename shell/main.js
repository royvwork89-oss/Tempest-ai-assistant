const { app, BrowserWindow, shell, ipcMain, dialog, Menu, MenuItem } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { autoUpdater, CancellationToken } = require('electron-updater');

// NOTA: backend/utils/logger.js (y backend/config/appPaths.js, del que
// depende) NO se requieren acá arriba a propósito. appPaths.js calcula
// APP_DATA_DIR una sola vez, en el momento en que el módulo se carga por
// primera vez — y ese valor queda cacheado por Node para siempre (mismo
// archivo resuelto = mismo objeto de módulo). Si este require se hiciera acá,
// se ejecutaría ANTES de que startBackend() setee process.env.APP_DATA_DIR,
// cacheando LOGS_DIR apuntando al fallback de desarrollo (backend/) incluso
// en la app empaquetada — y como backend/server.js pide el mismo módulo por
// la misma ruta resuelta, heredaría ese valor ya cacheado y mal. Por eso
// logger.js se pide de forma diferida (dentro de cada handler que lo usa),
// después de que startBackend() ya corrió. Ver DECISIONS.md → "Logger de
// errores centralizado".

const BACKEND_PORT = 3005;

let mainWindow   = null;
let splashWindow = null;

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

  // APP_DATA_DIR: raíz de TODO lo escribible (data/uploads/outputs/logs, ver
  // backend/config/appPaths.js) — separada de dónde está instalada la app.
  // Necesario porque la carpeta de instalación puede ser de solo lectura sin
  // admin (ej. Program Files); app.getPath('userData') siempre es escribible
  // por el usuario actual sin importar dónde se instaló el programa. En
  // desarrollo no se toca — appPaths.js cae a backend/ tal cual si no está
  // seteada. Ver DECISIONS.md → "Instalador — EPERM al escribir dentro de
  // Program Files".
  if (!process.env.APP_DATA_DIR && app.isPackaged) {
    process.env.APP_DATA_DIR = app.getPath('userData');
  }

  // MODELS_DIR: usar variable de entorno si existe, si no construir ruta
  // escribible. Antes vivía junto al .exe (path.dirname(process.execPath)) —
  // mismo problema que arriba: si el .exe está en Program Files, la descarga
  // de modelos del primer arranque fallaría con EPERM igual que uploads/data.
  // Ahora, empaquetado, vive junto a APP_DATA_DIR (misma carpeta de usuario).
  if (!process.env.MODELS_DIR) {
    process.env.MODELS_DIR = app.isPackaged
      ? path.join(app.getPath('userData'), 'models-localai')  // carpeta de usuario, siempre escribible
      : path.join(__dirname, '..', 'models-localai');          // desarrollo
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

// ─── Esperar a que el modelo termine de cargar en VRAM ──────────────────────
function waitForModelReady(retries = 600, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      http.get(`http://localhost:${BACKEND_PORT}/health`, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.ai === 'ready') return resolve(data);
            if (data.ai === 'error') return reject(new Error(data.aiError || 'Error cargando el modelo'));
          } catch {
            // respuesta no parseable todavía, se reintenta
          }
          retry();
        });
      }).on('error', () => retry());
    };

    const retry = () => {
      attempts++;
      if (attempts >= retries) {
        reject(new Error(`El modelo no terminó de cargar después de ${retries} intentos`));
      } else {
        setTimeout(check, interval);
      }
    };

    check();
  });
}

// ─── Crear ventana de splash (carga de modelos) ──────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    show: false,
    backgroundColor: '#0f1115',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow.show());
  splashWindow.on('closed', () => { splashWindow = null; });
}

// ─── Crear ventana principal ─────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Tempest',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Zoom manual con Ctrl+/Ctrl-/Ctrl+0 — como nunca se llama a
  // Menu.setApplicationMenu(), Electron arma su menú por defecto solo, que
  // en teoría ya trae CommandOrControl+Plus/CommandOrControl+- para zoom,
  // pero ese accelerator no siempre dispara según el layout de teclado
  // (problema conocido de Electron/Chromium con el token "Plus"). Se maneja
  // a mano vía before-input-event para no depender de eso.
  const ZOOM_STEP = 0.5;
  const MIN_ZOOM  = -6; // ~25%
  const MAX_ZOOM  = 6;  // ~400%

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.control) return;

    const wc = mainWindow.webContents;
    if (input.key === '+' || input.key === '=' || input.code === 'NumpadAdd') {
      wc.setZoomLevel(Math.min(MAX_ZOOM, wc.getZoomLevel() + ZOOM_STEP));
      event.preventDefault();
    } else if (input.key === '-' || input.code === 'NumpadSubtract') {
      wc.setZoomLevel(Math.max(MIN_ZOOM, wc.getZoomLevel() - ZOOM_STEP));
      event.preventDefault();
    } else if (input.key === '0') {
      wc.setZoomLevel(0);
      event.preventDefault();
    }
  });

  // Menú contextual del corrector ortográfico — Electron no lo muestra solo,
  // hay que armarlo a mano con las sugerencias que da Chromium (params.dictionarySuggestions)
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu();

    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions) {
        menu.append(new MenuItem({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion)
        }));
      }
      if (params.dictionarySuggestions.length > 0) {
        menu.append(new MenuItem({ type: 'separator' }));
      }
      menu.append(new MenuItem({
        label: 'Agregar al diccionario',
        click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      }));
      menu.append(new MenuItem({ type: 'separator' }));
    }

    if (params.isEditable) {
      menu.append(new MenuItem({ label: 'Cortar', role: 'cut', enabled: params.editFlags.canCut }));
      menu.append(new MenuItem({ label: 'Copiar', role: 'copy', enabled: params.editFlags.canCopy }));
      menu.append(new MenuItem({ label: 'Pegar', role: 'paste', enabled: params.editFlags.canPaste }));
    } else if (params.selectionText) {
      menu.append(new MenuItem({ label: 'Copiar', role: 'copy' }));
    }

    if (menu.items.length > 0) {
      menu.popup();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Crash del renderer (pantalla en blanco / "Tempest dejó de responder") —
  // sin esto, un crash del proceso de renderizado no dejaba NINGÚN rastro en
  // los logs: el backend seguía vivo y sano, solo la ventana moría. Se
  // registra con el mismo logger centralizado que usa el backend, para que
  // termine en el mismo errors-YYYY-MM-DD.jsonl que revisa "Abrir carpeta de
  // logs" — un solo lugar donde buscar, sea el error del lado que sea.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    const { logError } = require('../backend/utils/logger');
    logError('error', [`[render-process-gone] reason=${details.reason} exitCode=${details.exitCode}`]);
  });
}

// ─── Auto-actualizaciones vía GitHub Releases (electron-updater) ────────────
// Lee latest.yml del repo público royvwork89-oss/Tempest-ai-assistant (ver
// build.publish en package.json) — no requiere token porque el repo es
// público. Solo funciona en la app empaquetada: en desarrollo no hay
// instalador real que reemplazar y electron-updater tira error sin un feed
// configurado (los handlers IPC de abajo devuelven un error amigable en ese
// caso en vez de crashear).
//
// Flujo 100% manual (v2.18.0): antes se chequeaba solo en segundo plano y se
// auto-descargaba sin avisar. El usuario pidió control explícito: revisar
// desde Configuración → Preferencias, ver un spinner mientras se consulta
// GitHub, y confirmar antes de bajar nada. autoDownload queda en false para
// que downloadUpdate() solo se dispare cuando el usuario lo confirma en el
// modal — nunca automáticamente.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

let _updateCheckInFlight = false;

// Cuando la descarga confirmada por el usuario termina, se ofrece reiniciar
// ya mismo o dejarlo para después — esto no depende de quién disparó el
// checkForUpdates() (siempre es manual ahora), así que un solo listener
// persistente alcanza.
autoUpdater.on('update-downloaded', (info) => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Actualización lista',
    message: `Tempest ${info.version} está lista para instalarse.`,
    detail: 'La app se va a reiniciar para aplicar la actualización.',
    buttons: ['Reiniciar ahora', 'Más tarde'],
    defaultId: 0,
    cancelId: 1
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall();
  });
});

// Progreso real de la descarga — antes no se escuchaba este evento y el
// botón se quedaba fijo en "Descargando…" sin ningún dato, indistinguible
// para el usuario de una descarga colgada (encontrado probando el fix del
// 404, ver DECISIONS.md). electron-updater ya trae { percent, bytesPerSecond,
// transferred, total } listo — solo hacía falta reenviarlo al renderer.
autoUpdater.on('download-progress', (progress) => {
  mainWindow?.webContents.send('update-download-progress', progress);
});

// ─── Ciclo de vida ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createSplashWindow();

  try {
    startBackend();
    await waitForBackend();     // Express respondiendo
    await waitForModelReady();  // modelo cargado en VRAM (splash muestra el progreso)
    createWindow();
  } catch (err) {
    console.error('[shell] Error arrancando backend:', err.message);
    dialog.showErrorBox('Tempest no pudo iniciar', err.message);
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
// defaultPath es opcional: el renderer manda la ruta actual del input que
// disparó el diálogo. Sin esto, dialog.showOpenDialog recuerda internamente
// la última carpeta visitada de forma GLOBAL (todo el proceso de Electron
// comparte un solo historial de navegación), así que el diálogo siempre abría
// donde quedó la última vez sin importar qué proyecto lo llamó. Bug reportado:
// "los 3 proyectos comparten la misma ruta" — ver DECISIONS.md.
ipcMain.handle('select-folder', async (event, defaultPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Seleccionar carpeta del proyecto',
    ...(defaultPath ? { defaultPath } : {})
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

// ─── IPC: abrir carpeta de documentos generados (chat + transcripción) ──────
// A diferencia de open-transcriptions-folder (arriba), acá SÍ se usa
// OUTPUTS_DIR de appPaths.js en vez de una ruta relativa a __dirname — mismo
// criterio ya aplicado en open-logs-folder/open-chat-folder/
// open-project-folder (ver DECISIONS.md, nota sobre el bug latente de
// open-transcriptions-folder en la app empaquetada: __dirname apunta adentro
// del bundle/asar, no a APP_DATA_DIR). Se crea la carpeta si todavía no
// existe (por ejemplo, si el usuario nunca generó un documento) para que
// "Abrir carpeta" nunca falle con ENOENT.
ipcMain.handle('open-documents-folder', async () => {
  const { OUTPUTS_DIR } = require('../backend/config/appPaths');
  const dir = path.join(OUTPUTS_DIR, 'documents');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    return { ok: false, error: err.message };
  }
  const error = await shell.openPath(dir);
  return { ok: !error, error: error || null };
});

// ─── IPC: abrir carpeta de modelos en el explorador nativo ──────────────────
// Reusa process.env.MODELS_DIR, ya resuelto en startBackend() (variable de
// entorno si existe, si no la ruta relativa al ejecutable/dev) — misma
// fuente de verdad que usa el backend para bajar y cargar los modelos, así
// nunca puede apuntar a un lugar distinto de donde realmente están.
ipcMain.handle('open-models-folder', async () => {
  if (!process.env.MODELS_DIR) {
    return { ok: false, error: 'MODELS_DIR no está definido todavía' };
  }
  const error = await shell.openPath(process.env.MODELS_DIR);
  return { ok: !error, error: error || null };
});

// ─── IPC: errores/warnings del renderer reenviados al logger del backend ────
// ipcMain.on (no .handle) porque preload.js manda esto con ipcRenderer.send
// — no espera respuesta. logger.js se pide de forma diferida por el mismo
// motivo que en el resto de este archivo (ver nota arriba de startBackend):
// necesita que APP_DATA_DIR ya esté seteado, y este handler solo se ejecuta
// cuando el renderer ya está corriendo, bien después de eso.
ipcMain.on('renderer-log', (_event, { level, args }) => {
  const { logError } = require('../backend/utils/logger');
  logError(level, [`[renderer]`, ...(Array.isArray(args) ? args : [args])]);
});

// ─── IPC: abrir carpeta de logs en el explorador nativo ─────────────────────
// Gateado a usuarios con rol admin desde el renderer (settings.js solo
// muestra el botón si _isAdmin es true, mismo patrón que la sección de dev
// mode) — acá igual se resuelve siempre vía appPaths.js (LOGS_DIR), nunca una
// ruta hardcodeada, para que apunte a lo mismo que escribe logger.js sin
// importar si la app está empaquetada o en desarrollo.
ipcMain.handle('open-logs-folder', async () => {
  const { LOGS_DIR } = require('../backend/config/appPaths');
  const error = await shell.openPath(LOGS_DIR);
  return { ok: !error, error: error || null };
});

// ─── IPC: abrir carpeta de exportaciones de un chat puntual ─────────────────
// chatId es el nombre real del .json del chat en disco (inmutable, ver
// ARCHITECTURE.md → contrato de chatId) — seguro para usar como nombre de
// carpeta sin sanitizar de nuevo. Se crea la carpeta si todavía no existe
// (por ejemplo, si el usuario abre la carpeta antes de exportar nada nunca)
// para que "Abrir carpeta" nunca falle con ENOENT. Ver DECISIONS.md →
// "Exportar chat — respaldo de conversaciones fuera de la app".
ipcMain.handle('open-chat-folder', async (_event, chatId) => {
  if (!chatId) return { ok: false, error: 'chatId requerido' };
  const { OUTPUTS_DIR } = require('../backend/config/appPaths');
  const dir = path.join(OUTPUTS_DIR, 'chat-exports', chatId);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    return { ok: false, error: err.message };
  }
  const error = await shell.openPath(dir);
  return { ok: !error, error: error || null };
});

// Mismo patrón que open-chat-folder, pero para la carpeta de respaldos de un
// proyecto (project-exports/<projectId>/). require() diferido de appPaths por
// el problema de cacheo documentado arriba.
ipcMain.handle('open-project-folder', async (_event, projectId) => {
  if (!projectId) return { ok: false, error: 'projectId requerido' };
  const { OUTPUTS_DIR } = require('../backend/config/appPaths');
  const dir = path.join(OUTPUTS_DIR, 'project-exports', projectId);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    return { ok: false, error: err.message };
  }
  const error = await shell.openPath(dir);
  return { ok: !error, error: error || null };
});

// ─── IPC: versión actual de la app ───────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());

// ─── IPC: revisar actualizaciones (manual, disparado desde Preferencias) ────
// Usa los eventos 'update-available' / 'update-not-available' / 'error' de
// electron-updater en vez de inspeccionar el valor resuelto por
// checkForUpdates() directamente — es el contrato documentado y confiable
// para saber si HAY una versión más nueva, no solo cuál es la última del feed.
// once() en vez de on() para no ir acumulando listeners en revisiones repetidas.
ipcMain.handle('check-for-updates', () => {
  if (!app.isPackaged) {
    return Promise.resolve({ ok: false, error: 'La revisión de actualizaciones no está disponible en modo desarrollo.' });
  }
  if (_updateCheckInFlight) {
    return Promise.resolve({ ok: false, error: 'Ya hay una revisión en curso.' });
  }

  _updateCheckInFlight = true;

  return new Promise((resolve) => {
    const cleanup = () => {
      autoUpdater.removeListener('update-available', onAvailable);
      autoUpdater.removeListener('update-not-available', onNotAvailable);
      autoUpdater.removeListener('error', onError);
      _updateCheckInFlight = false;
    };
    const onAvailable = (info) => {
      cleanup();
      resolve({ ok: true, updateAvailable: true, currentVersion: app.getVersion(), latestVersion: info.version });
    };
    const onNotAvailable = () => {
      cleanup();
      resolve({ ok: true, updateAvailable: false, currentVersion: app.getVersion() });
    };
    const onError = (err) => {
      cleanup();
      resolve({ ok: false, error: err.message });
    };

    autoUpdater.once('update-available', onAvailable);
    autoUpdater.once('update-not-available', onNotAvailable);
    autoUpdater.once('error', onError);

    autoUpdater.checkForUpdates().catch(onError);
  });
});

// ─── IPC: confirmar descarga de la actualización encontrada ─────────────────
// Solo se llama después de que el usuario confirma en el modal — autoDownload
// está en false a propósito, así que nada se baja sin este paso explícito.
// Cuando termine, el listener 'update-downloaded' de arriba muestra el
// diálogo nativo de reinicio.
//
// _downloadCancellationToken vive a nivel módulo (no dentro del handler)
// porque el botón "Cancelar" del renderer dispara un IPC aparte
// ('cancel-download-update') que necesita alcanzar el mismo token que
// downloadUpdate() está usando — son dos invocaciones IPC distintas sobre la
// misma descarga en curso.
let _downloadCancellationToken = null;

ipcMain.handle('download-update', async () => {
  const cancellationToken = new CancellationToken();
  _downloadCancellationToken = cancellationToken;
  try {
    await autoUpdater.downloadUpdate(cancellationToken);
    return { ok: true };
  } catch (err) {
    // CancellationError es el rechazo esperado cuando el usuario cancela a
    // propósito — no es una falla real, así que el renderer lo trata distinto
    // (mensaje "cancelado", no "error"). Chequeo por nombre en vez de
    // `instanceof CancellationError` para no sumar otro require solo por
    // esto — electron-updater ya usa este mismo nombre de clase.
    if (err.name === 'CancellationError') {
      return { ok: false, cancelled: true };
    }
    console.error('[updater] downloadUpdate falló:', err.message);
    return { ok: false, error: err.message };
  } finally {
    _downloadCancellationToken = null;
  }
});

// ─── IPC: cancelar una descarga de actualización en curso ───────────────────
ipcMain.handle('cancel-download-update', () => {
  if (!_downloadCancellationToken) {
    return { ok: false, error: 'No hay ninguna descarga en curso para cancelar.' };
  }
  _downloadCancellationToken.cancel();
  return { ok: true };
});