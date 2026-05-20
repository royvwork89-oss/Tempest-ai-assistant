const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// Extensiones relevantes para código y docs
const ALLOWED_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx',
  '.json', '.yaml', '.yml', '.toml', '.env',
  '.sql',
  '.css', '.html', '.htm',
  '.py', '.java', '.go', '.rs', '.rb', '.php',
  '.c', '.cpp', '.h', '.cs', '.sh', '.bash',
]);

// Carpetas que nunca se escanean
const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  'vendor', '.bin', '.next', '.cache', '__pycache__',
  '.nyc_output', '.turbo', 'out', '.svelte-kit',
  'uploads', 'outputs', 'backups',
]);

const MAX_FILES_DEFAULT  = 50;
const MAX_CHARS_DEFAULT  = 120000;

/**
 * Lee .gitignore de la raíz y devuelve set de patrones simples (solo nombres/rutas literales).
 * No implementamos glob completo — cubrimos el 90% de los casos reales.
 */
function loadGitignorePatterns(rootPath) {
  const patterns = new Set();
  const gitignorePath = path.join(rootPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return patterns;

  const lines = fs.readFileSync(gitignorePath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Quitamos slashes finales para que coincida con nombre de carpeta
    patterns.add(trimmed.replace(/\/$/, ''));
  }
  return patterns;
}

/**
 * Crawl recursivo del directorio raíz.
 * Devuelve array de { absolutePath, relativePath, ext, mtime, size }
 */
function crawl(rootPath, currentPath, gitignorePatterns, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(currentPath, { withFileTypes: true });
  } catch (_) {
    return results;
  }

  for (const entry of entries) {
    const name = entry.name;

    // Ocultos excepto .env
    if (name.startsWith('.') && name !== '.env') continue;

    const absPath = path.join(currentPath, name);
    const relPath = path.relative(rootPath, absPath).replace(/\\/g, '/');

    // Exclusiones hardcoded
    if (EXCLUDED_DIRS.has(name)) continue;

    // Exclusiones de .gitignore (simple — nombre o ruta)
    if (gitignorePatterns.has(name) || gitignorePatterns.has(relPath)) continue;

    if (entry.isDirectory()) {
      crawl(rootPath, absPath, gitignorePatterns, results);
    } else if (entry.isFile()) {
      const ext = path.extname(name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;

      let stat;
      try { stat = fs.statSync(absPath); } catch (_) { continue; }

      // Ignorar archivos mayores a 30KB
      if (stat.size > 30 * 1024) continue;

      results.push({
        absolutePath: absPath,
        relativePath: relPath,
        ext,
        mtimeMs: stat.mtimeMs,
        sizeBytes: stat.size,
      });
    }
  }

  return results;
}

/**
 * Genera o actualiza projectContext.json para el proyecto.
 * projectDataPath → backend/data/users/local-user/projects/{projectId}/
 * snapshotRoot    → ruta real del repo en disco (ej: H:/Proyectos/IA/Tempest)
 * maxFiles, maxChars → límites configurables (doble compuerta)
 *
 * Devuelve { added, updated, removed, total }
 */
async function generateSnapshot(projectDataPath, snapshotRoot, options = {}) {
  const maxFiles = options.maxFiles || MAX_FILES_DEFAULT;
  const maxChars = options.maxChars || MAX_CHARS_DEFAULT;

  if (!fs.existsSync(snapshotRoot)) {
    throw new Error(`La ruta del proyecto no existe: ${snapshotRoot}`);
  }

  const contextJsonPath = path.join(projectDataPath, 'projectContext.json');

  // Cargar manifest existente (para refresh incremental)
  let existing = { generatedAt: null, snapshotRoot: '', files: {} };
  if (fs.existsSync(contextJsonPath)) {
    try { existing = JSON.parse(fs.readFileSync(contextJsonPath, 'utf-8')); } catch (_) {}
  }

  const gitignorePatterns = loadGitignorePatterns(snapshotRoot);
  const crawled = crawl(snapshotRoot, snapshotRoot, gitignorePatterns);

  // Ordenar por mtime desc (más recientes primero) y aplicar maxFiles
  crawled.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const selected = crawled.slice(0, maxFiles);

  const newFiles = {};
  let added = 0, updated = 0, charCount = 0;

  for (const file of selected) {
    if (charCount >= maxChars) break;

    const prev = existing.files?.[file.relativePath];
    const changed = !prev || prev.mtimeMs !== file.mtimeMs;

    let hash = prev?.hash || '';
    let size = file.sizeBytes;

    if (changed) {
      try {
        const raw = fs.readFileSync(file.absolutePath, 'utf-8');
        hash = 'sha256:' + crypto.createHash('sha256').update(raw).digest('hex');
        charCount += raw.length;
        if (prev) updated++; else added++;
      } catch (_) {
        // Archivo ilegible — skip silencioso
        continue;
      }
    } else {
      charCount += prev.charCount || 0;
    }

    newFiles[file.relativePath] = {
      absolutePath: file.absolutePath,
      relativePath: file.relativePath,
      hash,
      mtimeMs:   file.mtimeMs,
      sizeBytes: size,
      charCount: changed ? (newFiles[file.relativePath]?.charCount || 0) : (prev?.charCount || 0),
    };
  }

  // Calcular removidos (estaban antes, ya no están en disco)
  const removed = Object.keys(existing.files || {}).filter(p => !newFiles[p]).length;

  const manifest = {
    generatedAt: new Date().toISOString(),
    snapshotRoot,
    maxFiles,
    maxChars,
    totalFiles: Object.keys(newFiles).length,
    files: newFiles,
  };

  fs.writeFileSync(contextJsonPath, JSON.stringify(manifest, null, 2));

  return { added, updated, removed, total: manifest.totalFiles };
}

/**
 * Lee el manifest actual sin regenerarlo.
 * Devuelve null si no existe.
 */
function loadManifest(projectDataPath) {
  const p = path.join(projectDataPath, 'projectContext.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (_) { return null; }
}

/**
 * Lee el contenido real de un archivo del snapshot.
 * Devuelve string o null si falla.
 */
function readFileContent(absolutePath) {
  try { return fs.readFileSync(absolutePath, 'utf-8'); } catch (_) { return null; }
}

module.exports = { generateSnapshot, loadManifest, readFileContent };