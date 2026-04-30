import {
  sendChatMessage,
  transcribeAudio,
  getChatHistory,
  listChats,
  createChat,
  listProjects,
  createProject,
  deleteChat,
  deleteProject,
  renameChat,
  renameProject,
  generateTitle
} from './api.js';

import { setActiveChat, getChatState } from './chatState.js';
import { addMessage } from './ui.js';

const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const typing = document.getElementById('typing');

const menuTrigger = document.getElementById('menuTrigger');
const smartMenuPanel = document.getElementById('smartMenuPanel');

const menuViewRoot = document.getElementById('menuViewRoot');
const menuViewLocal = document.getElementById('menuViewLocal');
const menuViewServices = document.getElementById('menuViewServices');
const menuViewOpenAI = document.getElementById('menuViewOpenAI');
const menuViewGoogle = document.getElementById('menuViewGoogle');

const toolMenuBtn = document.getElementById('toolMenuBtn');
const toolMenuPanel = document.getElementById('toolMenuPanel');

const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const deleteConfirmText = document.getElementById('deleteConfirmText');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const newProjectModal = document.getElementById('newProjectModal');
const newProjectNameInput = document.getElementById('newProjectNameInput');
const cancelNewProjectBtn = document.getElementById('cancelNewProjectBtn');
const confirmNewProjectBtn = document.getElementById('confirmNewProjectBtn');


let pendingDelete = null;
let pendingBulkDelete = null;


let primaryModel = 'hermes-q4';
const collapsedProjects = new Set();
let sidebarInitialized = false;
let pendingAutoRename = null;

let selectionMode = false;
let selectedChats = new Set();

const assistantsState = {
  openai: {
    enabled: false,
    model: null
  },
  google: {
    enabled: false,
    model: null
  }
};

function showMenuView(viewName) {
  [
    menuViewRoot,
    menuViewLocal,
    menuViewServices,
    menuViewOpenAI,
    menuViewGoogle
  ].forEach(view => view.classList.add('hidden'));

  if (viewName === 'root') menuViewRoot.classList.remove('hidden');
  if (viewName === 'local') menuViewLocal.classList.remove('hidden');
  if (viewName === 'services') menuViewServices.classList.remove('hidden');
  if (viewName === 'openai') menuViewOpenAI.classList.remove('hidden');
  if (viewName === 'google') menuViewGoogle.classList.remove('hidden');
}

function getLabel(model) {
  const labels = {
    'hermes-q4': 'Hermes Q4',
    'hermes-q5': 'Hermes Q5',
    'hermes-q6': 'Hermes Q6',
    'qwen_qwen3.5-0.8b': 'Qwen 0.8B',
    'mistral-7b': 'Mistral 7B',
    'auto': 'Automático',
    'gpt-4o-mini': 'GPT-4o-mini',
    'gpt-4.1-mini': 'GPT-4.1-mini',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-pro': 'Gemini 2.5 Pro'
  };

  return labels[model] || model;
}

function updateMenuTriggerLabel() {
  let label = `modelo: ${getLabel(primaryModel)}`;

  const activeServices = [];

  if (assistantsState.openai.enabled) {
    activeServices.push('OpenAI');
  }

  if (assistantsState.google.enabled) {
    activeServices.push('Google');
  }

  if (activeServices.length > 0) {
    label += ' + ' + activeServices.join(' + ');
  }

  menuTrigger.textContent = label;
}

function refreshLocalActiveState() {
  document.querySelectorAll('.local-model').forEach(btn => {
    btn.classList.remove('active');

    if (btn.dataset.model === primaryModel) {
      btn.classList.add('active');
    }
  });
}

function refreshServiceActiveState() {
  document.querySelectorAll('.service-entry').forEach(btn => {
    const service = btn.dataset.service;
    btn.classList.remove('selected-support');

    if (assistantsState[service].enabled) {
      btn.classList.add('selected-support');
    }
  });

  document.querySelectorAll('.service-model').forEach(btn => {
    const service = btn.dataset.service;
    const model = btn.dataset.model;

    btn.classList.remove('active');

    if (
      assistantsState[service].enabled &&
      assistantsState[service].model === model
    ) {
      btn.classList.add('active');
    }
  });
}

