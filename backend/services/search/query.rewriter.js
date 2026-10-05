// backend/services/search/query.rewriter.js
'use strict';

// ─── CONSULTA DE BÚSQUEDA ESCRITA POR EL MODELO ───────────────────────────────
// El buscador recibe una sola frase y no ve el chat. Para que una pregunta de
// seguimiento ("dame su nombre completo") busque lo que el usuario quiere
// decir, antes de buscar se le pide al modelo ya cargado que escriba la
// consulta leyendo los mensajes anteriores del usuario. Es lo que hacen los
// asistentes comerciales; pegar palabras sueltas del historial (la vía de
// respaldo, buildContextualQuery) deja la consulta sucia y trae resultados
// peores. Ver DECISIONS.md.
//
// Al modelo se le pasan SOLO los mensajes del usuario, nunca sus propias
// respuestas: si se equivocó antes, su error entraría a la consulta y la
// búsqueda lo devolvería "confirmado".
//
// Si el modelo no se puede usar o devuelve algo que no sirve, se cae a la
// vía de respaldo. La búsqueda nunca depende de que esto salga bien.

const llamaProvider = require('../localai/llama.provider');
const {
  buildContextualQuery,
  stripSearchCommands,
  contentKeywords,
  plainToken
} = require('./search.service');

const MAX_PREVIOUS_MESSAGES = 4;
const MAX_PREVIOUS_CHARS = 200;
const MAX_MESSAGE_CHARS = 300;
const MAX_QUERY_CHARS = 150;
const MAX_QUERY_WORDS = 16;
const MAX_NEW_KEYWORDS = 2;
const REWRITE_CONTEXT_SIZE = 1024;
const REWRITE_MAX_TOKENS = 32;

// Mismo criterio que generateTitleFromText() en localai.service.js: con estos
// modelos cargados casi no queda VRAM libre para un segundo contexto, y los de
// código o visión no son buenos escribiendo consultas.
const UNSUITABLE_MODEL = /14b|llava|vl-7b|deepseek/i;

const SYSTEM_PROMPT = [
  'Tu tarea es convertir el último mensaje del usuario en una consulta para un buscador web.',
  'Usa los mensajes anteriores solo para saber de qué tema se habla. Si el último mensaje cambia de tema, ignora los anteriores.',
  'Responde únicamente con la consulta: una sola línea, sin comillas, sin explicación, máximo 10 palabras.',
  'No respondas la pregunta y no agregues nombres ni datos que el usuario no haya escrito.',
  '',
  'Ejemplo 1',
  'Mensajes anteriores del usuario:',
  '- quiero comprar una laptop para programar',
  'Último mensaje: y cuanto cuesta',
  'Consulta: precio laptop para programar',
  '',
  'Ejemplo 2',
  'Mensajes anteriores del usuario:',
  '- háblame de la torre eiffel',
  'Último mensaje: cual es el clima en tokio hoy',
  'Consulta: clima Tokio hoy'
].join('\n');

function canUseModel(provider) {
  try {
    if (provider.getStatus().status !== 'ready') return false;
    const activeModel = provider.getActiveModel() || '';
    return activeModel !== '' && !UNSUITABLE_MODEL.test(activeModel);
  } catch (_) {
    return false;
  }
}

function cleanModelQuery(raw) {
  const firstLine = String(raw || '')
    .split('\n')
    .map(line => line.trim())
    .find(line => line !== '') || '';
  return firstLine
    .replace(/^(?:consulta|query|b[uú]squeda)\s*:\s*/i, '')
    .replace(/^["'“”«»`]+|["'“”«»`.]+$/g, '')
    .trim();
}

// Dos palabras cuentan como la misma si una es el comienzo de la otra:
// cubre correcciones de tecleo ("marin" → "marine") y plurales.
function sameWord(a, b) {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 4 && longer.startsWith(shorter);
}

// La consulta del modelo se acepta solo si es corta y está hecha, casi por
// completo, con palabras que el usuario escribió. Si trae varias palabras que
// el usuario nunca usó, el modelo contestó o inventó en vez de reescribir.
function isUsableQuery(query, userTexts) {
  if (query.length < 3 || query.length > MAX_QUERY_CHARS) return false;
  if (query.split(/\s+/).length > MAX_QUERY_WORDS) return false;

  const queryKeywords = contentKeywords(query).map(plainToken);
  if (queryKeywords.length === 0) return false;

  const userKeywords = userTexts.flatMap(text => contentKeywords(text).map(plainToken));
  const newKeywords = queryKeywords.filter(k => !userKeywords.some(u => sameWord(k, u)));
  if (newKeywords.length === queryKeywords.length) return false;
  return newKeywords.length <= MAX_NEW_KEYWORDS;
}

/**
 * @param {object} params
 * @param {string} params.message                — mensaje actual del usuario
 * @param {string[]} params.previousUserMessages — mensajes anteriores del usuario en este chat, del más viejo al más nuevo
 * @param {object} [params.provider]             — proveedor del modelo (inyectable para pruebas)
 * @returns {Promise<{ query: string, source: 'message'|'keywords'|'model' }>}
 */
async function resolveSearchQuery({ message, previousUserMessages = [], provider = llamaProvider }) {
  const current = stripSearchCommands(message);
  const previous = (Array.isArray(previousUserMessages) ? previousUserMessages : [])
    .filter(m => typeof m === 'string' && m.trim() !== '')
    .slice(-MAX_PREVIOUS_MESSAGES)
    .map(m => stripSearchCommands(m));

  // Sin mensajes anteriores no hay nada que resolver: se busca el mensaje,
  // ya sin las órdenes.
  if (previous.length === 0) return { query: current, source: 'message' };

  const fallback = { query: buildContextualQuery(current, previous), source: 'keywords' };
  if (!canUseModel(provider)) return fallback;

  const userPrompt = [
    'Mensajes anteriores del usuario:',
    ...previous.map(m => `- ${m.slice(0, MAX_PREVIOUS_CHARS)}`),
    `Último mensaje: ${current.slice(0, MAX_MESSAGE_CHARS)}`,
    'Consulta:'
  ].join('\n');

  try {
    const raw = await provider.generate(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      { temperature: 0, maxTokens: REWRITE_MAX_TOKENS, contextSize: REWRITE_CONTEXT_SIZE }
    );
    const query = cleanModelQuery(raw);
    if (isUsableQuery(query, [current, ...previous])) return { query, source: 'model' };
    console.warn(`[WEB SEARCH] consulta del modelo descartada: "${query.slice(0, 80)}"`);
  } catch (err) {
    console.warn('[WEB SEARCH] no se pudo reescribir la consulta con el modelo:', err.message);
  }
  return fallback;
}

module.exports = { resolveSearchQuery };
