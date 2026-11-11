const HARDWARE_TOKEN_PROFILES = {
  laptop: {
    default: { normal: 500, code: 900, continue: 900 },
    'qwen2.5-3b-q4': { normal: 500, code: 900, continue: 900 },
    'qwen2.5-3b-q5': { normal: 600, code: 1000, continue: 1000 },
    'llama-3.2-3b-q4': { normal: 600, code: 1000, continue: 1000 },
    // Modelo de razonamiento — genera cadena de pensamiento antes de la
    // respuesta final, necesita más presupuesto de tokens que un modelo
    // de chat normal o se corta a mitad del razonamiento.
    'phi-4-mini-reasoning': { normal: 900, code: 1200, continue: 1200 },
    'qwen3-8b': { normal: 600, code: 1200, continue: 1200 }
  },
  desktop: {
    default: { normal: 400, code: 1200, continue: 1200 },
    'hermes-q4': { normal: 400, code: 1200, continue: 1200 },
    'hermes-q5': { normal: 500, code: 1400, continue: 1400 },
    'hermes-q6': { normal: 600, code: 1600, continue: 1600 },
    'llama-3.1-8b-q5': { normal: 500, code: 1400, continue: 1400 },
    'qwen2.5-7b-q5': { normal: 500, code: 1400, continue: 1400 },
    'gemma-2-9b-q4': { normal: 500, code: 1200, continue: 1200 },
    'deepseek-coder-6.7b-q6': { normal: 400, code: 1600, continue: 1600 },
    'qwen-coder-14b-q4': { normal: 500, code: 2000, continue: 2000 },
    'qwen2.5-14b-q3': { normal: 600, code: 900, continue: 900 },
  }
};

const MODEL_CONTEXT_SIZES = {
  'hermes-q4':               8192,
  'hermes-q5':               6000,
  'llama-3.1-8b-q5':         8192,
  'llama-3.2-3b-q4':         4096,
  'llama-3.2-3b-q8':         4096,
  'qwen2.5-7b-q5':           8192,
  'qwen2.5-3b-q4':           8192,
  'qwen2.5-3b-q5':           8192,
  'qwen2.5-coder-3b-q8':     8192,
  'qwen-coder-14b-q4':       8192,
  'deepseek-coder-6.7b-q6': 6000,
  'qwen2.5-vl-7b-q4':        8192,
  // Bajado de 4096 a 2048: InsufficientMemoryError real en laptop (RTX 4050) —
  // el modelo (7B + proyector de visión) con gpuLayers:99 ya deja poca VRAM
  // libre para el KV cache. Mismo criterio que el fix de deepseek-coder-6.7b-q6
  // (bajado a 6000 en desktop por el mismo tipo de error). Empírico: no se pudo
  // confirmar el número óptimo exacto en esta sesión (sin acceso a la VRAM real
  // de la laptop) — si 2048 todavía falla, bajar más (ej. 1024).
  'llava-1.6':               2048,
  'qwen2.5-14b-q3':          6144,
  'phi-4-mini-reasoning':    8192, // soporta 128K nativo, pero acá se limita por VRAM disponible en laptop
  'qwen3-8b':                6144, // igual criterio que qwen2.5-14b-q3 en desktop: modelo grande, contexto reducido
};

// Modo documento largo: la ventana se amplía solo en la petición que lo
// necesita (contextSizeOverride), el modelo no se recarga. Un perfil de
// hardware que no aparece aquí no usa este modo.
const LARGE_CONTEXT_PROFILES = {
  laptop: { model: 'qwen2.5-3b-q5', contextSize: 16384, maxAttachmentChars: 50000 },
};

function getLargeContextConfig(hardwareProfile) {
  return LARGE_CONTEXT_PROFILES[hardwareProfile] || null;
}

// Documentos del chat: por encima de estos tokens, un documento NO se envía
// entero cuando la pregunta tiene palabras que buscar — se envían los mejores
// fragmentos (chat-docs.retriever.js). 3000 sale de las pruebas de v3.1.0 en la
// laptop (13 líneas se leen bien, 11 mil tokens no). Un perfil sin entrada deja
// el comportamiento anterior: el escritorio no se ha probado.
const DOC_FRAGMENT_TOKENS = {
  laptop: 3000,
};

function getDocFragmentTokens(hardwareProfile) {
  return DOC_FRAGMENT_TOKENS[hardwareProfile] || null;
}

function getContextSize(model) {
  return MODEL_CONTEXT_SIZES[model] || 4096; // fallback conservador
}

function isCodeRequest(message) {
  return /archivo|archivos|genera|crea|código|codigo|función|funcion|proyecto|html|css|javascript|js|node|express|backend|frontend/i
    .test(String(message || ''));
}

function getMaxTokens(model, message, mode = 'general', hardwareProfile = 'laptop') {
  const selectedHardware = HARDWARE_TOKEN_PROFILES[hardwareProfile] ? hardwareProfile : 'laptop';
  const selectedModel = model || 'hermes-q4';
  const hardwareConfig = HARDWARE_TOKEN_PROFILES[selectedHardware];
  const modelConfig = hardwareConfig[selectedModel] || hardwareConfig.default;

  if (mode === 'continue') return modelConfig.continue;
  if (mode === 'coder' || mode === 'coder/strict' || mode === 'coder/hybrid' || mode === 'coder/patch') return modelConfig.code;
  if (mode === 'explain') return modelConfig.normal;
  // general o legacy: fallback al regex anterior
  if (isCodeRequest(message)) return modelConfig.code;
  return modelConfig.normal;
}

module.exports = {
  HARDWARE_TOKEN_PROFILES,
  MODEL_CONTEXT_SIZES,
  isCodeRequest,
  getMaxTokens,
  getContextSize,  // ← agregar
  LARGE_CONTEXT_PROFILES,
  getLargeContextConfig,
  DOC_FRAGMENT_TOKENS,
  getDocFragmentTokens,
};