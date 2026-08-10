import { getMemoryQuery, getChatState } from './chatState.js';
import { getToken } from './modules/login.js';
import { BASE_URL } from './config.js';

let _abortController = null;

export function abortCurrentStream() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
}

function authHeaders(extra = {}) {
  const token = getToken();
  const headers = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function handleUnauthorized(response) {
  if (response.status === 401) {
    import('./modules/login.js').then(({ clearSession }) => {
      clearSession();
      location.reload();
    });
  }
  return response;
}

/**
 * onToken(token: string) → se llama con cada fragmento de texto
 * Retorna { ok, attachments } cuando termina el stream.
 */
export async function sendChatMessage(message, config = {}, files = [], onToken = null, onModel = null, onDebug = null, onSwitching = null) {
  const state = getChatState();
  const hasFiles = Array.isArray(files) && files.length > 0;

  let fetchRes;

  _abortController = new AbortController();
  const { signal } = _abortController;

  if (!hasFiles) {
    console.log('[api] sendChatMessage llamado desde:', new Error().stack?.split('\n').slice(1,4).join(' | '));
    fetchRes = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        message,
        projectId: state.projectId,
        chatId: state.chatId,
        config
      }),
      signal
    });
  } else {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('projectId', state.projectId);
    formData.append('chatId', state.chatId);
    formData.append('config', JSON.stringify(config));
    files.forEach(file => formData.append('attachments', file));

    fetchRes = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
      signal
    });
  }

  // ── Manejo de errores pre-stream (400, 500) ───────────────────
  handleUnauthorized(fetchRes);
  if (!fetchRes.ok) {
    let errorMessage = 'Error en el servidor';
    let errorCode = null;
    try {
      const errData = await fetchRes.json();
      errorCode = errData.error || null;
      errorMessage = errData.message || errData.error || errorMessage;
    } catch { /* sin body */ }

    // El código del backend viaja en `.code`, no embebido en el texto: quien
    // atrapa este error necesita distinguir un rechazo esperado (patch sin
    // contexto / sin grounding, que hay que mostrarle al usuario tal cual) de
    // una caída real del servidor. Antes se hacía con `errMsg.includes('Patch
    // Mode')` en chat.js, que se rompía en silencio apenas cambiaba la
    // redacción del mensaje.
    const err = new Error(errorMessage);
    err.code = errorCode;
    throw err;
  }

  // ── Leer stream SSE ───────────────────────────────────────────
  const reader = fetchRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let attachments = [];
  let usedModel = null;
  // Señal del backend: alguna imagen adjunta necesitaba análisis visual y no
  // estaba disponible. El aviso al usuario (con el enlace de descarga de
  // Ollama) lo dibuja chat.js, no el modelo — ver image.extractor.js.
  let visionUnavailable = false;

  while (true) {
    let done, value;
    try {
      ({ done, value } = await reader.read());
    } catch (err) {
      if (err.name === 'AbortError') return { ok: 'aborted', attachments, usedModel, visionUnavailable };
      throw err;
    }
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const payload = trimmed.slice(5).trim();

      if (payload.startsWith('[SWITCHING_MODEL]')) {
        try {
          const meta = JSON.parse(payload.slice(17).trim());
          if (onSwitching) onSwitching(meta.model || null);
        } catch { /* sin meta */ }
        continue;
      }

      if (payload.startsWith('[MODEL]')) {
        try {
          const meta = JSON.parse(payload.slice(7).trim());
          usedModel = meta.model || null;
          if (onModel) onModel(usedModel);
        } catch { /* sin meta */ }
        continue;
      }

      if (payload.startsWith('[DONE]')) {
        try {
          const meta = JSON.parse(payload.slice(6).trim());
          attachments = meta.attachments || [];
          usedModel = meta.model || null;
          visionUnavailable = meta.visionUnavailable === true;
        } catch { /* sin meta */ }
        continue;
      }

      if (payload.startsWith('[ERROR]')) {
        // Antes: solo se logueaba y el loop seguía — sendChatMessage()
        // terminaba devolviendo { ok: true } igual (el `while` sale por
        // `done` cuando el backend cierra la conexión después de este
        // evento). chat.js interpretaba eso como éxito y finalizaba una
        // burbuja vacía (fullText nunca se llenó, no hubo ningún [token]
        // antes del error) — el usuario no veía nada, ni la respuesta ni
        // un aviso de error. El backend sí loguea el error real
        // (requests-*.jsonl, ok:false) y sí manda este evento — el bug
        // estaba en que acá se lo descartaba en vez de propagarlo. Ver
        // DECISIONS.md.
        const message = payload.slice(7).trim();
        console.error('Stream error:', message);
        const err = new Error(message || 'Error generando la respuesta');
        err.code = 'stream_error';
        throw err;
      }

      if (payload.startsWith('[DEBUG]')) {
        try {
          const debug = JSON.parse(payload.slice(7).trim());
          if (onDebug) onDebug(debug);
        } catch { /* sin meta */ }
        continue;
      }

      // Restaurar saltos de línea escapados
      let token;
      try { token = JSON.parse(payload); } catch { token = payload; }
      if (onToken) onToken(token);
    }
  }

  _abortController = null;
  return { ok: true, attachments, usedModel, visionUnavailable };
}

