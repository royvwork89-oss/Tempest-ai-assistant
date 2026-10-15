'use strict';

// ─── GENERADOR DE EMBEDDINGS STANDALONE ──────────────────────────────────────
// Sin dependencias de Tempest — solo fs, path y Ollama HTTP.
// Uso: node backend/scripts/generate-embeddings.js <projectId> [userId]

const fs   = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config/appPaths');

// ─── ARGS ─────────────────────────────────────────────────────────────────────
const projectId = process.argv[2];
const userId    = process.argv[3];

if (!projectId) {
  console.error('Uso: node generate-embeddings.js <projectId> [userId]');
  process.exit(1);
}

// ─── ENCONTRAR PROYECTO ───────────────────────────────────────────────────────
const usersDir = path.join(DATA_DIR, 'users');
let projectDataPath = null;

if (userId) {
  const candidate = path.join(usersDir, userId, 'projects', projectId);
  if (fs.existsSync(candidate)) projectDataPath = candidate;
} else {
  for (const user of fs.readdirSync(usersDir)) {
    const candidate = path.join(usersDir, user, 'projects', projectId);
    if (fs.existsSync(candidate)) { projectDataPath = candidate; break; }
  }
}

if (!projectDataPath) {
  console.error(`No se encontró el proyecto "${projectId}"`);
  process.exit(1);
}

// ─── LEER MANIFEST ────────────────────────────────────────────────────────────
const contextPath = path.join(projectDataPath, 'projectContext.json');
if (!fs.existsSync(contextPath)) {
  console.error('No hay projectContext.json — genera el snapshot desde la UI primero');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));
const files = Object.values(manifest.files || {});

if (files.length === 0) {
  console.log('[embed-gen] No hay archivos en el snapshot');
  process.exit(0);
}

// ─── CHUNKER INLINE ───────────────────────────────────────────────────────────
const CHUNK_SIZE    = 4000;
const CHUNK_OVERLAP = 150;
const MAX_CHUNKS =    300;
const MAX_CHUNKS_PER_FILE = 15;

function chunkText(text, relPath) {
  const chunks = [];
  let start = 0, index = 0;
  while (start < text.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end);
      if (lastNewline > start + CHUNK_OVERLAP) end = lastNewline + 1;
    }
    const t = text.slice(start, end).trim();
    if (t.length > 0) chunks.push({ chunkId: `${relPath}::${index++}`, relPath, text: t, charStart: start });
    if (end >= text.length) break;
    start = end - CHUNK_OVERLAP;
    if (start <= 0 || start >= text.length) break;
  }
  return chunks;
}

// ─── EMBEDDING LOCAL (node-llama-cpp) ─────────────────────────────────────────
// Reemplaza a Ollama (ver DECISIONS.md v2.14.0 y "Embeddings sin Ollama") —
// modelo GGUF chico dedicado (nomic-embed-text-v1.5, ~80MB), cargado una vez
// en este proceso hijo aislado (no toca el modelo de chat del proceso
// principal). Script se mantiene sin imports de otros módulos de Tempest a
// propósito — node-llama-cpp es una dependencia de npm, no un módulo interno.
const EMBED_MODEL_FILENAME = 'nomic-embed-text-v1.5.Q4_K_M.gguf';

function resolveEmbedModelPath() {
  const modelsDir = process.env.MODELS_DIR
    ? path.resolve(process.env.MODELS_DIR)
    : path.join(__dirname, '../../models-localai');
  return path.join(modelsDir, EMBED_MODEL_FILENAME);
}

const LOAD_ATTEMPTS = [
  { useGpu: true,  waitMs: 0 },
  { useGpu: true,  waitMs: 5000 },
  { useGpu: false, waitMs: 10000 },
];
const FILE_ATTEMPTS = 3;
const FILE_RETRY_WAIT_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadEmbedContext(useGpu) {
  const { getLlama } = await import('node-llama-cpp');
  const llama = await getLlama({ gpu: useGpu ? 'auto' : false });
  const modelPath = resolveEmbedModelPath();
  console.log(`[embed-gen] Cargando modelo de embeddings local (${useGpu ? 'GPU' : 'CPU'}): ${modelPath}`);
  const model = await llama.loadModel({ modelPath, gpuLayers: useGpu ? 99 : 0 });
  return model.createEmbeddingContext();
}

let _embedContext = null;
async function getEmbedContext() {
  if (_embedContext) return _embedContext;
  let lastError = null;
  for (let i = 0; i < LOAD_ATTEMPTS.length; i++) {
    const { useGpu, waitMs } = LOAD_ATTEMPTS[i];
    if (waitMs) await sleep(waitMs);
    try {
      _embedContext = await loadEmbedContext(useGpu);
      return _embedContext;
    } catch (err) {
      lastError = err;
      console.warn(`[embed-gen] Intento ${i + 1}/${LOAD_ATTEMPTS.length} de cargar el modelo (${useGpu ? 'GPU' : 'CPU'}) falló: ${err.message}`);
    }
  }
  throw lastError;
}

async function getEmbedding(text) {
  const context = await getEmbedContext();
  const embedding = await context.getEmbeddingFor(text);
  return Array.from(embedding.vector);
}

