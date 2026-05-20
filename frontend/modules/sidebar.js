import {
  listChats,
  listProjects,
  createChat,
  deleteChat,
  deleteProject,
  renameChat,
  renameProject,
  getChatHistory,
  listContextItems,
  uploadContextFiles,
  updateContextItem,
  deleteContextItem,
  getProjectSettings,
  updateProjectSettings
} from '../api.js';
import { setActiveChat, getChatState } from '../chatState.js';
import { addMessage } from '../ui.js';

function validateName(name) {
  if (!name || !name.trim()) return 'El nombre no puede estar vacío.';
  if (name.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres.';
  if (/[\\/:*?"<>|]/.test(name)) return 'El nombre contiene caracteres no permitidos: \\ / : * ? " < > |';
  if (/^\./.test(name.trim())) return 'El nombre no puede empezar con un punto.';
  if (name.trim().length > 60) return 'El nombre es demasiado largo (máximo 60 caracteres).';
  return null;
}

let collapsedProjects = new Set();
let sidebarInitialized = false;
let selectionMode = false;
let selectedChats = new Set();
let projectSelectionMode = null; // projectId activo en modo selección, o null
let selectedProjectChats = new Set();
let pendingDelete = null;
let pendingBulkDelete = null;

export function getSelectionMode() { return selectionMode; }
export function getSelectedChats() { return selectedChats; }
export function getPendingDelete() { return pendingDelete; }
export function getPendingBulkDelete() { return pendingBulkDelete; }
export function setPendingDelete(val) { pendingDelete = val; }
export function setPendingBulkDelete(val) { pendingBulkDelete = val; }
export function clearSelection() {
  selectionMode = false;
  selectedChats.clear();
  projectSelectionMode = null;
  selectedProjectChats.clear();
}

export function createActionsMenu({ type, id, projectId }, { onLoadSidebar, onLoadChatHistory, deleteConfirmModal, deleteConfirmText }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'sidebar-item';

  const label = document.createElement('span');
  label.textContent = id;
  label.className = 'sidebar-item-label';

  const dots = document.createElement('button');
  dots.textContent = '⋯';
  dots.className = 'sidebar-dots';

  const menu = document.createElement('div');
  menu.className = 'sidebar-context-menu hidden';

  const renameBtn = document.createElement('button');
  renameBtn.textContent = 'Renombrar';

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Eliminar';

  renameBtn.onclick = (event) => {
    event.stopPropagation();
    menu.classList.add('hidden');
    openRenameModal({ type, id, projectId, onLoadSidebar });
  };

  deleteBtn.onclick = (event) => {
    event.stopPropagation();
    pendingDelete = { type, id, projectId };
    deleteConfirmText.textContent = `¿Estás seguro de que deseas eliminar "${id}"?`;
    deleteConfirmModal.classList.remove('hidden');
  };

  dots.onclick = (event) => {
    event.stopPropagation();
    document.querySelectorAll('.sidebar-context-menu').forEach(m => m.classList.add('hidden'));
    menu.classList.toggle('hidden');
  };

  if (type === 'project') {
    const contextBtn = document.createElement('button');
    contextBtn.textContent = 'Archivos de contexto';
    contextBtn.onclick = (event) => {
      event.stopPropagation();
      menu.classList.add('hidden');
      openContextFilesModal(id);
    };
    menu.appendChild(contextBtn);

    const configBtn = document.createElement('button');
    configBtn.textContent = 'Configuración';
    configBtn.onclick = (event) => {
      event.stopPropagation();
      menu.classList.add('hidden');
      openProjectConfigModal(id);
    };
    menu.appendChild(configBtn);

    const selectChatsBtn = document.createElement('button');
    selectChatsBtn.textContent = projectSelectionMode === id ? 'Cancelar selección' : 'Seleccionar chats';
    selectChatsBtn.onclick = async (event) => {
      event.stopPropagation();
      menu.classList.add('hidden');
      if (projectSelectionMode === id) {
        projectSelectionMode = null;
        selectedProjectChats.clear();
      } else {
        projectSelectionMode = id;
        selectedProjectChats.clear();
        if (collapsedProjects.has(id)) collapsedProjects.delete(id);
      }
      await deps.onLoadSidebar();
    };
    menu.appendChild(selectChatsBtn);
  }

  menu.appendChild(renameBtn);
  menu.appendChild(deleteBtn);

  wrapper.appendChild(label);
  wrapper.appendChild(dots);
  wrapper.appendChild(menu);

  return wrapper;
}

export function renderSelectionControls(container, { onLoadSidebar, deleteConfirmModal, deleteConfirmText }) {
  const controls = document.createElement('div');
  controls.className = 'selection-controls';

  const selectBtn = document.createElement('button');
  selectBtn.textContent = selectionMode ? 'Cancelar selección' : 'Seleccionar chats';

  selectBtn.onclick = async () => {
    selectionMode = !selectionMode;
    selectedChats.clear();
    await onLoadSidebar();
  };

  controls.appendChild(selectBtn);

  if (selectionMode) {
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = `Eliminar seleccionados (${selectedChats.size})`;
    deleteBtn.disabled = selectedChats.size === 0;

    deleteBtn.onclick = () => {
      if (selectedChats.size === 0) return;
      pendingBulkDelete = {
        type: 'chats',
        projectId: 'general',
        chatIds: Array.from(selectedChats)
      };
      deleteConfirmText.textContent = '¿Estás seguro de que deseas eliminar los chats seleccionados?';
      deleteConfirmModal.classList.remove('hidden');
    };

    controls.appendChild(deleteBtn);
  }

  container.appendChild(controls);
}

export async function loadChats(projectId = 'general', deps) {
  try {
    const res = await listChats(projectId);
    const container = document.getElementById('chatList');
    container.innerHTML = '';
    renderSelectionControls(container, deps);

    if (!res.ok || !Array.isArray(res.chats)) {
      container.textContent = 'No se pudieron cargar los chats';
      return;
    }

    res.chats.filter(chatId => chatId !== 'default').forEach(chatId => {
      const item = document.createElement('div');
      const state = getChatState();

      item.className = state.projectId === projectId && state.chatId === chatId
        ? 'sidebar-link active-chat'
        : 'sidebar-link';

      if (selectionMode && projectId === 'general') {
        item.classList.add('selectable-chat');
        if (selectedChats.has(chatId)) item.classList.add('selected-chat');

        const label = document.createElement('span');
        label.textContent = chatId;
        item.appendChild(label);

        item.onclick = () => {
          if (selectedChats.has(chatId)) selectedChats.delete(chatId);
          else selectedChats.add(chatId);
          deps.onLoadSidebar();
        };
      } else {
        const itemContent = createActionsMenu({ type: 'chat', id: chatId, projectId }, deps);
        item.appendChild(itemContent);
        item.onclick = () => {
          setActiveChat({ projectId, chatId, mode: 'project' });
          deps.onLoadChatHistory();
          deps.onLoadSidebar();
        };
      }

      container.appendChild(item);
    });
  } catch (error) {
    console.error('Error cargando chats:', error);
  }
}

export async function loadProjectChats(projectId, container, deps) {
  const res = await listChats(projectId);
  container.innerHTML = '';

  const newChatItem = document.createElement('div');
  newChatItem.className = 'sidebar-link project-chat-link new-project-chat';
  newChatItem.textContent = '+ Nuevo chat';

  newChatItem.onclick = async () => {
    setActiveChat({ projectId, chatId: null, mode: 'landing' });
    deps.onSetPendingAutoRename({ type: 'chat', projectId, chatId: null });
    deps.onRenderWelcomeScreen();
    await deps.onLoadSidebar();
    deps.userInput.focus();
  };

  container.appendChild(newChatItem);

  if (!res.ok || !Array.isArray(res.chats)) return;

  // Barra de selección del proyecto
  if (projectSelectionMode === projectId) {
    const selBar = document.createElement('div');
    selBar.className = 'selection-controls project-selection-controls';

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = `Eliminar seleccionados (${selectedProjectChats.size})`;
    deleteBtn.disabled = selectedProjectChats.size === 0;
    deleteBtn.onclick = () => {
      if (selectedProjectChats.size === 0) return;
      deps.onSetPendingBulkDelete({
        type: 'chats',
        projectId,
        chatIds: Array.from(selectedProjectChats),
      });
      deps.deleteConfirmText.textContent = `¿Eliminar ${selectedProjectChats.size} chat(s) del proyecto "${projectId}"?`;
      deps.deleteConfirmModal.classList.remove('hidden');
    };
    selBar.appendChild(deleteBtn);
    container.appendChild(selBar);
  }

  res.chats.filter(chatId => chatId !== 'default').forEach(chatId => {
    const chatItem = document.createElement('div');
    const state = getChatState();

    chatItem.className = state.projectId === projectId && state.chatId === chatId
      ? 'sidebar-link project-chat-link active-chat'
      : 'sidebar-link project-chat-link';

    if (projectSelectionMode === projectId) {
      chatItem.classList.add('selectable-chat');
      if (selectedProjectChats.has(chatId)) chatItem.classList.add('selected-chat');

      const label = document.createElement('span');
      label.textContent = chatId;
      chatItem.appendChild(label);

      chatItem.onclick = () => {
        if (selectedProjectChats.has(chatId)) selectedProjectChats.delete(chatId);
        else selectedProjectChats.add(chatId);
        deps.onLoadSidebar();
      };
    } else {
      const itemContent = createActionsMenu({ type: 'chat', id: chatId, projectId }, deps);
      chatItem.appendChild(itemContent);
      chatItem.onclick = () => {
        setActiveChat({ projectId, chatId, mode: 'project' });
        deps.onLoadChatHistory();
        deps.onLoadSidebar();
      };
    }

    container.appendChild(chatItem);
  });
}

export async function loadProjects(deps) {
  const res = await listProjects();
  const container = document.getElementById('projectList');
  container.innerHTML = '';

  if (!res.ok || !Array.isArray(res.projects)) {
    container.textContent = 'No se pudieron cargar los proyectos';
    return;
  }

  const visibleProjects = res.projects.filter(p => p !== 'general');

  if (!sidebarInitialized) {
    visibleProjects.forEach(p => collapsedProjects.add(p));
    sidebarInitialized = true;
  }

  for (const projectId of visibleProjects) {
    const projectBlock = document.createElement('div');
    projectBlock.className = 'project-block';

    const state = getChatState();
    const isCollapsed = collapsedProjects.has(projectId);
    const isActiveProject = state.projectId === projectId;

    const projectTitle = document.createElement('div');
    projectTitle.className = isCollapsed && isActiveProject
      ? 'project-title active-chat'
      : 'project-title';

    const arrow = document.createElement('span');
    arrow.className = 'project-arrow';
    arrow.textContent = isCollapsed ? '▸' : '▾';

    const projectActions = createActionsMenu({ type: 'project', id: projectId, projectId }, deps);
    projectActions.classList.add('project-actions');

    projectTitle.appendChild(arrow);
    projectTitle.appendChild(projectActions);

    const projectChats = document.createElement('div');
    projectChats.className = 'project-chats';

    projectTitle.onclick = async () => {
      if (collapsedProjects.has(projectId)) collapsedProjects.delete(projectId);
      else collapsedProjects.add(projectId);
      setActiveChat({ projectId, chatId: 'default', mode: 'project' });
      await deps.onLoadSidebar();
      deps.onLoadChatHistory();
    };

    projectBlock.appendChild(projectTitle);
    projectBlock.appendChild(projectChats);
    container.appendChild(projectBlock);

    if (!collapsedProjects.has(projectId)) {
      await loadProjectChats(projectId, projectChats, deps);
    }
  }
}

export function openRenameModal({ type, id, projectId, onLoadSidebar }) {
  const modal = document.getElementById('renameModal');
  const label = document.getElementById('renameModalLabel');
  const input = document.getElementById('renameModalInput');
  const cancelBtn = document.getElementById('cancelRenameBtn');
  const confirmBtn = document.getElementById('confirmRenameBtn');

  label.textContent = type === 'project' ? 'Nuevo nombre del proyecto' : 'Nuevo nombre del chat';
  input.value = id;
  modal.classList.remove('hidden');
  input.focus();
  input.select();

  const newCancel = cancelBtn.cloneNode(true);
  const newConfirm = confirmBtn.cloneNode(true);
  cancelBtn.replaceWith(newCancel);
  confirmBtn.replaceWith(newConfirm);

  const close = () => modal.classList.add('hidden');

  newCancel.onclick = close;

  newConfirm.onclick = async () => {
    const newName = input.value.trim();
    if (!newName || newName === id) { close(); return; }

    const error = validateName(newName);
    if (error) {
      const errorEl = modal.querySelector('.rename-modal-error') || (() => {
        const el = document.createElement('p');
        el.className = 'rename-modal-error';
        input.insertAdjacentElement('afterend', el);
        return el;
      })();
      errorEl.textContent = error;
      return;
    }

    const errorEl = modal.querySelector('.rename-modal-error');
    if (errorEl) errorEl.remove();

    if (type === 'chat') await renameChat(id, newName, projectId);
    if (type === 'project') await renameProject(id, newName);
    close();
    await onLoadSidebar();
  };createActionsMenu

  input.onkeydown = async (e) => {
    if (e.key === 'Enter') newConfirm.onclick();
    if (e.key === 'Escape') close();
  };
}

export async function openContextFilesModal(projectId) {
  const modal = document.getElementById('contextFilesModal');
  const projectName = document.getElementById('contextFilesProjectName');
  const list = document.getElementById('contextFilesList');
  const uploadBtn = document.getElementById('contextUploadBtn');
  const fileInput = document.getElementById('contextFileInput');
  const uploadStatus = document.getElementById('contextUploadStatus');
  const closeBtn = document.getElementById('closeContextFilesBtn');

  projectName.textContent = projectId;
  modal.classList.remove('hidden');

  // ── Snapshot ──────────────────────────────────────────────
  const snapshotSection = document.getElementById('contextSnapshotSection');
  const snapshotStatus  = document.getElementById('contextSnapshotStatus');
  const snapshotBtn     = document.getElementById('contextSnapshotBtn');
  const snapshotInput   = document.getElementById('contextSnapshotRootInput');

  async function refreshSnapshotStatus() {
    try {
      const res = await fetch(`/project/${projectId}/context/snapshot/status`);
      const data = await res.json();
      if (data.hasSnapshot) {
        const d = new Date(data.generatedAt);
        const fmt = d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
        snapshotStatus.textContent = `✓ Snapshot activo · ${data.totalFiles} archivos · ${fmt}`;
        snapshotStatus.className = 'snapshot-status snapshot-status--ok';
        snapshotInput.value = snapshotInput.value || data.snapshotRoot || '';
      } else {
        snapshotStatus.textContent = 'Sin snapshot — genera uno para activar Patch Mode funcional.';
        snapshotStatus.className = 'snapshot-status snapshot-status--empty';
      }
    } catch (_) {
      snapshotStatus.textContent = 'No se pudo verificar el snapshot.';
      snapshotStatus.className = 'snapshot-status snapshot-status--empty';
    }
  }

  await refreshSnapshotStatus();

  const newSnapshotBtn = snapshotBtn.cloneNode(true);
  snapshotBtn.replaceWith(newSnapshotBtn);

  newSnapshotBtn.onclick = async () => {
    const root = snapshotInput.value.trim();
    if (!root) {
      snapshotStatus.textContent = '✗ Escribe la ruta del proyecto primero.';
      snapshotStatus.className = 'snapshot-status snapshot-status--error';
      return;
    }
    newSnapshotBtn.disabled = true;
    newSnapshotBtn.textContent = 'Generando...';
    snapshotStatus.textContent = 'Escaneando archivos...';
    snapshotStatus.className = 'snapshot-status';

    try {
      const res = await fetch(`/project/${projectId}/context/snapshot`, {
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
        snapshotStatus.className = 'snapshot-status snapshot-status--error';
      }
    } catch (err) {
      snapshotStatus.textContent = '✗ Error de conexión.';
      snapshotStatus.className = 'snapshot-status snapshot-status--error';
    } finally {
      newSnapshotBtn.disabled = false;
      newSnapshotBtn.textContent = '↻ Generar snapshot';
    }
  };
  // ── /Snapshot ─────────────────────────────────────────────

  async function renderItems() {
    list.innerHTML = '';
    uploadStatus.textContent = '';

    let items = [];
    try {
      const res = await listContextItems(projectId);
      items = res.items || [];
    } catch (err) {
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
      name.className = 'context-file-name';
      name.textContent = item.name;
      if (item.source === 'snapshot') {
        const badge = document.createElement('span');
        badge.className = 'context-source-badge';
        badge.textContent = 'snapshot';
        name.appendChild(badge);
      }

      const size = document.createElement('span');
      size.className = 'context-file-size';
      size.textContent = item.sizeBytes ? `${(item.sizeBytes / 1024).toFixed(1)} KB` : '';

      info.appendChild(name);
      info.appendChild(size);

      const controls = document.createElement('div');
      controls.className = 'context-file-controls';

      const enabledLabel = document.createElement('label');
      enabledLabel.className = 'context-toggle';
      const enabledCheck = document.createElement('input');
      enabledCheck.type = 'checkbox';
      enabledCheck.checked = item.enabled;
      enabledCheck.onchange = async () => {
        await updateContextItem(projectId, item.id, { enabled: enabledCheck.checked });
      };
      enabledLabel.appendChild(enabledCheck);
      enabledLabel.appendChild(document.createTextNode(' activo'));

      const alwaysLabel = document.createElement('label');
      alwaysLabel.className = 'context-toggle';
      const alwaysCheck = document.createElement('input');
      alwaysCheck.type = 'checkbox';
      alwaysCheck.checked = item.alwaysInclude;
      alwaysCheck.onchange = async () => {
        await updateContextItem(projectId, item.id, { alwaysInclude: alwaysCheck.checked });
      };
      alwaysLabel.appendChild(alwaysCheck);
      alwaysLabel.appendChild(document.createTextNode(' siempre'));
      alwaysLabel.style.paddingRight = '4px';

      const delBtn = document.createElement('button');
      delBtn.className = 'context-file-delete';
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
    } catch (err) {
      uploadStatus.textContent = '✗ Error al subir archivos';
    }

    fileInput.value = '';
    uploadBtn.disabled = false;
    await renderItems();
  };

  const newClose = closeBtn.cloneNode(true);
  closeBtn.replaceWith(newClose);
  newClose.onclick = () => modal.classList.add('hidden');

  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  };
}

export async function loadSidebar(deps) {
  await loadChats('general', deps);
  await loadProjects(deps);
}

export async function openProjectConfigModal(projectId) {
  const modal    = document.getElementById('projectConfigModal');
  const nameEl   = document.getElementById('projectConfigName');
  const textarea = document.getElementById('projectPromptTextarea');
  const saveBtn  = document.getElementById('saveProjectConfigBtn');
  const cancelBtn = document.getElementById('cancelProjectConfigBtn');

  nameEl.textContent = projectId;
  textarea.value = '';
  modal.classList.remove('hidden');

  try {
    const res = await getProjectSettings(projectId);
    if (res.ok) textarea.value = res.settings?.prompts?.projectPromptText || '';
  } catch (_) {}

  textarea.focus();

  const close = () => modal.classList.add('hidden');

  const newSave   = saveBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  saveBtn.replaceWith(newSave);
  cancelBtn.replaceWith(newCancel);

  newCancel.onclick = close;

  newSave.onclick = async () => {
    newSave.disabled = true;
    newSave.textContent = 'Guardando...';

    try {
      const res = await updateProjectSettings(projectId, {
        prompts: { projectPromptText: textarea.value.trim() }
      });
      if (res.ok) close();
      else newSave.textContent = '✗ Error';
    } catch (_) {
      newSave.textContent = '✗ Error';
    } finally {
      newSave.disabled = false;
      if (newSave.textContent === 'Guardando...') newSave.textContent = 'Guardar';
    }
  };

  modal.onclick = (e) => { if (e.target === modal) close(); };
}