import {
  listChats,
  listProjects,
  createChat,
  renameChat,
  renameProject,
  getChatHistory,
  getProjectSettings
} from '../api.js';
import { setActiveChat, getChatState } from '../chatState.js';
import { addMessage } from '../ui.js';
import { openContextFilesModal } from './contextFiles.js';
import { openProjectConfigModal } from './projectConfig.js';
import { openRenameModal } from './modals.js';

let _isSending = false;
export function setSendingState(val) { _isSending = val; }
export function getSendingState() { return _isSending; }

let collapsedProjects = new Set();
let sidebarInitialized = false;
let selectionMode = false;
let selectedChats = new Set();
let projectSelectionMode = null; // projectId activo en modo selección, o null
let selectedProjectChats = new Set();
let pendingDelete = null;
let pendingBulkDelete = null;
let savedScrollTop = 0;

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

export function createActionsMenu({ type, id, title, projectId }, { onLoadSidebar, onLoadChatHistory, deleteConfirmModal, deleteConfirmText }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'sidebar-item';

  const label = document.createElement('span');
  label.textContent = title || id;
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
    openRenameModal({ type, id, title, projectId, onLoadSidebar });
  };

  deleteBtn.onclick = (event) => {
    event.stopPropagation();
    pendingDelete = { type, id, projectId };
    deleteConfirmText.textContent = `¿Estás seguro de que deseas eliminar "${title || id}"?`;
    deleteConfirmModal.classList.remove('hidden');
  };

  dots.onclick = (event) => {
    event.stopPropagation();
    if (_isSending) return;
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

    res.chats.filter(chat => chat.chatId !== 'default').forEach(chat => {
      const { chatId, title } = chat;
      const item = document.createElement('div');
      const state = getChatState();

      item.className = state.projectId === projectId && state.chatId === chatId
        ? 'sidebar-link active-chat'
        : 'sidebar-link';

      if (selectionMode && projectId === 'general') {
        item.classList.add('selectable-chat');
        if (selectedChats.has(chatId)) item.classList.add('selected-chat');

        const label = document.createElement('span');
        label.textContent = title;
        item.appendChild(label);

        item.onclick = () => {
          if (selectedChats.has(chatId)) selectedChats.delete(chatId);
          else selectedChats.add(chatId);
          deps.onLoadSidebar();
        };
      } else {
        const itemContent = createActionsMenu({ type: 'chat', id: chatId, title, projectId }, deps);
        item.appendChild(itemContent);
        item.onclick = () => {
          if (_isSending) return;
          const prevState = getChatState();
          setActiveChat({ projectId, chatId, mode: 'project' });
          if (prevState.chatId !== chatId || prevState.projectId !== projectId) {
            deps.onLoadChatHistory();
          }
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
    if (_isSending) return;
    setActiveChat({ projectId, chatId: null, mode: 'landing' });
    deps.onSetPendingAutoRename({ type: 'chat', projectId, chatId: null });
    deps.onRenderWelcomeScreen();
    await deps.onLoadSidebar();
    deps.userInput.focus();
    if (deps.onProjectModelChange) {
      try {
        const res = await getProjectSettings(projectId);
        deps.onProjectModelChange(res?.settings?.preferences?.defaultModel);
      } catch (_) {}
    }
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

  res.chats.filter(chat => chat.chatId !== 'default').forEach(chat => {
    const { chatId, title } = chat;
    const chatItem = document.createElement('div');
    const state = getChatState();

    chatItem.className = state.projectId === projectId && state.chatId === chatId
      ? 'sidebar-link project-chat-link active-chat'
      : 'sidebar-link project-chat-link';

    if (projectSelectionMode === projectId) {
      chatItem.classList.add('selectable-chat');
      if (selectedProjectChats.has(chatId)) chatItem.classList.add('selected-chat');

      const label = document.createElement('span');
      label.textContent = title;
      chatItem.appendChild(label);

      chatItem.onclick = () => {
        if (selectedProjectChats.has(chatId)) selectedProjectChats.delete(chatId);
        else selectedProjectChats.add(chatId);
        deps.onLoadSidebar();
      };
    } else {
      const itemContent = createActionsMenu({ type: 'chat', id: chatId, title, projectId }, deps);
      chatItem.appendChild(itemContent);
      chatItem.onclick = async () => {
        if (_isSending) return;
        const prevState = getChatState();
        setActiveChat({ projectId, chatId, mode: 'project' });
        if (prevState.chatId !== chatId || prevState.projectId !== projectId) {
          deps.onLoadChatHistory();
        }
        deps.onLoadSidebar();
        if (deps.onProjectModelChange) {
          try {
            const res = await getProjectSettings(projectId);
            deps.onProjectModelChange(res?.settings?.preferences?.defaultModel);
          } catch (_) {}
        }
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
      if (_isSending) return;
      const prevState = getChatState();
      if (collapsedProjects.has(projectId)) collapsedProjects.delete(projectId);
      else collapsedProjects.add(projectId);
      setActiveChat({ projectId, chatId: 'default', mode: 'project' });
      await deps.onLoadSidebar();
      if (prevState.chatId !== 'default' || prevState.projectId !== projectId) {
        deps.onLoadChatHistory();
      }
      if (deps.onProjectModelChange) {
        try {
          const res = await getProjectSettings(projectId);
          deps.onProjectModelChange(res?.settings?.preferences?.defaultModel);
        } catch (_) {}
      }
    };

    projectBlock.appendChild(projectTitle);
    projectBlock.appendChild(projectChats);
    container.appendChild(projectBlock);

    if (!collapsedProjects.has(projectId)) {
      await loadProjectChats(projectId, projectChats, deps);
    }
  }
}

export async function loadSidebar(deps) {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) savedScrollTop = sidebar.scrollTop;
  await loadChats('general', deps);
  await loadProjects(deps);
  if (sidebar) sidebar.scrollTop = savedScrollTop;
}