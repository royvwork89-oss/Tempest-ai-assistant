// backend/services/context/linked-folder.service.js
//
// Escaneo pesado de la carpeta vinculada a un proyecto: crawl + extracción + manifest.
// Separado a propósito de snapshot.service.js — snapshot es la raíz de código para
// patch mode (apply.service.js depende de un único snapshotRoot), la carpeta vinculada
// es una fuente de documentos/contexto general, sin ese contrato. Ver DECISIONS.md
// ("Lectura de carpeta vinculada por proyecto") para la comparación completa.
//
// Solo se ejecuta bajo demanda (botón "Actualizar carpeta vinculada"), nunca por mensaje.
// linked-folder.provider.js es la contraparte liviana: solo lee lo que este servicio ya
// generó, nunca toca el filesystem.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { extractText } = require('../attachment.service');
const { isPathSafe } = require('./providers/fs.provider');

// ─── Configuración ────────────────────────────────────────────────────────────

// Carpetas que nunca se escanean — misma base que snapshot.service.js
const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  'vendor', '.bin', '.next', '.cache', '__pycache__',
  '.nyc_output', '.turbo', 'out', '.svelte-kit',
  'uploads', 'outputs', 'backups',
]);

// Texto/código + binarios soportados por attachment.service (mismo pipeline que adjuntos,
// sin pipeline de extracción paralelo)
const LINKED_FOLDER_EXTENSIONS = new Set([
  '.txt', '.md', '.html', '.css', '.js', '.ts', '.jsx', '.tsx',
  '.json', '.yaml', '.yml', '.xml', '.csv', '.py', '.java',
  '.c', '.cpp', '.h', '.cs', '.php', '.rb', '.go', '.rs',
  '.sh', '.bash', '.env', '.ini', '.toml', '.sql',
  '.pdf', '.docx', '.xlsx', '.pptx',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
]);

const DEFAULTS = {
  maxDepth: 6,
  maxFiles: 200,
  // Parche rápido (v-actual): 5MB dejaba afuera libros/PDFs reales (ej. manuales
  // técnicos de 70-80MB). 100MB es más realista sin abrir la puerta a cualquier
  // cosa. Solución definitiva pendiente: chunking + selección por relevancia
  // (ver DECISIONS.md, sección de tool use) — eso elimina el límite por completo
  // en vez de solo subirlo. Esto es intencionalmente el parche corto, no el rediseño.
  maxFileSize: 100 * 1024 * 1024, // 100MB
  ignoreGlobs: [
    '**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**',
    '**/*.env', '**/.env*', '**/secrets*', '**/credentials*',
  ],
};

// Válvula de seguridad — tope duro de entradas visitadas, independiente de maxFiles.
// Evita que una carpeta con cientos de miles de archivos (fuera de EXCLUDED_DIRS)
// cuelgue el escaneo. maxFiles ya filtra el resultado final; esto protege el crawl en sí.
const HARD_VISIT_CEILING = 5000;

// ─── Utilidades de path ───────────────────────────────────────────────────────

function globToRegExp(glob) {
  const pattern = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // "**/" y "/**" se resuelven ANTES que "**" suelto — así "**/secrets*" también
    // matchea "secrets.txt" en la raíz (sin directorio antes), igual que .gitignore.
    // Con el reemplazo ingenuo de "**"→".*" quedaba un "/" literal pegado que exigía
    // sí o sí un directorio previo (bug real: dejaba pasar secrets.txt sin excluir).
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\/\*\*/g, '(?:/.*)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  return new RegExp('^' + pattern + '$');
}

function matchesIgnoreGlobs(relPath, globs) {
  return globs.some(g => globToRegExp(g).test(relPath));
}

// ─── Crawl recursivo ──────────────────────────────────────────────────────────

/**
 * Recorre rootPath respetando ignoreGlobs, EXCLUDED_DIRS, maxDepth y extensiones
 * soportadas. No aplica maxFiles acá — eso se decide después, ordenando por mtime
 * (igual que snapshot.service.js), para no sesgar por orden de directorio.
 * Devuelve { entries, truncated } — truncated=true si se pegó contra HARD_VISIT_CEILING.
 */
