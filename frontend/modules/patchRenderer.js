import { getChatState } from '../chatState.js';
import { BASE_URL } from '../config.js';
import { getToken } from './login.js';
import { showErrorToast } from '../ui.js';

// Mismo patrón que contextFiles.js — sin esto, en Electron (file://) la ruta
// relativa no resuelve contra el backend, y sin el JWT authMiddleware devuelve
// 401 en silencio (no loguea nada en el backend).
function authH(extra = {}) {
  const token = getToken();
  const headers = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ─── PATCHES YA APLICADOS ─────────────────────────────────────────────────────
// El estado "aplicado" del botón vivía sólo en memoria: al reabrir un chat la
// tarjeta se redibujaba con el botón rearmado y volver a apretarlo duplicaba el
// cambio en el archivo real. Ahora el backend lo persiste por proyecto y acá se
// cachea la lista, que se refresca al cambiar de chat/proyecto.
//
// FNV-1a de 32 bits, idéntico a `patchHash()` en apply.service.js — cualquier
// cambio en uno tiene que replicarse en el otro o los hashes dejan de coincidir
// y el marcado deja de funcionar (silenciosamente: los botones volverían a
// aparecer todos como no aplicados).
let _appliedPatches = {};

function patchHash(filepath, searchContent, replaceContent) {
  const str = `${filepath}\n${searchContent}\n${replaceContent}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

export async function refreshAppliedPatches(projectId) {
  if (!projectId || projectId === 'general') { _appliedPatches = {}; return; }
  try {
    const res = await fetch(`${BASE_URL}/project/${encodeURIComponent(projectId)}/patch/applied`, {
      headers: authH()
    });
    const data = await res.json();
    _appliedPatches = data.applied || {};
  } catch (err) {
    console.error('[patchRenderer] no se pudo cargar la lista de patches aplicados:', err);
    _appliedPatches = {};
  }
}

const ICONS = {
  copy: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
};

// El error del backend puede ser largo ("Archivo no encontrado: ...", "No se
// encontró el fragmento en ...") y el botón es angosto: metido ahí adentro se
// corta, y antes además se auto-borraba a los 3 segundos, con lo cual desde el
// lado del usuario un patch fallido se veía EXACTAMENTE igual que no haber
// hecho clic. Ahora el detalle va a un toast legible y el botón sólo queda
// marcado en rojo con una etiqueta corta, sin auto-limpiarse: el estado de
// "esto falló" persiste hasta que se reintente. Ver DECISIONS.md.
function showApplyResult(btn, message, type, detail = null) {
  btn.className = type === 'ok'
    ? 'patch-apply-btn patch-apply-btn--ok'
    : 'patch-apply-btn patch-apply-btn--error';

  if (type === 'ok') {
    btn.textContent = message;
    return;
  }

  btn.textContent = '✗ No se aplicó';
  btn.title = detail || message;
  showErrorToast(detail || message);
}

export function renderPatchBlock(searchText, replaceText, filename) {
  const wrapper = document.createElement('div');
  wrapper.className = 'patch-block';

  const header = document.createElement('div');
  header.className = 'patch-header';

  const fileLabel = document.createElement('span');
  fileLabel.className = 'patch-filename';
  fileLabel.textContent = filename || 'cambio';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.innerHTML = ICONS.copy;
  copyBtn.title = 'Copiar patch';
  copyBtn.onclick = async () => {
    const patchText = `<<<<<<< SEARCH\n${searchText}\n=======\n${replaceText}\n>>>>>>> REPLACE`;
    try {
      await navigator.clipboard.writeText(patchText);
      copyBtn.innerHTML = ICONS.check;
      setTimeout(() => { copyBtn.innerHTML = ICONS.copy; }, 1500);
    } catch (e) { console.error('No se pudo copiar el patch:', e); }
  };

  const applyBtn = document.createElement('button');
  applyBtn.className = 'patch-apply-btn';
  applyBtn.textContent = '⚡ Aplicar';
  applyBtn.title = 'Aplicar patch sobre el archivo real';
  applyBtn.dataset.filepath      = filename || '';
  applyBtn.dataset.searchContent  = searchText;
  applyBtn.dataset.replaceContent = replaceText;

  // Marcado persistente: si este patch ya se aplicó en este proyecto, se
  // muestra como tal aunque el chat se haya recargado.
  const thisHash = patchHash(filename || '', searchText, replaceText);
  const alreadyApplied = _appliedPatches[thisHash];
  if (alreadyApplied) {
    applyBtn.textContent = '✓ Aplicado';
    applyBtn.className = 'patch-apply-btn patch-apply-btn--ok';
    applyBtn.title = `Aplicado el ${new Date(alreadyApplied.appliedAt).toLocaleString()} — click para aplicarlo de nuevo`;
  }

  applyBtn.onclick = async () => {
    const { projectId } = getChatState();

    if (!projectId || projectId === 'general') {
      showApplyResult(applyBtn, '✗ Solo disponible dentro de un proyecto', 'error');
      return;
    }

    // El botón NO queda muerto tras aplicarse: el registro puede quedar
    // desactualizado (si el usuario revirtió el archivo a mano, querrá volver a
    // aplicarlo). Se pide confirmación explícita en vez de bloquear.
    if (_appliedPatches[thisHash]) {
      const cuando = new Date(_appliedPatches[thisHash].appliedAt).toLocaleString();
      if (!confirm(`Este patch ya se aplicó el ${cuando}.\n\nAplicarlo otra vez va a insertar el cambio de nuevo (duplicándolo si sigue ahí).\n\n¿Aplicar igual?`)) return;
    }
    if (!filename) {
      showApplyResult(applyBtn, '✗ Sin ruta de archivo', 'error');
      return;
    }

    const ok = confirm(
      `¿Aplicar patch sobre:\n${filename}\n\nSe creará un backup automático antes de modificar el archivo.`
    );
    if (!ok) return;

    applyBtn.disabled = true;
    applyBtn.textContent = 'Aplicando...';

    try {
      const res = await fetch(`${BASE_URL}/project/${projectId}/patch/apply`, {
        method:  'POST',
        headers: authH({ 'Content-Type': 'application/json' }),
        body:    JSON.stringify({
          filepath:       filename,
          searchContent:  searchText,
          replaceContent: replaceText,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showApplyResult(applyBtn, '✓ Aplicado', 'ok');
        // Se registra en la caché local además de en el backend, para que la
        // confirmación de "ya aplicado" funcione en el mismo render sin tener
        // que volver a pedir la lista.
        _appliedPatches[thisHash] = { filepath: filename, appliedAt: new Date().toISOString() };
        applyBtn.disabled = false;
      } else {
        showApplyResult(applyBtn, 'No se aplicó', 'error', data.error || 'El servidor rechazó el patch sin dar un motivo.');
        applyBtn.disabled = false;
      }
    } catch (err) {
      showApplyResult(applyBtn, 'No se aplicó', 'error', 'No se pudo conectar con el backend para aplicar el patch.');
      console.error('[patchRenderer] error aplicando patch:', err);
      applyBtn.disabled = false;
    }
  };

  header.appendChild(fileLabel);
  header.appendChild(applyBtn);
  header.appendChild(copyBtn);
  wrapper.appendChild(header);

  const diffContainer = document.createElement('div');
  diffContainer.className = 'patch-diff';

  // Se descartan los saltos de línea finales del bloque: producían una línea
  // "- " / "+ " vacía al final de la vista previa, que además hacía parecer que
  // el fragmento ocupaba una línea más de las que ocupa. Ver el bug de pérdida
  // de datos en apply.service.js, que tenía la misma raíz.
  const dropTrailingEmpty = (text) => {
    const lines = String(text).split('\n');
    while (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop();
    return lines;
  };

  const removedLines = dropTrailingEmpty(searchText);
  const addedLines = dropTrailingEmpty(replaceText);

  removedLines.forEach(line => {
    const el = document.createElement('div');
    el.className = 'patch-line patch-line--removed';
    el.textContent = '- ' + line;
    diffContainer.appendChild(el);
  });

  const separator = document.createElement('div');
  separator.className = 'patch-separator';
  diffContainer.appendChild(separator);

  addedLines.forEach(line => {
    const el = document.createElement('div');
    el.className = 'patch-line patch-line--added';
    el.textContent = '+ ' + line;
    diffContainer.appendChild(el);
  });

  wrapper.appendChild(diffContainer);
  return wrapper;
}