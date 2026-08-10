// Primer import a propósito — se auto-inicializa al cargarse (ver el
// archivo) y captura errores incluso de los módulos que se importan después.
import './modules/rendererLogger.js';

import { getChatHistory } from './api.js';

import { setActiveChat, getChatState } from './chatState.js';
import { addMessage, addDocumentCard, showErrorToast, addErrorMessage } from './ui.js';
import {
  HARDWARE_PROFILE,
  APP_MODE,
  MODEL_PROFILES,
  getLabel,
  renderLocalModels,
  refreshLocalActiveState,
  updateMenuTriggerLabel,
  initHardwareProfile
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
  getSendingState,
  promptImportChat,
  promptImportProject
} from './modules/sidebar.js';

import { refreshAppliedPatches } from './modules/patchRenderer.js';
import { openProjectConfigModal } from './modules/projectConfig.js';
import { initModals } from './modules/modals.js';
import { initTranscription } from './modules/transcription.js';
import { initAttachments, getAttachedFiles, clearAttachedFiles } from './modules/attachments.js';
import { initChat, ensureGeneralChatExists, autoResizeUserInput } from './modules/chat.js';
import { initDevPanel, handleDebugEvent } from './modules/devPanel.js';
import { initSettings } from './modules/settings.js';
import { initWebSearch } from './modules/webSearch.js';
import { initLogin, getToken, getUser, logout } from './modules/login.js';
import { makeUniqueChatTitle } from './modules/autoRename.js';

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
    if (model === 'auto') primaryModel = 'auto';
  },
  deleteConfirmModal,
  deleteConfirmText,
  userInput
};

const chatDeps = {
  chatBox,
  typing,
  sendBtn,
  userInput,
  menuTrigger,
  HARDWARE_PROFILE,
  getPrimaryModel: () => primaryModel,
  onDebug: handleDebugEvent,
  getAssistantsState: () => assistantsState,
  updateMenuTriggerLabel,
  getAttachedFiles,
  clearAttachedFiles,
  loadSidebar,
  getSidebarDeps: () => sidebarDeps,
  getPendingAutoRename: () => pendingAutoRename,
  setPendingAutoRename: (val) => { pendingAutoRename = val; },
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

// ─── Menú de modelos locales — se arma DESPUÉS de que HARDWARE_PROFILE esté
// resuelto (ver más abajo, tras `await initHardwareProfile()`). Si se arma
// acá arriba (código de nivel superior del módulo, se ejecuta antes que ese
// await), siempre usa el valor default ('desktop') de models.js sin importar
// cuál sea el perfil real — bug encontrado en vivo, ver DECISIONS.md →
// "Menú de modelos locales mostraba siempre la lista de desktop".
function onLocalModelSelect(model) {
  if (model === 'back') { showMenuView('root'); return; }
  primaryModel = model;
  updateMenuTriggerLabel(menuTrigger, primaryModel, assistantsState);
  refreshLocalActiveState(menuViewLocal, primaryModel);
  smartMenuPanel.classList.add('hidden');
}

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

document.getElementById('newChatBtn').onclick = async () => {
  if (getSendingState()) return;
  setActiveChat({ projectId: 'general', chatId: null, mode: 'landing' });
  pendingAutoRename = null;
  renderWelcomeScreen();
  // Antes sin `await`: quedaba corriendo de fondo, sin orden garantizado
  // contra el propio `await loadSidebar(...)` que hace ensureGeneralChatExists()
  // al crear el chat real (ver chat.js) si el usuario mandaba el primer
  // mensaje rápido después de clickear "+ Nuevo chat" — dos refrescos de
  // sidebar en paralelo, candidato sospechoso para la burbuja de bienvenida
  // que quedaba pegada junto al mensaje real (ver DECISIONS.md). Con
  // `await`, este refresco termina antes de que el usuario pueda disparar
  // el segundo.
  await loadSidebar(sidebarDeps);
  userInput.focus();
};

// Importar al espacio general. La lógica vive en sidebar.js (promptImportChat)
// porque cada proyecto tiene su propio punto de entrada al mismo flujo — acá
// sólo cambia el destino.
document.getElementById('importChatBtn').onclick = () => {
  if (getSendingState()) return;
  promptImportChat('general', sidebarDeps);
};

document.getElementById('importProjectBtn').onclick = () => {
  if (getSendingState()) return;
  promptImportProject(sidebarDeps);
};

function renderWelcomeScreen() {
  chatBox.innerHTML = `
    <div class="welcome-screen">
      <h2>¿En qué puedo ayudarte?</h2>
      <p>Escribe un mensaje o usa una herramienta para iniciar un nuevo chat.</p>
    </div>
  `;
}

/**
 * Detecta si un mensaje guardado corresponde a una card de documento generado
 * (transcripción, documento exportado, etc.) y extrae sus datos para reconstruirla.
 * Formato esperado (ver transcription.js — documentSummary):
 *   📄 Documento generado
 *   Título · FORMATO
 *   ...
 *   [Ver documento](url)
 *   [Descargar](url)
 */
function parseDocumentCardMessage(content) {
  const text = String(content || '');
  if (!text.startsWith('📄 Documento generado')) return null;

  const titleLineMatch = text.match(/📄 Documento generado\n(.+?) · (\w+)/);
  const urlMatch = text.match(/\[Ver documento\]\((https?:\/\/[^\s)]+)\)/);
  const filenameMatch = text.match(/Archivo generado:\s*(\S+)/);

  if (!urlMatch) return null;

  const fileUrl = urlMatch[1];
  const filename = filenameMatch ? filenameMatch[1] : fileUrl.split('/').pop();
  const format = titleLineMatch ? titleLineMatch[2] : (filename.split('.').pop() || 'txt');
  const title = titleLineMatch ? titleLineMatch[1] : 'Documento';

  // previewText = todo el bloque entre el título y los links
  const previewMatch = text.match(/· \w+\n\n([\s\S]*?)\n\n\[Ver documento\]/);
  const previewText = previewMatch ? previewMatch[1] : '';

  return { title, format, filename, fileUrl, downloadUrl: fileUrl, previewText };
}

