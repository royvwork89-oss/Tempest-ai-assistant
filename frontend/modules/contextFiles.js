import { BASE_URL } from '../config.js';
import {
  listContextItems,
  uploadContextFiles,
  updateContextItem,
  deleteContextItem
} from '../api.js';
import { getToken } from './login.js';

function authH(extra = {}) {
  const token = getToken();
  const headers = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function openContextFilesModal(projectId) {
  const modal        = document.getElementById('contextFilesModal');
  const projectName  = document.getElementById('contextFilesProjectName');
  let list           = document.getElementById('contextFilesList');
  // cloneNode+replaceWith — evita listeners drag&drop acumulados entre aperturas
  const freshList = list.cloneNode(false);
  list.replaceWith(freshList);
  list = freshList;
  const uploadBtn    = document.getElementById('contextUploadBtn');
  const fileInput    = document.getElementById('contextFileInput');
  const uploadStatus = document.getElementById('contextUploadStatus');
  const closeBtn     = document.getElementById('closeContextFilesBtn');

  projectName.textContent = projectId;
  modal.classList.remove('hidden');

  // ── Carpeta del proyecto (un solo input compartido por Código y Documentos) ──
  // Decisión final (ver DECISIONS.md): dentro de UN MISMO proyecto, Código y
  // Documentos comparten la misma ruta a propósito — el usuario normalmente
  // escanea la misma carpeta para ambos. Lo que NUNCA debe compartirse es este
  // valor ENTRE proyectos distintos: como el modal reutiliza los mismos
  // elementos del DOM para todos los proyectos (mismo patrón ya documentado
  // para snapshotToggle/snapshotBtn/closeBtn), el input se limpia explícitamente
  // acá abajo ANTES de prellenarlo — si no, el proyecto B hereda lo que quedó
  // escrito al ver el proyecto A. Bug reportado: "los 3 proyectos comparten la
  // misma ruta en el input".
  const folderInput   = document.getElementById('contextProjectFolderInput');
  const folderBrowse  = document.getElementById('contextProjectFolderBrowse');
  const folderBtn     = document.getElementById('contextProjectFolderBtn');
  folderInput.value = '';

  const snapshotStatus     = document.getElementById('contextSnapshotStatus');
  const linkedFolderStatus = document.getElementById('contextLinkedFolderStatus');

  // Toggles — resetear siempre al abrir para evitar estado sucio de proyecto anterior
  let snapshotToggle = document.getElementById('contextSnapshotToggle');
  snapshotToggle.checked  = true;
  snapshotToggle.disabled = false;
  const newSnapToggle = snapshotToggle.cloneNode(false);
  snapshotToggle.replaceWith(newSnapToggle);
  snapshotToggle = newSnapToggle;

  let linkedFolderToggle = document.getElementById('contextLinkedFolderToggle');
  linkedFolderToggle.checked  = false;
  linkedFolderToggle.disabled = true;
  const newLFToggle = linkedFolderToggle.cloneNode(false);
  linkedFolderToggle.replaceWith(newLFToggle);
  linkedFolderToggle = newLFToggle;

  async function getProjectSettings() {
    try {
      const res  = await fetch(`${BASE_URL}/project/${projectId}/settings`, { headers: authH() });
      const data = await res.json();
      return data.ok ? data.settings : null;
    } catch (_) { return null; }
  }

  snapshotToggle.addEventListener('change', async () => {
    await fetch(`${BASE_URL}/project/${projectId}/context/snapshot/toggle`, {
      method: 'POST',
      headers: authH({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ enabled: snapshotToggle.checked })
    });
    await refreshSnapshotStatus();
    await renderItems();
  });

  linkedFolderToggle.addEventListener('change', async () => {
    await fetch(`${BASE_URL}/project/${projectId}/context/linked-folder/toggle`, {
      method: 'POST',
      headers: authH({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ enabled: linkedFolderToggle.checked })
    });
    await refreshLinkedFolderStatus();
    await renderItems();
  });

  // ── Explorador de carpetas ─────────────────────────────────
  function attachFolderBrowser(inputEl, browseBtnEl) {
    if (!browseBtnEl) return;
    let browseDropdown = null;

    function removeBrowseDropdown() {
      if (browseDropdown) { browseDropdown.remove(); browseDropdown = null; }
    }

    async function showBrowse(browsePath) {
      removeBrowseDropdown();
      try {
        const res  = await fetch(`${BASE_URL}/fs/browse?path=${encodeURIComponent(browsePath)}`, { headers: authH() });
        const data = await res.json();
        if (!data.ok) return;

        browseDropdown = document.createElement('div');
        browseDropdown.className = 'fs-browse-dropdown';
        browseDropdown.style.cssText = 'position:absolute;background:var(--bg-secondary,#1e1e2e);border:1px solid var(--border,#333);border-radius:6px;max-height:220px;overflow-y:auto;z-index:9999;min-width:320px;';

        if (data.path) {
          const upItem = document.createElement('div');
          upItem.style.cssText = 'padding:6px 12px;cursor:pointer;font-size:0.85rem;color:var(--text-secondary,#888);border-bottom:1px solid var(--border,#333);';
          upItem.textContent = '↑ Subir';
          upItem.onmouseenter = () => upItem.style.background = 'var(--hover,#2a2a3e)';
          upItem.onmouseleave = () => upItem.style.background = '';
          upItem.onclick = async (e) => {
            e.stopPropagation();
            const parent = data.path.replace(/\\/g, '/').replace(/\/[^/]+\/?$/, '') || '';
            await showBrowse(parent);
          };
          browseDropdown.appendChild(upItem);

          const selectItem = document.createElement('div');
          selectItem.style.cssText = 'padding:6px 12px;cursor:pointer;font-size:0.85rem;color:var(--accent,#7c6af7);border-bottom:1px solid var(--border,#333);font-weight:600;';
          selectItem.textContent = '✓ Usar esta carpeta';
          selectItem.onmouseenter = () => selectItem.style.background = 'var(--hover,#2a2a3e)';
          selectItem.onmouseleave = () => selectItem.style.background = '';
          selectItem.onclick = (e) => {
            e.stopPropagation();
            inputEl.value = data.path.replace(/\\/g, '/');
            removeBrowseDropdown();
          };
          browseDropdown.appendChild(selectItem);
        }

        if (!data.entries.length) {
          const empty = document.createElement('div');
          empty.style.cssText = 'padding:6px 12px;font-size:0.85rem;color:var(--text-secondary,#888);';
          empty.textContent = 'Sin subcarpetas';
          browseDropdown.appendChild(empty);
        }

        data.entries.forEach(entry => {
          const item = document.createElement('div');
          item.style.cssText = 'padding:6px 12px;cursor:pointer;font-size:0.85rem;';
          const fullPath = data.path ? `${data.path}/${entry.name}` : entry.name;
          item.textContent = `📁 ${entry.name}`;
          item.onmouseenter = () => item.style.background = 'var(--hover,#2a2a3e)';
          item.onmouseleave = () => item.style.background = '';
          item.onclick = async (e) => {
            e.stopPropagation();
            inputEl.value = fullPath.replace(/\\/g, '/');
            await showBrowse(fullPath);
          };
          browseDropdown.appendChild(item);
        });

        inputEl.insertAdjacentElement('afterend', browseDropdown);
      } catch (_) {}
    }

    browseBtnEl.onclick = async (e) => {
      e.stopPropagation();

      // Electron: diálogo nativo de carpetas. Se manda el valor actual del
      // input como defaultPath — si no, el diálogo recuerda internamente la
      // última carpeta visitada de forma GLOBAL en todo el proceso (ver fix
      // en shell/main.js), no por proyecto.
      if (window.electronAPI?.selectFolder) {
        const folderPath = await window.electronAPI.selectFolder(inputEl.value.trim() || undefined);
        if (folderPath) {
          inputEl.value = folderPath.replace(/\\/g, '/');
          removeBrowseDropdown();
        }
        return;
      }

      // Navegador: fallback al dropdown via /fs/browse
      await showBrowse(inputEl.value.trim());
    };

    inputEl.oninput = async () => {
      const val = inputEl.value.trim();
      if (val.length >= 2) await showBrowse(val);
      else removeBrowseDropdown();
    };

    document.addEventListener('click', (e) => {
      if (browseDropdown && !browseDropdown.contains(e.target) && e.target !== browseBtnEl && e.target !== inputEl) {
        removeBrowseDropdown();
      }
    });
  }

  attachFolderBrowser(folderInput, folderBrowse);

  // ── Estado del snapshot ───────────────────────────────────
  async function refreshSnapshotStatus() {
    try {
      const res  = await fetch(`${BASE_URL}/project/${projectId}/context/snapshot/status`, { headers: authH() });
      const data = await res.json();

      if (data.hasSnapshot) {
        const d   = new Date(data.generatedAt);
        const fmt = d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });

        // folderInput se limpió al abrir el modal (arriba), así que este
        // fallback solo aplica dentro de la MISMA apertura del modal —
        // nunca hereda el valor de un proyecto distinto.
        folderInput.value = folderInput.value || data.snapshotRoot || '';

        // Carpeta escaneada pero sin archivos de código — nada que activar/pausar.
        // Antes esto se confundía con "nunca se generó snapshot" y forzaba checked=true,
        // dejando el toggle trabado sin poder destildarlo (bug reportado).
        if (!data.totalFiles) {
          snapshotStatus.textContent = 'Sin archivos de código en esta carpeta.';
          snapshotStatus.className   = 'snapshot-status snapshot-status--empty';
          snapshotToggle.checked  = false;
          snapshotToggle.disabled = true;
          snapshotToggle.title    = 'Esta carpeta no tiene archivos de código para patch mode';
          return;
        }

        snapshotToggle.disabled = false;

        // Sincronizar toggle con estado real
        const index         = await fetch(`${BASE_URL}/project/${projectId}/context/items`, { headers: authH() }).then(r => r.json());
        const snapshotItems = (index.items || []).filter(i => i.source === 'snapshot');
        snapshotToggle.checked = snapshotItems.some(i => i.enabled);

        snapshotStatus.textContent = snapshotToggle.checked
          ? `✓ ${data.totalFiles} archivos · ${fmt}`
          : `⏸ Pausado · ${data.totalFiles} archivos · ${fmt}`;
        snapshotStatus.className = snapshotToggle.checked
          ? 'snapshot-status snapshot-status--ok'
          : 'snapshot-status snapshot-status--empty';
      } else {
        snapshotStatus.textContent = 'Sin snapshot — necesario para Patch Mode.';
        snapshotStatus.className   = 'snapshot-status snapshot-status--empty';
        if (snapshotToggle) snapshotToggle.checked = false;
      }
    } catch (_) {
      snapshotStatus.textContent = 'No se pudo verificar el snapshot.';
      snapshotStatus.className   = 'snapshot-status snapshot-status--empty';
    }
  }

  // ── Estado de la carpeta vinculada ────────────────────────
  async function refreshLinkedFolderStatus() {
    const settings = await getProjectSettings();
    const lf = settings?.linkedFolder;

    if (!lf || !lf.path) {
      linkedFolderStatus.textContent = 'Sin escanear.';
      linkedFolderStatus.className   = 'snapshot-status snapshot-status--empty';
      linkedFolderToggle.checked  = false;
      linkedFolderToggle.disabled = true;
      return;
    }

    folderInput.value = folderInput.value || lf.path;

    if (lf.status === 'error') {
      linkedFolderStatus.textContent = `✗ Error: ${lf.lastError || 'desconocido'}`;
      linkedFolderStatus.className   = 'snapshot-status snapshot-status--error';
      linkedFolderToggle.checked  = false;
      linkedFolderToggle.disabled = true;
      return;
    }

    if (!lf.lastIndexed) {
      linkedFolderStatus.textContent = 'Vinculada, sin escanear todavía.';
      linkedFolderStatus.className   = 'snapshot-status snapshot-status--empty';
      linkedFolderToggle.checked  = false;
      linkedFolderToggle.disabled = true;
      return;
    }

    // Carpeta escaneada pero sin documentos soportados — nada que activar/pausar.
    if (!lf.totalFiles) {
      linkedFolderStatus.textContent = 'Sin documentos soportados en esta carpeta.';
      linkedFolderStatus.className   = 'snapshot-status snapshot-status--empty';
      linkedFolderToggle.checked  = false;
      linkedFolderToggle.disabled = true;
      linkedFolderToggle.title    = 'Esta carpeta no tiene PDF/DOCX/PPTX/imágenes para indexar';
      return;
    }

    linkedFolderToggle.disabled = false;
    linkedFolderToggle.checked  = !!lf.enabled;

    const d         = new Date(lf.lastIndexed);
    const fmt       = d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    const truncNote = lf.truncated ? ' · límite alcanzado' : '';
    linkedFolderStatus.textContent = lf.enabled
      ? `✓ ${lf.totalFiles} archivos · ${fmt}${truncNote}`
      : `⏸ Pausado · ${lf.totalFiles} archivos · ${fmt}${truncNote}`;
    linkedFolderStatus.className = lf.enabled
      ? 'snapshot-status snapshot-status--ok'
      : 'snapshot-status snapshot-status--empty';
  }

  // Snapshot primero (prioridad para prellenar el input), después carpeta
  // vinculada (solo prellena si snapshot no lo hizo) — ambas dentro de la
  // MISMA apertura del modal, sobre un input que arrancó vacío.
  await refreshSnapshotStatus();
  await refreshLinkedFolderStatus();

  // ── Botón "Escanear carpeta" — dispara ambos scans contra la misma ruta ──
  const newFolderBtn = folderBtn.cloneNode(true);
  folderBtn.replaceWith(newFolderBtn);

  newFolderBtn.onclick = async () => {
    const root = folderInput.value.trim();
    if (!root) {
      snapshotStatus.textContent     = '✗ Escribe o seleccioná una carpeta primero.';
      snapshotStatus.className       = 'snapshot-status snapshot-status--error';
      linkedFolderStatus.textContent = '✗ Escribe o seleccioná una carpeta primero.';
      linkedFolderStatus.className   = 'snapshot-status snapshot-status--error';
      return;
    }

    newFolderBtn.disabled    = true;
    newFolderBtn.textContent = 'Escaneando...';
    snapshotStatus.textContent     = 'Escaneando código...';
    snapshotStatus.className       = 'snapshot-status';
    linkedFolderStatus.textContent = 'Escaneando documentos...';
    linkedFolderStatus.className   = 'snapshot-status';

    // En paralelo, con allSettled — si uno falla el otro igual se completa
    // (son dos sistemas independientes por dentro; patch mode no se toca).
    const [snapResult, lfResult] = await Promise.allSettled([
      fetch(`${BASE_URL}/project/${projectId}/context/snapshot`, {
        method: 'POST',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ snapshotRoot: root }),
      }).then(r => r.json()),
      fetch(`${BASE_URL}/project/${projectId}/context/linked-folder/refresh`, {
        method: 'POST',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ path: root }),
      }).then(r => r.json()),
    ]);

    if (snapResult.status === 'rejected' || !snapResult.value?.ok) {
      const err = snapResult.status === 'rejected' ? snapResult.reason?.message : snapResult.value?.error;
      snapshotStatus.textContent = `✗ Error: ${err || 'desconocido'}`;
      snapshotStatus.className   = 'snapshot-status snapshot-status--error';
    }
    if (lfResult.status === 'rejected' || !lfResult.value?.ok) {
      const err = lfResult.status === 'rejected' ? lfResult.reason?.message : lfResult.value?.error;
      linkedFolderStatus.textContent = `✗ Error: ${err || 'desconocido'}`;
      linkedFolderStatus.className   = 'snapshot-status snapshot-status--error';
    }

    await refreshSnapshotStatus();
    await refreshLinkedFolderStatus();
    await renderItems();

    newFolderBtn.disabled    = false;
    newFolderBtn.textContent = '↻ Escanear carpeta';
  };
  // ── /Carpeta del proyecto ─────────────────────────────────

  // ── Lista de archivos ─────────────────────────────────────
  async function renderItems() {
    list.innerHTML           = '';
    uploadStatus.textContent = '';

    let items = [];
    try {
      const res = await listContextItems(projectId);
      items = res.items || [];
    } catch (_) {
      list.innerHTML = '<p class="context-empty">Error al cargar archivos.</p>';
      return;
    }

    if (items.length === 0) {
      list.innerHTML = '<p class="context-empty">No hay archivos de contexto. Sube archivos para que Tempest los use en este proyecto.</p>';
      return;
    }

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'context-file-row';

      const info = document.createElement('div');
      info.className = 'context-file-info';

      const name = document.createElement('span');
      name.className   = 'context-file-name';
      name.textContent = item.name;
      if (item.source === 'snapshot' || item.source === 'linked-folder') {
        const badge = document.createElement('span');
        badge.className   = 'context-source-badge';
        badge.textContent = item.source === 'snapshot' ? 'snapshot' : 'carpeta';
        name.appendChild(badge);
      }

      const size = document.createElement('span');
      size.className   = 'context-file-size';
      size.textContent = item.sizeBytes ? `${(item.sizeBytes / 1024).toFixed(1)} KB` : '';

      info.appendChild(name);
      info.appendChild(size);

      const controls = document.createElement('div');
      controls.className = 'context-file-controls';

      const enabledLabel = document.createElement('label');
      enabledLabel.className = 'context-toggle';
      const enabledCheck = document.createElement('input');
      enabledCheck.type    = 'checkbox';
      enabledCheck.checked = item.enabled;
      enabledCheck.onchange = async () => {
        await updateContextItem(projectId, item.id, { enabled: enabledCheck.checked });
      };
      enabledLabel.appendChild(enabledCheck);
      enabledLabel.appendChild(document.createTextNode(' activo'));

      const alwaysLabel = document.createElement('label');
      alwaysLabel.className          = 'context-toggle';
      alwaysLabel.style.paddingRight = '4px';
      const alwaysCheck = document.createElement('input');
      alwaysCheck.type    = 'checkbox';
      alwaysCheck.checked = item.alwaysInclude;
      alwaysCheck.onchange = async () => {
        await updateContextItem(projectId, item.id, { alwaysInclude: alwaysCheck.checked });
      };
      alwaysLabel.appendChild(alwaysCheck);
      alwaysLabel.appendChild(document.createTextNode(' siempre'));

      const delBtn = document.createElement('button');
      delBtn.className   = 'context-file-delete';
      delBtn.textContent = '✕';
      delBtn.onclick = async () => {
        await deleteContextItem(projectId, item.id);
        await renderItems();
      };

      const enabledGroup = document.createElement('div');
      enabledGroup.className = 'context-file-toggle';
      enabledGroup.appendChild(enabledLabel);

      const fixedGroup = document.createElement('div');
      fixedGroup.className = 'context-file-toggle';
      fixedGroup.appendChild(alwaysLabel);

      controls.appendChild(enabledGroup);
      controls.appendChild(fixedGroup);
      controls.appendChild(delBtn);

      row.appendChild(info);
      row.appendChild(controls);
      list.appendChild(row);
    });
  }

  await renderItems();

  // ── Drag & drop ───────────────────────────────────────────
  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    list.classList.add('drag-over');
  });

  list.addEventListener('dragleave', (e) => {
    if (!list.contains(e.relatedTarget)) list.classList.remove('drag-over');
  });

  list.addEventListener('drop', async (e) => {
    e.preventDefault();
    list.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

    let currentItems = [];
    try {
      const res = await listContextItems(projectId);
      currentItems = res.items || [];
    } catch (_) {}

    const MAX_FILES = 20;
    const available = MAX_FILES - currentItems.length;

    if (available <= 0) {
      uploadStatus.textContent = `✗ Límite alcanzado (máx ${MAX_FILES} archivos por proyecto)`;
      return;
    }

    const toUpload = files.slice(0, available);
    const skipped  = files.length - toUpload.length;

    uploadStatus.textContent = 'Subiendo...';
    uploadBtn.disabled = true;

    try {
      const res = await uploadContextFiles(projectId, toUpload);
      let msg = res.added?.length
        ? `✓ ${res.added.length} archivo(s) agregado(s)`
        : 'Sin cambios (posibles duplicados)';
      if (skipped > 0) msg += ` · ${skipped} omitido(s) por límite`;
      uploadStatus.textContent = msg;
    } catch (_) {
      uploadStatus.textContent = '✗ Error al subir archivos';
    }

    uploadBtn.disabled = false;
    await renderItems();
  });
  // ── /Drag & drop ──────────────────────────────────────────

  // ── Subida manual ─────────────────────────────────────────
  uploadBtn.onclick = () => fileInput.click();

  fileInput.onchange = async () => {
    if (!fileInput.files.length) return;
    uploadStatus.textContent = 'Subiendo...';
    uploadBtn.disabled = true;

    try {
      const res = await uploadContextFiles(projectId, fileInput.files);
      uploadStatus.textContent = res.added?.length
        ? `✓ ${res.added.length} archivo(s) subido(s)`
        : 'Sin cambios (posibles duplicados)';
    } catch (_) {
      uploadStatus.textContent = '✗ Error al subir archivos';
    }

    fileInput.value    = '';
    uploadBtn.disabled = false;
    await renderItems();
  };

  // ── Cerrar modal ──────────────────────────────────────────
  const newClose = closeBtn.cloneNode(true);
  closeBtn.replaceWith(newClose);
  newClose.onclick = () => modal.classList.add('hidden');

  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  };
}