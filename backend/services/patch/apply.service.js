// backend/services/patch/apply.service.js
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ─── VALIDACIÓN DE SINTAXIS POST-APPLY ────────────────────────────────────────
// Encontrado en pruebas de v3.0: una respuesta de patch truncada (el modelo
// se quedó sin maxTokens a mitad de generación) se aplicó igual, dejando el
// archivo real con un error de sintaxis — sin que "Aplicar" avisara nada,
// mostraba "✓ Aplicado" en verde con el archivo roto. Ver DECISIONS.md.
//
// Alcance deliberadamente acotado a JS/CJS/MJS — es lo único que se puede
// validar de forma barata y confiable con el motor ya disponible (vm.Script
// solo chequea sintaxis, no ejecuta nada). Para otros lenguajes no hay forma
// local de validar sin sumar un parser/toolchain nuevo por lenguaje — se
// deja pasar sin bloquear (no es peor que el comportamiento actual).
const SYNTAX_CHECKABLE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);

function validateSyntaxIfApplicable(filepath, newText) {
  const ext = path.extname(filepath).toLowerCase();
  if (!SYNTAX_CHECKABLE_EXTENSIONS.has(ext)) {
    return { valid: true, checked: false };
  }
  try {
    // eslint-disable-next-line no-new
    new vm.Script(newText, { filename: path.basename(filepath) });
    return { valid: true, checked: true };
  } catch (err) {
    return { valid: false, checked: true, error: err.message };
  }
}

// ─── REGISTRO DE PATCHES APLICADOS ────────────────────────────────────────────
// El estado "ya aplicado" del botón sólo vivía en memoria del renderer: al
// reabrir un chat, la tarjeta se redibuja desde el historial con el botón
// rearmado, y volver a apretarlo duplicaba el cambio en el archivo real (caso
// observado: la misma línea de console.log insertada dos veces). Se persiste
// por PROYECTO y no por chat porque el archivo es del proyecto — el mismo
// cambio aplicado desde dos chats distintos sigue siendo el mismo cambio.
//
// Hash propio y no crypto/SHA: tiene que calcularse IGUAL en el frontend, que
// sólo dispone de `crypto.subtle` (asíncrono, incómodo en el render sincrónico
// de la tarjeta). Con FNV-1a de 32 bits alcanza: acá no hay adversario, sólo
// hay que distinguir patches entre sí dentro de un proyecto.
const APPLIED_FILE = 'applied-patches.json';

function patchHash(filepath, searchContent, replaceContent) {
  const str = `${filepath}\n${searchContent}\n${replaceContent}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

function loadAppliedPatches(projectDataPath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectDataPath, APPLIED_FILE), 'utf-8'));
  } catch (_) {
    return {};
  }
}

function recordAppliedPatch(projectDataPath, filepath, searchContent, replaceContent) {
  try {
    const applied = loadAppliedPatches(projectDataPath);
    applied[patchHash(filepath, searchContent, replaceContent)] = {
      filepath,
      appliedAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(projectDataPath, APPLIED_FILE), JSON.stringify(applied, null, 2), 'utf-8');
  } catch (err) {
    // No se rompe el apply por no poder registrarlo: el cambio en el archivo
    // ya se hizo y es lo que importa. Sólo se pierde la marca visual.
    console.warn('[apply.service] no se pudo registrar el patch aplicado:', err.message);
  }
}

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
    // Mensaje explícito sobre las dos causas reales, porque "Archivo no
    // encontrado: x" a secas deja al usuario sin saber qué hacer: o el archivo
    // no pertenece a este proyecto (típico al adjuntar algo de otra carpeta),
    // o el snapshot está desactualizado respecto del disco.
    throw new Error(
      `No existe "${filepath}" dentro de este proyecto, así que no hay nada que modificar. ` +
      `Si adjuntaste el archivo desde otra carpeta, abrilo desde el proyecto al que pertenece. ` +
      `Si el archivo sí debería estar acá, reindexá el proyecto en "Archivos de contexto".`
    );
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
        recordAppliedPatch(projectDataPath, filepath, searchContent, replaceContent);
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
    recordAppliedPatch(projectDataPath, filepath, searchContent, replaceContent);
    return { ok: true, filepath };
  }

  // Reemplazar líneas en el original preservando CRLF si existía.
  //
  // BUG CORREGIDO (v3.0.0) — PÉRDIDA DE DATOS: el bloque SEARCH casi siempre
  // termina con un salto de línea (es el formato de `<<<<<<< SEARCH\n…\n=======`).
  // `split('\n')` sobre "abc\n" devuelve ["abc", ""] — un elemento vacío final —,
  // así que `searchNormLines.length` daba 2 para un fragmento de UNA línea, el
  // rango [startLine, startLine+2) abarcaba una línea de más, y esa línea del
  // archivo se borraba sin aparecer en el diff.
  //
  // Caso real que lo destapó: pedir "agregá un console.log al inicio de
  // logger.middleware.js" borró el `console.log` que el archivo ya tenía. El
  // usuario aprobó un borrado que la vista previa no mostraba.
  //
  // Los vacíos finales se descartan para contar el span. No se toca `normSearch`
  // en sí: el `indexOf` de más arriba sí necesita el salto final para anclar
  // correctamente el match.
  const searchSpanLines = [...searchNormLines];
  while (searchSpanLines.length > 1 && searchSpanLines[searchSpanLines.length - 1] === '') {
    searchSpanLines.pop();
  }
  const endLine      = startLine + searchSpanLines.length;
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

  recordAppliedPatch(projectDataPath, filepath, searchContent, replaceContent);
  return { ok: true, filepath, backupPath };
}

/**
 * Escribe el backup y luego el archivo modificado.
 * Backup en: projectDataPath/backups/{timestamp}_{filename}
 */
function _writeWithBackup(absolutePath, newText, projectDataPath, filepath) {
  // Validar sintaxis ANTES de tocar el disco — si el resultado queda
  // inválido (ej. respuesta del modelo cortada a mitad de generación), no
  // se crea backup ni se escribe nada; se lanza un error que apply.service.js
  // propaga tal cual hasta el frontend (mismo camino que assertContained
  // más arriba), y "Aplicar" muestra el error en rojo en vez de "Aplicado".
  const syntaxCheck = validateSyntaxIfApplicable(filepath, newText);
  if (!syntaxCheck.valid) {
    throw new Error(
      `El resultado no es sintácticamente válido — no se aplicó nada, el archivo original quedó intacto.\n` +
      `Motivo probable: la respuesta del modelo vino incompleta.\n` +
      `Detalle: ${syntaxCheck.error}`
    );
  }

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

module.exports = { applyPatch, loadAppliedPatches, patchHash };