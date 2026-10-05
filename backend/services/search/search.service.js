// backend/services/search/search.service.js
const fs   = require('fs');
const path = require('path');

const searxngProvider = require('./providers/searxng.provider');
const braveProvider   = require('./providers/brave.provider');
const tavilyProvider  = require('./providers/tavily.provider');
const { DATA_DIR } = require('../../config/appPaths');

const CONFIG_PATH = path.join(DATA_DIR, 'search-config.json');

const PROVIDERS = {
  searxng: searxngProvider,
  brave:   braveProvider,
  tavily:  tavilyProvider
};

// require perezoso — evita cualquier riesgo de dependencia circular al
// cargar el módulo (auth.service no requiere search.service).
function _auth() {
  try { return require('../auth.service'); } catch { return {}; }
}

// ─── ESQUEMA ────────────────────────────────────────────────────────────────
// {
//   profiles:    { [profileId]: { name, globalEnabled, providers } },
//   userConfigs: { [username]:  { globalEnabled, providers } }   // solo usuarios "sin perfil"
// }
//
// "global" es un perfil más dentro de `profiles` — no un caso especial. Cada
// perfil (incluido global) y cada usuario sin perfil tiene su propio registro
// de providers/apiKeys, completamente independiente. Ver DECISIONS.md →
// "Hoja de ruta para el creador de perfiles" para la especificación completa.

function getDefaultProviders() {
  return {
    searxng: { enabled: false, url: 'http://localhost:8081' },
    brave:   { enabled: false, apiKey: '' },
    tavily:  { enabled: false, apiKey: '' }
  };
}

function getDefaultRecord(name) {
  return { name, globalEnabled: false, providers: getDefaultProviders() };
}

function _isLegacyShape(raw) {
  // Esquema viejo: { globalEnabled, providers } en la raíz, sin `profiles`.
  return !!(raw && typeof raw === 'object' && !raw.profiles && raw.providers);
}

function _migrateLegacyConfig(raw) {
  const cfg = {
    profiles: {
      global: {
        name: 'Perfil Global',
        globalEnabled: raw.globalEnabled ?? false,
        providers: raw.providers ?? getDefaultProviders()
      }
    },
    userConfigs: {}
  };

  // Usuarios que ya estaban "sin perfil" heredaban de facto la config global
  // filtrada por su allow-list (`searchProviders`). Migrarlos a un registro
  // propio con esos mismos valores como punto de partida — de ahí en
  // adelante son completamente independientes.
  try {
    const { listUsers } = _auth();
    const users = listUsers ? listUsers() : [];
    for (const u of users) {
      const profileId = u.profileId ?? 'none';
      if (profileId !== 'none') continue; // con perfil → no necesita registro propio

      const allowed = u.searchProviders; // null = todos, [] = ninguno, array = lista
      const providers = getDefaultProviders();
      for (const [name, base] of Object.entries(raw.providers ?? {})) {
        const isAllowed = allowed === null || allowed === undefined || allowed.includes(name);
        providers[name] = { ...base, enabled: !!base.enabled && isAllowed };
      }
      cfg.userConfigs[u.username] = {
        globalEnabled: u.searchEnabled !== false,
        providers
      };
    }
  } catch (e) {
    console.warn('[search] No se pudo migrar configs de usuarios sin perfil:', e.message);
  }

  return cfg;
}

function loadFullConfig() {
  let raw = null;
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('[search] No se pudo leer search-config.json:', e.message);
  }

  if (!raw) {
    const fresh = { profiles: { global: getDefaultRecord('Perfil Global') }, userConfigs: {} };
    saveFullConfig(fresh);
    return fresh;
  }

  if (_isLegacyShape(raw)) {
    const migrated = _migrateLegacyConfig(raw);
    saveFullConfig(migrated);
    console.log('[search] search-config.json migrado al esquema de perfiles/usuarios independientes');
    return migrated;
  }

  // Blindaje — asegurar que siempre exista al menos el perfil global.
  if (!raw.profiles) raw.profiles = {};
  if (!raw.profiles.global) raw.profiles.global = getDefaultRecord('Perfil Global');
  if (!raw.userConfigs) raw.userConfigs = {};
  return raw;
}

function saveFullConfig(cfg) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// ─── ACCESO A REGISTROS (perfil o usuario sin perfil) ───────────────────────

