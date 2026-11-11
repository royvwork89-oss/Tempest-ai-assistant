'use strict';

// Fuentes persistentes por chat (v3.1.0). Guarda el texto COMPLETO extraído de
// cada adjunto, separado de lo que se manda al modelo en cada turno (eso lo
// decide chat-docs.selector.js y arma chat-docs.service.js). Solo disco: sin
// reglas de selección, sin llamadas al modelo.
//
// Layout (dentro de la carpeta del proyecto; los chats sin proyecto viven bajo
// projects/general, ver memory.service.js getPaths):
//   chat-docs/<chatId>/
//     index.json   → { docs: [...], lastUsedIds: [...] }
//     <docId>.txt  → texto completo (o recortado al tope de disco)
//
// Contrato de `status`:
//   'active'  → se puede mandar al modelo
//   'removed' → el usuario lo quitó (el archivo se conserva; se puede reactivar)
//   'error'   → la extracción falló, no hay texto que mandar
// 'missing' no se guarda: se detecta en caliente con isMissing() si el índice
// nombra un documento cuyo .txt ya no está en disco.
//
// CONTRATO DE CONCURRENCIA: todo el almacén usa la API SÍNCRONA de fs, así que
// cada lectura-modificación-escritura es indivisible respecto al event loop y
// no necesita candado. Si algún día se vuelve asíncrono, o se agrega un
// endpoint de subida aparte del mensaje, hay que agregar un candado por chat.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_STORAGE_CHARS = 500000; // protección de disco, no presupuesto de contexto
const MAX_ACTIVE_DOCS = 10;

const SAFE_SEGMENT_RE = /^[A-Za-z0-9._-]+$/;
const DOC_ID_RE = /^[a-z0-9-]+$/;

function isSafeSegment(value) {
  return typeof value === 'string' && SAFE_SEGMENT_RE.test(value) && value !== '.' && value !== '..';
}

function isValidDocId(docId) {
  return typeof docId === 'string' && DOC_ID_RE.test(docId);
}

// null si el chatId no es un segmento de ruta seguro: las lecturas devuelven
// vacío y las escrituras lo rechazan, nunca se arma una ruta con texto crudo.
function getChatDocsDir({ projectDir, chatId }) {
  if (!projectDir || !isSafeSegment(chatId)) return null;
  return path.join(projectDir, 'chat-docs', chatId);
}

function getIndexPath(dirInfo) {
  const dir = getChatDocsDir(dirInfo);
  return dir ? path.join(dir, 'index.json') : null;
}

function getDocPath(dirInfo, docId) {
  const dir = getChatDocsDir(dirInfo);
  if (!dir || !isValidDocId(docId)) return null;
  const filePath = path.join(dir, `${docId}.txt`);
  return path.dirname(filePath) === dir ? filePath : null;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

// Escribe a un temporal y renombra: un cierre a medias no deja un archivo
// incompleto con el nombre definitivo.
function atomicWrite(filePath, data) {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, data, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function loadIndex(dirInfo) {
  const indexPath = getIndexPath(dirInfo);
  if (!indexPath || !fs.existsSync(indexPath)) return { docs: [], lastUsedIds: [], lastFragments: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    return {
      docs: Array.isArray(parsed.docs) ? parsed.docs.filter((d) => isValidDocId(d?.id)) : [],
      lastUsedIds: Array.isArray(parsed.lastUsedIds) ? parsed.lastUsedIds.filter(isValidDocId) : [],
      lastFragments: sanitizeFragments(parsed.lastFragments),
    };
  } catch (err) {
    console.error('[chat-docs.store] index.json corrupto, se reinicia:', err.message);
    return { docs: [], lastUsedIds: [], lastFragments: {} };
  }
}

// { docId: [índices de fragmento] } — qué fragmentos de cada documento se enviaron
// en el último turno guardado, para reutilizarlos en una pregunta de seguimiento.
function sanitizeFragments(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, list] of Object.entries(raw)) {
    if (!isValidDocId(id) || !Array.isArray(list)) continue;
    out[id] = list.filter((n) => Number.isInteger(n) && n >= 0 && n < 100000).slice(0, 200);
  }
  return out;
}

function saveIndex(dirInfo, index) {
  const dir = getChatDocsDir(dirInfo);
  if (!dir) throw new Error('chatId inválido');
  ensureDir(dir);
  atomicWrite(getIndexPath(dirInfo), JSON.stringify(index, null, 2));
}

function slugify(name) {
  return String(name || 'doc')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'doc';
}

