'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const unzipper = require('unzipper');
const { getCatalogEntry, getDownloadInfo } = require('./models.catalog');

// ─── Interfaz reemplazable de descarga de modelos. Usa fetch nativo (Electron
// 42 / Node moderno lo trae global — mismo patrón que search/providers/*.js,
// que ya usan fetch() sin librerías extra) en vez de https/axios, para no
// sumar dependencias solo por esto.

// Estado en memoria de descargas — un solo proceso backend, no hace falta
// persistir a disco. modelId → { status, downloadedBytes, totalBytes, error }
// status: 'queued' | 'downloading' | 'verifying' | 'done' | 'error'
const _state = new Map();

function getDownloadState(modelId) {
  return _state.get(modelId) || null;
}

function _setState(modelId, patch) {
  _state.set(modelId, { ..._state.get(modelId), ...patch });
}

// Marca un modelo como "en cola" antes de que le toque el turno — lo usa
// ensureRequiredModels() en server.js para que el panel/splash puedan
// distinguir "todavía no arrancó" de "no hay ninguna descarga pendiente".
function markQueued(modelId) {
  const info = getDownloadInfo(modelId);
  _setState(modelId, {
    status: 'queued',
    downloadedBytes: 0,
    totalBytes: info.sizeBytes || null,
    error: null
  });
}

// Evita descargas duplicadas si el panel manual y el chequeo de primer
// arranque piden el mismo modelo a la vez — ambos reciben la misma promesa.
const _inFlight = new Map();

function downloadModel(modelId) {
  if (_inFlight.has(modelId)) return _inFlight.get(modelId);

  const promise = _downloadModel(modelId).finally(() => {
    _inFlight.delete(modelId);
  });
  _inFlight.set(modelId, promise);
  return promise;
}

// ─── Cola con límite de concurrencia — usada por "Descargar todos" del panel
// (y por cada click individual, para que compartan el mismo límite). Bajar
// todo en paralelo sin límite no baja más rápido en total — el cuello de
// botella es el ancho de banda del usuario, no CPU — y además satura disco
// con varios streams grandes escribiendo a la vez. 2 en simultáneo es un
// punto medio: algo de paralelismo real sin competir demasiado por la misma
// conexión. Los requeridos del primer arranque (server.js) NO pasan por acá
// — siguen su propio loop secuencial 1-a-la-vez, ya probado.
const MAX_CONCURRENT_DOWNLOADS = 2;
const _queue = [];
let _activeCount = 0;

function queueDownload(modelId) {
  const existing = getDownloadState(modelId);
  if (existing && (existing.status === 'downloading' || existing.status === 'verifying' || existing.status === 'queued')) {
    return; // ya en curso o ya esperando su turno, no duplicar
  }
  if (_queue.includes(modelId)) return;

  markQueued(modelId);
  _queue.push(modelId);
  _pumpQueue();
}

function _pumpQueue() {
  while (_activeCount < MAX_CONCURRENT_DOWNLOADS && _queue.length > 0) {
    const modelId = _queue.shift();
    _activeCount++;
    downloadModel(modelId)
      .catch((err) => {
        console.error(`[model.downloader] Descarga en cola de "${modelId}" falló:`, err.message);
      })
      .finally(() => {
        _activeCount--;
        _pumpQueue();
      });
  }
}

async function _downloadModel(modelId) {
  const entry = getCatalogEntry(modelId);
  const info = getDownloadInfo(modelId);

  if (!info.url) {
    const err = new Error(`Sin fuente de descarga configurada para "${modelId}"`);
    _setState(modelId, { status: 'error', error: err.message });
    throw err;
  }

  // ─── zip-bundle: la fuente es un .zip con varios archivos adentro (ej.
  // whisper-cli.exe + sus .dll de CUDA), no un archivo suelto para renombrar
  // como el resto del catálogo. Ver models.catalog.js → 'whisper-cli'.
  if (info.type === 'zip-bundle') {
    return _downloadZipBundle(modelId, entry, info);
  }

  const targetPath = entry.path;
  const partPath = `${targetPath}.part`;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  _setState(modelId, {
    status: 'downloading',
    downloadedBytes: 0,
    totalBytes: info.sizeBytes || null,
    error: null
  });

  try {
    const res = await fetch(info.url); // fetch sigue redirects por default (HF resuelve a CDN)
    if (!res.ok || !res.body) {
      throw new Error(`Descarga falló: HTTP ${res.status}`);
    }

    const totalBytes = Number(res.headers.get('content-length')) || info.sizeBytes || null;
    _setState(modelId, { totalBytes });

    const hash = crypto.createHash('sha256');
    let downloadedBytes = 0;
    const writeStream = fs.createWriteStream(partPath);
    const nodeStream = Readable.fromWeb(res.body);

    nodeStream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      hash.update(chunk);
      _setState(modelId, { downloadedBytes });
    });

    await pipeline(nodeStream, writeStream);

    if (info.sha256) {
      _setState(modelId, { status: 'verifying' });
      const digest = hash.digest('hex');
      if (digest !== info.sha256) {
        throw new Error(
          `Checksum no coincide para "${modelId}" (esperado ${info.sha256}, obtenido ${digest})`
        );
      }
    } else {
      // No bloquea la descarga — solo advierte. Ver DECISIONS.md: preferible
      // a impedir el uso de un modelo por no tener aún el sha256 confirmado.
      console.warn(`[model.downloader] "${modelId}" sin sha256 configurado — se acepta sin verificar`);
    }

    // Rename atómico (mismo filesystem): nunca queda un .part a medio
    // escribir con el nombre final. Si el proceso muere antes de esta línea,
    // el .part queda huérfano pero el archivo final sigue "no existente"
    // para models.inventory.js — el próximo intento simplemente pisa el .part.
    fs.renameSync(partPath, targetPath);
    _setState(modelId, { status: 'done', downloadedBytes: totalBytes || downloadedBytes });
    return { modelId, path: targetPath };
  } catch (err) {
    try { fs.unlinkSync(partPath); } catch { /* no existía, nada que limpiar */ }
    _setState(modelId, { status: 'error', error: err.message });
    throw err;
  }
}

