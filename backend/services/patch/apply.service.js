// backend/services/patch/apply.service.js
const fs   = require('fs');
const path = require('path');

/**
 * Normaliza texto para matching: colapsa espacios y normaliza saltos de línea.
 * NUNCA escribimos el texto normalizado — solo lo usamos para buscar.
 */
function normalize(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')   // non-breaking space
    .replace(/\ufeff/g, '')    // BOM
    .replace(/\u200b/g, '')    // zero-width space
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n');
}

/**
 * Containment check: la ruta resuelta debe estar dentro de projectRoot.
 * Previene path traversal (ej: ../../etc/passwd).
 */
/**
 * Normalización fuzzy para firmas de función — ignora valores por defecto.
 */
function normalizeFunctionSignature(text) {
  return text
    .replace(/=\s*'[^']*'/g, '')      // = 'string'
    .replace(/=\s*"[^"]*"/g, '')      // = "string"
    .replace(/=\s*\[[^\]]*\]/g, '')   // = []
    .replace(/=\s*\{[^}]*\}/g, '')    // = {}
    .replace(/=\s*null\b/g, '')       // = null
    .replace(/=\s*false\b/g, '')      // = false
    .replace(/=\s*true\b/g, '')       // = true
    .replace(/=\s*\d+/g, '')          // = número
    .replace(/\s*,/g, ',')            // espacio antes de coma
    .replace(/\s*}/g, '}')            // espacio antes de }
    .replace(/\s*\)/g, ')')           // espacio antes de )
    .replace(/\s+/g, ' ')
    .trim();
}

function assertContained(absolutePath, projectRoot) {
  const resolved = path.resolve(absolutePath);
  const root     = path.resolve(projectRoot);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Ruta fuera del proyecto: ${resolved}`);
  }
  return resolved;
}

/**
 * Aplica un bloque { filepath, searchContent, replaceContent } sobre el archivo real.
 *
 * Flujo:
 *   1. Leer archivo original
 *   2. Exact match normalizado para encontrar posición
 *   3. Si no hay match → lanzar error con contexto
 *   4. Crear backup en projectDataPath/backups/
 *   5. Reemplazar en el texto ORIGINAL (no en el normalizado)
 *   6. Escribir resultado
 *
 * @param {object} params
 * @param {string} params.filepath       — ruta relativa desde projectRoot
 * @param {string} params.searchContent  — texto a buscar
 * @param {string} params.replaceContent — texto de reemplazo
 * @param {string} params.projectRoot    — ruta absoluta del repo
 * @param {string} params.projectDataPath — ruta de datos del proyecto (para backups)
 * @returns {{ ok: true, backupPath: string, filepath: string }}
 */
async function applyPatch({ filepath, searchContent, replaceContent, projectRoot, projectDataPath }) {
  if (!filepath)      throw new Error('filepath es requerido');
  if (!projectRoot)   throw new Error('projectRoot es requerido');
  if (searchContent === undefined || searchContent === null) throw new Error('searchContent es requerido');
  if (replaceContent === undefined || replaceContent === null) throw new Error('replaceContent es requerido');

  // Seguridad: construir ruta absoluta y verificar containment
  const absolutePath = assertContained(path.join(projectRoot, filepath), projectRoot);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Archivo no encontrado: ${filepath}`);
  }

  const originalText = fs.readFileSync(absolutePath, 'utf-8');

  // Normalizar SOLO para buscar
  const normOriginal = normalize(originalText);
  const normSearch   = normalize(searchContent);

  let matchIndex = normOriginal.indexOf(normSearch);

  // Si no hay match exacto, intentar con las primeras 5 líneas como ancla
  if (matchIndex === -1) {
    const anchorLines = normSearch.split('\n').slice(0, 5).join('\n');
    const anchorIndex = normOriginal.indexOf(anchorLines);
    if (anchorIndex !== -1) {
      console.log('[apply] match exacto falló, usando ancla de 5 líneas');
      // Reemplazar todo el archivo si el searchContent cubre casi todo
      const searchRatio = normSearch.length / normOriginal.length;
      if (searchRatio > 0.8) {
        console.log('[apply] searchContent cubre >80% del archivo — reemplazando completo');
        const backupPath = _writeWithBackup(absolutePath, replaceContent, projectDataPath, filepath);
        return { ok: true, filepath, backupPath };
      }
      matchIndex = anchorIndex;
    }
  }

  // Fallback fuzzy: comparar ignorando valores por defecto en firmas de función
  if (matchIndex === -1) {
    const normSearchFuzzy   = normalizeFunctionSignature(normSearch);
    const normOriginalFuzzy = normalizeFunctionSignature(normOriginal);
    const fuzzyIndex = normOriginalFuzzy.indexOf(normSearchFuzzy);
    if (fuzzyIndex !== -1) {
      console.log('[apply] match fuzzy por firma de función');
      matchIndex = fuzzyIndex;
    }
  }

  if (matchIndex === -1) {
    const preview = normSearch.slice(0, 120).replace(/\n/g, '↵');
    throw new Error(`No se encontró el fragmento en ${filepath}.\nBuscado: "${preview}..."`);
  }
  // Encontrar offsets en el texto ORIGINAL usando el índice del normalizado
  // Mapear posición normalizada → posición original
  const originalLines    = originalText.split(/\r?\n/);
  const normLines        = normOriginal.split('\n');
  const searchNormLines  = normSearch.split('\n');

  // Encontrar línea de inicio en el normalizado
  let normLinesCounted = 0;
  let charCount = 0;
  let startLine = -1;
  for (let i = 0; i < normLines.length; i++) {
    if (charCount === matchIndex) { startLine = i; break; }
    charCount += normLines[i].length + 1; // +1 por \n
  }

  if (startLine === -1) {
    // Fallback: reemplazo sobre texto normalizado si el mapeo falla
    const replaced = normOriginal.slice(0, matchIndex)
      + normalize(replaceContent)
      + normOriginal.slice(matchIndex + normSearch.length);
    _writeWithBackup(absolutePath, replaced, projectDataPath, filepath);
    return { ok: true, filepath };
  }

  // Reemplazar líneas en el original preservando CRLF si existía
  const endLine      = startLine + searchNormLines.length;
  const replaceLines = replaceContent.split(/\r?\n/);
  const hasCRLF      = originalText.includes('\r\n');

  const resultLines  = [
    ...originalLines.slice(0, startLine),
    ...replaceLines,
    ...originalLines.slice(endLine),
  ];

  const newText = hasCRLF
    ? resultLines.join('\r\n')
    : resultLines.join('\n');

  const backupPath = _writeWithBackup(absolutePath, newText, projectDataPath, filepath);

  return { ok: true, filepath, backupPath };
}

/**
 * Escribe el backup y luego el archivo modificado.
 * Backup en: projectDataPath/backups/{timestamp}_{filename}
 */
function _writeWithBackup(absolutePath, newText, projectDataPath, filepath) {
  // Crear carpeta de backups
  const backupsDir = path.join(projectDataPath, 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName = filepath.replace(/[/\\]/g, '_');
  const backupPath = path.join(backupsDir, `${ts}_${safeName}.bak`);

  // Copiar original como backup
  fs.copyFileSync(absolutePath, backupPath);

  // Escribir el archivo modificado
  fs.writeFileSync(absolutePath, newText, 'utf-8');

  console.log(`[apply.service] backup: ${backupPath}`);
  console.log(`[apply.service] aplicado: ${absolutePath}`);

  return backupPath;
}

module.exports = { applyPatch };