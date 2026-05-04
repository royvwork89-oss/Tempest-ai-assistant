import {
  sendChatMessage,
  transcribeAudio,
  getChatHistory,
  listChats,
  createChat,
  deleteChat,
  deleteProject,
  renameChat,
  renameProject,
  generateTitle
} from './api.js';

import { setActiveChat, getChatState } from './chatState.js';
import { addMessage } from './ui.js';
import {
  HARDWARE_PROFILE,
  APP_MODE,
  MODEL_PROFILES,
  resolveAutoModel,
  getLabel,
  renderLocalModels,
  refreshLocalActiveState,
  updateMenuTriggerLabel
} from './modules/models.js';
import {
  loadSidebar,
  loadChats,
  loadProjects,
  setPendingDelete,
  setPendingBulkDelete,
  getPendingDelete,
  getPendingBulkDelete,
  clearSelection
} from './modules/sidebar.js';

const chatBox        = document.getElementById('chatBox');
const userInput      = document.getElementById('userInput');
const sendBtn        = document.getElementById('sendBtn');
const typing         = document.getElementById('typing');
const menuTrigger    = document.getElementById('menuTrigger');
const smartMenuPanel = document.getElementById('smartMenuPanel');
const menuViewRoot   = document.getElementById('menuViewRoot');
const menuViewLocal  = document.getElementById('menuViewLocal');
const menuViewServices  = document.getElementById('menuViewServices');
const menuViewOpenAI    = document.getElementById('menuViewOpenAI');
const menuViewGoogle    = document.getElementById('menuViewGoogle');
const toolMenuBtn    = document.getElementById('toolMenuBtn');
const toolMenuPanel  = document.getElementById('toolMenuPanel');
const transcriptionBtn        = document.getElementById('transcriptionBtn');
const transcriptionModal      = document.getElementById('transcriptionModal');
const transcriptionAudioInput = document.getElementById('transcriptionAudioInput');
const transcriptionMode       = document.getElementById('transcriptionMode');
const transcriptionFormat     = document.getElementById('transcriptionFormat');
const cancelTranscriptionBtn  = document.getElementById('cancelTranscriptionBtn');
const processTranscriptionBtn = document.getElementById('processTranscriptionBtn');
const deleteConfirmModal  = document.getElementById('deleteConfirmModal');
const deleteConfirmText   = document.getElementById('deleteConfirmText');
const cancelDeleteBtn     = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn    = document.getElementById('confirmDeleteBtn');
const newProjectModal     = document.getElementById('newProjectModal');
const newProjectNameInput = document.getElementById('newProjectNameInput');
const cancelNewProjectBtn  = document.getElementById('cancelNewProjectBtn');
const confirmNewProjectBtn = document.getElementById('confirmNewProjectBtn');

let primaryModel = MODEL_PROFILES[HARDWARE_PROFILE][0].model;
let pendingAutoRename = null;

const assistantsState = {
  openai: { enabled: false, model: null },
  google: { enabled: false, model: null }
};

const sidebarDeps = {
  onLoadSidebar: () => loadSidebar(sidebarDeps),
  onLoadChatHistory: loadChatHistory,
  onRenderWelcomeScreen: renderWelcomeScreen,
  onSetPendingAutoRename: (val) => { pendingAutoRename = val; },
  deleteConfirmModal,
  deleteConfirmText,
  userInput
};

function showMenuView(viewName) {
  [menuViewRoot, menuViewLocal, menuViewServices, menuViewOpenAI, menuViewGoogle]
    .forEach(view => view.classList.add('hidden'));
  if (viewName === 'root')     menuViewRoot.classList.remove('hidden');
  if (viewName === 'local')    menuViewLocal.classList.remove('hidden');
  if (viewName === 'services') menuViewServices.classList.remove('hidden');
  if (viewName === 'openai')   menuViewOpenAI.classList.remove('hidden');
  if (viewName === 'google')   menuViewGoogle.classList.remove('hidden');
}

menuTrigger.addEventListener('click', () => {
  smartMenuPanel.classList.toggle('hidden');
  showMenuView('root');
});

document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => showMenuView(btn.dataset.view));
});

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => showMenuView(btn.dataset.back));
});

