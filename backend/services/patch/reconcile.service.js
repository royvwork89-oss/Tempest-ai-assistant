// backend/services/patch/reconcile.service.js
'use strict';

// ─── RECONCILIACIÓN DE PATCH CONTRA EL ARCHIVO REAL ───────────────────────────
// Los modelos locales chicos no generan "antes y después": devuelven el
// archivo con el cambio ya hecho, a veces dos veces (como SEARCH y como
// REPLACE), a veces con el formato roto. Un SEARCH así nunca coincide con el
// archivo real y el patch no se puede aplicar, aunque el cambio que propone
// el modelo sea válido.
//
// Este módulo toma lo que el modelo declaró como estado final, lo compara
// línea por línea contra el archivo REAL y arma el bloque SEARCH/REPLACE a
// partir del archivo en disco. El SEARCH sale del archivo, no del modelo, así
// que coincide siempre; y la vista previa muestra el diff real, incluido
// cualquier borrado.
//
// Solo actúa cuando el bloque del modelo NO sirve tal cual. Si el modelo
// generó un bloque bien formado cuyo SEARCH ya existe en el archivo, la
// respuesta se deja intacta. Ver DECISIONS.md.

const { normalize, locateWholeLines } = require('./apply.service');

const WELL_FORMED_BLOCK = /<<<<<<<[^\n]*\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>>[^\n]*/;
const OPEN_MARKER       = /^\s*<{5,}.*$/;
const CLOSE_MARKER      = /^\s*>{5,}.*$/;
const SEPARATOR_LINE    = /^\s*(?:<{5,}.*|={5,}|SEARCH:?|REPLACE:?|#{2,}\s*(?:CONTENIDO ACTUAL DEL ARCHIVO|FIN DEL ARCHIVO)\s*#{2,}|```.*)\s*$/i;
const NOISE_START       = /^\s*(?:REGLAS:|INSTRUCCION:)/i;
const FILE_HEADER       = /^\s*Archivo:\s*.+$/i;

const CONTEXT_LINES  = 2;
const MIN_KEPT_RATIO = 0.5;
const MAX_LCS_CELLS  = 4000000;

function toLines(text) {
  return String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function isBlank(line) {
  return line.trim() === '';
}

function trimBlankEdges(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && isBlank(lines[start])) start++;
  while (end > start && isBlank(lines[end - 1])) end--;
  return lines.slice(start, end);
}

// Parte la respuesta del modelo en secciones separadas por los marcadores
// (bien o mal formados). En un bloque sano son [SEARCH, REPLACE]; en uno roto
// pueden venir separadas por un "REPLACE" suelto o por el delimitador del
// grounding que el modelo copió. Lo que viene después del cierre es ruido.
function extractSections(reply) {
  const lines = toLines(reply);
  const openIndex = lines.findIndex(l => OPEN_MARKER.test(l));
  const hasMarker = openIndex !== -1;
  const body = hasMarker ? lines.slice(openIndex + 1) : lines.filter(l => !FILE_HEADER.test(l));

  const sections = [];
  let current = [];
  for (const line of body) {
    if (CLOSE_MARKER.test(line) || NOISE_START.test(line)) break;
    if (SEPARATOR_LINE.test(line)) {
      sections.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  sections.push(current);

  return {
    hasMarker,
    sections: sections.map(trimBlankEdges).filter(s => s.length > 0)
  };
}

// LCS por líneas. Devuelve la secuencia de operaciones que lleva del archivo
// real al texto candidato: 'eq' (línea presente en ambos), 'del' (solo en el
// archivo), 'ins' (solo en el candidato).
function diffLines(fileKeys, candKeys) {
  const n = fileKeys.length;
  const m = candKeys.length;
  if (n * m > MAX_LCS_CELLS) return null;

  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = fileKeys[i] === candKeys[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (fileKeys[i] === candKeys[j]) {
      ops.push({ type: 'eq', fi: i, ci: j });
      i++; j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ type: 'del', fi: i });
      i++;
    } else {
      ops.push({ type: 'ins', ci: j });
      j++;
    }
  }
  while (i < n) ops.push({ type: 'del', fi: i++ });
  while (j < m) ops.push({ type: 'ins', ci: j++ });
  return ops;
}

// El camino de match exacto de applyPatch(), sobre texto en memoria: usa la
// misma función que applyPatch() para ubicar el bloque. Sirve para comprobar
// que el bloque armado, al aplicarse, produce exactamente el archivo
// esperado — antes de mostrárselo al usuario.
function simulateExactApply(fileText, search, replace) {
  const match = locateWholeLines(normalize(fileText), normalize(search));
  if (!match) return null;

  const fileLines = fileText.split(/\r?\n/);
  return [
    ...fileLines.slice(0, match.startLine),
    ...replace.split(/\r?\n/),
    ...fileLines.slice(match.startLine + match.lineCount)
  ];
}

function indentOf(line) {
  return /^[ \t]*/.exec(line)[0];
}

// Posiciones del archivo donde el SEARCH del modelo aparece completo y
// contiguo si se ignora la indentación.
function locateIgnoringIndent(fileLooseKeys, searchLooseKeys) {
  const positions = [];
  const last = fileLooseKeys.length - searchLooseKeys.length;
  for (let start = 0; start <= last; start++) {
    let match = true;
    for (let k = 0; k < searchLooseKeys.length; k++) {
      if (fileLooseKeys[start + k] !== searchLooseKeys[k]) { match = false; break; }
    }
    if (match) positions.push(start);
  }
  return positions;
}

function sameLines(a, b) {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * @param {object} params
 * @param {string} params.reply           — respuesta cruda del modelo
 * @param {string} params.originalContent — contenido completo y actual del archivo
 * @param {string} params.relPath         — ruta relativa del archivo dentro del proyecto
 * @returns {{ changed: boolean, text: string, reason: string, stats?: object }}
 */
function reconcilePatchReply({ reply, originalContent, relPath }) {
  const unchanged = (reason, stats) => ({ changed: false, text: reply, reason, stats });

  if (!reply || !originalContent || !relPath) return unchanged('missing_input');

  const replyNormalized = toLines(reply).join('\n');
  const normFile = normalize(originalContent);

  // El bloque del modelo se respeta solo si su SEARCH existe tal cual en el
  // archivo, en líneas enteras y con la indentación de su primera línea
  // intacta. applyPatch() también acepta un SEARCH cuya primera línea perdió
  // la indentación, pero lo aplica dejando esa línea sin indentar; ese caso
  // se recalcula acá, donde las líneas se llevan a la indentación real.
  // La indentación se compara sobre el texto real, no sobre el normalizado:
  // normalize() ignora los espacios que preceden a un cierre (`}`, `)`, `]`),
  // así que ahí un `}` sin indentar y uno indentado se ven iguales.
  const wellFormed = WELL_FORMED_BLOCK.exec(replyNormalized);
  if (wellFormed && wellFormed[1].trim() !== '') {
    const exact = locateWholeLines(normFile, normalize(wellFormed[1]));
    if (exact) {
      const modelLines = toLines(wellFormed[1]);
      const firstText = modelLines.findIndex(l => !isBlank(l));
      const fileLine = originalContent.split(/\r?\n/)[exact.startLine + firstText];
      if (fileLine !== undefined && indentOf(fileLine) === indentOf(modelLines[firstText])) {
        return unchanged('model_block_ok');
      }
    }
  }

  const { hasMarker, sections } = extractSections(replyNormalized);
  if (sections.length === 0) return unchanged('no_candidate');

  const fileLines = originalContent.split(/\r?\n/);
  const fileKeys = normFile.split('\n');
  if (fileKeys.length !== fileLines.length) return unchanged('line_mismatch');
  let realLineCount = fileLines.length;
  while (realLineCount > 0 && isBlank(fileLines[realLineCount - 1])) realLineCount--;
  if (realLineCount === 0) return unchanged('empty_file');

  // A partir de qué líneas del archivo se borran y cuáles se insertan, arma
  // el bloque SEARCH/REPLACE con líneas tomadas del archivo real.
  const finish = (deleted, inserts, via) => {
    // Líneas en blanco insertadas en los bordes absolutos del archivo: no
    // aportan nada y dejarían el bloque empezando o terminando en blanco.
    if (inserts.has(0)) {
      const top = inserts.get(0);
      while (top.length && isBlank(top[0])) top.shift();
      if (!top.length) inserts.delete(0);
    }
    if (inserts.has(realLineCount)) {
      const bottom = inserts.get(realLineCount);
      while (bottom.length && isBlank(bottom[bottom.length - 1])) bottom.pop();
      if (!bottom.length) inserts.delete(realLineCount);
    }

    const insertedCount = [...inserts.values()].reduce((sum, list) => sum + list.length, 0);
    if (deleted.size === 0 && insertedCount === 0) return unchanged('no_change');

    // Si lo único que cambia son líneas en blanco, no hay un cambio real que
    // proponer: es ruido de la copia del modelo, no el pedido del usuario.
    const onlyBlankChanges =
      [...deleted].every(i => isBlank(fileLines[i])) &&
      [...inserts.values()].every(list => list.every(isBlank));
    if (onlyBlankChanges) return unchanged('no_change');

    const touched = [...deleted];
    const changeStart = Math.min(...touched, ...inserts.keys());
    const changeEnd = Math.max(...touched.map(i => i + 1), ...inserts.keys());

    const buildRange = (from, to) => {
      const search = [];
      const replace = [];
      for (let i = from; i < to; i++) {
        if (inserts.has(i)) replace.push(...inserts.get(i));
        search.push(fileLines[i]);
        if (!deleted.has(i)) replace.push(fileLines[i]);
      }
      if (inserts.has(to)) replace.push(...inserts.get(to));
      return { search, replace };
    };

    const expected = buildRange(0, fileLines.length).replace;

    // El bloque arranca con algo de contexto y crece hasta que, aplicado con la
    // misma lógica que applyPatch(), da exactamente el archivo esperado. Crecer
    // resuelve los casos en que el contexto mínimo aparece repetido más arriba.
    let from = Math.max(0, changeStart - CONTEXT_LINES);
    let to = Math.min(realLineCount, changeEnd + CONTEXT_LINES);

    while (true) {
      while (from > 0 && isBlank(fileLines[from])) from--;
      while (to < realLineCount && isBlank(fileLines[to - 1])) to++;

      const { search, replace } = buildRange(from, to);
      const searchText = search.join('\n');
      const replaceText = replace.join('\n');

      const usable = search.length > 0 && replace.length > 0 &&
        !isBlank(search[0]) && !isBlank(search[search.length - 1]) &&
        !isBlank(replace[0]) && !isBlank(replace[replace.length - 1]);

      if (usable && sameLines(simulateExactApply(originalContent, searchText, replaceText), expected)) {
        return {
          changed: true,
          text: `Archivo: ${relPath}\n\n<<<<<<< SEARCH\n${searchText}\n=======\n${replaceText}\n>>>>>>> REPLACE`,
          reason: 'reconciled',
          stats: { inserted: insertedCount, deleted: deleted.size, searchLines: search.length, via }
        };
      }

      if (from === 0 && to === realLineCount) break;
      from = Math.max(0, from - 1);
      to = Math.min(realLineCount, to + 1);
    }

    return unchanged('verify_failed', { inserted: insertedCount, deleted: deleted.size, via });
  };

  // Vía 1 — el modelo generó un SEARCH/REPLACE real, pero con otra
  // indentación (o sin la de la primera línea). Si su SEARCH aparece completo
  // y en un único lugar del archivo al ignorar la indentación, ese es el
  // tramo a tocar: se toma el diff entre su SEARCH y su REPLACE y las líneas
  // nuevas se llevan a la indentación real del archivo.
  if (hasMarker && sections.length >= 2) {
    const searchLines = sections[0];
    const replaceLines = sections[1];
    const searchLoose = normalize(searchLines.join('\n')).split('\n').map(k => k.trim());
    const replaceLoose = normalize(replaceLines.join('\n')).split('\n').map(k => k.trim());
    const fileLoose = fileKeys.slice(0, realLineCount).map(k => k.trim());

    if (searchLoose.some(k => /[A-Za-z0-9]/.test(k))) {
      const positions = locateIgnoringIndent(fileLoose, searchLoose);
      const blockOps = positions.length === 1 ? diffLines(searchLoose, replaceLoose) : null;
      if (blockOps) {
        const start = positions[0];
        const firstRef = searchLoose.findIndex(k => k !== '');

        // Las líneas que escribe el modelo se llevan a la indentación real
        // del archivo. Si en su SEARCH hay una línea al mismo nivel, se copia
        // la indentación que esa línea tiene en disco. Si no, se traslada la
        // diferencia respecto de una línea de referencia, convirtiendo a
        // tabs cuando el archivo indenta con tabs.
        const modelLevels = [...new Set(
          [...searchLines, ...replaceLines].filter(l => !isBlank(l)).map(l => indentOf(l).length)
        )].sort((x, y) => x - y);
        let modelUnit = 1;
        for (let i = 1; i < modelLevels.length; i++) {
          const step = modelLevels[i] - modelLevels[i - 1];
          if (i === 1 || step < modelUnit) modelUnit = step;
        }
        const fileUsesTabs = fileLines.some(l => l.startsWith('\t'));
        const shiftIndent = (fileIndent, delta) => {
          if (delta === 0) return fileIndent;
          const unit = fileUsesTabs ? '\t' : ' ';
          const amount = fileUsesTabs ? Math.round(delta / modelUnit) : delta;
          return amount > 0
            ? fileIndent + unit.repeat(amount)
            : fileIndent.slice(0, Math.max(0, fileIndent.length + amount));
        };
        const relativeTo = (line, k) => shiftIndent(
          indentOf(fileLines[start + k]),
          indentOf(line).length - indentOf(searchLines[k]).length
        ) + line.trim();
        const placeInserted = (line, nearIndex, refIndex) => {
          if (isBlank(line)) return '';
          const level = indentOf(line).length;
          let sibling = -1;
          for (let k = 0; k < searchLines.length; k++) {
            if (isBlank(searchLines[k]) || indentOf(searchLines[k]).length !== level) continue;
            if (sibling === -1 || Math.abs(k - nearIndex) < Math.abs(sibling - nearIndex)) sibling = k;
          }
          if (sibling !== -1) return indentOf(fileLines[start + sibling]) + line.trim();
          return relativeTo(line, refIndex);
        };

        const deleted = new Set();
        const inserts = new Map();
        let nextSearchIndex = 0;
        let refIndex = firstRef;
        for (const op of blockOps) {
          if (op.type === 'ins') {
            const position = start + nextSearchIndex;
            const line = placeInserted(replaceLines[op.ci], nextSearchIndex, refIndex);
            if (!inserts.has(position)) inserts.set(position, []);
            inserts.get(position).push(line);
            continue;
          }
          if (op.type === 'del') {
            deleted.add(start + op.fi);
          } else if (searchLoose[op.fi] !== '' &&
                     indentOf(replaceLines[op.ci]).length !== indentOf(searchLines[op.fi]).length) {
            // Misma línea, pero el modelo le cambió la indentación entre su
            // SEARCH y su REPLACE (p. ej. al envolver código en un bloque):
            // es un cambio real y se aplica sobre la indentación del archivo.
            const position = start + op.fi;
            deleted.add(position);
            if (!inserts.has(position)) inserts.set(position, []);
            inserts.get(position).push(relativeTo(replaceLines[op.ci], op.fi));
          }
          if (searchLoose[op.fi] !== '') refIndex = op.fi;
          nextSearchIndex = op.fi + 1;
        }
        return finish(deleted, inserts, 'search_block');
      }
    }
  }

  // Vía 2 — el modelo devolvió el archivo (o un tramo) con el cambio ya
  // hecho. Se compara ese estado final contra el archivo real.
  const evaluate = (candLines) => {
    const candKeys = normalize(candLines.join('\n')).split('\n');
    const ops = diffLines(fileKeys.slice(0, realLineCount), candKeys);
    if (!ops) return null;
    const kept = ops.filter(o => o.type === 'eq' && fileKeys[o.fi] !== '').length;
    const candNonBlank = candKeys.filter(k => k !== '').length;
    return { candLines, ops, kept, ratio: candNonBlank ? kept / candNonBlank : 0 };
  };

  // Con marcadores, el estado final declarado por el modelo es la segunda
  // sección (REPLACE); si solo hay una, es esa. Sin marcadores (el modelo
  // devolvió solo código), se toma la sección que más se parece al archivo.
  let best = null;
  if (hasMarker) {
    best = evaluate(sections[1] || sections[0]);
  } else {
    for (const section of sections) {
      const result = evaluate(section);
      if (result && (!best || result.kept > best.kept)) best = result;
    }
  }
  if (!best) return unchanged('too_large');

  const fileNonBlank = fileKeys.slice(0, realLineCount).filter(k => k !== '').length;
  const minKept = Math.min(2, fileNonBlank);
  if (best.kept < minKept || best.ratio < MIN_KEPT_RATIO) {
    return unchanged('low_similarity', { kept: best.kept, ratio: Number(best.ratio.toFixed(2)) });
  }

  // La región tocada va de la primera a la última línea no vacía que el
  // candidato conserva del archivo. Lo que el archivo tiene fuera de esa
  // región no se toca: si el modelo copió solo un tramo, o se cortó antes de
  // terminar, el resto del archivo queda como está.
  const { ops, candLines } = best;
  const anchors = ops
    .map((o, index) => (o.type === 'eq' && fileKeys[o.fi] !== '' ? index : -1))
    .filter(index => index !== -1);
  const firstAnchor = anchors[0];
  const lastAnchor = anchors[anchors.length - 1];

  const regionStart = ops[firstAnchor].fi;
  const regionEnd = ops[lastAnchor].fi + 1;

  const deleted = new Set();
  const inserts = new Map();
  let nextFileIndex = regionStart;
  ops.forEach((op, index) => {
    const inside = index >= firstAnchor && index <= lastAnchor;
    if (op.type === 'ins') {
      const position = index < firstAnchor ? regionStart : (index > lastAnchor ? regionEnd : nextFileIndex);
      const line = candLines[op.ci].replace(/\s+$/, '');
      if (!inserts.has(position)) inserts.set(position, []);
      inserts.get(position).push(line);
      return;
    }
    if (!inside) return;
    if (op.type === 'del') deleted.add(op.fi);
    nextFileIndex = op.fi + 1;
  });

  return finish(deleted, inserts, 'final_state');
}

module.exports = { reconcilePatchReply };