function listProfiles(cfg = loadFullConfig()) {
  return Object.entries(cfg.profiles).map(([id, rec]) => ({
    id,
    name: rec.name || id,
    globalEnabled: !!rec.globalEnabled
  }));
}

function getProfileRecord(profileId, cfg = loadFullConfig()) {
  return cfg.profiles[profileId] || null;
}

function getUserRecord(username, cfg = loadFullConfig()) {
  return cfg.userConfigs[username] || null;
}

function createProfile(name) {
  const cfg = loadFullConfig();
  const base = (name || 'perfil').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'perfil';
  let id = base;
  let n = 2;
  while (cfg.profiles[id]) { id = `${base}-${n}`; n++; }
  cfg.profiles[id] = getDefaultRecord(name || id);
  saveFullConfig(cfg);
  return { id, name: cfg.profiles[id].name };
}

function deleteProfile(profileId) {
  if (profileId === 'global') throw new Error('No se puede eliminar el Perfil Global');
  const cfg = loadFullConfig();
  if (!cfg.profiles[profileId]) throw new Error('Perfil no encontrado');
  delete cfg.profiles[profileId];
  saveFullConfig(cfg);

  // Usuarios que tenían este perfil asignado quedan "sin perfil" — nunca
  // heredan silenciosamente otro perfil.
  try {
    const { reassignProfileUsers } = _auth();
    reassignProfileUsers?.(profileId, 'none');
  } catch (e) {
    console.warn('[search] No se pudo reasignar usuarios tras eliminar perfil:', e.message);
  }
}

function saveRecord({ type, id, name, globalEnabled, providers }) {
  if (!['profile', 'user'].includes(type)) throw new Error('type debe ser "profile" o "user"');
  if (!id) throw new Error('Falta id');

  const cfg = loadFullConfig();
  const bucket = type === 'profile' ? cfg.profiles : cfg.userConfigs;
  const existing = bucket[id] || getDefaultRecord(type === 'profile' ? id : undefined);

  const merged = {
    ...(type === 'profile' ? { name: name ?? existing.name ?? id } : {}),
    globalEnabled: typeof globalEnabled === 'boolean' ? globalEnabled : existing.globalEnabled,
    providers: { ...existing.providers }
  };

  if (providers && typeof providers === 'object') {
    for (const [pname, pcfg] of Object.entries(providers)) {
      if (merged.providers[pname]) {
        merged.providers[pname] = { ...merged.providers[pname], ...pcfg };
      }
    }
  }

  bucket[id] = merged;
  saveFullConfig(cfg);
  return merged;
}

// ─── RESOLUCIÓN POR IDENTIDAD REAL (usada en runtime de chat) ───────────────

function getEffectiveRecord(username) {
  const cfg = loadFullConfig();
  if (!username) return cfg.profiles.global;

  const { listUsers } = _auth();
  const users = listUsers ? listUsers() : [];
  const user = users.find(u => u.username === username);
  const profileId = user?.profileId ?? 'none';

  if (profileId !== 'none') {
    // Perfil asignado (incluye 'global') — si el perfil fue borrado y el
    // usuario aún no fue reasignado, cae a un registro vacío/deshabilitado
    // en vez de heredar silenciosamente otro perfil.
    return cfg.profiles[profileId] || getDefaultRecord(profileId);
  }

  // Sin perfil — registro propio, independiente de todo lo demás.
  return cfg.userConfigs[username] || getDefaultRecord();
}

function getEnabledProviders(record) {
  if (!record?.providers) return [];
  return Object.entries(record.providers)
    .filter(([, cfg]) => cfg.enabled)
    .map(([name]) => name);
}