menuTrigger.addEventListener('click', () => {
  smartMenuPanel.classList.toggle('hidden');
  showMenuView('root');
});

document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    showMenuView(btn.dataset.view);
  });
});

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => {
    showMenuView(btn.dataset.back);
  });
});

document.querySelectorAll('.local-model').forEach(btn => {
  btn.addEventListener('click', () => {
    primaryModel = btn.dataset.model;
    updateMenuTriggerLabel();
    refreshLocalActiveState();
    smartMenuPanel.classList.add('hidden');
  });
});

document.querySelectorAll('.service-entry').forEach(btn => {
  btn.addEventListener('click', () => {
    const service = btn.dataset.service;

    if (service === 'openai') showMenuView('openai');
    if (service === 'google') showMenuView('google');
  });
});

document.querySelectorAll('.service-model').forEach(btn => {
  btn.addEventListener('click', () => {
    const service = btn.dataset.service;
    const model = btn.dataset.model;

    if (
      assistantsState[service].enabled &&
      assistantsState[service].model === model
    ) {
      assistantsState[service].enabled = false;
      assistantsState[service].model = null;
    } else {
      assistantsState[service].enabled = true;
      assistantsState[service].model = model;
    }

    refreshServiceActiveState();
    updateMenuTriggerLabel();
    smartMenuPanel.classList.add('hidden');
  });
});

const transcriptionBtn = document.getElementById('transcriptionBtn');
const transcriptionModal = document.getElementById('transcriptionModal');
const transcriptionAudioInput = document.getElementById('transcriptionAudioInput');
const transcriptionMode = document.getElementById('transcriptionMode');
const transcriptionFormat = document.getElementById('transcriptionFormat');
const cancelTranscriptionBtn = document.getElementById('cancelTranscriptionBtn');
const processTranscriptionBtn = document.getElementById('processTranscriptionBtn');

function getAssistants() {
  return [
    {
      provider: 'openai',
      enabled: assistantsState.openai.enabled,
      model: assistantsState.openai.model
    },
    {
      provider: 'google',
      enabled: assistantsState.google.enabled,
      model: assistantsState.google.model
    }
  ];
}

async function loadChatHistory() {
  try {
    const data = await getChatHistory();

    if (!data.ok || !Array.isArray(data.history)) {
      return;
    }

    chatBox.innerHTML = '';

    data.history.forEach(msg => {
      const sender = msg.role === 'user' ? 'Tú' : 'Tempest';
      addMessage(chatBox, sender, msg.content);
    });
  } catch (error) {
    console.error('No se pudo cargar el historial:', error);
  }
}

toolMenuBtn.addEventListener('click', () => {
  toolMenuPanel.classList.toggle('hidden');
});

transcriptionBtn.addEventListener('click', () => {
  toolMenuPanel.classList.add('hidden');
  transcriptionModal.classList.remove('hidden');
});

cancelTranscriptionBtn.addEventListener('click', () => {
  transcriptionModal.classList.add('hidden');
});

processTranscriptionBtn.addEventListener('click', async () => {
  const file = transcriptionAudioInput.files[0];

  if (!file) {
    alert('Selecciona un audio');
    return;
  }

  transcriptionModal.classList.add('hidden');
  await ensureGeneralChatExists();

  typing.textContent = 'Transcribiendo audio...';
  sendBtn.disabled = true;
  transcriptionBtn.disabled = true;
  userInput.disabled = true;

  try {
    const data = await transcribeAudio(file, {
      mode: transcriptionMode.value,
      format: transcriptionFormat.value
    });

    if (!data.ok) {
      addMessage(chatBox, 'Tempest', 'Error al transcribir audio');
      return;
    }

    const fileUrl = data.transcription.fileUrl;

    const finalUrl = `${window.location.origin}${fileUrl}`;

    addMessage(
      chatBox,
      'Tempest',
      `Transcripción lista.

Abrir archivo:
${finalUrl}

Ubicación en Windows:
${data.transcription.filePath}

¿Quieres que analice la transcripción?`
    );

  } catch (error) {
    console.error(error);
    addMessage(chatBox, 'Tempest', 'Error procesando audio');
  } finally {
    typing.textContent = '';
    sendBtn.disabled = false;
    transcriptionBtn.disabled = false;
    userInput.disabled = false;
    transcriptionAudioInput.value = '';
    userInput.focus();
  }
});

userInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

function autoResizeUserInput() {
  userInput.style.height = 'auto';

  const maxHeight = 400;
  const newHeight = Math.min(userInput.scrollHeight, maxHeight);

  userInput.style.height = `${newHeight}px`;
  userInput.style.overflowY =
    userInput.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

userInput.addEventListener('input', autoResizeUserInput);

updateMenuTriggerLabel();
showMenuView('root');
refreshLocalActiveState();
refreshServiceActiveState();

renderWelcomeScreen();

function renderWelcomeScreen() {
  chatBox.innerHTML = `
    <div class="welcome-screen">
      <h2>¿En qué puedo ayudarte?</h2>
      <p>Escribe un mensaje o usa una herramienta para iniciar un nuevo chat.</p>
    </div>
  `;
}

async function ensureGeneralChatExists() {
  const state = getChatState();

  if (state.chatId && state.mode !== 'landing') {
    return;
  }

  const id = 'chat-' + Date.now();

  if (pendingAutoRename && pendingAutoRename.chatId === null) {
    pendingAutoRename.chatId = id;
  }

  const targetProjectId = state.projectId || 'general';
  await createChat(id, targetProjectId);

  setActiveChat({
    projectId: targetProjectId,
    chatId: id,
    mode: targetProjectId === 'general' ? 'chat' : 'project'
  });

  pendingAutoRename = {
    type: 'chat',
    projectId: targetProjectId,
    chatId: id
  };

  await loadSidebar();
  chatBox.innerHTML = '';
}

function makeUniqueChatTitle(title, existingChats) {
  let cleanTitle = String(title || 'Nueva conversación')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanTitle) {
    cleanTitle = 'Nueva conversación';
  }

  if (!Array.isArray(existingChats) || !existingChats.includes(cleanTitle)) {
    return cleanTitle;
  }

  let counter = 2;
  let uniqueTitle = `${cleanTitle} ${counter}`;

  while (existingChats.includes(uniqueTitle)) {
    counter++;
    uniqueTitle = `${cleanTitle} ${counter}`;
  }

  return uniqueTitle;
}

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  await ensureGeneralChatExists();

  const config = {
    primaryModel,
    assistants: getAssistants()
  };

  addMessage(chatBox, 'Tú', message);
  userInput.value = '';
  autoResizeUserInput();
  typing.textContent = 'Tempest está pensando...';
  sendBtn.disabled = true;
  userInput.disabled = true;

  try {
    const data = await sendChatMessage(message, config);

    if (data.ok) {
      addMessage(chatBox, 'Tempest', data.reply);

      if (pendingAutoRename) {
        const renameTarget = { ...pendingAutoRename };
        const titleData = await generateTitle(message, renameTarget.type);

        if (titleData.ok && titleData.title) {
          const chatsData = await listChats(renameTarget.projectId);
          const existingChats = Array.isArray(chatsData.chats)
            ? chatsData.chats.filter(chatId => chatId !== renameTarget.chatId)
            : [];

          const uniqueTitle = makeUniqueChatTitle(titleData.title, existingChats);

          await renameChat(
            renameTarget.chatId,
            uniqueTitle,
            renameTarget.projectId
          );

          setActiveChat({
            projectId: renameTarget.projectId,
            chatId: uniqueTitle,
            mode: renameTarget.projectId === 'general' ? 'chat' : 'project'
          });

          pendingAutoRename = null;
          await loadSidebar();
        }
      }
    } else {
      addMessage(
        chatBox,
        'Tempest',
        'Ocurrió un error: ' + (data.error || 'Desconocido')
      );
    }
  } catch (error) {
    addMessage(chatBox, 'Tempest', 'No pude conectar con el backend.');
    console.error(error);
  } finally {
    typing.textContent = '';
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
  }
}

sendBtn.addEventListener('click', sendMessage);

