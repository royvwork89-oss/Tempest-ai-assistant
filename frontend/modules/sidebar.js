import {
  listChats,
  listProjects,
  createChat,
  renameChat,
  renameProject,
  getChatHistory,
  getProjectSettings,
  exportChat,
  importChat,
  exportProject,
  importProject
} from '../api.js';
import { setActiveChat, getChatState } from '../chatState.js';
import { addMessage, showErrorToast } from '../ui.js';
import { openContextFilesModal } from './contextFiles.js';
import { openProjectConfigModal } from './projectConfig.js';
import { openRenameModal } from './modals.js';

// ─── Íconos ─────────────────────────────────────────────────────────────────
// SVG inline en vez de emojis (📂/📦/📥): los emojis los dibuja la fuente del
// sistema, así que cambian de forma, color y tamaño según Windows/Linux y no
// heredan el color del texto — en el menú oscuro quedaban desalineados y con
// su propio color. Estos son 24x24 con `fill="currentColor"`, mismo criterio
// que el engranaje de Configuración en index.html: heredan el color del botón
// y su estado :hover sin CSS extra.
const ICONS = {
  // Carpeta abierta
  folderOpen: '<path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>',
  // Flecha hacia abajo sobre una bandeja — sacar algo de la app a disco
  export: '<path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>',
  // Flecha hacia arriba sobre una bandeja — traer algo de disco a la app
  import: '<path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>',
  // Lápiz — renombrar
  rename: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>',
  // Tacho — eliminar
  delete: '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
  // Hoja con esquina doblada — archivos de contexto
  file: '<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>',
  // Deslizadores — configuración del proyecto. A propósito NO es el engranaje
  // de index.html: ese es la configuración global de la app, este es la de un
  // proyecto puntual, y conviene que se distingan de un vistazo.
  tune: '<path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>',
  // Recuadro con tilde — modo selección múltiple
  checkbox: '<path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>',
  // Recuadro vacío — cancelar el modo selección
  checkboxOff: '<path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>'
};

