const fs = require('fs');
const path = require('path');
const { LOGS_DIR } = require('../config/appPaths');

// Ver backend/utils/logger.js para el porqué de leer package.json en vez de
// app.getVersion() — mismo criterio, mismo dato, estampado también acá para
// que requests-*.jsonl (no solo errors-*.jsonl) traiga la versión de la app.
const APP_VERSION = require('../../package.json').version;

const ADMIN_MODE = process.env.ADMIN_MODE === 'true';

let devModeEnabled = false;

function isAdmin() {
  return ADMIN_MODE;
}

function isDevModeEnabled() {
  return devModeEnabled;
}

function toggleDevMode(value) {
  if (!ADMIN_MODE) return false;
  devModeEnabled = typeof value === 'boolean' ? value : !devModeEnabled;
  return devModeEnabled;
}

function logRequest(payload) {
  try {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(LOGS_DIR, `requests-${date}.jsonl`);
    const entry = JSON.stringify({ timestamp: new Date().toISOString(), appVersion: APP_VERSION, ...payload }) + '\n';
    fs.appendFileSync(logFile, entry, 'utf8');
  } catch (err) {
    console.warn('[devMode] logRequest falló:', err.message);
  }
}

module.exports = { isAdmin, isDevModeEnabled, toggleDevMode, logRequest };