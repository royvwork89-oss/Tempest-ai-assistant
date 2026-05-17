/**
 * patch.parser.js
 * Detecta y normaliza la salida del modelo a bloques de patch estándar.
 * Soporta: Search/Replace blocks y unified diff (---/+++)
 *
 * Contrato de salida:
 * [{ filepath, searchContent, replaceContent, format }]
 */

/**
 * @typedef {Object} PatchBlock
 * @property {string} filepath
 * @property {string} searchContent
 * @property {string} replaceContent
 * @property {'search_replace'|'unified_diff'} format
 */

/**
 * Detecta el formato del output del modelo.
 * @param {string} text
 * @returns {'search_replace'|'unified_diff'|'none'}
 */
function detectFormat(text) {
  if (!text) return 'none';
  if (text.includes('<<<<<<< SEARCH') || text.includes('<<<<<<<')) return 'search_replace';
  if (/^---\s/m.test(text) || /^\+\+\+\s/m.test(text) || /^@@/m.test(text)) return 'unified_diff';
  return 'none';
}

/**
 * Parsea bloques Search/Replace.
 * @param {string} text
 * @returns {PatchBlock[]}
 */
function parseSearchReplace(text) {
  const blocks = [];

  // Extraer filepath + bloque SEARCH/REPLACE
  const blockRegex = /Archivo:\s*(.+?)\n[\s\S]*?<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
  let match;

  while ((match = blockRegex.exec(text)) !== null) {
    const filepath = match[1].trim();
    const searchContent = match[2].trim();
    const replaceContent = match[3].trim();

    if (!searchContent && !replaceContent) continue;

    blocks.push({ filepath, searchContent, replaceContent, format: 'search_replace' });
  }

  // Fallback: sin "Archivo:" explícito
  if (blocks.length === 0) {
    const fallbackRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    while ((match = fallbackRegex.exec(text)) !== null) {
      blocks.push({
        filepath: '',
        searchContent: match[1].trim(),
        replaceContent: match[2].trim(),
        format: 'search_replace'
      });
    }
  }

  return blocks;
}

/**
 * Transpila unified diff a bloques Search/Replace.
 * Ignora números de línea @@ — los modelos locales los calculan mal.
 * @param {string} text
 * @returns {PatchBlock[]}
 */
function transpileGitDiff(text) {
  const blocks = [];
  const lines = text.split(/\r?\n/);

  let currentFile = '';
  let inHunk = false;
  let searchLines = [];
  let replaceLines = [];
  let contextBefore = [];
  let contextAfter = [];

  function flushBlock() {
    if (searchLines.length === 0 && replaceLines.length === 0) return;

    const searchContent = [...contextBefore, ...searchLines].join('\n').trim();
    const replaceContent = [...contextBefore, ...replaceLines].join('\n').trim();

    if (searchContent) {
      blocks.push({