renderLocalModels(menuViewLocal, (model) => {
  if (model === 'back') { showMenuView('root'); return; }
  primaryModel = model;
  updateMenuTriggerLabel(menuTrigger, primaryModel, assistantsState);
  refreshLocalActiveState(menuViewLocal, primaryModel);
  smartMenuPanel.classList.add('hidden');
});

updateMenuTriggerLabel(menuTrigger, primaryModel, assistantsState);
showMenuView('root');
refreshLocalActiveState(menuViewLocal, primaryModel);

document.querySelectorAll('.service-model').forEach(btn => {
  btn.addEventListener('click', () => {
    const service = btn.dataset.service;
    const model   = btn.dataset.model;
    assistantsState[service].enabled = true;
    assistantsState[service].model   = model;
    updateMenuTriggerLabel(menuTrigger, primaryModel, assistantsState);
    smartMenuPanel.classList.add('hidden');
  });
});

document.addEventListener('click', (e) => {
  if (!smartMenuPanel.contains(e.target) && !menuTrigger.contains(e.target))
    smartMenuPanel.classList.add('hidden');
  if (!toolMenuPanel.contains(e.target) && !toolMenuBtn.contains(e.target))
    toolMenuPanel.classList.add('hidden');
  document.querySelectorAll('.sidebar-context-menu').forEach(m => {
    if (!m.contains(e.target)) m.classList.add('hidden');
  });
});

toolMenuBtn.addEventListener('click', () => toolMenuPanel.classList.toggle('hidden'));
transcriptionBtn.addEventListener('click', () => {
  toolMenuPanel.classList.add('hidden');
  transcriptionModal.classList.remove('hidden');
});
cancelTranscriptionBtn.addEventListener('click', () => transcriptionModal.classList.add('hidden'));

