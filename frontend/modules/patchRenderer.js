import { getChatState } from '../chatState.js';
import { BASE_URL } from '../config.js';
import { getToken } from './login.js';

// Mismo patrón que contextFiles.js — sin esto, en Electron (file://) la ruta
// relativa no resuelve contra el backend, y sin el JWT authMiddleware devuelve
// 401 en silencio (no loguea nada en el backend).
function authH(extra = {}) {
  const token = getToken();
  const headers = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

const ICONS = {
  copy: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
};

function showApplyResult(btn, message, type) {
  btn.textContent = message;
  btn.className = type === 'ok'
    ? 'patch-apply-btn patch-apply-btn--ok'
    : 'patch-apply-btn patch-apply-btn--error';
  if (type === 'ok') return;
  setTimeout(() => {
    btn.className   = 'patch-apply-btn';
    btn.textContent = '⚡ Aplicar';
  }, 3000);
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

  applyBtn.onclick = async () => {
    const { projectId } = getChatState();

    if (!projectId || projectId === 'general') {
      showApplyResult(applyBtn, '✗ Solo disponible dentro de un proyecto', 'error');
      return;
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
        applyBtn.disabled = true;
      } else {
        showApplyResult(applyBtn, `✗ ${data.error}`, 'error');
        applyBtn.disabled = false;
        applyBtn.textContent = '⚡ Aplicar';
      }
    } catch (_) {
      showApplyResult(applyBtn, '✗ Error de conexión', 'error');
      applyBtn.disabled = false;
      applyBtn.textContent = '⚡ Aplicar';
    }
  };

  header.appendChild(fileLabel);
  header.appendChild(applyBtn);
  header.appendChild(copyBtn);
  wrapper.appendChild(header);

  const diffContainer = document.createElement('div');
  diffContainer.className = 'patch-diff';

  const removedLines = searchText.split('\n');
  const addedLines = replaceText.split('\n');

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