// ─── BÚSQUEDA REAL ────────────────────────────────────────────────────────
// `username` identifica quién está preguntando — resuelve la key/URL del
// registro correcto (perfil asignado o config propia sin perfil). Sin
// username cae al Perfil Global (compatibilidad con llamadas internas que
// no tienen contexto de usuario).
// BUG REAL, encontrado en pruebas de v3.0.0 (ver ROADMAP.md → "Búsqueda
// web"): esta función devolvía un array vacío tanto si la búsqueda nunca se
// intentó (proveedor deshabilitado) como si se intentó y FALLÓ (ej.
// SearXNG sin contenedor Docker levantado → fetch rechaza la conexión). En
// chat.controller.js las dos cosas eran indistinguibles: el chat quedaba
// con `resultCount: 0` sin más contexto, y el modelo respondía con
// conocimiento de entrenamiento desactualizado sin avisar al usuario que la
// búsqueda había fallado. Se reprodujo en vivo con "cuál es la versión más
// reciente de node?" respondida sin aviso de desactualización.
//
// Fix (con alcance acotado — NO se agrega auto-arranque del contenedor de
// SearXNG, eso queda documentado en ROADMAP.md como mejora aparte): la
// función ahora devuelve `{ results, error }`. `error` es `null` cuando la
// búsqueda ni se intentó (deshabilitada) o se intentó y funcionó — y trae el
// mensaje del fallo cuando se intentó y el provider tiró excepción. El
// llamador (chat.controller.js) usa ese campo para avisarle honestamente al
// modelo que no pudo buscar, en vez de dejarlo responder como si la
// búsqueda nunca se hubiera pedido.
// ─── UN RESULTADO POR SITIO ───────────────────────────────────────────────────
// Los buscadores suelen devolver varias páginas del mismo sitio (caso real:
// de 5 resultados sobre el clima, 4 eran de la misma empresa). Al modelo le
// llegaban como fuentes separadas y las presentaba así, aunque fueran una
// sola. Se le pide de más al proveedor y acá se conserva la primera página
// de cada sitio — la mejor rankeada —, hasta MAX_PAGES_FOR_MODEL.
//
// Un resultado sin URL (la respuesta directa que arma Tavily) no es una
// página: se conserva siempre y no cuenta para el tope. El tope es el mismo
// número de páginas que ya se le pasaba al modelo, para no agrandar el
// mensaje. Ver DECISIONS.md.
const MAX_PAGES_FOR_MODEL = 5;

// Sitio al que pertenece una URL: el dominio sin subdominios, para que
// "weather.yahoo.com" y "es.yahoo.com" cuenten como el mismo. Los dominios
// con sufijo de país compuesto ("gob.mx", "com.mx", "co.uk") llevan una
// etiqueta más.
function _siteKey(url) {
  try {
    const labels = new URL(url).hostname.toLowerCase().replace(/^www\./, '').split('.');
    if (labels.length <= 2) return labels.join('.');
    const last = labels[labels.length - 1];
    const secondLast = labels[labels.length - 2];
    const size = (last.length === 2 && secondLast.length <= 3) ? 3 : 2;
    return labels.slice(-size).join('.');
  } catch (_) {
    return '';
  }
}

function pickDistinctSites(results, maxPages = MAX_PAGES_FOR_MODEL) {
  const seen = new Set();
  const picked = [];
  let pages = 0;
  for (const result of Array.isArray(results) ? results : []) {
    const site = _siteKey(result?.url || '');
    if (!site) {
      picked.push(result);
      continue;
    }
    if (seen.has(site) || pages >= maxPages) continue;
    seen.add(site);
    picked.push(result);
    pages++;
  }
  return picked;
}

async function search(query, providerName, { username } = {}) {
  const record = getEffectiveRecord(username);

  if (!record?.globalEnabled) return { results: [], error: null };

  const providerCfg = record.providers?.[providerName];
  if (!providerCfg?.enabled) return { results: [], error: null };

  const provider = PROVIDERS[providerName];
  if (!provider) return { results: [], error: `Proveedor de búsqueda "${providerName}" no reconocido` };

  try {
    const received = await provider.search(query, providerCfg);
    return { results: pickDistinctSites(received), error: null, receivedCount: received.length };
  } catch (e) {
    console.error(`[search] Error en provider "${providerName}":`, e.message);
    return { results: [], error: e.message || String(e) };
  }
}

const INJECTION_PATTERNS = [
  /ignora\s+(tus\s+)?instrucciones/gi,
  /olvida\s+(todo|tus)/gi,
  /system[\s_-]*prompt/gi,
  /\[INST\]/g,
  /<\|system\|>/g,
  /<<SYS>>/g,
];

// Cuánto texto de cada resultado llega al modelo. Lo que el proveedor
// devuelva por encima de esto se corta. Depende del perfil de hardware:
// en desktop los modelos tienen contexto para recibir el fragmento completo
// que conserva el proveedor; en laptop el contexto es más chico y se manda
// la mitad. Un perfil desconocido usa el valor conservador.
const SNIPPET_MAX_CHARS = { desktop: 800, laptop: 400 };

function getSnippetMaxChars(hardwareProfile) {
  return SNIPPET_MAX_CHARS[hardwareProfile] || SNIPPET_MAX_CHARS.laptop;
}

