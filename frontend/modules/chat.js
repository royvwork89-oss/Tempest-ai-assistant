import {
  sendChatMessage,
  getChatHistory,
  createChat,
  generateDocument
} from '../api.js';
import { tryAutoRename } from './autoRename.js';

import { setActiveChat, getChatState } from '../chatState.js';
import {
  addMessage,
  addDocumentCard,
  showErrorToast,
  addErrorMessage
} from '../ui.js';
import { createStreamingBubble, finalizeStreamingBubble } from './streaming.js';

let _deps = null;

export function initChat(deps) {
  _deps = deps;

  const { userInput, sendBtn } = deps;

  userInput.addEventListener('input', autoResizeUserInput);
  userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);
}

export function autoResizeUserInput() {
  const { userInput } = _deps;
  userInput.style.height = 'auto';
  const maxHeight = 400;
  const newHeight = Math.min(userInput.scrollHeight, maxHeight);
  userInput.style.height = `${newHeight}px`;
  userInput.style.overflowY = userInput.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

export async function ensureGeneralChatExists() {
  const { chatBox, loadSidebar, getSidebarDeps, getPendingAutoRename, setPendingAutoRename } = _deps;
  const state = getChatState();
  if (state.chatId && state.mode !== 'landing') return;

  const id = 'chat-' + Date.now();
  const pending = getPendingAutoRename();
  if (pending && pending.chatId === null)
    setPendingAutoRename({ ...pending, chatId: id });

  const targetProjectId = state.projectId || 'general';
  await createChat(id, targetProjectId);
  setActiveChat({ projectId: targetProjectId, chatId: id, mode: targetProjectId === 'general' ? 'chat' : 'project' });

  setPendingAutoRename({ type: 'chat', projectId: targetProjectId, chatId: id });

  await loadSidebar(getSidebarDeps());
  chatBox.innerHTML = '';
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

  return { format };
}

async function sendMessage() {
  const {
    chatBox, typing, sendBtn, userInput,
    getPrimaryModel, getAssistantsState,
    HARDWARE_PROFILE,
    menuTrigger,
    updateMenuTriggerLabel,
    getAttachedFiles, clearAttachedFiles,
    loadSidebar, getSidebarDeps,
    getPendingAutoRename, setPendingAutoRename,
  } = _deps;

  const message = userInput.value.trim();
  const files = getAttachedFiles();

  if (!message && files.length === 0) return;

  await ensureGeneralChatExists();

  const primaryModel = getPrimaryModel();

  const config = {
    primaryModel,
    autoProfile:     'balanceado',
    hardwareProfile: HARDWARE_PROFILE,
    assistants: Object.entries(getAssistantsState()).map(([provider, s]) => ({ provider, ...s }))
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

        await tryAutoRename({
          getPendingAutoRename, setPendingAutoRename,
          loadSidebar, getSidebarDeps,
          titleText: message.trim() || (files.length > 0 ? files.map(f => f.name).join(', ') : '')
        });

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
            updateMenuTriggerLabel(menuTrigger, 'auto', getAssistantsState(), model);
          }
        }
      );

      finalizeStreamingBubble(bubble, rawEl, fullText);

      if (data.usedModel && primaryModel === 'auto') {
        updateMenuTriggerLabel(menuTrigger, 'auto', getAssistantsState(), data.usedModel);
      }

      if (files.length > 0) {
        clearAttachedFiles();
        document.getElementById('attachmentPreview').innerHTML = '';
        document.getElementById('attachmentPreview').classList.add('hidden');
      }

      if (data.ok) {
        await tryAutoRename({
          getPendingAutoRename, setPendingAutoRename,
          loadSidebar, getSidebarDeps,
          titleText: message.trim() || (files.length > 0 ? files.map(f => f.name).join(', ') : '')
        });
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