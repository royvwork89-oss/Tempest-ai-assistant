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
    try {
      const errData = await fetchRes.json();
      if (errData.error === 'patch_no_context') {
        errorMessage = errData.message;
      } else {
        errorMessage = errData.message || errData.error || errorMessage;
      }
    } catch { /* sin body */ }
    throw new Error(errorMessage);
  }

  // ── Leer stream SSE ───────────────────────────────────────────
  const reader = fetchRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let attachments = [];
  let usedModel = null;

  while (true) {
    let done, value;
    try {
      ({ done, value } = await reader.read());
    } catch (err) {
      if (err.name === 'AbortError') return { ok: 'aborted', attachments, usedModel };
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
        } catch { /* sin meta */ }
        continue;
      }

      if (payload.startsWith('[ERROR]')) {
        console.error('Stream error:', payload.slice(7));
        continue;
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
  return { ok: true, attachments, usedModel };
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