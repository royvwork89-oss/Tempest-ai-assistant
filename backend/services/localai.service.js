const cleanReply = require('../utils/cleanReply');
const memory = require('./memory.service');

const DEFAULT_MEMORY_OPTIONS = {
  userId: memory.DEFAULT_USER_ID,
  projectId: memory.DEFAULT_PROJECT_ID,
  chatId: memory.DEFAULT_CHAT_ID
};

function normalizeQuestion(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function formatList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }

  return items
    .filter(Boolean)
    .map(item => `- ${item}`)
    .join('\n');
}

function getCurrentTimeAnswer(message) {
  const question = normalizeQuestion(message);

  const asksTime =
    question.includes('que hora es') ||
    question.includes('dime la hora') ||
    question.includes('hora actual') ||
    question.includes('dame la hora') ||   // ← AGREGA ESTA
    question.includes('que hora');         // ← OPCIONAL (más flexible)

  if (!asksTime) return null;

  const now = new Date();

  const time = now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return `Son las ${time}.`;
}

function buildProfileAnswer(profile) {
  const parts = [];

  if (profile.name) {
    parts.push(`Te llamas ${profile.name}.`);
  }

  if (profile.birthPlace) {
    parts.push(`Eres de ${profile.birthPlace}.`);
  }

  if (profile.nationality) {
    parts.push(`Tu nacionalidad es ${profile.nationality}.`);
  }

  if (profile.currentProject) {
    parts.push(`Actualmente trabajas en: ${profile.currentProject}.`);
  }

  if (Array.isArray(profile.likes) && profile.likes.length > 0) {
    parts.push(`Te gusta:\n${formatList(profile.likes)}`);
  }

  if (Array.isArray(profile.goals) && profile.goals.length > 0) {
    parts.push(`Tus objetivos son:\n${formatList(profile.goals)}`);
  }

  if (Array.isArray(profile.preferences) && profile.preferences.length > 0) {
    parts.push(`Tus preferencias son:\n${formatList(profile.preferences)}`);
  }

  return parts.length > 0
    ? parts.join('\n\n')
    : 'No tengo suficiente información sobre ti todavía.';
}

function getControlledMemoryAnswer(message, fullMemory) {
  const question = normalizeQuestion(message);
  const profile = fullMemory.profile || {};
  const projectMemory = fullMemory.projectMemory || {};

  if (
    question.includes('que sabes de mi') ||
    question.includes('que sabes sobre mi')
  ) {
    return buildProfileAnswer(profile);
  }

  if (
    question.includes('como me llamo') ||
    question.includes('cual es mi nombre')
  ) {
    return profile.name
      ? `Te llamas ${profile.name}.`
      : 'Aún no tengo guardado tu nombre.';
  }

  if (
    question.includes('de donde soy') ||
    question.includes('donde naci') ||
    question.includes('cual es mi lugar de nacimiento')
  ) {
    return profile.birthPlace
      ? `Eres de ${profile.birthPlace}.`
      : 'Aún no tengo guardado tu lugar de origen.';
  }

  if (
    question.includes('que me gusta') ||
    question.includes('cuales son mis gustos')
  ) {
    return Array.isArray(profile.likes) && profile.likes.length > 0
      ? `Te gusta:\n${formatList(profile.likes)}`
      : 'Aún no tengo información sobre tus gustos.';
  }

  if (
    question.includes('que quiero') ||
    question.includes('cuales son mis objetivos') ||
    question.includes('que objetivos tengo')
  ) {
    return Array.isArray(profile.goals) && profile.goals.length > 0
      ? `Tus objetivos son:\n${formatList(profile.goals)}`
      : 'Aún no tengo información sobre tus objetivos.';
  }

  if (
    question.includes('en que trabajo') ||
    question.includes('en que estoy trabajando') ||
    question.includes('cual es mi proyecto actual')
  ) {
    if (profile.currentProject) {
      return `Actualmente trabajas en: ${profile.currentProject}.`;
    }

    if (
      Array.isArray(projectMemory.currentTasks) &&
      projectMemory.currentTasks.length > 0
    ) {
      return `Actualmente tienes estas tareas del proyecto:\n${formatList(projectMemory.currentTasks)}`;
    }

    return 'Aún no tengo información sobre tu trabajo o proyecto actual.';
  }

  if (
    question.includes('como prefiero') ||
    question.includes('mis preferencias') ||
    question.includes('como quiero que respondas')
  ) {
    return Array.isArray(profile.preferences) && profile.preferences.length > 0
      ? `Tus preferencias son:\n${formatList(profile.preferences)}`
      : 'Aún no tengo información sobre tus preferencias.';
  }

  if (
    question.includes('que sabes de tempest') ||
    question.includes('que es tempest') ||
    question.includes('estado del proyecto tempest')
  ) {
    const parts = [];

    if (projectMemory.name) {
      parts.push(`Proyecto: ${projectMemory.name}`);
    }

    if (Array.isArray(projectMemory.facts) && projectMemory.facts.length > 0) {
      parts.push(`Datos del proyecto:\n${formatList(projectMemory.facts)}`);
    }

    if (Array.isArray(projectMemory.currentTasks) && projectMemory.currentTasks.length > 0) {
      parts.push(`Tareas actuales:\n${formatList(projectMemory.currentTasks)}`);
    }

    if (projectMemory.summary) {
      parts.push(`Resumen:\n${projectMemory.summary}`);
    }

    return parts.length > 0
      ? parts.join('\n\n')
      : 'Aún no tengo memoria suficiente sobre Tempest.';
  }

  return null;
}