// ─── Descarga + extracción de un .zip (ej. whisper-cli.exe + sus .dll de
// CUDA). Mismo esquema de estados que _downloadModel (downloading →
// verifying → extracting → done) para que el panel/splash no necesiten
// distinguir el caso — solo agregan 'extracting' como posible status.
async function _downloadZipBundle(modelId, entry, info) {
  const targetPath = entry.path; // ruta final del archivo principal (ej. whisper-cli.exe)
  const extractDir = path.dirname(targetPath);
  const zipPath = path.join(extractDir, `_${modelId}-download.zip.part`);
  fs.mkdirSync(extractDir, { recursive: true });

  _setState(modelId, {
    status: 'downloading',
    downloadedBytes: 0,
    totalBytes: info.sizeBytes || null,
    error: null
  });

  try {
    const res = await fetch(info.url);
    if (!res.ok || !res.body) {
      throw new Error(`Descarga falló: HTTP ${res.status}`);
    }

    const totalBytes = Number(res.headers.get('content-length')) || info.sizeBytes || null;
    _setState(modelId, { totalBytes });

    const hash = crypto.createHash('sha256');
    let downloadedBytes = 0;
    const writeStream = fs.createWriteStream(zipPath);
    const nodeStream = Readable.fromWeb(res.body);

    nodeStream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      hash.update(chunk);
      _setState(modelId, { downloadedBytes });
    });

    await pipeline(nodeStream, writeStream);

    if (info.sha256) {
      _setState(modelId, { status: 'verifying' });
      const digest = hash.digest('hex');
      if (digest !== info.sha256) {
        throw new Error(
          `Checksum no coincide para "${modelId}" (esperado ${info.sha256}, obtenido ${digest})`
        );
      }
    } else {
      console.warn(`[model.downloader] "${modelId}" sin sha256 configurado — se acepta sin verificar`);
    }

    _setState(modelId, { status: 'extracting' });
    await _extractZipBundle(zipPath, extractDir, info.bundleMainFile);

    if (!fs.existsSync(targetPath)) {
      throw new Error(
        `El .zip de "${modelId}" se extrajo pero no se encontró "${info.bundleMainFile}" dentro`
      );
    }

    _setState(modelId, { status: 'done', downloadedBytes: totalBytes || downloadedBytes });
    return { modelId, path: targetPath };
  } catch (err) {
    _setState(modelId, { status: 'error', error: err.message });
    throw err;
  } finally {
    // El .zip es un intermedio descartable — el resultado que importa son los
    // archivos ya extraídos en extractDir. Se limpia siempre, incluso si algo
    // falló a mitad de camino.
    try { fs.unlinkSync(zipPath); } catch { /* no existía, nada que limpiar */ }
  }
}

// Extrae el .zip a una carpeta temporal, ubica mainFile (puede estar en la
// raíz del .zip o dentro de una subcarpeta, según cómo empaquete cada
// release) y mueve TODO lo que esté a su lado —no solo el .exe— a
// extractDir: los builds CUDA necesitan sus .dll (cudart/cublas) en el mismo
// directorio para poder arrancar.
async function _extractZipBundle(zipPath, extractDir, mainFile) {
  const tempDir = path.join(extractDir, `_extract-tmp-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const directory = await unzipper.Open.file(zipPath);
    await directory.extract({ path: tempDir, concurrency: 4 });

    const found = _findFileRecursive(tempDir, mainFile);
    if (!found) {
      throw new Error(`"${mainFile}" no está dentro del .zip descargado`);
    }

    const sourceDir = path.dirname(found);
    for (const name of fs.readdirSync(sourceDir)) {
      const src = path.join(sourceDir, name);
      const dest = path.join(extractDir, name);
      fs.rmSync(dest, { recursive: true, force: true }); // por si quedó algo de un intento anterior fallido
      fs.renameSync(src, dest);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function _findFileRecursive(dir, filename) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      const nested = _findFileRecursive(full, filename);
      if (nested) return nested;
    } else if (name.toLowerCase() === filename.toLowerCase()) {
      return full;
    }
  }
  return null;
}

module.exports = { downloadModel, getDownloadState, markQueued, queueDownload };
