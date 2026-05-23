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
  generateTitle,
  generateDocument
} from './api.js';

import { setActiveChat, getChatState } from './chatState.js';
import { addMessage, addDocumentCard, createStreamingBubble, finalizeStreamingBubble, showErrorToast, addErrorMessage } from './ui.js';
import {
  HARDWARE_PROFILE,
  APP_MODE,
  MODEL_PROFILES,
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
  clearSelection,
  openRenameModal
} from './modules/sidebar.js';

import { openProjectConfigModal } from './modules/projectConfig.js';
import { initTranscription } from './modules/transcription.js';
import { initAttachments, getAttachedFiles, clearAttachedFiles } from './modules/attachments.js';

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
const addFileBtn = document.getElementById('addFileBtn');
const fileInput = document.getElementById('fileInput');
const transcriptionBtn = document.getElementById('transcriptionBtn');
const transcriptionModal = document.getElementById('transcriptionModal');
const transcriptionAudioInput = document.getElementById('transcriptionAudioInput');
const transcriptionMode = document.getElementById('transcriptionMode');
const transcriptionFormat = document.getElementById('transcriptionFormat');
const cancelTranscriptionBtn = document.getElementById('cancelTranscriptionBtn');
const processTranscriptionBtn = document.getElementById('processTranscriptionBtn');
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const deleteConfirmText = document.getElementById('deleteConfirmText');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const newProjectModal = document.getElementById('newProjectModal');
const newProjectNameInput = document.getElementById('newProjectNameInput');
const cancelNewProjectBtn = document.getElementById('cancelNewProjectBtn');
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
  onSetPendingBulkDelete: (val) => setPendingBulkDelete(val),
  onProjectModelChange: (model) => {
    if (!model || model === 'auto') return;
    primaryModel = model;
    updateMenuTriggerLabel(menuTrigger, primaryModel, assistantsState);
    refreshLocalActiveState(menuViewLocal, primaryModel);
    // Si el proyecto tiene auto, restablecer primaryModel a auto
    if (model === 'auto') primaryModel = 'auto';
  },
  deleteConfirmModal,
  deleteConfirmText,
  userInput
};

function showMenuView(viewName) {
  [menuViewRoot, menuViewLocal, menuViewServices, menuViewOpenAI, menuViewGoogle]
    .forEach(view => view.classList.add('hidden'));
  if (viewName === 'root') menuViewRoot.classList.remove('hidden');
  if (viewName === 'local') menuViewLocal.classList.remove('hidden');
  if (viewName === 'services') menuViewServices.classList.remove('hidden');
  if (viewName === 'openai') menuViewOpenAI.classList.remove('hidden');
  if (viewName === 'google') menuViewGoogle.classList.remove('hidden');
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
    const model = btn.dataset.model;
    assistantsState[service].enabled = true;
    assistantsState[service].model = model;
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
    initAttachments({
      fileInput,
      addFileBtn,
      attachmentPreview: document.getElementById('attachmentPreview'),
      chatBox,
      toolMenuPanel
    });
    await loadSidebar(sidebarDeps);
    return;
  }

  const pending = getPendingDelete();
  if (!pending) return;

  if (pending.type === 'chat') await deleteChat(pending.id, pending.projectId);
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

newProjectNameInput.addEventListener('input', () => {
  newProjectNameInput.setCustomValidity('');
});

