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

// ─── Avisos del sistema sobre el adjunto y la respuesta ──────────────────
// No son mensajes de Tempest: son notas de la aplicación sobre lo que pasó con
// el pedido. Por eso no llevan burbuja ni la etiqueta "Tempest" — si las
// llevaran, el usuario las leería como algo que dijo el modelo.
//
// El dato lo calcula el backend y viaja en el evento [DONE] (ver
// chat.controller.js). Antes solo quedaba en el log, así que una respuesta
// basada en una fracción del archivo se veía igual que una completa.

function formatChars(n) {
  return n.toLocaleString('es-MX');
}

function buildNoticeRow(variant) {
  const row = document.createElement('div');
  row.className = variant ? `system-notice system-notice-${variant}` : 'system-notice';
  return row;
}

function appendNoticeLine(row, text, cls) {
  const p = document.createElement('p');
  if (cls) p.className = cls;
  p.textContent = text;
  row.appendChild(p);
  return p;
}

// beforeEl: la burbuja de la respuesta. El aviso se inserta ANTES para que se
// lea junto con la respuesta y no después de haberla dado por buena. Si la
// burbuja ya no está en el DOM (stream abortado), cae al final del chat.
function placeNotice(chatBox, row, beforeEl) {
  if (beforeEl && beforeEl.isConnected && beforeEl.parentNode === chatBox) {
    chatBox.insertBefore(row, beforeEl);
  } else {
    chatBox.appendChild(row);
  }
}

const ATTACHMENT_SCOPE_TEXT =
  'Los archivos adjuntos valen solo para este mensaje. Para preguntar por ellos otra vez, vuelve a adjuntarlos.';

export function addAttachmentTruncatedNotice(chatBox, items, beforeEl) {
  if (!Array.isArray(items) || items.length === 0) return;

  const row = buildNoticeRow('warn');

  appendNoticeLine(
    row,
    items.length === 1
      ? 'El archivo se envió recortado'
      : `${items.length} archivos se enviaron recortados`,
    'system-notice-title'
  );

  // Tope de 3 para que el aviso no crezca sin control con muchos adjuntos.
  items.slice(0, 3).forEach((item) => {
    const name = item?.name || 'archivo';
    const sent = typeof item?.sent === 'number' ? item.sent : null;
    const total = typeof item?.total === 'number' ? item.total : null;

    if (sent !== null && total !== null && total > 0) {
      const pct = Math.max(1, Math.round((sent / total) * 100));
      appendNoticeLine(row, `${name}: llegaron ${formatChars(sent)} de ${formatChars(total)} caracteres (${pct} %).`);
    } else {
      appendNoticeLine(row, `${name}: llegó solo una parte del contenido.`);
    }
  });

  if (items.length > 3) {
    appendNoticeLine(row, `y ${items.length - 3} archivo(s) más.`);
  }

  appendNoticeLine(
    row,
    'En documentos se conserva el principio y el final: la parte del medio no llegó al modelo, así que la respuesta puede estar incompleta.',
    'system-notice-foot'
  );

  // El alcance va en la misma nota y no como aviso aparte: dos barras
  // seguidas se leen como dos problemas distintos cuando son el mismo pedido.
  appendNoticeLine(row, ATTACHMENT_SCOPE_TEXT, 'system-notice-foot');

  placeNotice(chatBox, row, beforeEl);
}

// Los adjuntos se limpian después de cada envío (ver chat.js). La conversación
// sigue abierta, así que sin este aviso el usuario pregunta por el documento en
// el turno siguiente y el modelo responde sin tenerlo, a veces sin decirlo.
export function addAttachmentScopeNotice(chatBox, beforeEl) {
  const row = buildNoticeRow(null);
  appendNoticeLine(row, ATTACHMENT_SCOPE_TEXT, 'system-notice-foot');
  placeNotice(chatBox, row, beforeEl);
}

export function addOutputTruncatedNotice(chatBox) {
  const row = buildNoticeRow('warn');
  appendNoticeLine(
    row,
    'La respuesta se cortó al llegar al límite de longitud. Pide que continúe para ver el resto.',
    'system-notice-foot'
  );
  chatBox.appendChild(row);
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