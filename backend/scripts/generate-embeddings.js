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
    start = end - CHUNK_OVERLAP;
    if (start <= 0 || start >= text.length) break;
  }
  return chunks;
}

// ─── OLLAMA EMBEDDING ─────────────────────────────────────────────────────────
async function getEmbedding(text) {
  const res = await fetch('http://localhost:11434/api/embeddings', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return data.embedding;
}

// ─── VECTOR STORE ─────────────────────────────────────────────────────────────
const storePath = path.join(projectDataPath, 'context', 'embeddings.json');

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
  const store = loadStore();
  let totalChunks = 0;

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

    // Limpiar chunks anteriores del archivo
    for (const key of Object.keys(store.chunks)) {
      if (store.chunks[key].relPath === file.relativePath) delete store.chunks[key];
    }

    for (const chunk of chunks) {
      if (totalChunks >= MAX_CHUNKS) break;
      try {
        chunk.vector = await getEmbedding(chunk.text);
        store.chunks[chunk.chunkId] = {
          relPath:   chunk.relPath,
          text:      chunk.text,
          charStart: chunk.charStart,
          vector:    chunk.vector,
          mtimeMs:   file.mtimeMs,
        };
        totalChunks++;
      } catch (err) {
        console.warn(`[embed-gen] Error en chunk ${chunk.chunkId}:`, err.message);
      }
    }

    saveStore(store);
    console.log(`[embed-gen] ✅ ${file.relativePath} (${chunks.length} chunks) | total: ${totalChunks}/${MAX_CHUNKS}`);
  }

  console.log(`[embed-gen] Completado — ${totalChunks} chunks guardados`);
  process.exit(0);
}

main().catch(err => {
  console.error('[embed-gen] Error fatal:', err.message);
  process.exit(1);
});