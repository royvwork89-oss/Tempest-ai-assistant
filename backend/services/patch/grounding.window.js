'use strict';

const MAX_CHARS_BY_PROFILE = { desktop: 2300, laptop: 2000 };
const DEFAULT_MAX_CHARS = 2000;
const EXACT_NAME_BONUS = 5;

const STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'un', 'al', 'es', 'lo', 'se', 'su', 'mi', 'tu', 'no', 'si', 'ya', 'me', 'te', 'le', 'to', 'in', 'of', 'is', 'it', 'an',
  'los', 'las', 'del', 'una', 'uno', 'unos', 'unas', 'que', 'con', 'por', 'para', 'como', 'cuando', 'donde',
  'esta', 'este', 'esto', 'ese', 'esa', 'eso', 'sus', 'mis', 'tus', 'sin', 'sobre', 'entre', 'hacia', 'hasta',
  'funcion', 'metodo', 'clase', 'archivo', 'archivos', 'codigo', 'linea', 'lineas', 'bloque', 'parte',
  'the', 'and', 'for', 'with', 'function', 'method', 'class', 'file', 'that', 'this', 'from', 'into'
]);

const GENERIC_VERBS = new Set([
  'agrega', 'agregar', 'agregale', 'anade', 'anadir', 'cambia', 'cambiar', 'cambiale', 'modifica', 'modificar',
  'corrige', 'corregir', 'arregla', 'arreglar', 'actualiza', 'actualizar', 'quita', 'quitar', 'pon', 'poner',
  'add', 'change', 'modify', 'fix', 'update', 'remove'
]);

const NOT_A_DECLARATION = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'else', 'do', 'with', 'try',
  'await', 'new', 'typeof', 'delete', 'void', 'throw', 'super', 'import', 'require'
]);

