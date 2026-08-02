import {
  sendChatMessage,
  getChatHistory,
  createChat,
  generateDocument
} from '../api.js';
import { tryAutoRename } from './autoRename.js';
import { getWebSearchConfig } from './webSearch.js';

import { setActiveChat, getChatState } from '../chatState.js';
import {
  addMessage,
  addDocumentCard,
  showErrorToast,
  addErrorMessage
} from '../ui.js';
import { createStreamingBubble, finalizeStreamingBubble } from './streaming.js';
import { setSendingState } from './sidebar.js';
import { abortCurrentStream } from '../api.js';

// Códigos de rechazo esperado de Patch Mode. El backend ya manda un mensaje
// redactado para el usuario y explica la acción a tomar (moverse al proyecto
// correcto, adjuntar el archivo, reindexar), así que se muestra tal cual en
// vez de reemplazarlo por un error genérico. Si se agrega un rechazo nuevo en
// el backend, sumar su código acá.
const PATCH_REJECTION_CODES = new Set(['patch_no_context', 'patch_no_grounding']);

let _deps = null;
let _sending = false;

const ICON_SEND = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405z"/></svg>`;
const ICON_STOP = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`;


export function initChat(deps) {
  _deps = deps;

  const { userInput, sendBtn } = deps;

  userInput.addEventListener('input', autoResizeUserInput);
  userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', (event) => {
    event.preventDefault();
    if (_sending) {
      abortCurrentStream();
    } else {
      sendMessage();
    }
  });
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
  // chatId === 'default' es el chat placeholder que createProject() genera
  // automáticamente al crear el proyecto (memory.service.js) — sidebar.js ya
  // lo excluye de la lista de chats visibles porque no es un chat real, es
  // solo el estado en blanco que se muestra al seleccionar la carpeta del
  // proyecto. Sin este chequeo, cualquier mensaje escrito ahí se guardaba
  // para siempre en ese mismo chat 'default' compartido en vez de crear un
  // chat nuevo — el "chat fantasma" que siempre está ahí sin nombre.
  if (state.chatId && state.chatId !== 'default' && state.mode !== 'landing') return;

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
  if (_sending) return;
  _sending = true;

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

  if (!message && files.length === 0) {
    _sending = false;
    setSendingState(false);
    sendBtn.classList.remove('stop-mode');
    sendBtn.innerHTML = ICON_SEND;
    sendBtn.disabled = false;
    userInput.disabled = false;
    return;
  }

  await ensureGeneralChatExists();

  const primaryModel = getPrimaryModel();

  const config = {
    primaryModel,
    autoProfile: 'balanceado',
    hardwareProfile: HARDWARE_PROFILE,
    assistants: Object.entries(getAssistantsState()).map(([provider, s]) => ({ provider, ...s })),
    ...getWebSearchConfig()
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

  setSendingState(true);
  sendBtn.classList.add('stop-mode');
  sendBtn.innerHTML = ICON_STOP;
  sendBtn.title = 'Detener respuesta';
  userInput.disabled = true;

  try {
    if (documentRequest && files.length === 0) {
      const data = await generateDocument(message, documentRequest.format, config);

      if (data.ok && data.document) {
        addDocumentCard(chatBox, data.document);
        tryAutoRename({
          getPendingAutoRename, setPendingAutoRename,
          loadSidebar, getSidebarDeps,
          titleText: message.trim() || (files.length > 0 ? files.map(f => f.name).join(', ') : '')
        }).catch(err => console.error('[chat] tryAutoRename falló:', err.message));
      } else {
        addErrorMessage(chatBox, 'No pude generar el documento: ' + (data.error || 'Error desconocido'));
      }
      return; // el finally se ejecuta igual
    }

    const { bubble, rawEl } = createStreamingBubble(chatBox);
    let fullText = '';

    // Capturar el estado de pendingAutoRename ANTES de lanzar el stream
    const pendingAtLaunch = getPendingAutoRename();
    const titleText = message.trim() || (files.length > 0 ? files.map(f => f.name).join(', ') : '');

    // Lanzar generación de título en paralelo al stream — sin loadSidebar
    const titlePromise = pendingAtLaunch
      ? tryAutoRename({
        getPendingAutoRename, setPendingAutoRename,
        loadSidebar: null,
        getSidebarDeps,
        titleText,
        usedModel: null
      }).catch(err => console.error('[chat] tryAutoRename paralelo falló:', err.message))
      : Promise.resolve();

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
        },
        (debug) => {
          if (_deps.onDebug) _deps.onDebug(debug);
        },
        (switchingModel) => {
          typing.textContent = `Cambiando a ${switchingModel || 'nuevo modelo'}...`;
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
        // Liberar UI antes de esperar el título — el renombrado es operación de fondo
        _sending = false;
        setSendingState(false);
        // Mismo riesgo que `data-streaming`: si loadSidebar tira, el flag
        // `reloading` quedaba en 'true' y loadChatHistory() dejaba de cargar
        // nada. El .finally() garantiza que se limpie pase lo que pase. No se
        // limpia en el finally de sendMessage() a propósito: esto corre en
        // segundo plano y ya habría terminado antes, borrando el flag mientras
        // la recarga todavía está en curso.
        titlePromise.then(async () => {
          chatBox.dataset.reloading = 'true';
          await loadSidebar(getSidebarDeps());
        }).catch(err => {
          console.error('[chat] recarga de sidebar post-título falló:', err);
        }).finally(() => {
          chatBox.dataset.reloading = '';
        });
      } else {
        bubble.remove();
        addErrorMessage(chatBox, 'Ocurrió un error al generar la respuesta. Intenta de nuevo.');
        await loadSidebar(getSidebarDeps());
      }
    } catch (streamError) {
      console.error(streamError);
      const errMsg = streamError?.message || '';
      if (errMsg === 'AbortError' || streamError?.name === 'AbortError') {
        if (fullText) {
          finalizeStreamingBubble(bubble, rawEl, fullText);
        } else {
          bubble.remove();
        }
        await loadSidebar(getSidebarDeps());
      } else if (PATCH_REJECTION_CODES.has(streamError?.code)) {
        // Rechazo esperado del backend, no una falla: el mensaje ya viene
        // redactado para el usuario y explica qué hacer. Se compara por
        // código (ver api.js) en vez de buscar texto dentro del mensaje.
        bubble.remove();
        addErrorMessage(chatBox, errMsg);
      } else {
        bubble.remove();
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
    sendBtn.classList.remove('stop-mode');
    sendBtn.innerHTML = ICON_SEND;
    sendBtn.title = 'Enviar';
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
    _sending = false;
    setSendingState(false);

    // `data-streaming` lo pone createStreamingBubble() y lo limpiaba UN SOLO
    // lugar: finalizeStreamingBubble(). Todas las ramas de error hacen
    // bubble.remove() sin pasar por finalize, así que el flag quedaba en
    // 'true' de forma permanente — y loadChatHistory() (app.js) arranca con
    // `if (chatBox.dataset.streaming === 'true') return`. Resultado: la app
    // quedaba congelada, la sidebar cambiaba de chat pero el contenido nunca
    // se recargaba, hasta enviar otro mensaje que sí llegara a finalize.
    // Se limpia acá, en el finally, para cubrir TODAS las salidas de una vez
    // en lugar de parchear rama por rama. Ver DECISIONS.md.
    chatBox.removeAttribute('data-streaming');
  }
}