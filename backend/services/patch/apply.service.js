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
    .map(l => l.trimEnd().replace(/\s+([)\]}])/g, '$1'))
    .join('\n');
}

/**
 * Ubica `needle` dentro de `haystack` como un bloque de LÍNEAS ENTERAS y
 * devuelve en qué línea empieza y cuántas ocupa, o null si no está.
 *
 * Una coincidencia vale solo si cubre líneas completas en las dos puntas:
 *   - empieza en un punto limpio de línea: desde el último salto de línea
 *     hasta el inicio de la coincidencia solo puede haber espacios, y
 *   - termina donde termina una línea del archivo.
 * Si una aparición no cumple, se descarta y se sigue buscando la próxima.
 *
 * Sobre el inicio limpio — caso real que lo destapó: un SEARCH de una sola
 * línea (`const apiKey = req.query.apiKey;`) coincidía primero con el mismo
 * texto pegado a un `//` dentro de un comentario más arriba en el archivo
 * (`//const apiKey = req.query.apiKey;`) — `indexOf` a secas toma esa
 * aparición por ser la primera, no la línea de código real más abajo. El
 * reemplazo terminaba dejando DOS declaraciones de la misma variable (la del
 * comentario, reemplazada, y la real, intacta) → "Identifier ya declarado".
 * La validación de sintaxis lo bloqueó antes de escribir, pero la causa de
 * fondo era esta. Ver DECISIONS.md.
 *
 * El reemplazo de applyPatch() trabaja por líneas, así que una coincidencia
 * que no cubre líneas enteras no se puede aplicar bien. Antes eso no se
 * controlaba y había tres formas de escribir de más sin que se viera en el
 * diff — todas reproducidas, ver DECISIONS.md:
 *   1. El SEARCH coincidía hasta la mitad de una línea más larga (p. ej. le
 *      faltaba un `//` final) y se reemplazaba la línea entera.
 *   2. El SEARCH empezaba después de la indentación de su primera línea; el
 *      mapeo a número de línea fallaba y se caía a un "plan B" que escribía
 *      el archivo ENTERO normalizado: CRLF convertido a LF y la indentación
 *      de todas las líneas de cierre (`}`, `)`, `]`) borrada.
 *   3. El match "fuzzy por firma de función" buscaba en una copia del texto
 *      con los espacios colapsados y usaba esa posición sobre el texto real:
 *      el corte caía en cualquier lado. En archivos .js lo frenaba la
 *      validación de sintaxis; en cualquier otro tipo escribía el archivo
 *      corrupto.
 *
 * Los saltos de línea finales del needle no cuentan: el bloque SEARCH casi
 * siempre termina con uno, y contarlo hacía abarcar una línea de más (bug de
 * pérdida de datos de v3.0.0).
 *
 * @returns {{ startLine: number, lineCount: number } | null}
 */
function locateWholeLines(haystack, needle) {
  const block = String(needle).replace(/\n+$/, '');
  if (block.trim() === '') return null;

  let from = 0;
  while (true) {
    const idx = haystack.indexOf(block, from);
    if (idx === -1) return null;

    const lineStart = haystack.lastIndexOf('\n', idx - 1) + 1;
    const end = idx + block.length;
    const startsAtLine = /^[ \t]*$/.test(haystack.slice(lineStart, idx));
    const endsAtLine = end === haystack.length || haystack[end] === '\n';

    if (startsAtLine && endsAtLine) {
      return {
        startLine: haystack.slice(0, lineStart).split('\n').length - 1,
        lineCount: block.split('\n').length
      };
    }
    from = idx + 1;
  }
}

/**
 * Containment check: la ruta resuelta debe estar dentro de projectRoot.
 * Previene path traversal (ej: ../../etc/passwd).
 */
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
  const normReplace  = normalize(replaceContent);

  // Chequeo SEARCH vs REPLACE del propio modelo — independiente de cómo matcheó
  // (exacto o por ancla). Si el modelo "resume" al reproducir (omite comentarios,
  // líneas que no le parecen relevantes), el REPLACE queda con menos contenido
  // que el SEARCH, y lo que falta desaparece del archivo real aunque el match
  // haya sido perfecto. Caso real: pedir agregar un console.log en
  // auth.middleware.js borró un comentario largo + comentarios numerados que
  // nadie pidió tocar — el SEARCH los tenía, el REPLACE no.
  const SEARCH_REPLACE_SHRINK_TOLERANCE = 3;
  const searchContentNonEmpty  = normSearch.split('\n').filter(l => l.trim() !== '').length;
  const replaceContentNonEmpty = normReplace.split('\n').filter(l => l.trim() !== '').length;
  if (replaceContentNonEmpty < searchContentNonEmpty - SEARCH_REPLACE_SHRINK_TOLERANCE) {
    throw new Error(
      `El REPLACE generado tiene menos contenido (${replaceContentNonEmpty} líneas) que el SEARCH ` +
      `(${searchContentNonEmpty} líneas) — probablemente el modelo omitió contenido que no pediste tocar ` +
      `(comentarios, líneas existentes). No se aplicó nada para evitar borrar algo sin que lo veas en el diff.`
    );
  }

  // Solo se acepta el fragmento completo, en líneas enteras. Se quitaron el
  // atajo de >80% (v3.0.3), el match fuzzy por firma de función, el plan B que
  // escribía el archivo normalizado y el ancla de 5 líneas con cierre: todos
  // podían escribir en un lugar equivocado o borrar líneas intermedias que el
  // diff no mostraba (ver locateWholeLines más arriba y DECISIONS.md).
  const exactMatch = locateWholeLines(normOriginal, normSearch);
  if (exactMatch === null) {
    const preview = normSearch.slice(0, 120).replace(/\n/g, '↵');
    throw new Error(`No se encontró el fragmento en ${filepath}.\nBuscado: "${preview}..."`);
  }

  const startLine     = exactMatch.startLine;
  const originalLines = originalText.split(/\r?\n/);

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
  // Los saltos finales se descartan para contar el span. Hoy eso lo hace
  // locateWholeLines(), que devuelve cuántas líneas ocupa el bloque
  // (`lineCount`) ya sin contarlos.
  const endLine = startLine + exactMatch.lineCount;
  const replaceLines = replaceContent.split(/\r?\n/).map(l => l.replace(/\r+$/, ''));
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

module.exports = { applyPatch, loadAppliedPatches, patchHash, normalize, locateWholeLines };