function createActionsMenu({ type, id, projectId }) {
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

    if (type === 'chat') {
      await renameChat(id, newName, projectId);
    }

    if (type === 'project') {
      await renameProject(id, newName);
    }

    await loadSidebar();
  };

  deleteBtn.onclick = async (event) => {
    event.stopPropagation();

    pendingDelete = { type, id, projectId };

    deleteConfirmText.textContent =
      `¿Estás seguro de que deseas eliminar "${id}"?`;

    deleteConfirmModal.classList.remove('hidden');
  };

  dots.onclick = (event) => {
    event.stopPropagation();

    document
      .querySelectorAll('.sidebar-context-menu')
      .forEach(item => item.classList.add('hidden'));

    menu.classList.toggle('hidden');
  };

  menu.appendChild(renameBtn);
  menu.appendChild(deleteBtn);

  wrapper.appendChild(label);
  wrapper.appendChild(dots);
  wrapper.appendChild(menu);

  return wrapper;
}



  cancelDeleteBtn.onclick = () => {
    pendingDelete = null;
    pendingBulkDelete = null;
    deleteConfirmModal.classList.add('hidden');
  };

confirmDeleteBtn.onclick = async () => {
  if (pendingBulkDelete) {
    for (const chatId of pendingBulkDelete.chatIds) {
      await deleteChat(chatId, pendingBulkDelete.projectId);
    }

    pendingBulkDelete = null;
    selectedChats.clear();
    selectionMode = false;
    deleteConfirmModal.classList.add('hidden');

    renderWelcomeScreen();
    await loadSidebar();
    return;
  }

  if (!pendingDelete) return;

  const { type, id, projectId } = pendingDelete;

  if (type === 'chat') {
    await deleteChat(id, projectId);
  }

  if (type === 'project') {
    await deleteProject(id);
  }

  pendingDelete = null;
  deleteConfirmModal.classList.add('hidden');

  renderWelcomeScreen();
  await loadSidebar();
};

function renderSelectionControls(container) {
  const controls = document.createElement('div');
  controls.className = 'selection-controls';

  const selectBtn = document.createElement('button');
  selectBtn.textContent = selectionMode ? 'Cancelar selección' : 'Seleccionar chats';

  selectBtn.onclick = async () => {
    selectionMode = !selectionMode;
    selectedChats.clear();
    await loadSidebar();
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

      deleteConfirmText.textContent =
        `¿Estás seguro de que deseas eliminar los chats seleccionados?`;

      deleteConfirmModal.classList.remove('hidden');
    };

    controls.appendChild(deleteBtn);
  }

  container.appendChild(controls);
}

async function loadChats(projectId = 'general') {
  try {
    const res = await listChats(projectId);
    const container = document.getElementById('chatList');

    container.innerHTML = '';
    renderSelectionControls(container);

    if (!res.ok || !Array.isArray(res.chats)) {
      container.textContent = 'No se pudieron cargar los chats';
      return;
    }

    res.chats
      .filter(chatId => chatId !== 'default')
      .forEach(chatId => {
        const item = document.createElement('div');
        const state = getChatState();

        item.className =
          state.projectId === projectId && state.chatId === chatId
            ? 'sidebar-link active-chat'
            : 'sidebar-link';

        if (selectionMode && projectId === 'general') {
          item.classList.add('selectable-chat');

          if (selectedChats.has(chatId)) {
            item.classList.add('selected-chat');
          }

          const label = document.createElement('span');
          label.textContent = chatId;

          item.appendChild(label);

          item.onclick = () => {
            if (selectedChats.has(chatId)) {
              selectedChats.delete(chatId);
            } else {
              selectedChats.add(chatId);
            }

            loadSidebar();
          };
        } else {
          const itemContent = createActionsMenu({
            type: 'chat',
            id: chatId,
            projectId
          });

          item.appendChild(itemContent);
          item.onclick = () => {
            setActiveChat({
              projectId,
              chatId,
              mode: 'project'
            });

            loadChatHistory();
            loadSidebar();
          };
        }

        container.appendChild(item);
      });

  } catch (error) {
    console.error('Error cargando chats:', error);
  }
}

