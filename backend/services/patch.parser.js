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
 * @property {'search_replace'|'unified_diff'|'merge_conflict'} format
 */

/**
 * Detecta el formato del output del modelo.
 * @param {string} text
 * @returns {'search_replace'|'unified_diff'|'none'}
 */
function detectFormat(text) {
  if (!text) return 'none';
  if (text.includes('<<<<<<< SEARCH')) return 'search_replace';
  if (/<<<<<<<\s+\S/.test(text) && /=======/.test(text) && />>>>>>>/.test(text)) return 'merge_conflict';
  if (text.includes('<<<<<<<')) return 'search_replace';
  if (/^---\s/m.test(text) || /^\+\+\+\s/m.test(text) || /^@@/m.test(text)) return 'unified_diff';
  if (looksLikeSimpleDiff(text)) return 'unified_diff';
  return 'none';
}

function isLikelyFilePath(s) {
  if (!s) return false;
  if (s.includes(' ') || s.includes(':')) return false;
  if (!(s.includes('/') || s.includes('\\'))) return false;
  return /\.[a-z0-9]{1,8}$/i.test(s);
}

function looksLikeSimpleDiff(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (isLikelyFilePath(line)) {
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        const next = lines[j];
        if (!next) continue;
        if (next.startsWith('---') || next.startsWith('+++') || next.startsWith('@@')) break;
        if ((next.startsWith('-') || next.startsWith('+')) && next.length > 1) return true;
      }
    }
  }
  return false;
}

/**
 * Parsea bloques Search/Replace.
 * @param {string} text
 * @returns {PatchBlock[]}
 */
function parseSearchReplace(text) {
  const blocks = [];

  // Extraer filepath + bloque SEARCH/REPLACE
  const blockRegex =
    /Archivo:\s*(.+?)\r?\n[\s\S]*?<<<<<<<\s*SEARCH\s*\r?\n([\s\S]*?)\r?\n=======\s*\r?\n([\s\S]*?)\r?\n>>>>>>>\s*REPLACE/g;
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
    const fallbackRegex =
      /<<<<<<<\s*SEARCH\s*\r?\n([\s\S]*?)\r?\n=======\s*\r?\n([\s\S]*?)\r?\n>>>>>>>\s*REPLACE/g;
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
    if (searchContent || replaceContent) {
      blocks.push({
        filepath: currentFile || 'unknown_file',
        searchContent,
        replaceContent,
        format: 'unified_diff'
      });
    }
    searchLines = [];
    replaceLines = [];
    contextBefore = [];
    contextAfter = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (line.startsWith('--- a/') || line.startsWith('--- ')) {
      flushBlock();
      currentFile = line.replace(/^---\s+(a\/)?/, '').trim();
      inHunk = false;
      continue;
    }
    if (line.startsWith('+++ b/') || line.startsWith('+++ ')) {
      continue;
    }

    if (line.startsWith('@@')) {
      flushBlock();
      inHunk = true;
      continue;
    }

    // Detectar filepath simplificado
    if (!inHunk && isLikelyFilePath(trimmed)) {
      let looksLikeDiff = false;
      for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
        const next = lines[j].trim();
        if (!next) continue;
        if (next.startsWith('-') || next.startsWith('+') || next.startsWith('@@')) {
          looksLikeDiff = true;
          break;
        }
      }
      if (looksLikeDiff) {
        flushBlock();
        currentFile = trimmed;
        inHunk = true;
        continue;
      }
    }

    // Forzar inHunk si hay +/- y tenemos archivo
    if (!inHunk && currentFile && (line.startsWith('-') || line.startsWith('+'))) {
      inHunk = true;
    }

    if (!inHunk) continue;

    if (line.startsWith('-') && !line.startsWith('---')) {
      searchLines.push(line.slice(1));
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      replaceLines.push(line.slice(1));
    } else if (line.startsWith(' ')) {
      const clean = line.slice(1);
      if (searchLines.length === 0 && replaceLines.length === 0) {
        contextBefore.push(clean);
        if (contextBefore.length > 3) contextBefore.shift();
      } else {
        contextAfter.push(clean);
        if (contextAfter.length >= 3) flushBlock();
      }
    } else if (!trimmed) {
      if (searchLines.length || replaceLines.length) flushBlock();
    } else {
      flushBlock();
      inHunk = false;
      if (isLikelyFilePath(trimmed)) {
        currentFile = trimmed;
        inHunk = true;
      }
    }
  }

  flushBlock();
  return blocks;
}

/**
 * Punto de entrada principal.
 * @param {string} rawText — output crudo del modelo
 * @returns {{ format: string, blocks: PatchBlock[] }}
 */

/**
 * Parsea formato git merge conflict generado por modelos locales.
 * <<<<<<< HEAD (o cualquier texto)
 * contenido original
 * =======
 * contenido nuevo
 * >>>>>>> hash (o cualquier texto)
 */
function parseMergeConflict(text, filepath = '') {
  const blocks = [];

  // Extraer filepath si hay línea "Archivo:" antes del bloque
  const fileRegex = /Archivo:\s*(.+?)\r?\n/;
  const fileMatch = fileRegex.exec(text);
  const detectedPath = fileMatch ? fileMatch[1].trim() : filepath;

  const blockRegex =
    /<<<<<<< [^\n]*\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> [^\n]*/g;
  let match;

  while ((match = blockRegex.exec(text)) !== null) {
    const searchContent = match[1].trim();
    const replaceContent = match[2].trim();
    if (!searchContent && !replaceContent) continue;
    blocks.push({
      filepath: detectedPath,
      searchContent,
      replaceContent,
      format: 'merge_conflict',
    });
  }

  return blocks;
}

function parsePatch(rawText) {
  const text = String(rawText || '');
  const format = detectFormat(text);

  console.log(`[patch.parser] formato detectado: ${format}`);

  console.log('[patch.parser] has SEARCH marker:', /<<<<<<</m.test(text));
  console.log('[patch.parser] has =======:', /=======/m.test(text));
  console.log('[patch.parser] has REPLACE marker:', />>>>>>>/m.test(text));
  console.log('[patch.parser] first 200 chars:', JSON.stringify(text.slice(0, 200)));

  if (format === 'search_replace') {
    const blocks = parseSearchReplace(text);
    console.log(`[patch.parser] bloques extraídos: ${blocks.length}`);
    return { format, blocks };
  }

  if (format === 'merge_conflict') {
    const blocks = parseMergeConflict(text);
    console.log(`[patch.parser] bloques merge_conflict extraídos: ${blocks.length}`);
    return { format, blocks };
  }

  if (format === 'unified_diff') {
    const blocks = transpileGitDiff(text);
    console.log(`[patch.parser] bloques transpilados: ${blocks.length}`);
    return { format, blocks };
  }

  console.log('[patch.parser] sin formato reconocido');
  return { format: 'none', blocks: [] };
}

module.exports = { parsePatch, detectFormat };