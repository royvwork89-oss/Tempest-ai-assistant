'use strict';

// Búsqueda por fragmentos dentro de UN documento del chat. Módulo puro: sin
// disco, sin modelo, sin GPU. Parte el texto en fragmentos con rango exacto de
// caracteres, los ordena contra la pregunta con BM25 y elige los mejores más
// sus vecinos. No usa embeddings a propósito: nomic-embed rinde mal en español
// y no hace falta para encontrar términos que el texto sí contiene.
//
// Contrato: cada fragmento devuelve { index, start, end, text } con
// text === fullText.slice(start, end). Quien arma el prompt usa start/end para
// decirle al modelo EXACTAMENTE qué partes recibió.

const TARGET_CHUNK_CHARS = 1400;
const HARD_CHUNK_CHARS = 2200;
const MIN_SCORE_RATIO = 0.4;
const MAX_RANKED = 4;

const STOPWORDS = new Set((
  'el la los las un una unos unas de del al a en y o u que qué es son se su sus lo le les me mi te tu ' +
  'por para con sin sobre como cómo más mas pero si sí no ya muy hay este esta esto ese esa eso ' +
  'dice dicen habla hablame háblame cuenta documento archivo texto quiero conocer fondo mucho poco ' +
  'tambien también donde dónde cuando cuándo cual cuál quien quién algo todo todos ' +
  'menciona mencionan dime dinos explica explicame pasa paso ocurre ocurren trata tratan significa ' +
  'existe existen aparece aparecen cosa cosas ademas segun puedes puedo favor entonces'
).split(/\s+/));

// Preguntas sobre el documento ENTERO: no hay palabras que buscar, así que la
// búsqueda devolvería fragmentos al azar. Para estas no se usan fragmentos y
// sigue el comportamiento de antes (completo si cabe, principio y final si no).
// Se resuelven bien con la "ficha" de la Etapa 2 (pendiente).
const GLOBAL_QUESTION_RE = /\b(resum[eiao]\w*|enlist\w*|list[aeo]\w*|temas?|puntos? (principales|clave)|de que (trata|habla|va)|todo el (documento|texto|archivo)|en general|analiza (ese|este|el) (documento|texto|archivo))\b/i;

function isGlobalQuestion(query) {
  return GLOBAL_QUESTION_RE.test(normalize(query || ''));
}

// ¿El mensaje parece una pregunta sobre el contenido? Sirve para no tratar un
// "hola" o un "gracias" como una búsqueda fallida. Son palabras de pregunta, no
// de tema: no dependen de qué documento haya ni de qué se le pregunte.
const DOC_QUESTION_RE = /\b(que|quien|quienes|cual|cuales|como|donde|cuando|cuanto|cuanta|cuantos|cuantas|por que|dice|dicen|menciona|mencionan|habla|hablan|aparece|aparecen|existe|existen|hay|segun|documento|texto|archivo)\b/;

function looksLikeDocQuestion(message) {
  const text = String(message || '');
  return /[¿?]/.test(text) || DOC_QUESTION_RE.test(normalize(text));
}

function normalize(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const SMALLTALK_WORDS = new Set((
  'hola holi buenas buenos buen dia dias tarde tardes noche noches gracias muchas adios hasta luego ' +
  'saludos hey ok okay vale perfecto genial listo chao bye que tal como estas'
).split(/\s+/));

function isSmallTalk(message) {
  const text = String(message || '');
  if (/[¿?]/.test(text)) return false;
  const words = normalize(text).split(/[^a-z0-9ñ]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => SMALLTALK_WORDS.has(w));
}

function stem(w) {
  return w.length > 4 ? w.replace(/(es|s)$/, '') : w;
}

function tokenize(s) {
  return normalize(s)
    .split(/[^a-z0-9ñ]+/)
    // También filtra por la raíz, para que el plural de una stopword
    // ("documentos", "archivos", "textos") no cuente como palabra con
    // contenido (bug del 26/11: "documentos" salía como "palabra
    // ausente" en el aviso de fragmentos, con el caso de dos documentos).
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !STOPWORDS.has(stem(w)))
    .map(stem);
}

// Palabras con contenido de una pregunta: la palabra como la escribió el usuario
// y su raíz (la misma que usa la búsqueda). Sin repetidas.
function queryWords(query) {
  const seen = new Set();
  const words = [];
  for (const raw of String(query || '').split(/[^\p{L}\p{N}]+/u)) {
    if (!raw) continue;
    const stemmed = tokenize(raw)[0];
    if (!stemmed || seen.has(stemmed)) continue;
    seen.add(stemmed);
    words.push({ word: raw.toLowerCase(), stem: stemmed });
  }
  return words;
}

// Qué palabras de la pregunta NO aparecen en ninguna parte del texto completo.
// Es un hecho comprobado, no una opinión del modelo. Busca por palabra: un
// sinónimo o una variante distinta de la transcripción cuenta como ausente.
function findMissingWords(text, query) {
  const words = queryWords(query);
  if (words.length === 0) return { words, missing: [], allMissing: false };
  const present = new Set(tokenize(text));
  const missing = words.filter((w) => !present.has(w.stem));
  return { words, missing, allMissing: missing.length === words.length };
}