export async function getChatHistory() {
  const response = await fetch(`${BASE_URL}/chat/history?${getMemoryQuery()}`, {
    headers: authHeaders()
  });

  if (!response.ok) {
    throw new Error('Error obteniendo historial');
  }

  return response.json();
}

export async function listChats(projectId = 'tempest') {
  const response = await fetch(`${BASE_URL}/chats?projectId=${encodeURIComponent(projectId)}`, {
    headers: authHeaders()
  });
  return response.json();
}

export async function createChat(chatId, projectId = 'tempest') {
  const response = await fetch(`${BASE_URL}/chat/create`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      chatId,
      projectId
    })
  });

  return response.json();
}

export async function deleteChat(chatId, projectId = 'tempest') {
  const response = await fetch(`${BASE_URL}/chat/delete`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      chatId,
      projectId
    })
  });

  return response.json();
}

export async function exportChat(chatId, projectId = 'general') {
  const response = await fetch(`${BASE_URL}/chat/export`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      chatId,
      projectId
    })
  });

  return response.json();
}

/**
 * Importa un chat desde el texto de un .md exportado. Se manda como JSON
 * (no FormData/multipart) a propósito: es texto plano, así no hace falta
 * meter multer ni un directorio temporal para un archivo que se consume
 * de una sola vez. Ver limit de express.json() en server.js.
 */
export async function importChat(markdown, projectId = 'general') {
  const response = await fetch(`${BASE_URL}/chat/import`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      markdown,
      projectId
    })
  });

  return response.json();
}

export async function renameChat(chatId, newTitle, projectId = 'general') {
  const response = await fetch(`${BASE_URL}/chat/rename`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      chatId,
      newTitle,
      projectId
    })
  });

  return response.json();
}

export async function exportProject(projectId) {
  const response = await fetch(`${BASE_URL}/project/export`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ projectId })
  });

  return response.json();
}

/**
 * `data` es el contenido crudo del .tempestproj (JSON como string). Se manda
 * tal cual, sin parsear en el frontend: parsear acá sólo serviría para
 * re-serializarlo enseguida y duplicaría la validación que igual hay que
 * hacer del lado del backend.
 */
export async function importProject(data) {
  const response = await fetch(`${BASE_URL}/project/import`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ data })
  });

  return response.json();
}

export async function renameProject(oldProjectId, newProjectId) {
  const response = await fetch(`${BASE_URL}/project/rename`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      oldProjectId,
      newProjectId
    })
  });

  return response.json();
}

export async function listProjects() {
  const response = await fetch(`${BASE_URL}/projects`, {
    headers: authHeaders()
  });
  return response.json();
}

export async function createProject(projectId) {
  const response = await fetch(`${BASE_URL}/project/create`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ projectId })
  });

  return response.json();
}

export async function deleteProject(projectId) {
  const response = await fetch(`${BASE_URL}/project/delete`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ projectId })
  });

  return response.json();
}

export async function transcribeAudio(audioFile, options = {}) {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('mode', options.mode || 'plain');
  formData.append('format', options.format || 'txt');

  const response = await fetch(`${BASE_URL}/transcribe`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData
  });

  return response.json();
}

export async function generateTitle(text, type = 'chat', model = null) {
  const response = await fetch(`${BASE_URL}/title/generate`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text, type, model })
  });

  return response.json();
}

export async function generateDocument(prompt, format = 'txt', config = {}) {
  const state = getChatState();
  const response = await fetch(`${BASE_URL}/document/generate`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      prompt,
      format,
      projectId: state.projectId,
      chatId: state.chatId,
      config
    })
  });

  return response.json();
}


// ─── Context Files ─────────────────────────────────────────────────────────

export async function listContextItems(projectId) {
 const response = await fetch(`${BASE_URL}/project/${encodeURIComponent(projectId)}/context/items`, {
    headers: authHeaders()
  });
  return response.json();
}

export async function uploadContextFiles(projectId, files) {
  const formData = new FormData();
  Array.from(files).forEach(file => formData.append('files', file));

  const response = await fetch(`${BASE_URL}/project/${encodeURIComponent(projectId)}/context/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData
  });

  return response.json();
}

export async function updateContextItem(projectId, itemId, changes) {
  const response = await fetch(`${BASE_URL}/project/${encodeURIComponent(projectId)}/context/item/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(changes)
  });

  return response.json();
}

export async function deleteContextItem(projectId, itemId) {
  const response = await fetch(`${BASE_URL}/project/${encodeURIComponent(projectId)}/context/item/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
    headers: authHeaders()
  });

  return response.json();
}

// ─── Project Settings ───────────────────────────────────────────────────────

export async function getProjectSettings(projectId) {
  const res = await fetch(`${BASE_URL}/project/${encodeURIComponent(projectId)}/settings`, {
    headers: authHeaders()
  });
  return res.json();
}

export async function updateProjectSettings(projectId, updates) {
  const res = await fetch(`${BASE_URL}/project/${encodeURIComponent(projectId)}/settings`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates)
  });
  return res.json();
}

export async function saveMessageToHistory(role, content, target = null) {
  const state = target || getChatState();
  const response = await fetch(`${BASE_URL}/chat/message/save`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      role,
      content,
      projectId: state.projectId,
      chatId: state.chatId
    })
  });
  return response.json();
}