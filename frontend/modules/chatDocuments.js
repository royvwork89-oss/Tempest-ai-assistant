// Barra de documentos del chat (v3.1.0).
// Muestra los documentos guardados en el chat actual y deja quitarlos o
// reactivarlos. La fuente de verdad es el backend (GET /chat/documents): esta
// barra no deduce nada. Qué recibió el modelo en cada turno NO sale de acá sino
// del campo `documents` del evento [DONE] (ver ui.js → addChatDocumentsNotice).
import { BASE_URL } from '../config.js';
import { getToken } from './login.js';
import { getChatState, getMemoryQuery } from '../chatState.js';
import { showErrorToast } from '../ui.js';

function headers(extra = {}) {
  const h = { ...extra };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function getBar() {
  return document.getElementById('chatDocsBar');
}

function hideBar(bar) {
  bar.innerHTML = '';
  bar.classList.add('hidden');
}

function makeChip(doc, onToggle) {
  const chip = document.createElement('span');
  chip.className = 'chat-doc-chip';

  const unusable = doc.status === 'error' || doc.missing;
  if (doc.status === 'removed') chip.classList.add('chat-doc-chip-removed');
  if (unusable) chip.classList.add('chat-doc-chip-error');

  const label = document.createElement('span');
  label.className = 'chat-doc-name';
  label.textContent = doc.name;
  const bits = [];
  if (doc.status === 'removed') bits.push('quitado: no se usa en este chat');
  if (doc.status === 'error') bits.push(`no se pudo leer${doc.error ? ': ' + doc.error : ''}`);
  if (doc.missing) bits.push('el archivo guardado ya no existe');
  if (doc.storageTruncated) bits.push(`guardado parcial: ${doc.chars.toLocaleString('es-MX')} de ${doc.originalChars.toLocaleString('es-MX')} caracteres`);
  if (bits.length === 0 && doc.chars) bits.push(`${doc.chars.toLocaleString('es-MX')} caracteres`);
  label.title = bits.join(' · ');
  chip.appendChild(label);

  if (doc.status === 'active' && !doc.missing) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-doc-btn';
    btn.textContent = '✕';
    btn.title = 'Quitar del chat (no se borra; se puede reactivar)';
    btn.addEventListener('click', () => onToggle(doc, 'removed'));
    chip.appendChild(btn);
  } else if (doc.status === 'removed') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-doc-btn';
    btn.textContent = '↺';
    btn.title = 'Reactivar en este chat';
    btn.addEventListener('click', () => onToggle(doc, 'active'));
    chip.appendChild(btn);
  }
  return chip;
}

async function setStatus(doc, status) {
  try {
    const state = getChatState();
    const res = await fetch(`${BASE_URL}/chat/documents/status`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ projectId: state.projectId, chatId: state.chatId, docId: doc.id, status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) showErrorToast(data.error || 'No se pudo actualizar el documento');
  } catch (err) {
    console.error('[chatDocuments] setStatus falló:', err.message);
    showErrorToast('No se pudo actualizar el documento');
  }
  refreshChatDocuments();
}

export async function refreshChatDocuments() {
  const bar = getBar();
  if (!bar) return;
  try {
    const state = getChatState();
    // El chat provisional 'default' (o ninguno) todavía no puede tener documentos.
    if (!state.chatId || state.chatId === 'default') { hideBar(bar); return; }

    const res = await fetch(`${BASE_URL}/chat/documents?${getMemoryQuery()}`, { headers: headers() });
    if (!res.ok) { hideBar(bar); return; }
    const data = await res.json();
    const docs = Array.isArray(data.documents) ? data.documents : [];
    if (docs.length === 0) { hideBar(bar); return; }

    bar.innerHTML = '';
    const title = document.createElement('span');
    title.className = 'chat-docs-title';
    const active = docs.filter((d) => d.status === 'active' && !d.missing).length;
    title.textContent = `Documentos del chat (${active}/${data.maxActive || 10}):`;
    bar.appendChild(title);
    docs.forEach((d) => bar.appendChild(makeChip(d, setStatus)));
    bar.classList.remove('hidden');
  } catch (err) {
    console.error('[chatDocuments] no se pudo actualizar la barra:', err.message);
    hideBar(bar);
  }
}
