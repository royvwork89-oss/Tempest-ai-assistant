'use strict';

// backend/utils/logger.js
//
// Logger centralizado de errores — encontrado en pruebas de v3.0.0 (ver
// DECISIONS.md): el backend solo persistía métricas de requests EXITOSOS
// (devMode.service.js → logRequest(), requests-YYYY-MM-DD.jsonl). Cuando algo
// fallaba de verdad, el error solo iba a console.error() — visible en una
// terminal de desarrollo, pero invisible para cualquiera que use el .exe
// empaquetado normal (sin terminal abierta). Si un usuario real reporta un
// error, no había forma de diagnosticarlo después de los hechos.
//
// Enfoque: en vez de agregar una llamada a logError() a mano en cada uno de
// los ~20 archivos que ya usan console.error()/console.warn() (frágil, fácil
// de olvidar en código nuevo), se parchea console.error/console.warn UNA
// SOLA VEZ acá — todo lo que ya se loguea como error/warning en el backend
// queda persistido automáticamente, sin tocar los call sites existentes.

const fs = require('fs');
const path = require('path');
const { LOGS_DIR } = require('../config/appPaths');

// Versión de la app leída una sola vez — se estampa en cada entrada de log
// para poder distinguir, una vez que haya updates automáticos, si un reporte
// viene de la versión más nueva o de una vieja sin actualizar. Se lee de
// package.json (no de Electron `app.getVersion()`) porque este módulo corre
// igual en modo desarrollo standalone (`npm start` fuera de Electron) y en
// el backend empaquetado — package.json siempre está disponible en ambos
// casos, `require('electron').app` no. Ver DECISIONS.md → "Versión de la
// app en cada entrada del log".
const APP_VERSION = require('../../package.json').version;

let _patched = false;
const _originalError = console.error.bind(console);
const _originalWarn  = console.warn.bind(console);

function _serializeArg(arg) {
  if (arg instanceof Error) {
    return { name: arg.name, message: arg.message, stack: arg.stack };
  }
  if (typeof arg === 'object' && arg !== null) {
    try { return JSON.parse(JSON.stringify(arg)); } catch (_) { return String(arg); }
  }
  return arg;
}

/**
 * Escribe una entrada en errors-YYYY-MM-DD.jsonl. No lanza — un fallo acá
 * (disco lleno, permisos) nunca debe tumbar el flujo que lo llamó.
 */
function logError(level, args) {
  try {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(LOGS_DIR, `errors-${date}.jsonl`);
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      appVersion: APP_VERSION,
      level,
      args: args.map(_serializeArg)
    }) + '\n';
    fs.appendFileSync(logFile, entry, 'utf8');
  } catch (_) {
    // Deliberadamente silencioso — nunca queremos que loguear un error
    // lance un segundo error y oculte el original.
  }
}

/**
 * Parchea console.error/console.warn para que, además de imprimir en la
 * terminal como siempre, también persistan en disco. Llamar UNA VEZ al
 * arrancar el server (server.js), antes de que cualquier otro módulo pueda
 * loguear algo.
 */
function initErrorLogging() {
  if (_patched) return;
  _patched = true;

  console.error = (...args) => {
    _originalError(...args);
    logError('error', args);
  };

  console.warn = (...args) => {
    _originalWarn(...args);
    logError('warn', args);
  };
}

/**
 * Borra logs (requests-*.jsonl y errors-*.jsonl) más viejos que maxAgeDays.
 * Pensado para llamarse una vez al arrancar — sin esto, los JSONL crecen
 * para siempre en la carpeta de datos del usuario.
 */
function cleanupOldLogs(maxAgeDays = 30) {
  try {
    if (!fs.existsSync(LOGS_DIR)) return;
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(LOGS_DIR).filter(f => /^(requests|errors)-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
    for (const file of files) {
      const filePath = path.join(LOGS_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        _originalError(`[logger] Log viejo eliminado (>${maxAgeDays}d): ${file}`);
      }
    }
  } catch (err) {
    _originalError('[logger] cleanupOldLogs falló:', err.message);
  }
}

module.exports = { initErrorLogging, logError, cleanupOldLogs };
