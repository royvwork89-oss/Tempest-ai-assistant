import {
  listContextItems,
  uploadContextFiles,
  updateContextItem,
  deleteContextItem
} from '../api.js';

export async function openContextFilesModal(projectId) {
  const modal        = document.getElementById('contextFilesModal');
  const projectName  = document.getElementById('contextFilesProjectName');
  const list         = document.getElementById('contextFilesList');
  const uploadBtn    = document.getElementById('contextUploadBtn');
  const fileInput    = document.getElementById('contextFileInput');
  const uploadStatus = document.getElementById('contextUploadStatus');
  const closeBtn     = document.getElementById('closeContextFilesBtn');

  projectName.textContent = projectId;
  modal.classList.remove('hidden');

  // ── Snapshot ──────────────────────────────────────────────
  const snapshotStatus = document.getElementById('contextSnapshotStatus');
  const snapshotBtn    = document.getElementById('contextSnapshotBtn');
  const snapshotInput  = document.getElementById('contextSnapshotRootInput');
  const snapshotBrowse = document.getElementById('contextSnapshotBrowse');

  // Toggle — resetear siempre al abrir para evitar estado sucio de proyecto anterior
  let snapshotToggle = document.getElementById('contextSnapshotToggle');
  snapshotToggle.checked  = true;
  snapshotToggle.disabled = false;

  // cloneNode+replaceWith para limpiar listeners acumulados
  const newToggle = snapshotToggle.cloneNode(false);
  snapshotToggle.replaceWith(newToggle);
  snapshotToggle = newToggle; // apuntar a la referencia fresca

  // Leer estado real de los items snapshot
  try {
    const itemsRes = await listContextItems(projectId);
    const items = itemsRes.items || [];
    const snapshotItems = items.filter(i => i.source === 'snapshot');

    if (snapshotItems.length === 0) {
      snapshotToggle.checked  = false;
      snapshotToggle.disabled = true;
      snapshotToggle.title    = 'Genera un snapshot primero para poder activarlo';
    } else {
      snapshotToggle.checked  = snapshotItems.some(i => i.enabled !== false);
      snapshotToggle.disabled = false;
      snapshotToggle.title    = snapshotToggle.checked
        ? 'Snapshot activo — clic para pausar'
        : 'Snapshot pausado — clic para activar';
    }
  } catch (_) {}

  snapshotToggle.addEventListener('change', async () => {
    await fetch(`/project/${projectId}/context/snapshot/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: snapshotToggle.checked })
    });
    await refreshSnapshotStatus();
    await renderItems();
  });

  // ── Explorador de carpetas ────────────────────────────────
  if (snapshotBrowse) {
    let browseDropdown = null;

    function removeBrowseDropdown() {
      if (browseDropdown) { browseDropdown.remove(); browseDropdown = null; }
    }

    async function showBrowse(browsePath) {
      removeBrowseDropdown();
      try {
        const res  = await fetch(`/fs/browse?path=${encodeURIComponent(browsePath)}`);
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
            snapshotInput.value = data.path.replace(/\\/g, '/');
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
            snapshotInput.value = fullPath.replace(/\\/g, '/');
            await showBrowse(fullPath);
          };
          browseDropdown.appendChild(item);
        });

        snapshotInput.insertAdjacentElement('afterend', browseDropdown);
      } catch (_) {}
    }

    snapshotBrowse.onclick = async (e) => {
      e.stopPropagation();
      await showBrowse(snapshotInput.value.trim());
    };

    snapshotInput.oninput = async () => {
      const val = snapshotInput.value.trim();
      if (val.length >= 2) await showBrowse(val);
      else removeBrowseDropdown();
    };

    document.addEventListener('click', (e) => {
      if (browseDropdown && !browseDropdown.contains(e.target) && e.target !== snapshotBrowse && e.target !== snapshotInput) {
        removeBrowseDropdown();
      }
    });
  }

  // ── Estado del snapshot ───────────────────────────────────
  async function refreshSnapshotStatus() {
    try {
      const res  = await fetch(`/project/${projectId}/context/snapshot/status`);
      const data = await res.json();

      if (data.hasSnapshot) {
        const d   = new Date(data.generatedAt);
        const fmt = d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
        const isEnabled = snapshotToggle ? snapshotToggle.checked : true;

        snapshotStatus.textContent = isEnabled
          ? `✓ Snapshot activo · ${data.totalFiles} archivos · ${fmt}`
          : `⏸ Snapshot pausado · ${data.totalFiles} archivos · ${fmt}`;
        snapshotStatus.className = isEnabled
          ? 'snapshot-status snapshot-status--ok'
          : 'snapshot-status snapshot-status--empty';

        snapshotInput.value = snapshotInput.value || data.snapshotRoot || '';

        // Sincronizar toggle con estado real
        const index         = await fetch(`/project/${projectId}/context/items`).then(r => r.json());
        const snapshotItems = (index.items || []).filter(i => i.source === 'snapshot');
        snapshotToggle.checked = snapshotItems.length === 0 || snapshotItems.some(i => i.enabled);
      } else {
        snapshotStatus.textContent = 'Sin snapshot — genera uno para activar Patch Mode funcional.';
        snapshotStatus.className   = 'snapshot-status snapshot-status--empty';
        if (snapshotToggle) snapshotToggle.checked = false;
      }
    } catch (_) {
      snapshotStatus.textContent = 'No se pudo verificar el snapshot.';
      snapshotStatus.className   = 'snapshot-status snapshot-status--empty';
    }
  }

  await refreshSnapshotStatus();

  // ── Botón generar snapshot ────────────────────────────────
  const newSnapshotBtn = snapshotBtn.cloneNode(true);
  snapshotBtn.replaceWith(newSnapshotBtn);

  newSnapshotBtn.onclick = async () => {
    const root = snapshotInput.value.trim();
    if (!root) {
      snapshotStatus.textContent = '✗ Escribe la ruta del proyecto primero.';
      snapshotStatus.className   = 'snapshot-status snapshot-status--error';
      return;
    }
    newSnapshotBtn.disabled    = true;
    newSnapshotBtn.textContent = 'Generando...';
    snapshotStatus.textContent = 'Escaneando archivos...';
    snapshotStatus.className   = 'snapshot-status';

    try {
      const res  = await fetch(`/project/${projectId}/context/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotRoot: root }),
      });
      const data = await res.json();
      if (data.ok) {
        await refreshSnapshotStatus();
        await renderItems();
      } else {
        snapshotStatus.textContent = `✗ Error: ${data.error}`;
        snapshotStatus.className   = 'snapshot-status snapshot-status--error';
      }
    } catch (_) {
      snapshotStatus.textContent = '✗ Error de conexión.';
      snapshotStatus.className   = 'snapshot-status snapshot-status--error';
    } finally {
      newSnapshotBtn.disabled    = false;
      newSnapshotBtn.textContent = '↻ Generar snapshot';
    }
  };
  // ── /Snapshot ─────────────────────────────────────────────

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
      if (item.source === 'snapshot') {
        const badge = document.createElement('span');
        badge.className   = 'context-source-badge';
        badge.textContent = 'snapshot';
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