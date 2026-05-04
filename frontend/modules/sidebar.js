import {
  listChats,
  listProjects,
  createChat,
  deleteChat,
  deleteProject,
  renameChat,
  renameProject,
  getChatHistory
} from '../api.js';
import { setActiveChat, getChatState } from '../chatState.js';
import { addMessage } from '../ui.js';

let collapsedProjects = new Set();
let sidebarInitialized = false;
let selectionMode = false;
let selectedChats = new Set();
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

  renameBtn.onclick = async (event) => {
    event.stopPropagation();
    const newName = prompt('Nuevo nombre:', id);
    if (!newName || newName === id) return;
    if (type === 'chat') await renameChat(id, newName, projectId);
    if (type === 'project') await renameProject(id, newName);
    await onLoadSidebar();
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

  res.chats.filter(chatId => chatId !== 'default').forEach(chatId => {
    const chatItem = document.createElement('div');
    const state = getChatState();

    chatItem.className = state.projectId === projectId && state.chatId === chatId
      ? 'sidebar-link project-chat-link active-chat'
      : 'sidebar-link project-chat-link';

    const itemContent = createActionsMenu({ type: 'chat', id: chatId, projectId }, deps);
    chatItem.appendChild(itemContent);

    chatItem.onclick = () => {
      setActiveChat({ projectId, chatId, mode: 'project' });
      deps.onLoadChatHistory();
      deps.onLoadSidebar();
    };

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

export async function loadSidebar(deps) {
  await loadChats('general', deps);
  await loadProjects(deps);
}