function iconSvg(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name]}</svg>`;
}

// Botón de menú contextual con ícono + texto. La clase `has-icon` es la que
// usa el CSS para NO indentar este botón (los que no tienen ícono llevan un
// padding extra para que todas las etiquetas queden alineadas).
// innerHTML es seguro acá: tanto el SVG como la etiqueta son literales del
// código, nunca texto que venga del usuario.
function menuButton(iconName, label) {
  const btn = document.createElement('button');
  btn.className = 'has-icon';
  btn.innerHTML = `${iconSvg(iconName)}<span>${label}</span>`;
  return btn;
}

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

// ─── Importar chat ──────────────────────────────────────────────────────────
// Un único <input type="file"> reutilizado para todos los puntos de entrada
// (el botón global de la sidebar y el de cada proyecto). Se crea una sola vez
// y se reusa: crear uno nuevo por click filtraría un elemento cada vez que el
// usuario abre el diálogo y cancela (cancelar NO dispara 'change', así que no
// habría dónde limpiarlo). El destino se decide en el momento del click —
// mismo flujo, sólo cambia el projectId.
let _importInput = null;

export function promptImportChat(projectId, deps) {
  if (!_importInput) {
    _importInput = document.createElement('input');
    _importInput.type = 'file';
    _importInput.accept = '.md,.markdown,text/markdown';
    _importInput.style.display = 'none';
    document.body.appendChild(_importInput);
  }

  _importInput.onchange = async () => {
    const file = _importInput.files?.[0];
    // value = '' siempre antes de salir: si no, elegir el MISMO archivo dos
    // veces seguidas no dispara 'change' (el valor no cambió) y el segundo
    // intento parecería no hacer nada.
    if (!file) { _importInput.value = ''; return; }

    try {
      const markdown = await file.text();
      const result = await importChat(markdown, projectId);

      if (!result.ok) {
        showErrorToast(result.error || 'No se pudo importar el chat.');
        return;
      }

      // El proyecto destino se despliega sí o sí: si estaba colapsado, el
      // chat importado no se vería y parecería que no pasó nada.
      if (projectId !== 'general') collapsedProjects.delete(projectId);

      await deps.onLoadSidebar();
      setActiveChat({ projectId, chatId: result.chatId, mode: 'project' });
      await deps.onLoadChatHistory();
      await deps.onLoadSidebar();

      if (!result.exact) {
        // El .md no traía el bloque de datos (export anterior a v3.0.0 o
        // archivo editado a mano): el texto se recuperó, pero los timestamps
        // son los de la importación.
        showErrorToast('Chat importado, pero sin metadatos originales: las fechas de los mensajes son las de la importación.');
      }
    } catch (err) {
      console.error('[sidebar] error importando chat:', err);
      showErrorToast('No se pudo leer el archivo.');
    } finally {
      _importInput.value = '';
    }
  };

  _importInput.click();
}

// Importar un proyecto entero desde un .tempestproj. Mismo esquema de input
// reutilizado que promptImportChat(), y mismo criterio: el backend nunca pisa
// un proyecto existente, ante colisión de nombre crea uno con sufijo.
let _importProjectInput = null;

export function promptImportProject(deps) {
  if (!_importProjectInput) {
    _importProjectInput = document.createElement('input');
    _importProjectInput.type = 'file';
    _importProjectInput.accept = '.tempestproj,application/json';
    _importProjectInput.style.display = 'none';
    document.body.appendChild(_importProjectInput);
  }

  _importProjectInput.onchange = async () => {
    const file = _importProjectInput.files?.[0];
    if (!file) { _importProjectInput.value = ''; return; }

    try {
      const data = await file.text();
      const result = await importProject(data);

      if (!result.ok) {
        showErrorToast(result.error || 'No se pudo importar el proyecto.');
        return;
      }

      // El proyecto importado arranca desplegado — si no, aparece como una
      // línea colapsada más y no se ve que efectivamente trajo sus chats.
      collapsedProjects.delete(result.projectId);
      await deps.onLoadSidebar();

      if (result.renamed) {
        showErrorToast(`Ya existía un proyecto con ese nombre. Se importó como "${result.projectId}".`);
      }
    } catch (err) {
      console.error('[sidebar] error importando proyecto:', err);
      showErrorToast('No se pudo leer el archivo.');
    } finally {
      _importProjectInput.value = '';
    }
  };

  _importProjectInput.click();
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

  const renameBtn = menuButton('rename', 'Renombrar');
  const deleteBtn = menuButton('delete', 'Eliminar');
  deleteBtn.classList.add('menu-danger');

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
    const contextBtn = menuButton('file', 'Archivos de contexto');
    contextBtn.onclick = (event) => {
      event.stopPropagation();
      menu.classList.add('hidden');
      openContextFilesModal(id);
    };
    menu.appendChild(contextBtn);

    const configBtn = menuButton('tune', 'Configuración');
    configBtn.onclick = (event) => {
      event.stopPropagation();
      menu.classList.add('hidden');
      openProjectConfigModal(id);
    };
    menu.appendChild(configBtn);

    const selectChatsBtn = projectSelectionMode === id
      ? menuButton('checkboxOff', 'Cancelar selección')
      : menuButton('checkbox', 'Seleccionar chats');
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
      // Bug preexistente (encontrado de paso, ver DECISIONS.md): usaba
      // `deps.onLoadSidebar()`, pero `deps` no existe en este scope — el
      // segundo parámetro de la función ya viene desestructurado como
      // `onLoadSidebar` directo. Tal cual estaba, un click acá tiraba
      // ReferenceError.
      await onLoadSidebar();
    };
    menu.appendChild(selectChatsBtn);

    // Mismo par que en el menú de un chat, pero a nivel proyecto: la carpeta
    // es project-exports/<projectId>/ y el respaldo es un .tempestproj con el
    // árbol completo (chats + contexto + settings + embeddings) más una copia
    // legible en .md de cada chat.
    const openProjectFolderBtn = menuButton('folderOpen', 'Abrir carpeta');
    if (window.electronAPI?.openProjectFolder) {
      openProjectFolderBtn.onclick = async (event) => {
        event.stopPropagation();
        menu.classList.add('hidden');
        const result = await window.electronAPI.openProjectFolder(id);
        if (!result.ok) {
          console.error('[sidebar] error abriendo carpeta del proyecto:', result.error);
          showErrorToast('No se pudo abrir la carpeta del proyecto.');
        }
      };
    } else {
      openProjectFolderBtn.disabled = true;
      openProjectFolderBtn.title = 'Solo disponible en la app de escritorio';
    }
    menu.appendChild(openProjectFolderBtn);

    const exportProjectBtn = menuButton('export', 'Exportar proyecto');
    exportProjectBtn.onclick = async (event) => {
      event.stopPropagation();
      menu.classList.add('hidden');
      // Un proyecto grande (embeddings incluidos) tarda unos segundos: se
      // deshabilita el botón mientras tanto para que no se dispare dos veces.
      exportProjectBtn.disabled = true;
      try {
        const result = await exportProject(id);
        if (!result.ok) {
          showErrorToast(result.error || 'No se pudo exportar el proyecto.');
          return;
        }
        if (window.electronAPI?.openProjectFolder) {
          await window.electronAPI.openProjectFolder(id);
        }
      } catch (err) {
        console.error('[sidebar] error exportando proyecto:', err);
        showErrorToast('No se pudo exportar el proyecto.');
      } finally {
        exportProjectBtn.disabled = false;
      }
    };
    menu.appendChild(exportProjectBtn);
  }

  if (type === 'chat') {
    // "Abrir carpeta" — abre OUTPUTS_DIR/chat-exports/<chatId>/ (misma
    // carpeta donde cae "Exportar chat"). Se crea vacía si todavía no se
    // exportó nada, así nunca falla. Fuera de Electron (navegador) no hay
    // explorador nativo que abrir — el botón queda deshabilitado.
    const openFolderBtn = menuButton('folderOpen', 'Abrir carpeta');
    if (window.electronAPI?.openChatFolder) {
      openFolderBtn.onclick = async (event) => {
        event.stopPropagation();
        menu.classList.add('hidden');
        const result = await window.electronAPI.openChatFolder(id);
        if (!result.ok) {
          console.error('[sidebar] error abriendo carpeta del chat:', result.error);
          showErrorToast('No se pudo abrir la carpeta del chat.');
        }
      };
    } else {
      openFolderBtn.disabled = true;
      openFolderBtn.title = 'Solo disponible en la app de escritorio';
    }
    menu.appendChild(openFolderBtn);

    // "Exportar chat" — genera un .md legible con toda la conversación (ver
    // exportChat() en chat.controller.js) y abre la carpeta apenas termina,
    // para que el usuario vea el archivo de inmediato. Pensado como respaldo
    // manual de conversaciones puntuales — el usuario puede copiar ese .md
    // a otro lado (USB, nube) antes de formatear o reinstalar, sin depender
    // de que sobreviva el resto de los datos de la app.
    const exportBtn = menuButton('export', 'Exportar chat');
    exportBtn.onclick = async (event) => {
      event.stopPropagation();
      menu.classList.add('hidden');
      try {
        const result = await exportChat(id, projectId);
        if (!result.ok) {
          showErrorToast(result.error || 'No se pudo exportar el chat.');
          return;
        }
        if (window.electronAPI?.openChatFolder) {
          await window.electronAPI.openChatFolder(id);
        }
      } catch (err) {
        console.error('[sidebar] error exportando chat:', err);
        showErrorToast('No se pudo exportar el chat.');
      }
    };
    menu.appendChild(exportBtn);
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

  // Importar dentro del proyecto: el chat restaurado queda como un chat más
  // de ESTE proyecto, no del espacio general. Va justo debajo de "+ Nuevo
  // chat" — mismo criterio que el botón global de la sidebar: es una acción,
  // no un chat, así que arriba de la lista y no al final (donde se correría
  // de lugar cada vez que el proyecto suma chats).
  const importChatItem = document.createElement('div');
  importChatItem.className = 'sidebar-link project-chat-link new-project-chat with-icon';
  importChatItem.innerHTML = `${iconSvg('import')}<span>Importar chat</span>`;
  importChatItem.onclick = (event) => {
    event.stopPropagation();
    if (_isSending) return;
    promptImportChat(projectId, deps);
  };
  container.appendChild(importChatItem);

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