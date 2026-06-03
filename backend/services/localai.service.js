const cleanReply = require('../utils/cleanReply');
const { parsePatch } = require('./patch.parser');
const memory = require('./memory.service');
const { getCurrentTimeAnswer, getControlledMemoryAnswer } = require('./localai/memory.answers');
const { buildSystemPrompt } = require('../config/buildSystemPrompt');
const { looksLikeCutReply, removeIncompleteFileBlock } = require('./localai/response.validator');
const { getMaxTokens } = require('./localai/token.profiles');

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
    memory.addChatHistoryMessage('assistant', greeting, options);
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.primaryModel || 'hermes-q4',
      stream: false,
      temperature: 0.3,
      stop: ['<|im_end|>', '<|im_start|>', '://', '\nUser:', '¿Hay algo más', '¿Hay algún', '\ngenera una función'],
      max_tokens: getMaxTokens(options.primaryModel, message, options.mode || 'general', options.hardwareProfile || 'laptop'),
      messages
    })
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error LocalAI: ${errorText}`);
  }

  const data = await response.json();
  console.log('RESPUESTA LOCALAI:', data);

  let reply = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || 'Sin respuesta';
  reply = cleanReply(reply);

  if (!reply) reply = 'No pude generar una respuesta válida.';

  if (looksLikeCutReply(reply)) {
    reply = removeIncompleteFileBlock(reply);

    const continueController = new AbortController();
    const continueTimeoutId = setTimeout(() => continueController.abort(), 300000);

    const continueResponse = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
      method: 'POST',
      signal: continueController.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.primaryModel || 'hermes-q4',
        stream: false,
        temperature: 0.3,
        stop: ['<|im_end|>', '<|im_start|>', '://', '\nUser:', '¿Hay algo más', '¿Hay algún', '\ngenera una función'],
        max_tokens: getMaxTokens(options.primaryModel, message, 'continue', options.hardwareProfile || 'laptop'),
        messages: [
          ...messages,
          { role: 'assistant', content: reply },
          { role: 'user', content: 'Tu respuesta anterior quedó cortada. NO repitas los archivos completos que ya entregaste. Regenera COMPLETO el archivo que quedó incompleto y después continúa con los archivos faltantes. Usa bloques separados.' }
        ]
      })
    });

    clearTimeout(continueTimeoutId);

    if (continueResponse.ok) {
      const continueData = await continueResponse.json();
      const continueReply = cleanReply(continueData?.choices?.[0]?.message?.content || '');
      if (continueReply) reply = reply + '\n\n' + continueReply;
    }
  }

  memory.addChatHistoryMessage('assistant', reply, options);
  return reply;
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

  title = title.split(' ').filter(word => word.length > 1).slice(0, 5).join(' ').trim();

  if (!title || title.length < 3) return 'Nueva conversación';
  return title.charAt(0).toUpperCase() + title.slice(1);
}

async function generateTitleFromText(text, type = 'chat', model = null) {
  const profile = process.env.HARDWARE_PROFILE || 'desktop';
  if (!model) model = profile === 'laptop' ? 'llama-3.2-3b-q4' : 'hermes-q4';
  if (!model) model = 'hermes-q4'; // fallback de seguridad
  console.log(`[generateTitle] profile=${profile} model=${model}`);
  const cleanedText = String(text || '')
    .replace(/---\s*ARCHIVOS ADJUNTOS\s*---[\s\S]*/i, '')
    .trim()
    .slice(0, 300);

  if (!cleanedText) return 'Nueva conversación';

  try {
    const titleController = new AbortController();
    const titleTimeout = setTimeout(() => titleController.abort(), profile === 'laptop' ? 30000 : 60000);
    const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: titleController.signal,
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.3,
        max_tokens: 12,
        messages: [
          {
            role: 'system',
            content: 'Eres un generador de títulos. Responde ÚNICAMENTE con 2 a 4 palabras en español que resuman el mensaje. Sin comillas. Sin puntos. Sin explicación. Solo las palabras del título.'
          },
          {
            role: 'user',
            content: cleanedText
          }
        ]
      })
    });

    if (!response.ok) return cleanGeneratedTitle('', cleanedText);

    clearTimeout(titleTimeout);
    const data = await response.json();
    const rawTitle = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
    return cleanGeneratedTitle(rawTitle, cleanedText);
    
  } catch (error) {
    console.error('Error en generateTitleFromText:', error);
    return cleanGeneratedTitle('', cleanedText);
  }
}

// ─── STREAMING ────────────────────────────────────────────────────────────────

async function* streamToLocalAI(message, options = DEFAULT_MEMORY_OPTIONS) {
  const fullMemory = memory.getFullMemory(options);

  const timeAnswer = getCurrentTimeAnswer(message);
  if (timeAnswer) {
    memory.addChatHistoryMessage('assistant', timeAnswer, options);
    yield timeAnswer;
    return;
  }

  const controlledAnswer = getControlledMemoryAnswer(message, fullMemory);
  if (controlledAnswer) {
    memory.addChatHistoryMessage('assistant', controlledAnswer, options);
    yield controlledAnswer;
    return;
  }

  const lowerMessage = message.toLowerCase().trim();
  if (lowerMessage === 'hola' || lowerMessage === 'buenas' || lowerMessage === 'hey') {
    const name = fullMemory.profile?.name || 'Rogelio';
    const greeting = `Hola ${name}, ¿en qué puedo ayudarte?`;
    memory.addChatHistoryMessage('assistant', greeting, options);
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

  const messages = [
    { role: 'system', content: await buildSystemPrompt({ fullMemory, mode: options.mode || 'general', variant: options.variant || null, userId: options.userId, projectId: options.projectId, userMessage: message, skipContextFiles: options.skipContextFiles || false }) },
    ...chatHistory,
    { role: 'user', content: processedMessage }
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  let fullReply = '';

  try {
    const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.primaryModel || 'hermes-q4',
        stream: true,
        temperature: (options.mode === 'coder' && options.variant === 'patch') ? 0.2 : 0.3,
        stop: (options.mode === 'coder' && options.variant === 'patch')
          ? ['<|im_end|>', '<|im_start|>', '\nREGLAS:', '[![', '\n--- ARCHIVOS', '\ndame el']
          : ['<|im_end|>', '<|im_start|>', '://', '\nUser:', '¿Hay algo más', '¿Hay algún', '\ngenera una función'],
        max_tokens: getMaxTokens(options.primaryModel, message, options.mode || 'general', options.hardwareProfile || 'laptop'),
        messages
      })
    });

    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error LocalAI: ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let stopped = false;
    let started = false;
    const STOP_REGEX = /<\|im_end\|>|<\|end_of_text\|>|<\|begin_of_text\|>|<\|eot_id\|>|<\|im_start\|>/g;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === '[DONE]') { stopped = true; break; }

        try {
          const parsed = JSON.parse(jsonStr);
          const finishReason = parsed?.choices?.[0]?.finish_reason;
          if (finishReason === 'stop' || finishReason === 'length') { stopped = true; break; }

          const rawToken = parsed?.choices?.[0]?.delta?.content;
          if (rawToken == null) continue;

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
            const recent = fullReply.slice(-600);
            // Detectar repetición de frases similares
            if (recent.includes('¿Cómo te gustaría') &&
              (recent.match(/¿Cómo te gustaría/g) || []).length > 1) {
              stopped = true; break;
            }
            // Detector genérico de n-gramas repetidos
            const repeated = /(.{15,80})\1{2,}/s.test(recent);
            const shortLoop = /^(\S+\s*){1,3}\n(\1\s*){3,}/m.test(recent);
            if (repeated || shortLoop) { stopped = true; break; }

            // Detector de loop de bloques patch
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

              // Detector: modelo reescribiendo archivo completo en lugar de diff
              const finCount = (fullReply.match(/--- FIN DE ARCHIVOS ---/g) || []).length;
              if (finCount >= 2) { stopped = true; break; }

              // Detector: modelo repitiendo el bloque de adjunto completo
              const adjCount = (fullReply.match(/\[Archivo \d+:/g) || []).length;
              if (adjCount >= 3) { stopped = true; break; }
            }
          }

          yield rawToken;

        } catch {
          // chunk inválido, ignorar
        }
      }

      if (stopped) break;
    }
  } finally {
    clearTimeout(timeoutId);
  }

 
  fullReply = cleanReply(fullReply);

  if (!fullReply) fullReply = 'No pude generar una respuesta válida.';

  // Retry deshabilitado en patch — el contexto del adjunto confunde el retry
  if (false && options.mode === 'coder' && options.variant === 'patch') {
    const { format } = parsePatch(fullReply);
    if (format !== 'search_replace') {
      console.log(`[patch] formato incorrecto detectado (${format}), reintentando con prompt de corrección...`);
      try {
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 120000);
        const retryResponse = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
          method: 'POST',
          signal: retryController.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: options.primaryModel || 'hermes-q4',
            stream: false,
            temperature: 0.15,
            max_tokens: getMaxTokens(options.primaryModel, message, 'coder', options.hardwareProfile || 'laptop'),
            stop: ['<|im_end|>', '<|im_start|>', 'FUNCIÓN ORIGINAL', 'VERSIÓN MODIFICADA'],
            messages: [
              ...messages,
              { role: 'assistant', content: fullReply },
              { role: 'user', content: 'Convierte tu respuesta anterior al formato Search/Replace exacto. Usa ÚNICAMENTE este formato:\n\nArchivo: ruta/archivo.ext\n\n<<<<<<< SEARCH\n[código original]\n=======\n[código nuevo]\n>>>>>>> REPLACE\n\nNada más.' }
            ]
          })
        });
        clearTimeout(retryTimeout);
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const retryReply = cleanReply(retryData?.choices?.[0]?.message?.content || '');
          console.log('[patch] retry raw:', JSON.stringify(retryReply?.slice(0, 200)));
          if (retryReply) {
            console.log('[patch] retry exitoso');
            fullReply = retryReply;
          }
        }
      } catch (err) {
        console.log('[patch] retry falló:', err.message);
      }
    }
  }

  memory.addChatHistoryMessage('assistant', fullReply, options);
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
  generateTitleFromText
};