function makeDocId(index, name) {
  const base = slugify(name);
  const existingIds = new Set(index.docs.map((d) => d.id));
  let id = base;
  let n = 2;
  while (existingIds.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

// Huella del texto extraído (no del nombre): reconoce el mismo contenido
// aunque el archivo se adjunte con otro nombre.
function hashContent(text) {
  const normalized = String(text).replace(/\r\n?/g, '\n').trim();
  return crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

/**
 * Guarda el texto completo de un documento. Si el mismo contenido ya está
 * guardado, lo reutiliza (y lo reactiva si estaba quitado) en vez de duplicar.
 * Si supera el tope de disco se guarda recortado y se marca storageTruncated:
 * el llamador debe avisarlo, nunca en silencio.
 *
 * @param {{projectDir:string, chatId:string}} dirInfo
 * @param {{name:string, type?:string, content?:string, error?:string}} doc
 * @returns {{entry:Object, reused:boolean, reactivated:boolean}}
 */
function saveDocument(dirInfo, { name, type, content, error = null }) {
  const dir = getChatDocsDir(dirInfo);
  if (!dir) throw new Error('chatId inválido');
  ensureDir(dir);

  const index = loadIndex(dirInfo);
  const now = new Date().toISOString();

  if (!error && typeof content === 'string') {
    const contentHash = hashContent(content);
    const existing = index.docs.find((d) => d.contentHash === contentHash && d.status !== 'error');
    if (existing) {
      const reactivated = existing.status === 'removed';
      if (reactivated) existing.status = 'active';
      existing.updatedAt = now;
      saveIndex(dirInfo, index);
      return { entry: existing, reused: true, reactivated };
    }

    const id = makeDocId(index, name);
    const stored = content.length > MAX_STORAGE_CHARS ? content.slice(0, MAX_STORAGE_CHARS) : content;
    atomicWrite(getDocPath(dirInfo, id), stored);

    const entry = {
      id,
      name,
      type: type || 'text',
      status: 'active',
      error: null,
      contentHash,
      chars: stored.length,
      originalChars: content.length,
      storageTruncated: content.length > MAX_STORAGE_CHARS,
      createdAt: now,
      updatedAt: now,
    };
    index.docs.push(entry);
    saveIndex(dirInfo, index);
    return { entry, reused: false, reactivated: false };
  }

  const entry = {
    id: makeDocId(index, name),
    name,
    type: type || 'text',
    status: 'error',
    error: error || 'sin contenido',
    contentHash: null,
    chars: 0,
    originalChars: 0,
    storageTruncated: false,
    createdAt: now,
    updatedAt: now,
  };
  index.docs.push(entry);
  saveIndex(dirInfo, index);
  return { entry, reused: false, reactivated: false };
}

function listDocuments(dirInfo) {
  return loadIndex(dirInfo).docs;
}

function countActive(dirInfo) {
  return loadIndex(dirInfo).docs.filter((d) => d.status === 'active').length;
}

function canAddActive(dirInfo) {
  return countActive(dirInfo) < MAX_ACTIVE_DOCS;
}

// Texto completo, o null si el id no es válido o el archivo no existe.
function getDocumentText(dirInfo, docId) {
  const filePath = getDocPath(dirInfo, docId);
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`[chat-docs.store] No se pudo leer ${docId}:`, err.message);
    return null;
  }
}

// true si el índice nombra el documento pero su .txt ya no está en disco.
function isMissing(dirInfo, docId) {
  const filePath = getDocPath(dirInfo, docId);
  return !filePath || !fs.existsSync(filePath);
}

function setDocumentStatus(dirInfo, docId, status) {
  if (!isValidDocId(docId)) return null;
  const indexPath = getIndexPath(dirInfo);
  if (!indexPath || !fs.existsSync(indexPath)) return null;
  const index = loadIndex(dirInfo);
  const doc = index.docs.find((d) => d.id === docId);
  if (!doc) return null;
  doc.status = status;
  doc.updatedAt = new Date().toISOString();
  saveIndex(dirInfo, index);
  return doc;
}

function getLastUsedIds(dirInfo) {
  return loadIndex(dirInfo).lastUsedIds;
}

// Solo escribe si el índice del chat ya existe: si el chat se borró mientras
// generaba, no se recrea la carpeta.
function getLastFragments(dirInfo) {
  return loadIndex(dirInfo).lastFragments;
}

function setLastUsedIds(dirInfo, ids, fragments) {
  const indexPath = getIndexPath(dirInfo);
  if (!indexPath || !fs.existsSync(indexPath)) return false;
  const index = loadIndex(dirInfo);
  index.lastUsedIds = (Array.isArray(ids) ? ids : []).filter(isValidDocId);
  if (fragments !== undefined) index.lastFragments = sanitizeFragments(fragments);
  saveIndex(dirInfo, index);
  return true;
}

function removeAllForChat(dirInfo) {
  const dir = getChatDocsDir(dirInfo);
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = {
  MAX_STORAGE_CHARS,
  MAX_ACTIVE_DOCS,
  isValidDocId,
  hashContent,
  saveDocument,
  listDocuments,
  countActive,
  canAddActive,
  getDocumentText,
  isMissing,
  setDocumentStatus,
  getLastUsedIds,
  setLastUsedIds,
  getLastFragments,
  removeAllForChat,
};
