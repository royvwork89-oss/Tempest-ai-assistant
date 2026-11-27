'use strict';

// Decide QUÉ documentos activos del chat van en el turno actual. Funciones
// puras: no tocan disco ni llaman al modelo. Reglas, en orden de prioridad:
//
//   1. Adjuntado en este mensaje (y, si el mensaje además nombra otro, ese
//      también): es lo que el usuario acaba de dar.
//   2. Nombrado explícitamente en el mensaje.
//   3. Los usados en el turno anterior, si siguen activos.
//   4. Todos los activos, si caben en el presupuesto.
//   5. Único activo: va aunque no quepa (se recorta aguas abajo, con aviso).
//   6. Varios que no caben y no se puede decidir: se pregunta, sin modelo.
//
// Cuando se eligen varios y no caben todos, el primero va siempre y los demás
// entran mientras quepan; el resto sale como excluido con su motivo. Nunca se
// recortan todos "un poco".

// Referencias claras a "el documento" sin nombrarlo. Deliberadamente más
// estrecha que "el archivo" / "el texto": en un chat de código esas dos frases
// se usan para otras cosas ("cómo guardo el archivo") y cortarían la
// conversación sin motivo. La parte de "pregunta de existencia" (tienes/hay/
// tengo + algún/ningún + documento) solo se evalúa con 0 documentos activos
// (selectDocuments devuelve outcome 'none'), así que no choca con ese caso.
const DOCUMENT_REFERENCE_RE =
  /\b(el|ese|este|dicho|mismo)\s+(documento|adjunto)\b|\b(el|ese|este)\s+(pdf|archivo adjunto)\b|lo que (te )?(pas[eé]|mand[eé]|adjunt[eé]|envi[eé])(?![a-záéíóúñ])|lo que (subiste|acabo de pasarte)|\b(tienes?|hay|tengo|cuentas? con|cuento con|dispones? de)(?:\s+\S+){0,2}?\s+(alg[uú]n|ning[uú]n)\s+(documentos?|archivos?(?: adjuntos?)?|pdfs?|adjuntos?)\b/i;

function referencesDocumentImplicitly(message) {
  return DOCUMENT_REFERENCE_RE.test(String(message || ''));
}

// Busca en `documents` (de cualquier estado) el que el mensaje nombra por su
// nombre de archivo, con o sin extensión. Gana el nombre más largo.
function findNamedDocument(message, documents) {
  const msg = String(message || '').toLowerCase();
  if (!msg) return null;

  let best = null;
  let bestLen = 0;
  for (const doc of documents) {
    const name = String(doc.name || '');
    const withoutExt = name.replace(/\.[a-z0-9]+$/i, '');
    for (const candidate of [name, withoutExt]) {
      if (candidate.length >= 4 && msg.includes(candidate.toLowerCase()) && candidate.length > bestLen) {
        best = doc;
        bestLen = candidate.length;
      }
    }
  }
  return best;
}

// El mensaje nombra un documento que no se puede usar. Devuelve
// { doc, problem: 'removed' | 'error' | 'missing' } o null si el nombrado está
// bien (o no se nombró ninguno). Caso (a) del cortocircuito.
function classifyNamedDocument(message, allDocuments, missingIds = []) {
  const doc = findNamedDocument(message, allDocuments);
  if (!doc) return null;
  if (doc.status === 'removed') return { doc, problem: 'removed' };
  if (doc.status === 'error') return { doc, problem: 'error' };
  if (doc.status === 'active' && missingIds.includes(doc.id)) return { doc, problem: 'missing' };
  return null;
}

// Reparte en orden: el primero siempre entra; los demás mientras quepan.
function packToBudget(docs, budgetChars) {
  const included = [];
  const overflow = [];
  let used = 0;
  for (const doc of docs) {
    if (included.length === 0 || used + (doc.chars || 0) <= budgetChars) {
      included.push(doc);
      used += doc.chars || 0;
    } else {
      overflow.push(doc);
    }
  }
  return { included, overflow };
}

function buildResult(outcome, included, allActive, reason, overflow = []) {
  const includedIds = new Set(included.map((d) => d.id));
  const overflowIds = new Set(overflow.map((d) => d.id));
  const excluded = allActive
    .filter((d) => !includedIds.has(d.id))
    .map((d) => ({ ...d, reason: overflowIds.has(d.id) ? 'budget_exceeded' : 'not_selected' }));
  return { outcome, included, excluded, reason };
}

/**
 * @param {Object} params
 * @param {string} params.message
 * @param {Array<{id,name,chars}>} params.documents - solo los ACTIVOS del chat
 * @param {string[]} [params.attachedNowIds] - ids adjuntados en este mensaje
 * @param {string[]} [params.previousUsedIds] - ids usados en el turno anterior
 * @param {number} params.budgetChars
 * @returns {{outcome:'none'|'select'|'ask', included:Array, excluded:Array, reason:string, question?:string}}
 */
function selectDocuments({ message, documents = [], attachedNowIds = [], previousUsedIds = [], budgetChars = 0 }) {
  if (documents.length === 0) {
    return { outcome: 'none', included: [], excluded: [], reason: 'sin documentos activos en el chat' };
  }

  const named = findNamedDocument(message, documents);

  // 1. Adjuntado en este mensaje
  const attachedNow = documents.filter((d) => attachedNowIds.includes(d.id));
  if (attachedNow.length > 0) {
    const candidates = named && !attachedNow.some((d) => d.id === named.id) ? [...attachedNow, named] : attachedNow;
    const { included, overflow } = packToBudget(candidates, budgetChars);
    return buildResult('select', included, documents, 'adjuntado en este mensaje', overflow);
  }

  // 2. Nombrado explícitamente
  if (named) {
    return buildResult('select', [named], documents, `nombrado en el mensaje: "${named.name}"`);
  }

  // 3. Los del turno anterior
  if (previousUsedIds.length > 0) {
    const previous = documents.filter((d) => previousUsedIds.includes(d.id));
    if (previous.length > 0) {
      const { included, overflow } = packToBudget(previous, budgetChars);
      return buildResult('select', included, documents, 'se repiten los documentos del turno anterior', overflow);
    }
  }

  // 4. Todos caben
  const total = documents.reduce((sum, d) => sum + (d.chars || 0), 0);
  if (total <= budgetChars) {
    return buildResult('select', documents, documents, 'todos los documentos activos caben');
  }

  // 5. Único activo
  if (documents.length === 1) {
    return buildResult('select', documents, documents, 'único documento activo del chat');
  }

  // 6. No se puede decidir
  return {
    outcome: 'ask',
    included: [],
    excluded: documents.map((d) => ({ ...d, reason: 'not_selected' })),
    reason: 'varios documentos no caben juntos y no se nombró ninguno',
    question:
      `Hay ${documents.length} documentos en este chat y no caben juntos: ` +
      `${documents.map((d) => d.name).join(', ')}. ¿Sobre cuál preguntas?`,
  };
}

module.exports = {
  referencesDocumentImplicitly,
  findNamedDocument,
  classifyNamedDocument,
  packToBudget,
  selectDocuments,
};