function crawl(rootPath, realRootPath, currentPath, depth, ignoreGlobs, maxDepth, results, visited) {
  if (maxDepth != null && depth > maxDepth) return;
  if (visited.count >= HARD_VISIT_CEILING) { visited.truncated = true; return; }

  let entries;
  try {
    entries = fs.readdirSync(currentPath, { withFileTypes: true });
  } catch (err) {
    console.warn(`[linked-folder] No se pudo leer ${currentPath}: ${err.message}`);
    return;
  }

  for (const entry of entries) {
    if (visited.count >= HARD_VISIT_CEILING) { visited.truncated = true; return; }
    visited.count++;

    const name = entry.name;
    if (name.startsWith('.') && name !== '.env') continue;
    // Archivos de bloqueo temporal de Office (~$doc.docx) — se crean solos al abrir
    // el archivo real en Word/Excel/PowerPoint, no son contenido, solo ruido.
    if (name.startsWith('~$')) continue;
    if (EXCLUDED_DIRS.has(name)) continue;

    const absPath = path.join(currentPath, name);
    const relPath = path.relative(rootPath, absPath).replace(/\\/g, '/');
    const relPathForDirMatch = entry.isDirectory() ? relPath + '/' : relPath;

    if (matchesIgnoreGlobs(relPathForDirMatch, ignoreGlobs) || matchesIgnoreGlobs(relPath, ignoreGlobs)) continue;

    // Symlinks: containment check antes de seguirlos — bloquea escape fuera de rootPath.
    // Comparamos realpath contra realpath (no contra rootPath sin resolver): si la
    // carpeta vinculada en sí vive detrás de un symlink/junction (frecuente en Windows,
    // y en mounts tipo FUSE), comparar un path resuelto contra uno sin resolver da falsos
    // positivos/negativos. Bug real encontrado en pruebas — no era solo teórico.
    if (entry.isSymbolicLink()) {
      let real;
      try { real = fs.realpathSync(absPath); } catch (_) { continue; }
      if (!isPathSafe(real, realRootPath)) {
        console.warn(`[linked-folder] symlink fuera de la carpeta vinculada, ignorado: ${relPath}`);
        continue;
      }
    }

    if (entry.isDirectory()) {
      crawl(rootPath, realRootPath, absPath, depth + 1, ignoreGlobs, maxDepth, results, visited);
    } else if (entry.isFile()) {
      const ext = path.extname(name).toLowerCase();
      if (!LINKED_FOLDER_EXTENSIONS.has(ext)) continue;

      let stat;
      try { stat = fs.statSync(absPath); } catch (_) { continue; }

      results.push({
        absolutePath: absPath,
        relativePath: relPath,
        ext,
        mtimeMs: stat.mtimeMs,
        sizeBytes: stat.size,
      });
    }
  }
}

// ─── Extracción (reusa attachment.service — mismo pipeline que adjuntos) ──────

async function extractFileContent(absolutePath, relPath) {
  const fakeFile = { originalname: path.basename(relPath), path: absolutePath };
  try {
    const result = await extractText(fakeFile);
    return result?.content || '';
  } catch (err) {
    console.warn(`[linked-folder] Error extrayendo ${relPath}: ${err.message}`);
    return `[Error al extraer contenido de ${relPath}: ${err.message}]`;
  }
}

// ─── Paths de persistencia ─────────────────────────────────────────────────────

function getManifestPath(projectDataPath) {
  return path.join(projectDataPath, 'context', 'linkedFolder.json');
}

function getContentDir(projectDataPath) {
  return path.join(projectDataPath, 'context', 'linked-folder-files');
}

function contentIdFor(relPath) {
  return crypto.createHash('md5').update(relPath).digest('hex');
}

function loadLinkedFolderManifest(projectDataPath) {
  const p = getManifestPath(projectDataPath);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (_) { return null; }
}

/** Lee el contenido ya extraído de un archivo de la carpeta vinculada. Null si no existe. */
function readLinkedFolderFileContent(projectDataPath, contentId) {
  const p = path.join(getContentDir(projectDataPath), `${contentId}.txt`);
  try { return fs.readFileSync(p, 'utf-8'); } catch (_) { return null; }
}

// ─── Generación / refresh del índice ───────────────────────────────────────────

/**
 * Escanea folderRoot, extrae contenido de archivos nuevos/modificados (reusando
 * attachment/extractors vía attachment.service.extractText), y persiste manifest +
 * contenido cacheado. Se llama solo bajo demanda (nunca automático por mensaje).
 *
 * Diffing por mtimeMs+sizeBytes — archivos sin cambios no se re-extraen (evita
 * repetir OCR/parseo de PDF costoso en cada refresh).
 *
 * @returns {{added:number, updated:number, removed:number, total:number,
 *            totalSizeBytes:number, contentHash:string, generatedAt:string,
 *            truncated:boolean}}
 */