async function loadProjects() {
  const res = await listProjects();
  const container = document.getElementById('projectList');

  container.innerHTML = '';

  if (!res.ok || !Array.isArray(res.projects)) {
    container.textContent = 'No se pudieron cargar los proyectos';
    return;
  }

  const visibleProjects = res.projects.filter(projectId => projectId !== 'general');

  if (!sidebarInitialized) {
    visibleProjects.forEach(projectId => collapsedProjects.add(projectId));
    sidebarInitialized = true;
  }

  for (const projectId of visibleProjects) {
    const projectBlock = document.createElement('div');
    projectBlock.className = 'project-block';

    const state = getChatState();
    const isCollapsed = collapsedProjects.has(projectId);
    const isActiveProject = state.projectId === projectId;

    const projectTitle = document.createElement('div');
    projectTitle.className =
      isCollapsed && isActiveProject
        ? 'project-title active-chat'
        : 'project-title';

    const arrow = document.createElement('span');
    arrow.className = 'project-arrow';
    arrow.textContent = isCollapsed ? '▸' : '▾';

    const projectActions = createActionsMenu({
      type: 'project',
      id: projectId,
      projectId
    });

    projectActions.classList.add('project-actions');

projectTitle.appendChild(arrow);
projectTitle.appendChild(projectActions);

    const projectChats = document.createElement('div');
    projectChats.className = 'project-chats';

    projectTitle.onclick = async () => {
      if (collapsedProjects.has(projectId)) {
        collapsedProjects.delete(projectId);
      } else {
        collapsedProjects.add(projectId);
      }

      setActiveChat({
        projectId,
        chatId: 'default',
        mode: 'project'
      });

      await loadSidebar();
      loadChatHistory();
    };

    projectBlock.appendChild(projectTitle);
    projectBlock.appendChild(projectChats);
    container.appendChild(projectBlock);

    if (!collapsedProjects.has(projectId)) {
      await loadProjectChats(projectId, projectChats);
    }
  }
}

document.getElementById('newChatBtn').onclick = async () => {
  setActiveChat({
    projectId: 'general',
    chatId: null,
    mode: 'landing'
  });

  pendingAutoRename = null;

  renderWelcomeScreen();
  await loadSidebar();
  userInput.focus();
};

document.getElementById('newProjectBtn').onclick = () => {
  newProjectNameInput.value = '';
  newProjectModal.classList.remove('hidden');
  newProjectNameInput.focus();
};

cancelNewProjectBtn.onclick = () => {
  newProjectModal.classList.add('hidden');
};

confirmNewProjectBtn.onclick = async () => {
  const projectName = newProjectNameInput.value.trim();

  if (!projectName) {
    alert('Escribe un nombre para el proyecto');
    return;
  }

  await createProject(projectName);

  setActiveChat({
    projectId: projectName,
    chatId: null,
    mode: 'landing'
  });

  pendingAutoRename = null;

  newProjectModal.classList.add('hidden');
  renderWelcomeScreen();
  await loadSidebar();
  userInput.focus();
};

async function loadSidebar() {
  await loadChats();
  await loadProjects();
}

loadSidebar();

async function loadProjectChats(projectId, container) {
  const res = await listChats(projectId);

  container.innerHTML = '';

  const newChatItem = document.createElement('div');
  newChatItem.className = 'sidebar-link project-chat-link new-project-chat';
  newChatItem.textContent = '+ Nuevo chat';

  newChatItem.onclick = async () => {
    setActiveChat({
      projectId,
      chatId: null,
      mode: 'landing'
    });

    pendingAutoRename = {
      type: 'chat',
      projectId,
      chatId: null
    };

    renderWelcomeScreen();
    await loadSidebar();
    userInput.focus();
  };

  container.appendChild(newChatItem);

  if (!res.ok || !Array.isArray(res.chats)) {
    return;
  }

  res.chats
    .filter(chatId => chatId !== 'default')
    .forEach(chatId => {
      const chatItem = document.createElement('div');
      const state = getChatState();

      chatItem.className =
        state.projectId === projectId && state.chatId === chatId
          ? 'sidebar-link project-chat-link active-chat'
          : 'sidebar-link project-chat-link';

      const itemContent = createActionsMenu({
        type: 'chat',
        id: chatId,
        projectId
      });

      chatItem.appendChild(itemContent);


      chatItem.onclick = () => {
        setActiveChat({
          projectId,
          chatId,
          mode: 'project'
        });

        loadChatHistory();
        loadSidebar();
      };

      container.appendChild(chatItem);
    });
}