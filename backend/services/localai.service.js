const cleanReply = require('../utils/cleanReply');
const { parsePatch } = require('./patch.parser');
const memory = require('./memory.service');
const { getCurrentTimeAnswer, getControlledMemoryAnswer } = require('./localai/memory.answers');
const { buildSystemPrompt } = require('../config/buildSystemPrompt');
const { looksLikeCutReply, removeIncompleteFileBlock } = require('./localai/response.validator');
const { getMaxTokens, getContextSize } = require('./localai/token.profiles');
const { getHardwareProfile } = require('./settings.service');
const llamaProvider = require('./localai/llama.provider');
const { countTokens } = require('./localai/llama.provider');

// ─── ACUMULADOR DE TOKENS ─────────────────────────────────────────────────────
const _tokenAccum = {};
function _addTokens(model, prompt, completion) {
  if (!_tokenAccum[model]) _tokenAccum[model] = { prompt: 0, completion: 0 };
  _tokenAccum[model].prompt += prompt;
  _tokenAccum[model].completion += completion;
}
function getTokenMetrics() { return _tokenAccum; }
const path = require('path');

// Registro modelId → archivo .gguf real. Única fuente de verdad — no duplicar
// este mapeo en otro lado (lo reutiliza también models.inventory.js).
const MODEL_FILES = {
  'hermes-q4': 'Hermes-3-Llama-3.1-8B-Q4_K_M.gguf',
  'hermes-q5': 'Hermes-3-Llama-3.1-8B.Q5_K_M.gguf',
  'qwen2.5-7b-q5': 'qwen2.5-7b-instruct-q5_k_m.gguf',
  'qwen2.5-14b-q3': 'Qwen2.5-14B-Instruct-Q3_K_M.gguf',
  'deepseek-coder-6.7b-q6': 'deepseek-coder-6.7b-instruct.Q6_K.gguf',
  'gemma-2-9b-q4': 'gemma-2-9b-it-Q4_K_M.gguf',
  'llama-3.1-8b-q5': 'Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf',
  'llama-3.2-3b-q4': 'Hermes-3-Llama-3.2-3B-Q4_K_M.gguf',
  'llama-3.2-3b-q8': 'Hermes-3-Llama-3.2-3B.Q8_0.gguf',
  'qwen2.5-coder-3b-q8': 'qwen2.5-coder-3b-instruct-q8_0.gguf',
  'qwen2.5-3b-q4': 'qwen2.5-3b-instruct-q4_k_m.gguf',
  'qwen2.5-3b-q5': 'qwen2.5-3b-instruct-q5_k_m.gguf',
  'qwen2.5-vl-7b-q4': 'Qwen_Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf',
  'llava-1.6': 'llava-v1.6-mistral-7b.Q4_K_M.gguf',
  'phi-4-mini-reasoning': 'microsoft_Phi-4-mini-reasoning-Q4_K_M.gguf',
  'qwen3-8b': 'Qwen_Qwen3-8B-Q4_K_M.gguf',
};

function resolveModelPath(modelName) {
  const modelsDir = process.env.MODELS_DIR
    ? path.resolve(process.env.MODELS_DIR)
    : path.join(__dirname, '../../models-localai');

  const filename = MODEL_FILES[modelName];
  if (!filename) {
    console.warn(`[llama] Modelo desconocido: "${modelName}", usando hermes-q4`);
    return path.join(modelsDir, MODEL_FILES['hermes-q4']);
  }
  return path.join(modelsDir, filename);
}

function getKnownModelIds() {
  return Object.keys(MODEL_FILES);
}

const DEFAULT_MEMORY_OPTIONS = {
  userId: memory.DEFAULT_USER_ID,
  projectId: memory.DEFAULT_PROJECT_ID,
  chatId: memory.DEFAULT_CHAT_ID
};

