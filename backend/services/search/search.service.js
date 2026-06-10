// backend/services/search/search.service.js
const fs   = require('fs');
const path = require('path');

const searxngProvider = require('./providers/searxng.provider');
const braveProvider   = require('./providers/brave.provider');

const CONFIG_PATH = path.join(__dirname, '../../data/search-config.json');

const PROVIDERS = {
  searxng: searxngProvider,
  brave:   braveProvider
};

function getDefaultConfig() {
  return {
    globalEnabled: false,
    providers: {
      searxng: { enabled: false, url: 'http://localhost:8081' },
      brave:   { enabled: false, apiKey: '' }
    }
  };
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('[search] No se pudo leer search-config.json:', e.message);
  }
  return getDefaultConfig();
}

function saveConfig(config) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getEnabledProviders(config) {
  return Object.entries(config.providers)
    .filter(([, cfg]) => cfg.enabled)
    .map(([name]) => name);
}

async function search(query, providerName) {
  const config = loadConfig();

  if (!config.globalEnabled) return [];

  const providerCfg = config.providers[providerName];
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

function sanitizeSnippet(text) {
  if (!text) return '';
  let clean = text;
  for (const p of INJECTION_PATTERNS) clean = clean.replace(p, '[contenido filtrado]');
  return clean.slice(0, 400);
}

function formatResultsAsContext(results, query) {
  if (!results || results.length === 0) return '';

  const items = results
    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${sanitizeSnippet(r.snippet)}`)
    .join('\n\n');

  return `[BÚSQUEDA WEB — consulta: "${query}"]\n\n${items}\n\n[FIN BÚSQUEDA WEB]\nINSTRUCCIONES: Responde la pregunta del usuario usando estos resultados SOLO si son relevantes. Si los resultados no corresponden al tema de la pregunta, ignóralos y dilo brevemente. Respuesta breve y directa, sin preguntas de seguimiento.`;
}

module.exports = {
  search,
  loadConfig,
  saveConfig,
  getDefaultConfig,
  getEnabledProviders,
  formatResultsAsContext
};