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

// GET /search/config — admin ve config completa, usuario ve solo providers habilitados
function getConfig(req, res) {
  const config = loadConfig();

  if (req.user?.role === 'admin') {
    return res.json({ ok: true, config });
  }

  // Usuario normal: solo lista de providers habilitados
  const enabled = getEnabledProviders(config);
  return res.json({ ok: true, enabledProviders: enabled, globalEnabled: config.globalEnabled });
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

module.exports = { getConfig, updateConfig, testProvider };