'use strict';

// ─── ESTADO DEL PROVIDER ──────────────────────────────────────────────────────
let _status          = 'loading'; // 'loading' | 'ready' | 'error'
let _error           = null;
let _llama           = null;
let _model           = null;
let _activeModelPath = null;
let _progress         = 0; // 0..1 — progreso de carga del modelo actual (node-llama-cpp onLoadProgress)

function getStatus()      { return { status: _status, error: _error, progress: _progress }; }
function getActiveModel() { return _activeModelPath; }

// ─── CONTEO REAL DE TOKENS ────────────────────────────────────────────────────
function countTokens(text) {
  if (!_model || _status !== 'ready') {
    return Math.ceil((text || '').length / 3.5); // fallback si el modelo no está listo
  }
  try {
    return _model.tokenize(text || '').length;
  } catch {
    return Math.ceil((text || '').length / 3.5);
  }
}

// ─── CHAT WRAPPER POR FAMILIA DE MODELO ───────────────────────────────────────
function getChatWrapperName(modelPath) {
  const name = modelPath.toLowerCase();
  if (name.includes('gemma'))                                             return 'gemma';
  if (name.includes('llava') || name.includes('mistral'))                return 'mistral';
  if (name.includes('llama-3') || name.includes('llama3') ||
      name.includes('hermes-3-llama-3'))                                 return 'llama3';
  if (name.includes('deepseek'))                                         return 'chatml';
  if (name.includes('qwen'))                                             return 'qwen';
  if (name.includes('phi'))                                              return 'chatml';
  return 'chatml';
}

// ─── INICIALIZACIÓN ───────────────────────────────────────────────────────────
async function init(modelPath, gpuLayers = 99) {
  _progress = 0;
  try {
    console.log('[llama] Cargando modelo:', modelPath);
    const { getLlama, LlamaLogLevel } = await import('node-llama-cpp');

    // 'cuda' a secas fuerza SOLO ese binario — si el runtime de CUDA no está
    // bien instalado/no coincide (ver DECISIONS.md → "node-llama-cpp
    // NoBinaryFoundError en laptop sin CUDA Toolkit"), node-llama-cpp explota
    // en vez de degradar. 'auto' deja que elija el mejor disponible (CUDA si
    // funciona, CPU si no) — mismo comportamiento en la máquina donde CUDA sí
    // anda bien, y evita el crash total en la que no.
    _llama = await getLlama({
      gpu: 'auto',
      logLevel: LlamaLogLevel.warn
    });

    _model = await _llama.loadModel({
      modelPath,
      gpuLayers,
      onLoadProgress: (loadProgress) => { _progress = loadProgress; }
    });
    _activeModelPath = modelPath;
    _status   = 'ready';
    _progress = 1;
    console.log('[llama] Modelo listo ✅');
  } catch (err) {
    _status = 'error';
    _error  = err.message;
    console.error('[llama] Error cargando modelo:', err.message);
  }
}

// ─── CAMBIO DINÁMICO DE MODELO ────────────────────────────────────────────────
async function switchModel(modelPath, gpuLayers = 99) {
  if (_activeModelPath === modelPath && _status === 'ready') return;

  console.log(`[llama] Cambiando modelo: ${_activeModelPath} → ${modelPath}`);
  _status   = 'loading';
  _progress = 0;

  try {
    if (_model) {
      await _model.dispose();
      _model = null;
    }

    _model = await _llama.loadModel({
      modelPath,
      gpuLayers,
      onLoadProgress: (loadProgress) => { _progress = loadProgress; }
    });
    _activeModelPath = modelPath;
    _status   = 'ready';
    _progress = 1;
    console.log('[llama] Modelo listo ✅', modelPath);
  } catch (err) {
    _status = 'error';
    _error  = err.message;
    console.error('[llama] Error cambiando modelo:', err.message);
    throw err;
  }
}