function sanitizeSnippet(text, maxChars = SNIPPET_MAX_CHARS.laptop) {
  if (!text) return '';
  let clean = text;
  for (const p of INJECTION_PATTERNS) clean = clean.replace(p, '[contenido filtrado]');
  return clean.slice(0, maxChars);
}

// ─── CONSULTA CON CONTEXTO DEL CHAT ───────────────────────────────────────────
// El buscador no ve el historial: recibe una sola frase. Una pregunta de
// seguimiento ("revisa bien cómo se llama el protagonista") no nombra el tema
// del que se viene hablando y devuelve resultados que no sirven. Antes de
// buscar se le agregan a la consulta las palabras con contenido de los
// mensajes anteriores DEL USUARIO, que es donde se nombró el tema.
//
// Se usan solo los mensajes del usuario, nunca las respuestas del modelo: si
// el modelo se equivocó, su error entraría a la búsqueda y volvería
// confirmado por los resultados. Ver DECISIONS.md.
const QUERY_STOPWORDS = new Set([
  'a', 'al', 'algo', 'ante', 'asi', 'aun', 'bien', 'cada', 'como', 'con', 'cual', 'cuales',
  'cuando', 'cuanto', 'de', 'del', 'desde', 'donde', 'e', 'el', 'ella', 'ellas', 'ellos', 'en',
  'entre', 'era', 'es', 'esa', 'ese', 'eso', 'esta', 'estan', 'estas', 'este', 'esto', 'estos',
  'fue', 'ha', 'hace', 'hacia', 'han', 'hasta', 'hay', 'la', 'las', 'le', 'les', 'lo', 'los',
  'mas', 'me', 'mi', 'mis', 'muy', 'ni', 'no', 'nos', 'o', 'os', 'otra', 'otro', 'para', 'pero',
  'por', 'porque', 'que', 'quien', 'quienes', 'se', 'sea', 'ser', 'si', 'sin', 'sobre', 'son',
  'su', 'sus', 'tambien', 'te', 'ti', 'tu', 'tus', 'u', 'un', 'una', 'unas', 'uno', 'unos', 'y',
  'ya', 'yo',
  'hola', 'buenas', 'gracias', 'favor', 'porfa', 'porfavor', 'oye', 'quiero', 'quisiera',
  'puedes', 'podrias', 'puede', 'dime', 'dame', 'sabes', 'saber', 'necesito', 'ayuda', 'ayudame',
  'revisa', 'revisalo', 'checa', 'checalo', 'busca', 'buscalo', 'buscar', 'verifica',
  'investiga', 'consulta', 'internet', 'web', 'google', 'linea', 'online',
  'equivocaste', 'equivocas', 'equivocado', 'mal', 'error', 'incorrecto', 'correcto', 'seguro',
  'vez', 'nuevo', 'llama', 'llaman', 'dice', 'dijiste'
]);

const CONTEXT_MAX_MESSAGES = 4;
const CONTEXT_MAX_KEYWORDS = 10;
const CONTEXT_MAX_KEYWORDS_PER_MESSAGE = 6;
const CONTEXT_SELF_CONTAINED_KEYWORDS = 4;
const QUERY_MAX_CHARS = 380;

function _plainToken(token) {
  return token.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function _contentKeywords(text) {
  return String(text || '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .filter(token => {
      const plain = _plainToken(token);
      if (QUERY_STOPWORDS.has(plain)) return false;
      return plain.length > 1 || /\d/.test(plain);
    });
}

/**
 * @param {string} message                 — mensaje actual del usuario
 * @param {string[]} previousUserMessages  — mensajes anteriores del usuario en este chat, del más viejo al más nuevo
 * @returns {string} consulta a mandar al buscador
 */