async function generateLinkedFolderIndex(projectDataPath, folderRoot, options = {}) {
  const opts = {
    maxDepth:    options.maxDepth    ?? DEFAULTS.maxDepth,
    maxFiles:    options.maxFiles    ?? DEFAULTS.maxFiles,
    maxFileSize: options.maxFileSize ?? DEFAULTS.maxFileSize,
    ignoreGlobs: options.ignoreGlobs || DEFAULTS.ignoreGlobs,
  };

  const resolvedRoot = path.resolve(folderRoot);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    throw new Error(`La carpeta vinculada no existe o no es un directorio: ${folderRoot}`);
  }
  // realpath de la raíz UNA sola vez — usado como referencia estable para el containment
  // check de symlinks internos, sin importar si la raíz misma vive detrás de un symlink.
  const realRoot = fs.realpathSync(resolvedRoot);

  const existing = loadLinkedFolderManifest(projectDataPath) || { files: {} };

  const crawled = [];
  const visited = { count: 0, truncated: false };
  crawl(resolvedRoot, realRoot, resolvedRoot, 0, opts.ignoreGlobs, opts.maxDepth, crawled, visited);

  // Filtro de tamaño + selección final por recencia (igual criterio que snapshot.service.js)
  const oversizedCount = crawled.length - crawled.filter(f => f.sizeBytes <= opts.maxFileSize).length;
  const withinSize = crawled.filter(f => f.sizeBytes <= opts.maxFileSize);
  withinSize.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const selected = withinSize.slice(0, opts.maxFiles);
  // Bug corregido: antes "truncated" solo se reportaba como "maxFiles alcanzado"
  // sin importar la causa real — si el corte fue por tamaño (oversizedCount>0) o
  // por cantidad (withinSize.length>opts.maxFiles), el log ahora distingue cuál fue.
  const truncatedByCount = withinSize.length > opts.maxFiles;
  const truncated = visited.truncated || truncatedByCount || oversizedCount > 0;

  const contentDir = getContentDir(projectDataPath);
  fs.mkdirSync(contentDir, { recursive: true });

  const newFiles = {};
  let added = 0, updated = 0, totalSize = 0;
  const hashes = [];

  for (const file of selected) {
    const prev = existing.files?.[file.relativePath];
    const changed = !prev || prev.mtimeMs !== file.mtimeMs || prev.sizeBytes !== file.sizeBytes;
    const contentId = contentIdFor(file.relativePath);

    let content, hash, charCount;

    if (changed) {
      content = await extractFileContent(file.absolutePath, file.relativePath);
      hash = 'sha256:' + crypto.createHash('sha256').update(content).digest('hex');
      fs.writeFileSync(path.join(contentDir, `${contentId}.txt`), content, 'utf-8');
      charCount = content.length;
      if (prev) updated++; else added++;
    } else {
      hash = prev.hash;
      charCount = prev.charCount;
    }

    newFiles[file.relativePath] = {
      relativePath: file.relativePath,
      absolutePath: file.absolutePath,
      ext: file.ext,
      contentId,
      hash,
      mtimeMs: file.mtimeMs,
      sizeBytes: file.sizeBytes,
      charCount,
    };

    hashes.push(hash);
    totalSize += file.sizeBytes;
  }

  // Limpiar contenido cacheado de archivos que salieron del set (borrados, renombrados,
  // excluidos por un ignoreGlob nuevo, o desplazados por el límite de maxFiles)
  const staleEntries = Object.values(existing.files || {}).filter(f => !newFiles[f.relativePath]);
  for (const stale of staleEntries) {
    try {
      fs.unlinkSync(path.join(contentDir, `${stale.contentId}.txt`));
    } catch (err) {
      // No aborta el refresh por un archivo huérfano que no se pudo limpiar (permiso,
      // antivirus con lock, etc.) — pero se loguea: antes quedaba en silencio total.
      console.warn(`[linked-folder] No se pudo borrar contenido cacheado de ${stale.relativePath}: ${err.message}`);
    }
  }

  const removed = staleEntries.length;
  const contentHash = 'sha256:' + crypto.createHash('sha256').update(hashes.slice().sort().join('')).digest('hex');

  const manifest = {
    generatedAt: new Date().toISOString(),
    folderRoot: resolvedRoot,
    options: opts,
    totalFiles: Object.keys(newFiles).length,
    totalSizeBytes: totalSize,
    contentHash,
    truncated,
    files: newFiles,
  };

  fs.writeFileSync(getManifestPath(projectDataPath), JSON.stringify(manifest, null, 2));

  if (truncated) {
    // Antes este mensaje siempre decía "maxFiles alcanzado" sin importar la causa
    // real — con carpetas chicas pero con archivos grandes (ej. libros/PDFs), el
    // corte real era por maxFileSize y el log culpaba al límite equivocado.
    const causes = [];
    if (oversizedCount > 0) causes.push(`${oversizedCount} archivo(s) superan maxFileSize=${(opts.maxFileSize / (1024 * 1024)).toFixed(0)}MB`);
    if (truncatedByCount) causes.push(`más de maxFiles=${opts.maxFiles} candidatos dentro del límite de tamaño`);
    if (visited.truncated) causes.push(`HARD_VISIT_CEILING=${HARD_VISIT_CEILING} alcanzado durante el recorrido`);
    console.warn(`[linked-folder] Escaneo truncado — causa(s): ${causes.join('; ')}. ` +
      `Se indexaron los ${selected.length} archivos más recientes.`);
  }

  return {
    added, updated, removed,
    total: manifest.totalFiles,
    totalSizeBytes: totalSize,
    contentHash,
    generatedAt: manifest.generatedAt,
    truncated,
  };
}

module.exports = {
  generateLinkedFolderIndex,
  loadLinkedFolderManifest,
  readLinkedFolderFileContent,
  DEFAULTS,
};