// ─── CREAR CONTEXTO + SESSION ─────────────────────────────────────────────────
async function _createSession(messages, contextSize = 4096) {
  const {
    LlamaChatSession,
    ChatMLChatWrapper,
    Llama3ChatWrapper,
    QwenChatWrapper,
    GemmaChatWrapper,
    MistralChatWrapper
  } = await import('node-llama-cpp');

  if (_status !== 'ready') throw new Error(`Modelo no disponible (${_status})`);

  const context  = await _model.createContext({ contextSize });
  const sequence = context.getSequence();

  const wrapperName = getChatWrapperName(_activeModelPath || '');
  const wrapperMap  = {
    chatml:  ChatMLChatWrapper,
    llama3:  Llama3ChatWrapper,
    qwen:    QwenChatWrapper,
    gemma:   GemmaChatWrapper,
    mistral: MistralChatWrapper
  };
  const WrapperClass = wrapperMap[wrapperName] || ChatMLChatWrapper;

  const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
  const session = new LlamaChatSession({
    contextSequence: sequence,
    systemPrompt,
    chatWrapper: new WrapperClass()
  });

  const history = messages.filter(m => m.role !== 'system');
  for (let i = 0; i < history.length - 1; i += 2) {
    const userMsg      = history[i];
    const assistantMsg = history[i + 1];
    if (userMsg?.role === 'user' && assistantMsg?.role === 'assistant') {
      await session.prompt(userMsg.content, { onTextChunk: () => {} });
    }
  }

  const lastUser = history.findLast(m => m.role === 'user')?.content || '';
  return { session, context, lastUser };
}

// ─── INFERENCIA SIMPLE ────────────────────────────────────────────────────────
async function generate(messages, options = {}) {
  let waited = 0;
  while (_status === 'loading' && waited < 30000) {
    await new Promise(resolve => setTimeout(resolve, 300));
    waited += 300;
  }

  if (_status !== 'ready') throw new Error(`Modelo no disponible (${_status})`);

  const { session, context, lastUser } = await _createSession(
    messages, options.contextSize
  );
  try {
    const reply = await session.prompt(lastUser, {
      temperature:   options.temperature   ?? 0.35,
      topP:          options.topP          ?? 0.9,
      repeatPenalty: { penalty: options.repeatPenalty ?? 1.18 },
      maxTokens:     options.maxTokens     ?? 1024
    });
    return reply;
  } finally {
    await context.dispose();
  }
}

// ─── STREAMING TOKEN A TOKEN ──────────────────────────────────────────────────
async function* stream(messages, options = {}) {
  let waited = 0;
  while (_status === 'loading' && waited < 30000) {
    await new Promise(resolve => setTimeout(resolve, 300));
    waited += 300;
  }

  if (_status !== 'ready') throw new Error(`Modelo no disponible (${_status})`);

  const { session, context, lastUser } = await _createSession(
    messages, options.contextSize
  );

  const queue   = [];
  let resolveFn = null;
  let done      = false;
  let error     = null;

  function enqueue(token) {
    queue.push(token);
    if (resolveFn) { resolveFn(); resolveFn = null; }
  }

  function waitForToken() {
    return new Promise(resolve => { resolveFn = resolve; });
  }

  const inferencePromise = session.prompt(lastUser, {
    temperature:   options.temperature   ?? 0.35,
    topP:          options.topP          ?? 0.9,
    repeatPenalty: { penalty: options.repeatPenalty ?? 1.18 },
    maxTokens:     options.maxTokens     ?? 1024,
    onTextChunk:   (token) => { enqueue(token); }
  }).then(() => {
    done = true;
    if (resolveFn) { resolveFn(); resolveFn = null; }
  }).catch((err) => {
    error = err;
    done  = true;
    if (resolveFn) { resolveFn(); resolveFn = null; }
  });

  try {
    while (true) {
      while (queue.length > 0) yield queue.shift();
      if (done && queue.length === 0) break;
      await waitForToken();
    }
    await inferencePromise;
    if (error) throw error;
  } finally {
    await context.dispose();
  }
}

module.exports = { init, switchModel, generate, stream, getStatus, getActiveModel, countTokens };