function buildSystemPrompt(fullMemory) {
  const profile = fullMemory.profile || {};
  const projectMemory = fullMemory.projectMemory || {};

  return `
Eres Tempest, una IA local conversacional.

REGLAS PRINCIPALES:
- Responde en español.
- Responde natural, directo y útil.
- NO saludes en cada respuesta.
- NO digas "basado en lo que has compartido".
- NO digas "según tu memoria".
- NO digas "tus intereses incluyen" salvo que el usuario pregunte explícitamente por sus gustos.
- NO recites listas del perfil en conversación normal.
- NO conviertas cada dato nuevo del usuario en un resumen de memoria.

CUANDO EL USUARIO COMPARTE UN GUSTO:
Ejemplo: "me gusta la ciencia ficción"
Respuesta correcta:
- Entra al tema.
- Pregunta algo interesante.
- Recomienda ideas, obras o caminos relacionados.
- Puedes sonar curioso o creativo.

Respuesta incorrecta:
- "Basado en lo que has compartido..."
- "Tus intereses incluyen..."
- "También te gusta X, Y y Z..."

CUANDO USAR MEMORIA:
- Usa profile SOLO si el usuario pregunta explícitamente:
  "¿Qué sabes de mí?"
  "¿Qué me gusta?"
  "¿Qué quiero?"
  "¿En qué trabajo?"
  "¿Cómo prefiero que respondas?"

CUANDO NO USAR MEMORIA:
- Si el usuario solo conversa.
- Si el usuario comparte un gusto nuevo.
- Si el usuario pide opinión, ideas, explicación o recomendaciones.

ESTILO:
- Conversa como copiloto inteligente.
- Si el tema da para más, invita a profundizar.
- Puedes recomendar 2 o 3 ejemplos.
- Máximo 4 párrafos cortos.

PROFILE DEL USUARIO, SOLO PARA CONSULTAS EXPLÍCITAS DE MEMORIA:
${JSON.stringify(profile, null, 2)}

MEMORIA DEL PROYECTO, SOLO SI EL USUARIO PREGUNTA POR TEMPEST:
${JSON.stringify(projectMemory, null, 2)}
`;
}

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

  if (
    lowerMessage === 'hola' ||
    lowerMessage === 'buenas' ||
    lowerMessage === 'hey'
  ) {
    const name = fullMemory.profile?.name || 'Rogelio';
    const greeting = `Hola ${name}, ¿en qué puedo ayudarte?`;

    memory.addChatHistoryMessage('assistant', greeting, options);
    return greeting;
  }


  const history = memory.getHistory(options).filter(msg => {
    const text = msg.content.toLowerCase();

    if (
      msg.role === 'user' &&
      (
        text.includes('me gusta') ||
        text.includes('quiero') ||
        text.includes('estoy trabajando')
      )
    ) {
      return false;
    }

    if (
      msg.role === 'assistant' &&
      (
        text.includes('no tengo memoria') ||
        text.includes('basado en lo que') ||
        text.trim() === ''
      )
    ) {
      return false;
    }

    return true;
  });

  const messages = [
    {
      role: 'system',
      content: buildSystemPrompt(fullMemory)
    },
    ...history,
    {
      role: 'user',
      content: message
    }
  ];

  console.log('HISTORIAL ENVIADO A LOCALAI:', messages);

  const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'hermes-q4',
      stream: false,
      temperature: 0,
      max_tokens: 160,
      messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error LocalAI: ${errorText}`);
  }

  const data = await response.json();
  console.log('RESPUESTA LOCALAI:', data);

  let reply =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    'Sin respuesta';

  reply = cleanReply(reply);

  if (!reply) {
    reply = 'No pude generar una respuesta válida.';
  }

  memory.addChatHistoryMessage('assistant', reply, options);

  return reply;
}

function cleanGeneratedTitle(rawTitle, sourceText = '') {
  const genericMessages = [
    'hola',
    'buenas',
    'hey',
    'ola',
    'hello',
    'hi',
    'qué tal',
    'que tal'
  ];

  const normalizedSource = String(sourceText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (
    !normalizedSource ||
    genericMessages.includes(normalizedSource) ||
    normalizedSource.length < 5
  ) {
    return 'Saludo inicial';
  }

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
    .replace(/["'`´“”‘’]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[{}[\]();]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  title = title
    .split(' ')
    .filter(word => word.length > 1)
    .slice(0, 5)
    .join(' ')
    .trim();

  if (!title || title.length < 3) {
    return 'Nueva conversación';
  }

  return title.charAt(0).toUpperCase() + title.slice(1);
}

async function generateTitleFromText(text, type = 'chat') {
  const normalizedText = String(text || '').trim();

  const prompt = `
Eres un generador de nombres para chats.

Responde SOLO con un título en español.
Máximo 5 palabras.
Sin comillas.
Sin signos raros.
Sin explicación.
Sin etiquetas.
Sin tokens.
No escribas "Texto base".
No escribas "Chat".
No escribas saludos como "Hola" si el mensaje solo es un saludo.

Si el mensaje es muy genérico, responde:
Nueva conversación

Mensaje:
${normalizedText}

Título:
`.trim();

  try {
    const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'hermes-q4',
        stream: false,
        temperature: 0,
        max_tokens: 20,
        messages: [
          {
            role: 'system',
            content: 'Responde únicamente con un título corto en español. No agregues explicación.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      return cleanGeneratedTitle('', normalizedText);
    }

    const data = await response.json();

    const rawTitle =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      '';

    return cleanGeneratedTitle(rawTitle, normalizedText);
  } catch (error) {
    console.error('Error en generateTitleFromText:', error);
    return cleanGeneratedTitle('', normalizedText);
  }
}

module.exports = 
{ 
  sendToLocalAI,
  generateTitleFromText 
};