// ─── VECTOR STORE ─────────────────────────────────────────────────────────────
const storePath = path.join(projectDataPath, 'context', 'embeddings.json');
const statusPath = path.join(projectDataPath, 'context', 'embeddings-status.json');

function writeStatus(state, extra = {}) {
  try {
    fs.mkdirSync(path.dirname(statusPath), { recursive: true });
    fs.writeFileSync(statusPath, JSON.stringify({
      state,
      model: EMBED_MODEL_FILENAME.replace(/\.gguf$/i, ''),
      updatedAt: new Date().toISOString(),
      ...extra,
    }, null, 2));
  } catch (err) {
    console.warn('[embed-gen] No se pudo escribir embeddings-status.json:', err.message);
  }
}

function loadStore() {
  if (!fs.existsSync(storePath)) return { version: 1, chunks: {} };
  try { return JSON.parse(fs.readFileSync(storePath, 'utf-8')); } catch { return { version: 1, chunks: {} }; }
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[embed-gen] Proyecto: ${projectId} | ${files.length} archivos`);
  writeStatus('generating', { message: 'Generando embeddings…' });

  const modelPath = resolveEmbedModelPath();
  if (!fs.existsSync(modelPath)) {
    writeStatus('error', { message: 'No se encontró el modelo de embeddings — descárgalo en Configuración → Modelos' });
    console.error(`[embed-gen] ERROR: no se encontró el modelo de embeddings en ${modelPath} — embeddings.json no se modificó. Descárgalo desde Configuración → Modelos (${EMBED_MODEL_FILENAME}).`);
    process.exit(1);
  }
  try {
    await getEmbedContext();
  } catch (err) {
    writeStatus('error', { message: `No se pudo cargar el modelo de embeddings tras ${LOAD_ATTEMPTS.length} intentos (${err.message})` });
    console.error(`[embed-gen] ERROR: no se pudo cargar el modelo de embeddings tras ${LOAD_ATTEMPTS.length} intentos (${err.message}) — embeddings.json no se modificó.`);
    process.exit(1);
  }

  const store = loadStore();
  store.model = EMBED_MODEL_FILENAME.replace(/\.gguf$/i, '');
  let totalChunks = 0;
  let failedFiles = 0;

  for (const file of files) {
    if (totalChunks >= MAX_CHUNKS) {
      console.log(`[embed-gen] Límite de ${MAX_CHUNKS} chunks alcanzado — resto usa fallback`);
      break;
    }

    if (!fs.existsSync(file.absolutePath)) continue;

    let raw;
    try { raw = fs.readFileSync(file.absolutePath, 'utf-8'); } catch { continue; }

    const chunks = chunkText(raw, file.relativePath).slice(0, MAX_CHUNKS_PER_FILE);
    if (chunks.length === 0) continue;

    let newEntries = {};
    let fileFailed = false;
    for (let attempt = 1; attempt <= FILE_ATTEMPTS; attempt++) {
      newEntries = {};
      fileFailed = false;
      for (const chunk of chunks) {
        if (totalChunks + Object.keys(newEntries).length >= MAX_CHUNKS) break;
        try {
          newEntries[chunk.chunkId] = {
            relPath:   chunk.relPath,
            text:      chunk.text,
            charStart: chunk.charStart,
            vector:    await getEmbedding(chunk.text),
            mtimeMs:   file.mtimeMs,
          };
        } catch (err) {
          fileFailed = true;
          console.warn(`[embed-gen] Intento ${attempt}/${FILE_ATTEMPTS} — error en chunk ${chunk.chunkId}:`, err.message);
          break;
        }
      }
      if (!fileFailed) break;
      if (attempt < FILE_ATTEMPTS) await sleep(FILE_RETRY_WAIT_MS * attempt);
    }

    const generated = Object.keys(newEntries).length;
    if (fileFailed || generated === 0) {
      failedFiles++;
      console.warn(`[embed-gen] ⚠ ${file.relativePath}: no se generaron sus embeddings — se conservan los anteriores`);
      continue;
    }

    for (const key of Object.keys(store.chunks)) {
      if (store.chunks[key].relPath === file.relativePath) delete store.chunks[key];
    }
    Object.assign(store.chunks, newEntries);
    totalChunks += generated;

    saveStore(store);
    console.log(`[embed-gen] ✅ ${file.relativePath} (${generated} chunks) | total: ${totalChunks}/${MAX_CHUNKS}`);
  }

  const storedChunks = Object.keys(store.chunks).length;
  if (!failedFiles) {
    writeStatus('ok', { chunks: storedChunks, failedFiles: 0, message: `${storedChunks} fragmentos` });
  } else if (storedChunks > 0) {
    writeStatus('partial', { chunks: storedChunks, failedFiles, message: `${failedFiles} archivo(s) con error — se conservan los anteriores` });
  } else {
    writeStatus('error', { chunks: 0, failedFiles, message: `No se generó ningún embedding (${failedFiles} archivo(s) con error)` });
  }
  console.log(`[embed-gen] Completado — ${totalChunks} chunks guardados${failedFiles ? `, ${failedFiles} archivo(s) con error` : ''}`);
  process.exit(failedFiles ? 1 : 0);
}

main().catch(err => {
  console.error('[embed-gen] Error fatal:', err.message);
  process.exit(1);
});