async function sendToLocalAI(message, options = DEFAULT_MEMORY_OPTIONS) {
  const fullMemory = memory.getFullMemory(options);

  const timeAnswer = getCurrentTimeAnswer(message);
  if (timeAnswer) {
    memory.addChatHistoryMessage('assistant', timeAnswer, options);
    return timeAnswer;
  }

  const controlledAnswer = getControlledMemoryAnswer(message, fullMemory);
  if (controlledAnswer) {
    memory.addChatHistoryMessage('assistant', controlledAnswer, options);
    return controlledAnswer;
  }

  const lowerMessage = message.toLowerCase().trim();
  if (lowerMessage === 'hola' || lowerMessage === 'buenas' || lowerMessage === 'hey') {
    const name = fullMemory.profile?.name || 'Rogelio';
    const greeting = `Hola ${name}, ¿en qué puedo ayudarte?`;
    return greeting;
  }

  // En patch mode no mandar historial — el diff anterior infla el prefill y causa timeout
  const chatHistory = (options.mode === 'coder' && options.variant === 'patch')
    ? []
    : memory.getChatHistory(options)
      .filter(msg => msg.content && msg.content.trim() !== '')
      .filter(isUsefulMessage)
      .slice(-2)
      .map(msg => ({ role: msg.role, content: msg.content }));

  let processedMessage = message.trim();
  const cleanedMsg = processedMessage.replace(/[¿?¡!]/g, '').trim();
  const preguntaWords = /^(cual|como|que|por que|cuando|donde|quien|cuanto|cuales|cómo|qué|cuándo|dónde|quién|cuánto|dime|explica|habla|genera|escribe|crea|haz|muestra|lista)/i;
  if (cleanedMsg.length > 3 && cleanedMsg.length <= 50 && !preguntaWords.test(cleanedMsg)) {
    processedMessage = `Háblame brevemente sobre: ${cleanedMsg}.`;
  } else if (cleanedMsg.length <= 2) {
    processedMessage = 'Necesito más contexto para responderte.';
  }
  const messages = [
    { role: 'system', content: await buildSystemPrompt({ fullMemory, mode: options.mode || 'general', variant: options.variant || null, userId: options.userId, projectId: options.projectId, userMessage: message, skipContextFiles: options.skipContextFiles || false }) },
    ...chatHistory,
    { role: 'user', content: processedMessage }
  ];

  console.log('HISTORIAL ENVIADO A LOCALAI:', messages);
  console.log('MODELO USADO:', options);

  const maxTokens = getMaxTokens(options.primaryModel, message, options.mode || 'general', options.hardwareProfile || 'laptop');

  const modelPath = resolveModelPath(options.primaryModel || 'hermes-q4');
  if (modelPath !== llamaProvider.getActiveModel()) {
    await llamaProvider.switchModel(modelPath);
  }

  let reply = await llamaProvider.generate(messages, {
    temperature: 0.3,
    repeatPenalty: 1.18,
    maxTokens
  });
  reply = cleanReply(reply);

  if (!reply) reply = 'No pude generar una respuesta válida.';

  if (looksLikeCutReply(reply)) {
    reply = removeIncompleteFileBlock(reply);

    try {
      const continueMessages = [
        ...messages,
        { role: 'assistant', content: reply },
        { role: 'user', content: 'Tu respuesta anterior quedó cortada. NO repitas los archivos completos que ya entregaste. Regenera COMPLETO el archivo que quedó incompleto y después continúa con los archivos faltantes. Usa bloques separados.' }
      ];
      const continueReply = cleanReply(await llamaProvider.generate(continueMessages, {
        temperature: 0.3,
        repeatPenalty: 1.18,
        maxTokens: getMaxTokens(options.primaryModel, message, 'continue', options.hardwareProfile || 'laptop')
      }));
      if (continueReply) reply = reply + '\n\n' + continueReply;
    } catch (err) {
      console.error('[sendToLocalAI] continue request falló:', err.message);
    }
  }

  memory.addChatHistoryMessage('assistant', reply, options);
  return reply;
}

function buildFallbackTitle(text) {
  const title = String(text || '')
    // Nombre de archivo sin texto de usuario (ej. adjuntar una imagen sin
    // escribir nada — el frontend manda el filename como titleText): separar
    // extensión y separadores típicos de filename ANTES de limpiar, si no
    // "test_ocr_recibo.png" queda pegado como "testocrrecibopng" en vez de
    // separarse en palabras. Ver DECISIONS.md → "Fallback de título ilegible
    // con nombres de archivo".
    .replace(/\.\w{1,5}$/, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 4)
    .join(' ')
    .trim();
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : title;
}