processTranscriptionBtn.addEventListener('click', async () => {
  const file = transcriptionAudioInput.files[0];
  if (!file) { alert('Selecciona un audio'); return; }

  transcriptionModal.classList.add('hidden');
  await ensureGeneralChatExists();

  typing.textContent = 'Transcribiendo audio...';
  sendBtn.disabled = true;
  transcriptionBtn.disabled = true;
  userInput.disabled = true;

  try {
    const data = await transcribeAudio(file, {
      mode:   transcriptionMode.value,
      format: transcriptionFormat.value
    });

    if (!data.ok) throw new Error(data.error || 'Error en transcripción');

    const finalUrl = `http://localhost:3005${data.transcription.fileUrl}`;
    addMessage(chatBox, 'Tempest',
      `Transcripción lista.\n\nAbrir archivo:\n${finalUrl}\n\nUbicación en Windows:\n${data.transcription.filePath}\n\n¿Quieres que analice la transcripción?`
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

cancelDeleteBtn.onclick = () => {
  setPendingDelete(null);
  setPendingBulkDelete(null);
  deleteConfirmModal.classList.add('hidden');
};

confirmDeleteBtn.onclick = async () => {
  const bulk = getPendingBulkDelete();
  if (bulk) {
    for (const chatId of bulk.chatIds) {
      await deleteChat(chatId, bulk.projectId);
    }
    setPendingBulkDelete(null);
    clearSelection();
    deleteConfirmModal.classList.add('hidden');
    renderWelcomeScreen();
    await loadSidebar(sidebarDeps);
    return;
  }

  const pending = getPendingDelete();
  if (!pending) return;

  if (pending.type === 'chat')    await deleteChat(pending.id, pending.projectId);
  if (pending.type === 'project') await deleteProject(pending.id);

  setPendingDelete(null);
  deleteConfirmModal.classList.add('hidden');
  renderWelcomeScreen();
  await loadSidebar(sidebarDeps);
};

document.getElementById('newChatBtn').onclick = async () => {
  setActiveChat({ projectId: 'general', chatId: null, mode: 'landing' });
  pendingAutoRename = null;
  renderWelcomeScreen();
  await loadSidebar(sidebarDeps);
  userInput.focus();
};

document.getElementById('newProjectBtn').onclick = () => {
  newProjectNameInput.value = '';
  newProjectModal.classList.remove('hidden');
  newProjectNameInput.focus();
};

cancelNewProjectBtn.onclick = () => newProjectModal.classList.add('hidden');

confirmNewProjectBtn.onclick = async () => {
  const projectName = newProjectNameInput.value.trim();
  if (!projectName) { alert('Escribe un nombre para el proyecto'); return; }

  const { createProject } = await import('./api.js');
  await createProject(projectName);

  setActiveChat({ projectId: projectName, chatId: null, mode: 'landing' });
  pendingAutoRename = null;
  newProjectModal.classList.add('hidden');
  renderWelcomeScreen();
  await loadSidebar(sidebarDeps);
  userInput.focus();
};

function renderWelcomeScreen() {
  chatBox.innerHTML = `
    <div class="welcome-screen">
      <h2>¿En qué puedo ayudarte?</h2>
      <p>Escribe un mensaje o usa una herramienta para iniciar un nuevo chat.</p>
    </div>
  `;
}

async function loadChatHistory() {
  try {
    const data = await getChatHistory();
    if (!data.ok || !Array.isArray(data.history)) return;
    chatBox.innerHTML = '';
    data.history.forEach(msg => {
      const sender = msg.role === 'user' ? 'Tú' : 'Tempest';
      addMessage(chatBox, sender, msg.content);
    });
  } catch (error) {
    console.error('No se pudo cargar el historial:', error);
  }
}

async function ensureGeneralChatExists() {
  const state = getChatState();
  if (state.chatId && state.mode !== 'landing') return;

  const id = 'chat-' + Date.now();
  if (pendingAutoRename && pendingAutoRename.chatId === null)
    pendingAutoRename.chatId = id;

  const targetProjectId = state.projectId || 'general';
  await createChat(id, targetProjectId);
  setActiveChat({ projectId: targetProjectId, chatId: id, mode: targetProjectId === 'general' ? 'chat' : 'project' });

  pendingAutoRename = { type: 'chat', projectId: targetProjectId, chatId: id };

  await loadSidebar(sidebarDeps);
  chatBox.innerHTML = '';
}

function makeUniqueChatTitle(title, existingChats) {
  let cleanTitle = String(title || 'Nueva conversación')
    .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'Nueva conversación';

  if (!Array.isArray(existingChats) || !existingChats.includes(cleanTitle))
    return cleanTitle;

  let counter = 2;
  let uniqueTitle = `${cleanTitle} ${counter}`;
  while (existingChats.includes(uniqueTitle)) { counter++; uniqueTitle = `${cleanTitle} ${counter}`; }
  return uniqueTitle;
}

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  await ensureGeneralChatExists();

  const selectedModel = primaryModel === 'auto' ? resolveAutoModel(message) : primaryModel;

  if (primaryModel === 'auto' && APP_MODE === 'dev')
    menuTrigger.textContent = `modo: Automático local · usando ${getLabel(selectedModel)}`;

  const config = {
    primaryModel: selectedModel,
    hardwareProfile: HARDWARE_PROFILE,
    assistants: Object.entries(assistantsState).map(([provider, s]) => ({ provider, ...s }))
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
            ? chatsData.chats.filter(c => c !== renameTarget.chatId)
            : [];
          const uniqueTitle = makeUniqueChatTitle(titleData.title, existingChats);
          await renameChat(renameTarget.chatId, uniqueTitle, renameTarget.projectId);
          setActiveChat({ projectId: renameTarget.projectId, chatId: uniqueTitle, mode: renameTarget.projectId === 'general' ? 'chat' : 'project' });
          pendingAutoRename = null;
          await loadSidebar(sidebarDeps);
        }
      }
    } else {
      addMessage(chatBox, 'Tempest', 'Ocurrió un error: ' + (data.error || 'Desconocido'));
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

function autoResizeUserInput() {
  userInput.style.height = 'auto';
  const maxHeight = 400;
  const newHeight = Math.min(userInput.scrollHeight, maxHeight);
  userInput.style.height = `${newHeight}px`;
  userInput.style.overflowY = userInput.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

userInput.addEventListener('input', autoResizeUserInput);
userInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

renderWelcomeScreen();
loadSidebar(sidebarDeps);