// Parte el texto en fragmentos de ~TARGET_CHUNK_CHARS respetando líneas en blanco
// y, si un bloque no tiene ninguna, líneas simples; como último recurso corta
// duro. Cubre el texto completo sin huecos ni solapes.
function splitIntoChunks(text, target = TARGET_CHUNK_CHARS) {
  const chunks = [];
  if (!text) return chunks;

  const pieces = [];
  const paragraphRe = /[^\n]*(?:\n\s*\n|$)/g;
  let m;
  let last = 0;
  while ((m = paragraphRe.exec(text)) !== null) {
    if (m[0].length === 0) { paragraphRe.lastIndex++; if (paragraphRe.lastIndex > text.length) break; continue; }
    pieces.push([m.index, m.index + m[0].length]);
    last = m.index + m[0].length;
  }
  if (last < text.length) pieces.push([last, text.length]);

  const expanded = [];
  for (const [s, e] of pieces) {
    if (e - s <= HARD_CHUNK_CHARS) { expanded.push([s, e]); continue; }
    let cur = s;
    while (cur < e) {
      let cut = Math.min(cur + target, e);
      if (cut < e) {
        const nl = text.lastIndexOf('\n', cut);
        const dot = text.lastIndexOf('. ', cut);
        const best = Math.max(nl, dot >= 0 ? dot + 1 : -1);
        if (best > cur + target / 2) cut = best + 1;
      }
      expanded.push([cur, cut]);
      cur = cut;
    }
  }

  let start = null;
  let end = null;
  const flush = () => {
    if (start === null) return;
    const raw = text.slice(start, end);
    if (raw.trim().length > 0) chunks.push({ index: chunks.length, start, end, text: raw });
    start = null;
    end = null;
  };
  for (const [s, e] of expanded) {
    if (start === null) { start = s; end = e; continue; }
    if (end - start + (e - s) > target) { flush(); start = s; end = e; }
    else end = e;
  }
  flush();
  return chunks;
}

// BM25 sobre los fragmentos. Devuelve [{index, score}] con score > 0, de mayor a menor.
function rankChunks(chunks, query) {
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0 || chunks.length === 0) return { ranked: [], queryTerms };

  const docs = chunks.map((c) => tokenize(c.text));
  const N = docs.length;
  const avgLen = docs.reduce((a, d) => a + d.length, 0) / N || 1;
  const df = new Map();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) || 0) + 1);

  const ranked = [];
  docs.forEach((d, i) => {
    const counts = new Map();
    for (const t of d) counts.set(t, (counts.get(t) || 0) + 1);
    let score = 0;
    for (const t of queryTerms) {
      const tf = counts.get(t);
      if (!tf) continue;
      const n = df.get(t);
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * d.length / avgLen));
    }
    if (score > 0) ranked.push({ index: i, score });
  });
  ranked.sort((a, b) => b.score - a.score);
  return { ranked, queryTerms };
}

/**
 * Elige fragmentos para una pregunta.
 * @param {Array} chunks - de splitIntoChunks
 * @param {string} query
 * @param {Object} opts
 * @param {number} opts.budgetChars - máximo de caracteres de texto a enviar
 * @param {number[]} [opts.previousIndexes] - fragmentos enviados en el turno anterior
 * @returns {{indexes:number[], source:'query'|'previous'|'none', queryTerms:string[]}}
 */
function pickFragments(chunks, query, { budgetChars, previousIndexes = [] } = {}) {
  if (isGlobalQuestion(query)) return { indexes: [], source: 'none', queryTerms: [] };
  const { ranked, queryTerms } = rankChunks(chunks, query);
  const valid = (previousIndexes || []).filter((i) => Number.isInteger(i) && i >= 0 && i < chunks.length);
  const chars = (i) => chunks[i].text.length;

  let base = [];
  let source = 'none';

  if (ranked.length > 0) {
    const top = ranked[0].score;
    base = ranked.filter((r) => r.score >= top * MIN_SCORE_RATIO).slice(0, MAX_RANKED).map((r) => r.index);
    source = 'query';
  } else if (queryTerms.length === 0 && valid.length > 0) {
    base = valid.slice();
    source = 'previous';
  }
  if (base.length === 0) return { indexes: [], source: 'none', queryTerms };

  const chosen = new Set();
  let used = 0;
  for (const i of base) {
    if (chosen.has(i)) continue;
    if (chosen.size > 0 && used + chars(i) > budgetChars) continue;
    chosen.add(i);
    used += chars(i);
  }

  // Al reutilizar los del turno anterior no se agregan vecinos: esos fragmentos
  // ya los incluían la vez pasada. Con dos o más fragmentos que coinciden
  // tampoco: los vecinos sin la palabra buscada distraen al modelo.
  const addNeighbors = source !== 'previous' && chosen.size < 2;
  for (const i of addNeighbors ? [...chosen] : []) {
    for (const n of [i + 1, i - 1]) {
      if (n < 0 || n >= chunks.length || chosen.has(n)) continue;
      if (used + chars(n) > budgetChars) continue;
      chosen.add(n);
      used += chars(n);
    }
  }

  return { indexes: [...chosen].sort((a, b) => a - b), source, queryTerms };
}

// ¿Esta pregunta encontraría algo en este texto? Barato; sirve para decidir antes
// de elegir modelo si hace falta la ventana ampliada.
function hasUsableMatch(text, query, previousIndexes = []) {
  if (isGlobalQuestion(query)) return false;
  const chunks = splitIntoChunks(text);
  const { ranked, queryTerms } = rankChunks(chunks, query);
  if (ranked.length > 0) return true;
  return queryTerms.length === 0 && (previousIndexes || []).length > 0;
}

module.exports = {
  TARGET_CHUNK_CHARS,
  tokenize,
  isGlobalQuestion,
  looksLikeDocQuestion,
  isSmallTalk,
  queryWords,
  findMissingWords,
  splitIntoChunks,
  rankChunks,
  pickFragments,
  hasUsableMatch,
};
