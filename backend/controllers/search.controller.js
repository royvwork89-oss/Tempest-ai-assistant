// backend/controllers/search.controller.js
const {
  getEffectiveRecord,
  getEnabledProviders,
  listProfiles,
  getProfileRecord,
  getUserRecord,
  createProfile,
  deleteProfile,
  saveRecord,
  getDefaultRecord
} = require('../services/search/search.service');

const PROVIDERS_META = require('../services/search/providers/searxng.provider');
const BRAVE_META     = require('../services/search/providers/brave.provider');
const TAVILY_META    = require('../services/search/providers/tavily.provider');

const PROVIDER_MODULES = {
  searxng: PROVIDERS_META,
  brave:   BRAVE_META,
  tavily:  TAVILY_META
};

const { setUserProfile } = require('../services/auth.service');

function _requireAdmin(req, res) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ ok: false, error: 'Solo administradores' });
    return false;
  }
  return true;
}

// GET /search/config — usado por el botón de búsqueda web del chat (todos los
// roles). Resuelve el registro real de quien pregunta (perfil asignado o
// config propia si está "sin perfil") — nunca un config global compartido.
function getConfig(req, res) {
  const username = req.user?.username;
  const record = getEffectiveRecord(username);
  const enabledProviders = record?.globalEnabled ? getEnabledProviders(record) : [];
  return res.json({ ok: true, enabledProviders, globalEnabled: !!record?.globalEnabled });
}

// GET /search/profiles — solo admin, lista de perfiles para poblar selectores
function listProfilesHandler(req, res) {
  if (!_requireAdmin(req, res)) return;
  return res.json({ ok: true, profiles: listProfiles() });
}

// POST /search/profiles — solo admin, crea un perfil nuevo (config vacía/deshabilitada)
function createProfileHandler(req, res) {
  if (!_requireAdmin(req, res)) return;
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'Falta nombre del perfil' });
  try {
    const profile = createProfile(name.trim());
    return res.json({ ok: true, profile });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// DELETE /search/profiles/:id — solo admin. Usuarios asignados a este perfil
// quedan "sin perfil" (nunca heredan silenciosamente otro perfil).
function deleteProfileHandler(req, res) {
  if (!_requireAdmin(req, res)) return;
  try {
    deleteProfile(req.params.id);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
}

// GET /search/record?type=profile|user&id=... — solo admin, config completa
// (providers + apiKeys) de un perfil o de un usuario "sin perfil" puntual.
function getRecordHandler(req, res) {
  if (!_requireAdmin(req, res)) return;
  const { type, id } = req.query;
  if (!type || !id) return res.status(400).json({ ok: false, error: 'Faltan type/id' });

  const record = type === 'profile' ? getProfileRecord(id) : getUserRecord(id);
  // Un usuario "sin perfil" que nunca guardó nada aún no tiene registro — se
  // devuelve un default vacío/deshabilitado en vez de 404, para que el panel
  // pueda mostrar el formulario y crear el registro al primer guardado.
  return res.json({ ok: true, record: record || (type === 'profile' ? null : getDefaultRecord()) });
}

// PATCH /search/record — solo admin, guarda providers/apiKeys de un perfil o
// de un usuario "sin perfil" puntual. Nunca toca otros registros.
function saveRecordHandler(req, res) {
  if (!_requireAdmin(req, res)) return;
  const { type, id, name, globalEnabled, providers } = req.body;
  if (!type || !id) return res.status(400).json({ ok: false, error: 'Faltan type/id' });

  try {
    const record = saveRecord({ type, id, name, globalEnabled, providers });
    return res.json({ ok: true, record });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
}

// POST /search/test — solo admin. Prueba SIEMPRE el registro de UN perfil o
// usuario puntual — una sola llamada real a la API, sin importar cuántos
// usuarios tenga ese perfil asignado (evita gastar cuota de pago por usuario).
async function testProvider(req, res) {
  if (!_requireAdmin(req, res)) return;

  const { type, id, provider, testUrl, testApiKey } = req.body;
  if (!provider) return res.status(400).json({ ok: false, error: 'Falta provider' });

  const record = type && id
    ? (type === 'profile' ? getProfileRecord(id) : getUserRecord(id))
    : null;
  const baseCfg = record?.providers?.[provider] || {};
  const provCfg = { ...baseCfg };
  if (testUrl)    provCfg.url    = testUrl;
  if (testApiKey) provCfg.apiKey = testApiKey; // testea con el valor del formulario sin guardar aún

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

// PATCH /search/user-profile — solo admin. Asigna un usuario a un perfil (o
// lo deja "sin perfil" para que tenga config propia). Ya no maneja
// providers/apiKeys — eso vive en /search/record.
function updateUserProfile(req, res) {
  if (!_requireAdmin(req, res)) return;

  const { username, profileId } = req.body;
  if (!username) return res.status(400).json({ ok: false, error: 'Falta username' });

  try {
    setUserProfile(username, profileId ?? 'none');
    return res.json({ ok: true, username, profileId: profileId ?? 'none' });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
}

module.exports = {
  getConfig,
  listProfilesHandler,
  createProfileHandler,
  deleteProfileHandler,
  getRecordHandler,
  saveRecordHandler,
  testProvider,
  updateUserProfile
};