function buildContextualQuery(message, previousUserMessages = []) {
  const current = String(message || '').trim();
  if (!current) return current;

  const currentKeywords = _contentKeywords(current);
  // Una pregunta con varias palabras de contenido ya trae su propio tema:
  // agregarle el del chat solo la ensucia. Las preguntas de seguimiento son
  // cortas ("y cuánto cuesta", "cómo se llama el protagonista").
  if (currentKeywords.length >= CONTEXT_SELF_CONTAINED_KEYWORDS) return current;

  const seen = new Set(currentKeywords.map(_plainToken));
  const recent = (Array.isArray(previousUserMessages) ? previousUserMessages : [])
    .filter(m => typeof m === 'string' && m.trim() !== '')
    .slice(-CONTEXT_MAX_MESSAGES);

  const context = [];
  for (const previous of recent) {
    let taken = 0;
    for (const token of _contentKeywords(previous)) {
      if (context.length >= CONTEXT_MAX_KEYWORDS || taken >= CONTEXT_MAX_KEYWORDS_PER_MESSAGE) break;
      const plain = _plainToken(token);
      if (seen.has(plain)) continue;
      seen.add(plain);
      context.push(token);
      taken++;
    }
  }

  // El mensaje del usuario va entero; el contexto se recorta para no pasar
  // el largo máximo que aceptan los proveedores.
  while (context.length > 0 && current.length + 1 + context.join(' ').length > QUERY_MAX_CHARS) {
    context.pop();
  }
  return context.length > 0 ? `${current} ${context.join(' ')}` : current;
}

// ─── ÓRDENES DE BÚSQUEDA ──────────────────────────────────────────────────────
// "checa en internet", "revisa en la web", "busca bien…" son órdenes para
// Tempest, no términos a buscar. Mandadas al buscador solo ensucian la
// consulta. Se quitan antes de armarla; la búsqueda en sí la sigue
// decidiendo el interruptor de búsqueda web, no estas frases.
const _WORD_START = '(?<![\\p{L}\\p{N}])';
const _WORD_END = '(?![\\p{L}\\p{N}])';
const _SEARCH_VERB = '(?:b[uú]sca(?:lo|la|me)?|buscar|ch[eé]ca(?:lo|la|me)?|rev[ií]sa(?:lo|la|me)?|ver[ií]fica(?:lo|la|me)?|invest[ií]ga(?:lo|la|me)?|cons[uú]lta(?:lo|la|me)?)';
const _SEARCH_PLACE = '(?:en|por)\\s+(?:el\\s+|la\\s+)?(?:internet|web|red|google|l[ií]nea)';
const _SEARCH_PLACE_EDGE = '(?:en|por)\\s+(?:el\\s+)?internet';
const SEARCH_COMMAND_PATTERNS = [
  new RegExp(`${_WORD_START}${_SEARCH_VERB}\\s+(?:bien\\s+)?${_SEARCH_PLACE}${_WORD_END}`, 'giu'),
  new RegExp(`^\\s*${_SEARCH_VERB}\\s+bien${_WORD_END}`, 'iu'),
  new RegExp(`^\\s*${_SEARCH_PLACE_EDGE}${_WORD_END}`, 'iu'),
  new RegExp(`${_WORD_START}${_SEARCH_PLACE_EDGE}\\s*[.!?]*\\s*$`, 'iu')
];

function stripSearchCommands(text) {
  const original = String(text || '').trim();
  let result = original;
  for (const pattern of SEARCH_COMMAND_PATTERNS) {
    result = result.replace(pattern, ' ');
  }
  result = result.replace(/\s+/g, ' ').replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '').trim();
  return result.length >= 3 ? result : original;
}

function formatResultsAsContext(results, query, { hardwareProfile } = {}) {
  if (!results || results.length === 0) return '';

  const maxChars = getSnippetMaxChars(hardwareProfile);
  const items = results
    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${sanitizeSnippet(r.snippet, maxChars)}`)
    .join('\n\n');

  return `[BÚSQUEDA WEB — consulta: "${query}"]\n\n${items}\n\n[FIN BÚSQUEDA WEB]\nINSTRUCCION OBLIGATORIA: Los datos anteriores son información en tiempo real obtenida ahora mismo. Tu conocimiento de entrenamiento está desactualizado — DEBES priorizar estos resultados sobre tu conocimiento previo. Responde ÚNICAMENTE basándote en los resultados anteriores. Si los resultados no tienen la respuesta, dilo explícitamente. Respuesta directa y breve.`;
}

module.exports = {
  search,
  formatResultsAsContext,
  buildContextualQuery,
  stripSearchCommands,
  getSnippetMaxChars,
  pickDistinctSites,
  contentKeywords: _contentKeywords,
  plainToken: _plainToken,
  loadFullConfig,
  saveFullConfig,
  listProfiles,
  getProfileRecord,
  getUserRecord,
  createProfile,
  deleteProfile,
  saveRecord,
  getEffectiveRecord,
  getEnabledProviders,
  getDefaultRecord,
  getDefaultProviders
};
