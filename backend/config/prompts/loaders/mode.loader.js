const fs = require('fs');
const path = require('path');

const MODES_DIR = path.join(__dirname, '../modes');

const MODE_FILES = {
  coder: {
    strict: 'coder.strict.txt',
    hybrid: 'coder.hybrid.txt',
    patch: 'coder.patch.txt'
  },
  explain: 'explain.txt',
  general: 'general.txt',
  visual: 'visual.txt'
};

/**
 * Carga el prompt del modo detectado.
 * @param {string} mode    — 'coder' | 'explain' | 'general'
 * @param {string} variant — 'strict' | 'hybrid' | null
 * @returns {string}
 */
function loadModePrompt(mode, variant = null) {
  try {
    let filename;

    if (mode === 'coder') {
      filename = MODE_FILES.coder[variant] || MODE_FILES.coder.strict;
    } else {
      filename = MODE_FILES[mode] || MODE_FILES.general;
    }

    const filePath = path.join(MODES_DIR, filename);
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch (err) {
    console.error(`[mode.loader] No se pudo leer modo ${mode}/${variant}:`, err.message);
    return '';
  }
}

module.exports = { loadModePrompt };