const cleanReply = require('../utils/cleanReply');
const memory = require('./memory.service');
const { getCurrentTimeAnswer, getControlledMemoryAnswer, buildSystemPrompt } = require('./localai/memory.answers');
const { looksLikeCutReply, removeIncompleteFileBlock } = require('./localai/response.validator');
const { getMaxTokens } = require('./localai/token.profiles');

const DEFAULT_MEMORY_OPTIONS = {
  userId: memory.DEFAULT_USER_ID,
  projectId: memory.DEFAULT_PROJECT_ID,
  chatId: memory.DEFAULT_CHAT_ID
};

async function sendToLocalAI(message, options = DEFAULT_MEMORY_OPTIONS) {
  memory.detectUserData(message, options);
  memory.addMessage('user', message, options);
  memory.addChatHistoryMessage('user', message, options);

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

  const history = memory.getHistory(options).filter(msg => {
    const text = msg.content.toLowerCase();
    if (msg.role === 'user' && (text.includes('me gusta') || text.includes('quiero') || text.includes('estoy trabajando')))
      return false;
    if (msg.role === 'assistant' && (text.includes('no tengo memoria') || text.includes('basado en lo que') || text.trim() === ''))
      return false;
    return true;
  }).slice(-4);

  const messages = [
    { role: 'system', content: buildSystemPrompt(fullMemory) },
    ...history,
    { role: 'user', content: message }
  ];

  console.log('HISTORIAL ENVIADO A LOCALAI:', messages);
  console.log('MODELO USADO:', options);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.primaryModel || 'hermes-q4',
      stream: false,
      temperature: 0,
      max_tokens: getMaxTokens(options.primaryModel, message, 'normal', options.hardwareProfile || 'laptop'),
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
    const continueTimeoutId = setTimeout(() => continueController.abort(), 120000);

    const continueResponse = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
      method: 'POST',
      signal: continueController.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.primaryModel || 'hermes-q4',
        stream: false,
        temperature: 0,
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

async function generateTitleFromText(text, type = 'chat', model = 'hermes-q4') {
  const normalizedText = String(text || '').trim();

  const prompt = `
Eres un generador de nombres para chats.
Responde SOLO con un título en español.
Máximo 5 palabras. Sin comillas. Sin signos raros. Sin explicación.
Si el mensaje es muy genérico, responde: Nueva conversación

Mensaje:
${normalizedText}

Título:
`.trim();

  try {
    const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0,
        max_tokens: 20,
        messages: [
          { role: 'system', content: 'Responde únicamente con un título corto en español.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) return cleanGeneratedTitle('', normalizedText);

    const data = await response.json();
    const rawTitle = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
    return cleanGeneratedTitle(rawTitle, normalizedText);
  } catch (error) {
    console.error('Error en generateTitleFromText:', error);
    return cleanGeneratedTitle('', normalizedText);
  }
}

module.exports = {
  sendToLocalAI,
  generateTitleFromText
};