confirmNewProjectBtn.onclick = async () => {
  const projectName = newProjectNameInput.value.trim();

  // Validación inline (mismas reglas que sidebar)
  const invalidChars = /[\\/:*?"<>|]/;
  if (!projectName) {
    newProjectNameInput.setCustomValidity('El nombre no puede estar vacío.');
    newProjectNameInput.reportValidity();
    return;
  }
  if (projectName.length < 2) {
    newProjectNameInput.setCustomValidity('Mínimo 2 caracteres.');
    newProjectNameInput.reportValidity();
    return;
  }
  if (invalidChars.test(projectName)) {
    newProjectNameInput.setCustomValidity('Caracteres no permitidos: \\ / : * ? " < > |');
    newProjectNameInput.reportValidity();
    return;
  }
  if (projectName.length > 60) {
    newProjectNameInput.setCustomValidity('Máximo 60 caracteres.');
    newProjectNameInput.reportValidity();
    return;
  }
  newProjectNameInput.setCustomValidity('');

  const { createProject } = await import('./api.js');
  await createProject(projectName);

  setActiveChat({ projectId: projectName, chatId: null, mode: 'landing' });
  pendingAutoRename = null;
  newProjectModal.classList.add('hidden');
  renderWelcomeScreen();
  await loadSidebar(sidebarDeps);
  openProjectConfigModal(projectName);
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

function detectDocumentRequest(message) {
  const text = String(message || '').toLowerCase();

  const wantsDocument =
    text.includes('documento') ||
    text.includes('archivo') ||
    text.includes('imprime') ||
    text.includes('imprimir') ||
    text.includes('genera un pdf') ||
    text.includes('crea un pdf') ||
    text.includes('genera un word') ||
    text.includes('crea un word') ||
    text.includes('hazme un pdf') ||
    text.includes('hazme un word');

  const wantsFormat =
    text.includes('pdf') ||
    text.includes('docx') ||
    text.includes('word') ||
    text.includes('txt');

  if (!wantsDocument || !wantsFormat) return null;

  let format = 'txt';

  if (text.includes('pdf')) format = 'pdf';
  if (text.includes('docx') || text.includes('word')) format = 'docx';
  if (text.includes('txt')) format = 'txt';

  return {
    format
  };
}

async function sendMessage() {
  const message = userInput.value.trim();
  const files = getAttachedFiles();

  if (!message && files.length === 0) return;

  await ensureGeneralChatExists();

  const config = {
    primaryModel:    primaryModel,
    autoProfile:     'balanceado',
    hardwareProfile: HARDWARE_PROFILE,
    assistants: Object.entries(assistantsState).map(([provider, s]) => ({ provider, ...s }))
  };

  const visibleMessage = files.length > 0
    ? `${message || 'Analiza los archivos adjuntos.'}\n\n📎 Archivos adjuntos: ${files.map(file => file.name).join(', ')}`
    : message;

  addMessage(chatBox, 'Tú', visibleMessage);

  userInput.value = '';
  autoResizeUserInput();

  const documentRequest = detectDocumentRequest(message);

  typing.textContent = documentRequest
    ? `Generando documento ${documentRequest.format.toUpperCase()}...`
    : 'Tempest está pensando...';

  sendBtn.disabled = true;
  userInput.disabled = true;

  try {
    if (documentRequest && files.length === 0) {
      const data = await generateDocument(message, documentRequest.format, config);

      if (data.ok && data.document) {
        addDocumentCard(chatBox, data.document);

        if (pendingAutoRename) {
          const renameTarget = { ...pendingAutoRename };
          const titleText = message.trim()
            || (files.length > 0 ? files.map(f => f.name).join(', ') : '');
          const titleData = await generateTitle(titleText, renameTarget.type);

          if (titleData.ok && titleData.title) {
            const chatsData = await listChats(renameTarget.projectId);
            const existingChats = Array.isArray(chatsData.chats)
              ? chatsData.chats.filter(c => c !== renameTarget.chatId)
              : [];

            const uniqueTitle = makeUniqueChatTitle(titleData.title, existingChats);

            await renameChat(renameTarget.chatId, uniqueTitle, renameTarget.projectId);

            setActiveChat({
              projectId: renameTarget.projectId,
              chatId: uniqueTitle,
              mode: renameTarget.projectId === 'general' ? 'chat' : 'project'
            });

            pendingAutoRename = null;
            await loadSidebar(sidebarDeps);
          }
        }

        return;
      }

      addErrorMessage(chatBox, 'No pude generar el documento: ' + (data.error || 'Error desconocido'));
      return;
    }

const { bubble, rawEl } = createStreamingBubble(chatBox);
    let fullText = '';

    try {
      const data = await sendChatMessage(
        message || 'Analiza los archivos adjuntos.',
        config,
        files,
        (token) => {
          fullText += token;
          rawEl.textContent = fullText;
          chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        },
        (model) => {
          if (model && primaryModel === 'auto') {
            updateMenuTriggerLabel(menuTrigger, 'auto', assistantsState, model);
          }
        }
      );

      finalizeStreamingBubble(bubble, rawEl, fullText);

      // Actualizar label con el modelo real usado por el router (solo visual, no cambia primaryModel)
      if (data.usedModel && primaryModel === 'auto') {
        updateMenuTriggerLabel(menuTrigger, 'auto', assistantsState, data.usedModel);
      }

      if (files.length > 0) {
        clearAttachedFiles();
        document.getElementById('attachmentPreview').innerHTML = '';
        document.getElementById('attachmentPreview').classList.add('hidden');
      }

      if (data.ok) {
        if (pendingAutoRename) {
          const renameTarget = { ...pendingAutoRename };
          const titleText = message.trim()
            || (files.length > 0 ? files.map(f => f.name).join(', ') : '');
          const titleData = await generateTitle(titleText, renameTarget.type);

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
        bubble.remove();
        addErrorMessage(chatBox, 'Ocurrió un error al generar la respuesta. Intenta de nuevo.');
      }
    } catch (streamError) {
      bubble.remove();
      console.error(streamError);
      const errMsg = streamError?.message || '';
      if (errMsg.includes('Patch Mode') || errMsg.includes('patch_no_context')) {
        addErrorMessage(chatBox, '⚠️ ' + errMsg);
      } else {
        showErrorToast('Sin conexión con el backend. ¿Está el servidor corriendo?');
        addErrorMessage(chatBox, 'No pude conectar con el backend. Verifica que el servidor esté activo.');
      }
    }
  } catch (error) {
    console.error(error);
    showErrorToast('Error inesperado. Revisa la consola.');
    addErrorMessage(chatBox, 'Ocurrió un error inesperado.');
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

initAttachments({
  fileInput,
  addFileBtn,
  attachmentPreview: document.getElementById('attachmentPreview'),
  chatBox,
  toolMenuPanel
});

initTranscription({
  transcriptionBtn,
  transcriptionModal,
  transcriptionAudioInput,
  transcriptionMode,
  transcriptionFormat,
  cancelTranscriptionBtn,
  processTranscriptionBtn,
  toolMenuPanel,
  chatBox,
  typing,
  sendBtn,
  userInput,
  loadSidebar,
  getSidebarDeps: () => sidebarDeps,
  ensureGeneralChatExists,
  makeUniqueChatTitle,
  getPendingAutoRename: () => pendingAutoRename,
  setPendingAutoRename: (val) => { pendingAutoRename = val; }
});

loadSidebar(sidebarDeps);