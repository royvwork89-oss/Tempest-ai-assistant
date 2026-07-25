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
  'llava-1.6':               4096,
  'qwen2.5-14b-q3':          6144,
  'phi-4-mini-reasoning':    8192, // soporta 128K nativo, pero acá se limita por VRAM disponible en laptop
  'qwen3-8b':                6144, // igual criterio que qwen2.5-14b-q3 en desktop: modelo grande, contexto reducido
};

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
};