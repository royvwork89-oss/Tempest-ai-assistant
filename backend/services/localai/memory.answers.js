const memory = require('../memory.service');

function normalizeQuestion(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function formatList(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items.filter(Boolean).map(item => `- ${item}`).join('\n');
}

function getCurrentTimeAnswer(message) {
  const question = normalizeQuestion(message);
  const asksTime =
    question.includes('que hora es') ||
    question.includes('dime la hora') ||
    question.includes('hora actual') ||
    question.includes('dame la hora') ||
    question.includes('que hora');

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
  if (profile.name) parts.push(`Te llamas ${profile.name}.`);
  if (profile.birthPlace) parts.push(`Eres de ${profile.birthPlace}.`);
  if (profile.nationality) parts.push(`Tu nacionalidad es ${profile.nationality}.`);
  if (profile.currentProject) parts.push(`Actualmente trabajas en: ${profile.currentProject}.`);
  if (Array.isArray(profile.likes) && profile.likes.length > 0)
    parts.push(`Te gusta:\n${formatList(profile.likes)}`);
  if (Array.isArray(profile.goals) && profile.goals.length > 0)
    parts.push(`Tus objetivos son:\n${formatList(profile.goals)}`);
  if (Array.isArray(profile.preferences) && profile.preferences.length > 0)
    parts.push(`Tus preferencias son:\n${formatList(profile.preferences)}`);
  return parts.length > 0 ? parts.join('\n\n') : 'No tengo suficiente información sobre ti todavía.';
}

function getControlledMemoryAnswer(message, fullMemory) {
  const question = normalizeQuestion(message);
  const profile = fullMemory.profile || {};
  const projectMemory = fullMemory.projectMemory || {};

  if (question.includes('que sabes de mi') || question.includes('que sabes sobre mi'))
    return buildProfileAnswer(profile);

  if (question.includes('como me llamo') || question.includes('cual es mi nombre'))
    return profile.name ? `Te llamas ${profile.name}.` : 'Aún no tengo guardado tu nombre.';

  if (question.includes('de donde soy') || question.includes('donde naci'))
    return profile.birthPlace ? `Eres de ${profile.birthPlace}.` : 'Aún no tengo guardado tu lugar de origen.';

  if (question.includes('que me gusta') || question.includes('cuales son mis gustos'))
    return Array.isArray(profile.likes) && profile.likes.length > 0
      ? `Te gusta:\n${formatList(profile.likes)}`
      : 'Aún no tengo información sobre tus gustos.';

  if (question.includes('que quiero') || question.includes('cuales son mis objetivos'))
    return Array.isArray(profile.goals) && profile.goals.length > 0
      ? `Tus objetivos son:\n${formatList(profile.goals)}`
      : 'Aún no tengo información sobre tus objetivos.';

  if (question.includes('en que trabajo') || question.includes('en que estoy trabajando')) {
    if (profile.currentProject) return `Actualmente trabajas en: ${profile.currentProject}.`;
    if (Array.isArray(projectMemory.currentTasks) && projectMemory.currentTasks.length > 0)
      return `Actualmente tienes estas tareas:\n${formatList(projectMemory.currentTasks)}`;
    return 'Aún no tengo información sobre tu trabajo actual.';
  }

  if (question.includes('como prefiero') || question.includes('mis preferencias'))
    return Array.isArray(profile.preferences) && profile.preferences.length > 0
      ? `Tus preferencias son:\n${formatList(profile.preferences)}`
      : 'Aún no tengo información sobre tus preferencias.';

  if (question.includes('que sabes de tempest') || question.includes('que es tempest')) {
    const parts = [];
    if (projectMemory.name) parts.push(`Proyecto: ${projectMemory.name}`);
    if (Array.isArray(projectMemory.facts) && projectMemory.facts.length > 0)
      parts.push(`Datos:\n${formatList(projectMemory.facts)}`);
    if (Array.isArray(projectMemory.currentTasks) && projectMemory.currentTasks.length > 0)
      parts.push(`Tareas:\n${formatList(projectMemory.currentTasks)}`);
    if (projectMemory.summary) parts.push(`Resumen:\n${projectMemory.summary}`);
    return parts.length > 0 ? parts.join('\n\n') : 'Aún no tengo memoria suficiente sobre Tempest.';
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

Respuesta incorrecta:
- "Basado en lo que has compartido..."
- "Tus intereses incluyen..."

CUANDO USAR MEMORIA:
- Usa profile SOLO si el usuario pregunta explícitamente:
  "¿Qué sabes de mí?" / "¿Qué me gusta?" / "¿En qué trabajo?"

CUANDO NO USAR MEMORIA:
- Si el usuario solo conversa.
- Si el usuario comparte un gusto nuevo.
- Si el usuario pide opinión, ideas o recomendaciones.

ESTILO:
- Conversa como copiloto inteligente.
- Si el tema da para más, invita a profundizar.
- Puedes recomendar 2 o 3 ejemplos.
- Máximo 4 párrafos cortos.

REGLAS DE CÓDIGO (MUY IMPORTANTE):
- Si el usuario pide código, SIEMPRE responde con bloques separados.
- Cada archivo debe ir en su propio bloque.
- Escribe siempre: Archivo: nombre-del-archivo.ext antes de cada uno.
- Nunca mezcles archivos.
- Nunca cortes código.
- Entrega TODOS los archivos solicitados.

PRIORIDAD:
Si el usuario pide varios archivos:
- entrega TODOS aunque sean simples
- NO te detengas después del primero

ACLARACIÓN CRÍTICA:
- Cuando el usuario pide archivos, NO estás creando archivos reales.
- SOLO estás mostrando ejemplos de código.
- SIEMPRE puedes generar código sin pedir más información.

PROFILE DEL USUARIO, SOLO PARA CONSULTAS EXPLÍCITAS DE MEMORIA:
${JSON.stringify(profile, null, 2)}

MEMORIA DEL PROYECTO, SOLO SI EL USUARIO PREGUNTA POR TEMPEST:
${JSON.stringify(projectMemory, null, 2)}
`;
}

module.exports = {
  getCurrentTimeAnswer,
  getControlledMemoryAnswer,
  buildSystemPrompt
};