const DECLARATION_PATTERNS = [
  { kind: 'callable', re: /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/ },
  { kind: 'callable', re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/ },
  { kind: 'class', re: /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'callable', re: /^\s*(?:async\s+|static\s+|get\s+|set\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{\s*$/ },
  { kind: 'python', re: /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/ }
];

function getGroundingMaxChars(hardwareProfile) {
  return MAX_CHARS_BY_PROFILE[hardwareProfile] || DEFAULT_MAX_CHARS;
}

function fold(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function messageTokens(userMessage) {
  const withoutPaths = String(userMessage || '').replace(/[\w./\\-]+\.[A-Za-z]{1,5}\b/g, ' ');
  const folded = fold(withoutPaths);
  const describing = new Set((folded.match(/\bque\s+[a-z0-9]+/g) || []).map(match => match.split(/\s+/)[1]));
  const tokens = folded
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 2 && !STOPWORDS.has(t) && (!GENERIC_VERBS.has(t) || describing.has(t)));
  return [...new Set(tokens)];
}

function nameWords(name) {
  return fold(name.replace(/([a-z0-9])([A-Z])/g, '$1 $2')).split(/[^a-z0-9]+/).filter(Boolean);
}

function wordsMatch(token, word) {
  if (token === word) return true;
  const shorter = Math.min(token.length, word.length);
  let prefix = 0;
  while (prefix < shorter && token[prefix] === word[prefix]) prefix++;
  return prefix >= 4 && prefix >= shorter - 2;
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function isBlank(line) {
  return line.trim() === '';
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function withLeadingComments(lines, line) {
  let start = line;
  while (start > 0 && /^\s*(\/\/|\/\*|\*|#|@)/.test(lines[start - 1])) start--;
  return start;
}

function columnAfterParams(line) {
  const open = line.indexOf('(');
  if (open === -1) return 0;
  let depth = 0;
  for (let i = open; i < line.length; i++) {
    if (line[i] === '(') depth++;
    else if (line[i] === ')') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return 0;
}

function braceBlockEnd(lines, startLine, startColumn) {
  let depth = 0;
  let opened = false;
  let state = null;
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (let j = i === startLine ? startColumn : 0; j < line.length; j++) {
      const ch = line[j];
      if (state === 'block') {
        if (ch === '*' && line[j + 1] === '/') { state = null; j++; }
        continue;
      }
      if (state) {
        if (ch === '\\') { j++; continue; }
        if (ch === state) state = null;
        continue;
      }
      if (ch === '/' && line[j + 1] === '/') break;
      if (ch === '/' && line[j + 1] === '*') { state = 'block'; j++; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { state = ch; continue; }
      if (ch === '{') { depth++; opened = true; }
      else if (ch === '}') {
        depth--;
        if (opened && depth <= 0) return i + 1;
      }
    }
    if (state === '"' || state === "'") state = null;
  }
  return -1;
}

function indentBlockEnd(lines, startLine) {
  const base = indentOf(lines[startLine]);
  for (let i = startLine + 1; i < lines.length; i++) {
    if (isBlank(lines[i])) continue;
    if (indentOf(lines[i]) <= base) {
      return /^\s*[}\])]/.test(lines[i]) ? i + 1 : i;
    }
  }
  return lines.length;
}

function findDeclarations(lines, relPath) {
  const isPython = /\.py$/i.test(relPath || '');
  const declarations = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line) || /^\s*(\/\/|\/\*|\*|#)/.test(line)) continue;
    for (const { kind, re } of DECLARATION_PATTERNS) {
      const match = re.exec(line);
      if (!match || NOT_A_DECLARATION.has(match[1])) continue;
      if (kind === 'python' && !isPython) continue;
      if (isPython && kind !== 'python' && kind !== 'class') continue;

      let end = -1;
      if (!isPython) {
        end = braceBlockEnd(lines, i, kind === 'callable' ? columnAfterParams(line) : 0);
      }
      if (end === -1 || end <= i) end = indentBlockEnd(lines, i);
      while (end > i + 1 && isBlank(lines[end - 1])) end--;

      declarations.push({
        name: match[1],
        line: i,
        start: withLeadingComments(lines, i),
        end,
        words: nameWords(match[1])
      });
      break;
    }
  }
  return declarations;
}

function pickDeclaration(declarations, userMessage) {
  if (declarations.length === 0) return null;
  const tokens = messageTokens(userMessage);
  const scores = new Array(declarations.length).fill(0);

  for (const token of tokens) {
    const matching = [];
    declarations.forEach((d, index) => {
      if (d.words.some(word => wordsMatch(token, word))) matching.push(index);
    });
    for (const index of matching) scores[index] += 1 / matching.length;
  }

  declarations.forEach((d, index) => {
    const mention = new RegExp(`(^|[^\\w$])${escapeRegExp(d.name)}([^\\w$]|$)`, 'i');
    if (mention.test(String(userMessage || ''))) scores[index] += EXACT_NAME_BONUS;
  });

  let best = -1;
  scores.forEach((score, index) => {
    if (score > 0 && (best === -1 || score > scores[best])) best = index;
  });
  return best === -1 ? null : declarations[best];
}

function sizeOf(lines, from, to) {
  let size = 0;
  for (let i = from; i < to; i++) size += lines[i].length + 1;
  return size;
}

function takeFromStart(lines, from, maxChars) {
  let to = from;
  let size = 0;
  while (to < lines.length && (to === from || size + lines[to].length + 1 <= maxChars)) {
    size += lines[to].length + 1;
    to++;
  }
  return { from, to };
}

function buildGroundingWindow({ content, userMessage, maxChars, relPath = '' }) {
  if (content.length <= maxChars) {
    return { text: content, truncated: false, strategy: 'full', target: null, complete: true };
  }

  const lines = content.split('\n');
  const picked = pickDeclaration(findDeclarations(lines, relPath), userMessage);

  if (!picked) {
    const { from, to } = takeFromStart(lines, 0, maxChars);
    return { text: lines.slice(from, to).join('\n'), truncated: true, strategy: 'start', target: null, complete: false };
  }

  let from = picked.start;
  let to = picked.end;
  let complete = true;

  if (sizeOf(lines, from, to) > maxChars) {
    ({ from, to } = takeFromStart(lines, from, maxChars));
    complete = false;
  }

  return {
    text: lines.slice(from, to).join('\n'),
    truncated: true,
    strategy: 'function',
    target: picked.name,
    complete
  };
}

module.exports = { buildGroundingWindow, getGroundingMaxChars };
