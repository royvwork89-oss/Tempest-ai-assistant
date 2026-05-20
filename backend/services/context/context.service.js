// backend/services/context/context.service.js
const fs   = require('fs');
const path = require('path');
const { assemble } = require('./assembler');

const DATA_ROOT = path.join(__dirname, '../../data/users/local-user/projects');

function getProjectDataPath(projectId) {
  return path.join(DATA_ROOT, projectId);
}

function getIndexPath(projectId) {
  return path.join(getProjectDataPath(projectId), 'context', 'index.json');
}

function getSettingsPath(projectId) {
  return path.join(getProjectDataPath(projectId), 'projectSettings.json');
}

function loadIndex(projectId) {
  const p = getIndexPath(projectId);
  if (!fs.existsSync(p)) return { version: 1, items: [] };
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveIndex(projectId, index) {
  const p = getIndexPath(projectId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(index, null, 2));
}

function loadSettings(projectId) {
  const p = getSettingsPath(projectId);
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
async function getProjectContext({ projectId, userMessage }) {
  if (!projectId || projectId === 'general') return '';

  console.log('[getProjectContext] inicio — projectId:', projectId);
  const settings = loadSettings(projectId);
  const index    = loadIndex(projectId);
  const projectDataPath = getProjectDataPath(projectId);
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
function initProject(projectId) {
  const projectDataPath = getProjectDataPath(projectId);
  const contextDir = path.join(projectDataPath, 'context', 'files');
  fs.mkdirSync(contextDir, { recursive: true });

  const settingsPath = getSettingsPath(projectId);
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(getDefaultSettings(), null, 2));
  }

  const indexPath = getIndexPath(projectId);
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, JSON.stringify({ version: 1, items: [] }, null, 2));
  }
}

module.exports = { getProjectContext, loadIndex, saveIndex, loadSettings, initProject, getProjectDataPath };