function cleanGeneratedTitle(rawTitle, sourceText = '') {
  const genericMessages = ['hola', 'buenas', 'hey', 'ola', 'hello', 'hi', 'qué tal', 'que tal'];
  const normalizedSource = String(sourceText || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  if (!normalizedSource || genericMessages.includes(normalizedSource) || normalizedSource.length < 5)
    return 'Saludo inicial';

  let title = String(rawTitle || '')
    .replace(/<\|.*?\|>/g, ' ')
    .replace(/end_of_text/gi, ' ')
    .replace(/begin_of_text/gi, ' ')
    .replace(/tool_call/gi, ' ')
    .replace(/tool/gi, ' ')
    .replace(/assistant/gi, ' ')
    .replace(/user/gi, ' ')
    .replace(/usuario/gi, ' ')
    .replace(/\bcomo\b/gi, ' ')
    .replace(/\bse\b/gi, ' ')
    .replace(/chat/gi, ' ')
    .replace(/texto base/gi, ' ')
    .replace(/título/gi, ' ')
    .replace(/titulo/gi, ' ')
    .replace(/respuesta/gi, ' ')
    .replace(/["'`´""'']/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[{}[\]();]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Detectar frases completas con verbos
  const sentenceIndicators = [' es ', ' son ', ' fue ', ' fueron ', ' tiene ', ' pueden '];
  const lower = ` ${title.toLowerCase()} `;
  if (sentenceIndicators.some(x => lower.includes(x))) {
    return buildFallbackTitle(sourceText) || 'Nueva conversación';
  }

  // Blacklist de títulos basura
  const bannedTitles = ['descripcion', 'descripción', 'titulo', 'título', 'tema', 'chat', 'conversacion', 'conversación', 'resumen', 'corto'];
  const words = title.split(' ').filter(word => word.length > 1);
  const filtered = words.filter(w => !bannedTitles.includes(w.toLowerCase()));
  title = filtered.slice(0, 4).join(' ').trim();

  // Limpiar caracteres sueltos al final
  title = title.replace(/[-_,;:]+$/, '').trim();

  if (!title || title.length < 3) return buildFallbackTitle(sourceText) || 'Nueva conversación';
  return title.charAt(0).toUpperCase() + title.slice(1);
}

const TITLE_FALLBACK_MODELS = [
  'deepseek-coder-6.7b-q6',
  'deepseek-coder-6.7b-q4',
  'qwen-coder-14b-q4',
  'qwen-coder-14b-q5',
  'qwen2.5-coder-3b-q8',
  'qwen2.5-7b-q5',
  'gemma-2-9b-q4',
  'llama-3.1-8b-q5',
  'qwen-coder-14b-q4'
];

async function generateTitleFromText(text, type = 'chat', model = null) {
  // getHardwareProfile() (settings.service.js) en vez de process.env directo —
  // así respeta el toggle de Configuración → Preferencias, no solo el .env.
  // El modelo en sí NO cambia: 'llama-3.2-3b-q4' es un modelo dedicado a esta
  // función (títulos), confirmado con el usuario — no es un 4to modelo
  // general suelto, es una elección a propósito para esta tarea puntual.
  // Ver DECISIONS.md → "Perfil de hardware: solo 3 modelos generales en
  // laptop, no 4 (títulos queda aparte)".
  const profile = getHardwareProfile();
  const fallbackModel = profile === 'laptop' ? 'llama-3.2-3b-q4' : 'hermes-q4';

  if (!model || TITLE_FALLBACK_MODELS.includes(model)) {
    model = fallbackModel;
  }

  console.log(`[generateTitle] profile=${profile} model=${model}`);
  const cleanedText = String(text || '')
    .replace(/---\s*ARCHIVOS ADJUNTOS\s*---[\s\S]*/i, '')
    .trim()
    .slice(0, 80);

  if (!cleanedText) return 'Nueva conversación';

  try {
    // Esperar a que el stream + switchModel terminen antes de generar título
    // El delay inicial cubre el tiempo de switchModel (~4s) + margen
    await new Promise(resolve => setTimeout(resolve, profile === 'laptop' ? 6000 : 5000));

    // Segunda verificación — esperar si aún está cargando
    let waited = 0;
    while (llamaProvider.getStatus().status === 'loading' && waited < 30000) {
      await new Promise(resolve => setTimeout(resolve, 500));
      waited += 500;
    }
    if (llamaProvider.getStatus().status !== 'ready') {
      return buildFallbackTitle(text) || 'Nueva conversación';
    }

    const activeModel = llamaProvider.getActiveModel() || '';
    if (activeModel.toLowerCase().includes('14b') || activeModel.toLowerCase().includes('q3') || activeModel.toLowerCase().includes('q4_k_m') || activeModel.toLowerCase().includes('deepseek')) {
      const activePath = activeModel.toLowerCase();
      // Modelos de visión (llava-1.6, qwen2.5-vl-7b-q4) sufren el mismo problema
      // que los 14B: gpuLayers:99 ya deja casi sin VRAM libre, y un segundo
      // contexto de 512 tokens para el título choca con InsufficientMemoryError.
      // Ver DECISIONS.md → "Fix: InsufficientMemoryError cargando llava-1.6".
      // deepseek-coder-6.7b-q6 (5.53GB) agregado (v3.0, pruebas julio 2026) —
      // el gate de arriba no lo capturaba porque no matchea '14b'/'q3'/
      // 'q4_k_m' (es Q6_K); con el modelo de embeddings ahora residente en
      // paralelo (ver embed.provider.js), el margen de VRAM que le quedaba
      // al contexto de 512 tokens del título dejó de alcanzar —
      // "InsufficientMemoryError: A context size of 512 is too large".
      const isHeavyModel = activePath.includes('14b') || activePath.includes('qwen2.5-14b')
        || activePath.includes('llava') || activePath.includes('vl-7b') || activePath.includes('deepseek');
      if (isHeavyModel) {
        return buildFallbackTitle(text) || 'Nueva conversación';
      }
    }

    const rawTitle = await llamaProvider.generate([
      {
        role: 'user',
        content: `Asigna 2-4 palabras clave que describan el tema principal de esta consulta. Solo las palabras, nada más.\n\n"Háblame sobre el río Nilo" → Río Nilo\n"Cómo instalar Docker en Windows" → Docker Windows\n"Explícame la fotosíntesis" → Fotosíntesis Plantas\n"Genera una función para validar emails" → Validación Email\n\n"${cleanedText}" →`
      }
    ], {
      temperature: 0.3,
      maxTokens: 8,
      contextSize: 512
    });

    return cleanGeneratedTitle(rawTitle || '', cleanedText);

  } catch (error) {
    console.error('Error en generateTitleFromText:', error.name, error.message);
    return cleanGeneratedTitle('', cleanedText);
  }
}

// ─── STREAMING ────────────────────────────────────────────────────────────────

async function* streamToLocalAI(message, options = DEFAULT_MEMORY_OPTIONS, meta = {}) {
  const fullMemory = memory.getFullMemory(options);

  const timeAnswer = getCurrentTimeAnswer(message);
  if (timeAnswer) {
    yield timeAnswer;
    return;
  }

  const controlledAnswer = getControlledMemoryAnswer(message, fullMemory);
  if (controlledAnswer) {
    yield controlledAnswer;
    return;
  }

  const lowerMessage = message.toLowerCase().trim();

  if (lowerMessage === 'hola' || lowerMessage === 'buenas' || lowerMessage === 'hey') {
    const name = fullMemory.profile?.name || 'Rogelio';
    const greeting = `Hola ${name}, ¿en qué puedo ayudarte?`;
    yield greeting;
    return;
  }

  // En patch mode no mandar historial — el diff anterior infla el prefill y causa timeout
  const chatHistory = (options.mode === 'coder' && options.variant === 'patch')
    ? []
    : memory.getChatHistory(options)
      .filter(msg => msg.content && msg.content.trim() !== '')
      .filter(isUsefulMessage)
      .slice(-2)
      .map(msg => ({ role: msg.role, content: msg.content }));

  let processedMessage = message.trim();
  const cleanedMsg = processedMessage.replace(/[¿?¡!]/g, '').trim();
  const preguntaWords = /^(cual|como|que|por que|cuando|donde|quien|cuanto|cuales|cómo|qué|cuándo|dónde|quién|cuánto|dime|explica|habla|genera|escribe|crea|haz|muestra|lista)/i;
  if (cleanedMsg.length > 3 && cleanedMsg.length <= 50 && !preguntaWords.test(cleanedMsg)) {
    processedMessage = `Háblame brevemente sobre: ${cleanedMsg}.`;
  } else if (cleanedMsg.length <= 2) {
    processedMessage = 'Necesito más contexto para responderte.';
  }

  const systemPrompt = await buildSystemPrompt({
    fullMemory,
    mode: options.mode || 'general',
    variant: options.variant || null,
    userId: options.userId,
    projectId: options.projectId,
    userMessage: message,
    skipContextFiles: options.skipContextFiles || false,
    dynamicMaxChars: options.dynamicMaxChars || null,
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
    { role: 'user', content: processedMessage }
  ];

  // Estimar tokens de entrada con el prompt completo real
  const totalPromptChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  meta.promptTokens = Math.round(totalPromptChars / 4);

  let fullReply = '';
  let stopped = false;
  let started = false;

  try {
    const temperature = (options.mode === 'coder' && options.variant === 'patch') ? 0.2 : 0.3;
    const maxTokens = options.maxTokens || getMaxTokens(options.primaryModel, message, options.mode || 'general', options.hardwareProfile || 'laptop');
    console.log(`[DIAGNOSTICO maxTokens] options.maxTokens=${options.maxTokens} | maxTokens final=${maxTokens} | promptTokens estimado=${meta.promptTokens}`);

    const modelPath = resolveModelPath(options.primaryModel || 'hermes-q4');
    if (modelPath !== llamaProvider.getActiveModel()) {
      if (options.onSwitchingModel) options.onSwitchingModel();
      await llamaProvider.switchModel(modelPath);
    }

    // contextSizeOverride: usado por chat.controller.js para reintentar con un
    // contextSize más chico tras un InsufficientMemoryError (ver salvaguarda ahí).
    const contextSize = options.contextSizeOverride || getContextSize(options.primaryModel || 'hermes-q4');
    for await (const rawToken of llamaProvider.stream(messages, { temperature, repeatPenalty: 1.18, maxTokens, contextSize, signal: options.signal })) {

      if (stopped) break;

      fullReply += rawToken;

      // Startup buffer — no emitir hasta tener contenido limpio
      if (!started) {
        const cleaned = fullReply.replace(/^[:\\\/]+/, '');
        if (cleaned.length < 1) continue;
        started = true;
        fullReply = cleaned;
        yield cleaned;
        continue;
      }

      // Detectar loop genérico en tiempo real
      if (fullReply.length > 60) {
        const isHeavyModel = (options.primaryModel || '').includes('14b');
        const loopWindow = isHeavyModel ? -900 : -600;
        const minLength = isHeavyModel ? 180 : 15;
        const loopMaxLength = isHeavyModel ? 500 : 140;
        const recent = fullReply.slice(loopWindow);

        if (recent.includes('¿Cómo te gustaría') &&
          (recent.match(/¿Cómo te gustaría/g) || []).length > 1) {
          stopped = true; break;
        }

        const maxLength = isHeavyModel ? 500 : 140;
        const repeated = new RegExp(`(.{${minLength},${loopMaxLength}})\\1{1,}`, 's').test(recent);
        const shortLoop = /^(\S+\s*){1,3}\n(\1\s*){3,}/m.test(recent);
        if (repeated || shortLoop) { stopped = true; break; }

        // Detector de loops patch
        if (options.mode === 'coder' && options.variant === 'patch') {
          const replaceCount = (fullReply.match(/>>>>>>> REPLACE/g) || []).length;
          const searchCount = (fullReply.match(/<<<<<<< SEARCH/g) || []).length;
          if (replaceCount >= 2 && replaceCount === searchCount) {
            const blocks = fullReply.split('>>>>>>> REPLACE');
            if (blocks.length >= 3) {
              const last = blocks[blocks.length - 2].trim();
              const prev = blocks[blocks.length - 3].trim();
              if (last === prev) { stopped = true; break; }
            }
          }
          const finCount = (fullReply.match(/--- FIN DE ARCHIVOS ---/g) || []).length;
          if (finCount >= 2) { stopped = true; break; }
          const adjCount = (fullReply.match(/\[Archivo \d+:/g) || []).length;
          if (adjCount >= 3) { stopped = true; break; }
        }
      }

      yield rawToken;
    }

  } finally {
    // Metadata estimada — node-llama-cpp no expone usage como LocalAI
    meta.promptTokens = countTokens(messages.map(m => m.content || '').join(' '));
    meta.completionTokens = countTokens(fullReply);
    _addTokens(options.primaryModel || 'unknown', meta.promptTokens, meta.completionTokens);
    // stopped=true significa que el detector de loops cortó la generación a propósito.
    // stopped=false significa que el for-await terminó solo — node-llama-cpp emitió su EOS de forma natural.
    meta.finishReason = stopped ? 'loop_detected' : 'stop';
    meta.timingPrompt = null;
    meta.timingGeneration = null;
  }
}

function isUsefulMessage(msg) {
  if (msg.role !== 'assistant') return true; // siempre conservar mensajes del usuario

  const content = msg.content?.toLowerCase().trim() || '';

  // Descartar mensajes cortos que son solo saludos/frases genéricas
  const genericPhrases = [
    'hola', 'en qué puedo ayudarte', 'cómo estás', 'cómo te llamas',
    'estoy bien', 'puedo asistirte', 'puedo ayudarte hoy',
    'en qué puedo', 'cómo puedo ayudarte'
  ];

  // Si el mensaje es corto Y contiene una frase genérica, descartar
  if (content.length < 80 && genericPhrases.some(p => content.includes(p))) {
    return false;
  }

  return true;
}

module.exports = {
  sendToLocalAI,
  streamToLocalAI,
  generateTitleFromText,
  getTokenMetrics,
  resolveModelPath,
  getKnownModelIds
};