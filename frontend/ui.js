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

// ─── Aviso: análisis de imágenes no disponible ──────────────────────────────
// Se dibuja acá, en el frontend, y NO se le pide al modelo de chat que lo diga.
// Dos razones, las dos aprendidas probando: (1) el texto llegaba como contenido
// del adjunto y el modelo lo parafraseaba — uno de 3B resume y se come justo la
// parte accionable; (2) un hipervínculo no sobrevive a ninguna paráfrasis. Acá
// el texto es exacto siempre y el enlace es un enlace de verdad.
//
// El `target="_blank"` es lo que hace que Electron lo abra en el navegador del
// sistema en vez de navegar la ventana de la app: shell/main.js intercepta con
// setWindowOpenHandler → shell.openExternal. Sin eso, el usuario terminaría con
// la web de Ollama adentro de Tempest y sin forma de volver.
// UN solo mensaje para cualquier combinación de requisitos faltantes: la app de
// Ollama, los pesos, el complemento de visión, el registro, o varios a la vez.
//
// Hubo una versión con un texto distinto por caso. Se descartó por pedido del
// usuario, y tenía razón: el texto único ya lleva a donde hay que ir
// (Configuración → Modelos) y ahí el panel muestra con precisión qué falta y
// qué botón apretar. Tres mensajes casi iguales no aportaban nada que el panel
// no dijera mejor, y multiplicaban el texto a mantener por tres.
//
// El backend igual sigue distinguiendo cuál falta — queda en el log y en el
// trace del request, que es donde sirve para diagnosticar.
export function addVisionUnavailableCard(chatBox) {
  const row = document.createElement('div');
  row.className = 'message-row bot';

  const bubble = document.createElement('div');
  bubble.className = 'message bot';

  const label = document.createElement('div');
  label.className = 'message-label';
  label.textContent = 'Tempest';

  const card = document.createElement('div');
  card.className = 'vision-notice-card';

  const title = document.createElement('h3');
  title.textContent = 'Análisis de imágenes no disponible';
  card.appendChild(title);

  const addP = (text, cls) => {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    card.appendChild(p);
  };

  addP('Para analizar imágenes, Tempest necesita Ollama y un modelo de visión configurado.');
  addP('Si Ollama no está instalado, puedes descargarlo aquí:');

  const link = document.createElement('a');
  link.className = 'vision-notice-link';
  link.textContent = 'Descargar Ollama';
  link.href = 'https://ollama.com/download';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  card.appendChild(link);

  addP('Después de instalarlo, Tempest lo detectará automáticamente. ' +
       'Luego podrás configurar el modelo de visión desde Configuración → Modelos.');

  addP('El análisis de imágenes es opcional. Puedes seguir usando normalmente ' +
       'el resto de las funciones de Tempest sin instalarlo.', 'vision-notice-footnote');

  bubble.appendChild(label);
  bubble.appendChild(card);
  row.appendChild(bubble);
  chatBox.appendChild(row);

  chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
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