import { renderMixedContent, renderMessageActions } from './modules/messageRenderer.js';

export function addMessage(chatBox, sender, text) {
  const row = document.createElement('div');
  row.className = `message-row ${sender === 'Tú' ? 'user' : 'bot'}`;

  const bubble = document.createElement('div');
  bubble.className = `message ${sender === 'Tú' ? 'user' : 'bot'}`;

  const label = document.createElement('div');
  label.className = 'message-label';
  label.textContent = sender;

  const content = document.createElement('div');
  content.className = 'message-content';

  renderMixedContent(content, text);

  const actions = renderMessageActions(sender, text);

  bubble.appendChild(label);
  bubble.appendChild(content);
  bubble.appendChild(actions);

  row.appendChild(bubble);
  chatBox.appendChild(row);

  chatBox.scrollTo({
    top: chatBox.scrollHeight,
    behavior: 'smooth'
  });
}

export function addDocumentCard(chatBox, documentData) {
  const row = document.createElement('div');
  row.className = 'message-row bot';

  const bubble = document.createElement('div');
  bubble.className = 'message bot';

  const label = document.createElement('div');
  label.className = 'message-label';
  label.textContent = 'Tempest';

  const card = document.createElement('div');
  card.className = 'document-card';

  const title = document.createElement('h3');
  title.textContent = '📄 Documento generado';

  const info = document.createElement('p');
  info.textContent = `${documentData.title || 'Documento'} · ${String(documentData.format || '').toUpperCase()}`;

  const preview = document.createElement('div');
  preview.className = 'document-preview';

  const previewText = String(documentData.previewText || '').trim();

  preview.textContent = previewText.length > 700
    ? previewText.slice(0, 700) + '...'
    : previewText;

  const actions = document.createElement('div');
  actions.className = 'document-actions';

  const viewBtn = document.createElement('a');
  viewBtn.textContent = 'Ver documento';
  viewBtn.className = 'document-btn';
  viewBtn.href = documentData.fileUrl;
  viewBtn.target = '_blank';
  viewBtn.rel = 'noopener noreferrer';

  const downloadBtn = document.createElement('a');
  downloadBtn.textContent = 'Descargar';
  downloadBtn.className = 'document-btn primary';
  downloadBtn.href = documentData.downloadUrl || documentData.fileUrl;
  downloadBtn.target = '_blank';
  downloadBtn.rel = 'noopener noreferrer';

  if (documentData.filename) {
    downloadBtn.setAttribute('download', documentData.filename);
  }

  actions.appendChild(viewBtn);
  actions.appendChild(downloadBtn);

  card.appendChild(title);
  card.appendChild(info);

  if (previewText) {
    card.appendChild(preview);
  }

  card.appendChild(actions);

  bubble.appendChild(label);
  bubble.appendChild(card);
  row.appendChild(bubble);
  chatBox.appendChild(row);

  chatBox.scrollTo({
    top: chatBox.scrollHeight,
    behavior: 'smooth'
  });
}

/**
 * Toast de error temporal en esquina superior derecha.
 * Para errores de sistema: sin conexión, LocalAI caído, etc.
 */
export function showErrorToast(message, duration = 4000) {
  const existing = document.getElementById('tempest-error-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'tempest-error-toast';
  toast.className = 'error-toast';
  toast.innerHTML = `
    <span class="error-toast-icon">⚠️</span>
    <span class="error-toast-text">${message}</span>
    <button class="error-toast-close" aria-label="Cerrar">✕</button>
  `;

  document.body.appendChild(toast);
  toast.getBoundingClientRect();
  toast.classList.add('error-toast--visible');

  const dismiss = () => {
    toast.classList.remove('error-toast--visible');
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('.error-toast-close').addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
}

/**
 * Burbuja de error dentro del chat.
 * Para errores contextuales: fallo al generar respuesta, etc.
 */
export function addErrorMessage(chatBox, message) {
  const row = document.createElement('div');
  row.className = 'message-row bot';

  const bubble = document.createElement('div');
  bubble.className = 'message bot message--error';

  const label = document.createElement('div');
  label.className = 'message-label';
  label.textContent = 'Tempest';

  const content = document.createElement('div');
  content.className = 'message-content error-message-content';
  content.innerHTML = `<span class="error-msg-icon">⚠️</span> ${message}`;

  bubble.appendChild(label);
  bubble.appendChild(content);
  row.appendChild(bubble);
  chatBox.appendChild(row);

  chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}