async function loadChatHistory() {
  try {
    if (chatBox.dataset.streaming === 'true' || chatBox.dataset.reloading === 'true') return;

    // Antes de pintar los mensajes: traer qué patches de este proyecto ya se
    // aplicaron, para que las tarjetas de patch del historial se dibujen con
    // el botón marcado. Tiene que ir ANTES del render, no después — si no, las
    // tarjetas ya se crearon consultando una lista vacía. Se espera a propósito
    // (no fire-and-forget) por el mismo motivo.
    await refreshAppliedPatches(getChatState().projectId);

    // chatId === 'default' es el placeholder en blanco del proyecto (ver
    // ensureGeneralChatExists en chat.js) — nunca debería tener contenido real
    // que mostrar. No pedirle historial al backend: solo limpiar la vista.
    if (getChatState().chatId === 'default') {
      chatBox.innerHTML = '';
      return;
    }

    const data = await getChatHistory();
    if (!data.ok || !Array.isArray(data.history)) return;
    chatBox.innerHTML = '';
    data.history.forEach(msg => {
      const sender = msg.role === 'user' ? 'Tú' : 'Tempest';
      const docCard = sender === 'Tempest' ? parseDocumentCardMessage(msg.content) : null;

      if (docCard) {
        addDocumentCard(chatBox, docCard);
      } else {
        addMessage(chatBox, sender, msg.content);
      }
    });
  } catch (error) {
    console.error('No se pudo cargar el historial:', error);
  }
}

await initLogin();
await initHardwareProfile();

// Recién acá HARDWARE_PROFILE tiene el valor real (persistido en
// app-settings.json, resuelto por el backend) — armar el menú de modelos
// locales antes de este punto siempre mostraba la lista de 'desktop' sin
// importar el perfil real. `refreshLocalModelsMenu` queda expuesta también
// para volver a armar el menú si el usuario cambia el perfil en vivo desde
// Configuración → Preferencias, sin tener que reiniciar la app.
function refreshLocalModelsMenu() {
  renderLocalModels(menuViewLocal, onLocalModelSelect);
  refreshLocalActiveState(menuViewLocal, primaryModel);
}
refreshLocalModelsMenu();
window.addEventListener('hardwareprofile-changed', refreshLocalModelsMenu);

renderWelcomeScreen();

initChat(chatDeps);

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

initModals({
  deleteConfirmModal,
  newProjectModal,
  newProjectNameInput,
  cancelDeleteBtn,
  confirmDeleteBtn,
  cancelNewProjectBtn,
  confirmNewProjectBtn,
  chatBox,
  fileInput,
  addFileBtn,
  toolMenuPanel,
  userInput,
  loadSidebar,
  getSidebarDeps: () => sidebarDeps,
  initAttachments,
  renderWelcomeScreen,
  setPendingAutoRename: (val) => { pendingAutoRename = val; }
});

const isAdmin = await initDevPanel();
await initSettings(isAdmin);
await initWebSearch();
loadSidebar(sidebarDeps);