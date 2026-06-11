// backend/services/context/context.service.js
const fs   = require('fs');
const path = require('path');
const { assemble } = require('./assembler');

function getProjectDataPath(projectId, userId = 'local-user') {
  return path.join(__dirname, '../../data/users', userId, 'projects', projectId);
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
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
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
      ignoreGlobs: ['**/node_modules/**','**/.git/**','**/dist/**','**/build/**'],
      maxFileSizeBytes: 10485760,
      maxTotalFilesIndexed: 200,
    },
    fs: { enabled: false, roots: [] },
  };
}

/** Llamado desde buildSystemPrompt — devuelve string con el bloque de contexto */
async function getProjectContext({ projectId, userMessage, userId = 'local-user' }) {
  if (!projectId || projectId === 'general') return '';

  console.log('[getProjectContext] inicio — projectId:', projectId);
  const settings = loadSettings(projectId, userId);
  const index    = loadIndex(projectId, userId);
  const projectDataPath = getProjectDataPath(projectId, userId);
  console.log('[getProjectContext] items en index:', index.items.length);

  const result = await assemble({
    items: index.items,
    projectDataPath,
    settings,
    userMessage,
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