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
async function search(query, providerName, { username } = {}) {
  const record = getEffectiveRecord(username);

  if (!record?.globalEnabled) return [];

  const providerCfg = record.providers?.[providerName];
  if (!providerCfg?.enabled) return [];

  const provider = PROVIDERS[providerName];
  if (!provider) return [];

  try {
    return await provider.search(query, providerCfg);
  } catch (e) {
    console.error(`[search] Error en provider "${providerName}":`, e.message);
    return [];
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

function sanitizeSnippet(text, maxChars = 400) {
  if (!text) return '';
  let clean = text;
  for (const p of INJECTION_PATTERNS) clean = clean.replace(p, '[contenido filtrado]');
  return clean.slice(0, maxChars);
}

function formatResultsAsContext(results, query) {
  if (!results || results.length === 0) return '';

  const items = results
    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${sanitizeSnippet(r.snippet)}`)
    .join('\n\n');

  return `[BÚSQUEDA WEB — consulta: "${query}"]\n\n${items}\n\n[FIN BÚSQUEDA WEB]\nINSTRUCCION OBLIGATORIA: Los datos anteriores son información en tiempo real obtenida ahora mismo. Tu conocimiento de entrenamiento está desactualizado — DEBES priorizar estos resultados sobre tu conocimiento previo. Responde ÚNICAMENTE basándote en los resultados anteriores. Si los resultados no tienen la respuesta, dilo explícitamente. Respuesta directa y breve.`;
}

module.exports = {
  search,
  formatResultsAsContext,
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
