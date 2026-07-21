// backend/services/context/context.service.js
const fs = require('fs');
const path = require('path');
const { assemble } = require('./assembler');
const { DATA_DIR } = require('../../config/appPaths');

function getProjectDataPath(projectId, userId = 'local-user') {
  return path.join(DATA_DIR, 'users', userId, 'projects', projectId);
}

function getIndexPath(projectId, userId = 'local-user') {
  return path.join(getProjectDataPath(projectId, userId), 'context', 'index.json');
}

function getSettingsPath(projectId, userId = 'local-user') {
  return path.join(getProjectDataPath(projectId, userId), 'projectSettings.json');
}

function loadIndex(projectId, userId = 'local-user') {
  const p = getIndexPath(projectId, userId);
  if (!fs.existsSync(p)) return { version: 1, items: [] };
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveIndex(projectId, index, userId = 'local-user') {
  const p = getIndexPath(projectId, userId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(index, null, 2));
}

function loadSettings(projectId, userId = 'local-user') {
  const p = getSettingsPath(projectId, userId);
  if (!fs.existsSync(p)) return getDefaultSettings();
  const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
  // Proyectos creados antes de agregar linkedFolder no lo tienen en disco — fallback in-memory,
  // no se persiste hasta el primer refresh/update real.
  if (!parsed.linkedFolder) parsed.linkedFolder = getDefaultSettings().linkedFolder;
  return parsed;
}

function getDefaultSettings() {
  return {
    version: 1,
    prompts: { projectPromptText: '' },
    preferences: {
      defaultModel: 'auto',
      defaultMode: 'auto'
    },
    contextRules: {
      maxFilesPerRequest: 6,
      maxCharsTotal: 18000,
      defaultPolicy: 'always+mentioned',
      mentionMatch: 'name+relPath',
      ignoreGlobs: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/search-config.json',
        '**/*.env',
        '**/.env*',
        '**/secrets*',
        '**/credentials*',
      ],
      maxFileSizeBytes: 10485760,
      maxTotalFilesIndexed: 200,
    },
    fs: { enabled: false, roots: [] },
    linkedFolder: {
      path: '',
      enabled: false,
      scanMode: 'deep',        // 'shallow' (maxDepth=1) | 'deep' (maxDepth=6) — solo preset de UI
      maxDepth: 6,
      maxFiles: 200,
      maxFileSize: 5242880,    // 5MB
      ignoreGlobs: [
        '**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**',
        '**/*.env', '**/.env*', '**/secrets*', '**/credentials*',
      ],
      lastIndexed: null,
      contentHash: null,
      totalFiles: 0,
      totalSizeBytes: 0,
      status: 'idle',          // 'idle' | 'ok' | 'error'
      lastError: null,
    },
  };
}

/** Llamado desde buildSystemPrompt — devuelve string con el bloque de contexto */
async function getProjectContext({ projectId, userMessage, userId = 'local-user', dynamicMaxChars = null }) {
  if (!projectId || projectId === 'general') return '';

  console.log('[getProjectContext] inicio — projectId:', projectId, '| dynamicMaxChars:', dynamicMaxChars);
  const settings = loadSettings(projectId, userId);
  const index = loadIndex(projectId, userId);
  const projectDataPath = getProjectDataPath(projectId, userId);
  console.log('[getProjectContext] items en index:', index.items.length);

  const result = await assemble({
    items: index.items,
    projectDataPath,
    settings,
    userMessage,
    dynamicMaxChars,
  });
  console.log('[getProjectContext] assemble completado, chars:', result.length);
  return result;
}

/** Inicializa archivos del proyecto al crearlo */
function initProject(projectId, userId = 'local-user') {
  const projectDataPath = getProjectDataPath(projectId, userId);
  const contextDir = path.join(projectDataPath, 'context', 'files');
  fs.mkdirSync(contextDir, { recursive: true });

  const settingsPath = getSettingsPath(projectId, userId);
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(getDefaultSettings(), null, 2));
  }

  const indexPath = getIndexPath(projectId, userId);
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, JSON.stringify({ version: 1, items: [] }, null, 2));
  }
}

module.exports = { getProjectContext, loadIndex, saveIndex, loadSettings, initProject, getProjectDataPath };