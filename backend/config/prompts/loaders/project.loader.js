const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../../appPaths');

const USERS_DIR = path.join(DATA_DIR, 'users');

/**
 * Carga el prompt de proyecto si existe.
 * @param {string} userId
 * @param {string} projectId
 * @returns {string}
 */
function loadProjectPrompt(userId, projectId) {
  if (!userId || !projectId || projectId === 'general') return '';

  const settingsPath = path.join(
    USERS_DIR,
    userId,
    'projects',
    projectId,
    'projectSettings.json'
  );

  try {
    if (!fs.existsSync(settingsPath)) return '';
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    return String(settings?.prompts?.projectPromptText || '').trim();
  } catch (err) {
    console.error(`[project.loader] Error leyendo projectSettings.json para ${projectId}:`, err.message);
    return '';
  }
}

module.exports = { loadProjectPrompt };