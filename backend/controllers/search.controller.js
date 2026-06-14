// backend/controllers/search.controller.js
const {
  loadConfig,
  saveConfig,
  getDefaultConfig,
  getEnabledProviders
} = require('../services/search/search.service');

const PROVIDERS_META = require('../services/search/providers/searxng.provider');
const BRAVE_META     = require('../services/search/providers/brave.provider');
const TAVILY_META    = require('../services/search/providers/tavily.provider');

const PROVIDER_MODULES = {
  searxng: PROVIDERS_META,
  brave:   BRAVE_META,
  tavily:  TAVILY_META
};

const { getUserSearchProviders, setSearchProviders } = require('../services/auth.service');

// GET /search/config — admin ve config completa, usuario ve solo providers habilitados
function getConfig(req, res) {
  const config = loadConfig();

  if (req.user?.role === 'admin') {
    // Admin ve config completa para editar, pero también recibe
    // sus propios enabledProviders filtrados por su searchEnabled y profileId
    const users = require('../services/auth.service').listUsers();
    const me = users.find(u => u.username === req.user?.username);
    const searchEnabled = me?.searchEnabled !== false;
    const profileId = me?.profileId ?? 'none';

    let enabledProviders;
    if (!searchEnabled) {
      enabledProviders = [];
    } else if (profileId === 'global' || !me) {
      enabledProviders = getEnabledProviders(config);
    } else {
      const allowed = me.searchProviders;
      const allProviders = Object.keys(config.providers);
      enabledProviders = allowed === null ? allProviders : allProviders.filter(p => allowed.includes(p));
    }
    return res.json({ ok: true, config, enabledProviders, globalEnabled: config.globalEnabled });
  }

  const users     = require('../services/auth.service').listUsers();
  const me        = users.find(u => u.username === req.user?.username);
  const profileId = me?.profileId ?? 'none';

  // searchEnabled del usuario — si está apagado, no hay búsqueda
  if (me && me.searchEnabled === false) {
    return res.json({ ok: true, enabledProviders: [], globalEnabled: false });
  }

  let filtered;
  if (profileId === 'global' || !me) {
    // Hereda config global — globalEnabled es el interruptor maestro para este grupo
    if (!config.globalEnabled) {
      return res.json({ ok: true, enabledProviders: [], globalEnabled: false });
    }
    filtered = getEnabledProviders(config);
  } else {
    // Sin perfil — config individual, completamente independiente del Perfil Global
    const userAllowed = me.searchProviders;
    const allProviders = Object.keys(config.providers);
    filtered = userAllowed === null ? allProviders : allProviders.filter(p => userAllowed.includes(p));
  }

  return res.json({ ok: true, enabledProviders: filtered, globalEnabled: config.globalEnabled });
}

// PATCH /search/config — solo admin
function updateConfig(req, res) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo administradores pueden modificar esta configuración' });
  }

  try {
    const current = loadConfig();
    const { globalEnabled, providers } = req.body;

    if (typeof globalEnabled === 'boolean') {
      current.globalEnabled = globalEnabled;
    }

    if (providers && typeof providers === 'object') {
      for (const [name, cfg] of Object.entries(providers)) {
        if (current.providers[name]) {
          Object.assign(current.providers[name], cfg);
        }
      }
    }

    saveConfig(current);
    return res.json({ ok: true, config: current });
  } catch (e) {
    console.error('[search.controller] Error al guardar config:', e.message);
    return res.status(500).json({ ok: false, error: 'Error al guardar configuración' });
  }
}

// POST /search/test — solo admin, prueba conexión de un provider
async function testProvider(req, res) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo administradores' });
  }

  const { provider, testUrl, testApiKey } = req.body;
  if (!provider) return res.status(400).json({ ok: false, error: 'Falta provider' });

  const config  = loadConfig();
  const provCfg = { ...config.providers[provider] };
  if (testUrl)    provCfg.url    = testUrl;
  if (testApiKey) provCfg.apiKey = testApiKey; // testea con URL del formulario sin guardar aún
  if (!provCfg) return res.status(400).json({ ok: false, error: 'Provider desconocido' });

  const mod = PROVIDER_MODULES[provider];
  if (!mod?.testConnection) {
    return res.status(400).json({ ok: false, error: 'Provider sin testConnection' });
  }

  try {
    const result = await mod.testConnection(provCfg);
    return res.json({ ok: result.ok, ...result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// PATCH /search/user-providers — solo admin, asigna providers permitidos a un usuario
function updateUserProviders(req, res) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo administradores' });
  }

  const { username, providers } = req.body;
  if (!username) return res.status(400).json({ ok: false, error: 'Falta username' });


  try {
    const useGlobal = req.body.useGlobalConfig === true;
    const profileId = req.body.profileId ?? 'none';
    const searchEnabled = req.body.searchEnabled !== false;
    setSearchProviders(username, providers ?? null, useGlobal, profileId, searchEnabled);
    return res.json({ ok: true, username, searchProviders: providers ?? null, useGlobalConfig: useGlobal });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
}

module.exports = { getConfig, updateConfig, testProvider, updateUserProviders };