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

const ICONS = {
  copy: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  edit: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  share: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  retry: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.63"/></svg>`
};

function makeActionBtn(icon, tooltip, disabled = false) {
  const btn = document.createElement('button');
  btn.className = 'message-action-btn' + (disabled ? ' disabled-action' : '');
  btn.innerHTML = icon;
  btn.title = tooltip;
  btn.disabled = disabled;
  return btn;
}

export function renderMessageActions(sender, text) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const copyBtn = makeActionBtn(ICONS.copy, 'Copiar');
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      copyBtn.innerHTML = ICONS.check;
      setTimeout(() => { copyBtn.innerHTML = ICONS.copy; }, 1500);
    } catch (error) {
      console.error('No se pudo copiar el mensaje:', error);
    }
  };
  actions.appendChild(copyBtn);

  if (sender === 'Tú') {
    actions.appendChild(makeActionBtn(ICONS.edit, 'Editar', true));
  } else {
    actions.appendChild(makeActionBtn(ICONS.share, 'Compartir', true));
    actions.appendChild(makeActionBtn(ICONS.retry, 'Intentarlo nuevamente', true));
  }

  return actions;
}

export function renderMixedContent(container, text) {
  const lines = String(text || '').split('\n');

  let normalText = [];
  let codeLines = [];
  let insideCode = false;
  let language = 'código';
  let insideFileBlock = false;
  let fileBlockName = '';
  let fileBlockLines = [];

  function flushText() {
    const value = normalText.join('\n').trim();
    if (value) container.appendChild(renderText(value));
    normalText = [];
  }

  function flushCode() {
    const value = codeLines.join('\n').trim();
    if (!value) { codeLines = []; language = 'código'; return; }
    const segments = value.split(/(?=^(?:Archivo:\s*.+|[\w./\\-]+\.(js|ts|jsx|tsx|py|json|yaml|yml|css|html|sh|env|sql|md):)$)/m);
    if (segments.length > 1) {
      segments.forEach(segment => {
        const trimmed = segment.trim();
        if (!trimmed) return;
        const match = trimmed.match(/^Archivo:\s*(.+)\n([\s\S]*)$/);
        if (match) {
          const fileName = match[1].trim();
          const code = match[2].trim();
          const ext = fileName.split('.').pop().toLowerCase();
          container.appendChild(renderCodeBlock(code, ext || fileName));
        } else {
          container.appendChild(renderCodeBlock(trimmed, language));
        }
      });
    } else {
      container.appendChild(renderCodeBlock(value, language));
    }
    codeLines = [];
    language = 'código';
  }

  function flushFileBlock() {
    const value = fileBlockLines.join('\n').trim();
    if (value) {
      const ext = fileBlockName.split('.').pop().toLowerCase();
      container.appendChild(renderCodeBlock(value, ext || fileBlockName));
    }
    fileBlockLines = [];
    fileBlockName = '';
    insideFileBlock = false;
  }

  // Detectar bloques patch completos antes del loop línea por línea
  const patchBlockRegex = /(?:Archivo:\s*(.+?)\n)?(?:[^\n]*\n)*?<<<<<<<[^\n]*\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>>[^\n]*/g;
  let patchMatch;
  let lastPatchIndex = 0;
  let hasPatch = false;
  const tempText = String(text || '');

  while ((patchMatch = patchBlockRegex.exec(tempText)) !== null) {
    hasPatch = true;
    const before = tempText.slice(lastPatchIndex, patchMatch.index).trim();
    if (before) container.appendChild(renderText(before));
    container.appendChild(renderPatchBlock(patchMatch[2], patchMatch[3], (patchMatch[1] || '').trim()));
    lastPatchIndex = patchMatch.index + patchMatch[0].length;
  }

  if (hasPatch) {
    const after = tempText.slice(lastPatchIndex).trim();
    if (after) container.appendChild(renderText(after));
    return;
  }

for (const line of lines) {
    const trimmed = line.trim();

    // Detectar inicio de bloque con backticks
    if (trimmed.startsWith('```')) {
      if (!insideCode) {
        if (insideFileBlock) flushFileBlock();
        flushText();
        insideCode = true;
        language = trimmed.replace(/```/g, '').trim() || 'código';
      } else {
        insideCode = false;
        flushCode();
      }
      continue;
    }

    if (insideCode) {
      codeLines.push(line);
      continue;
    }

    // Detectar "Archivo: nombre.ext" en texto plano
    const fileMatch = trimmed.match(/^Archivo:\s*(.+)$/);
    if (fileMatch) {
      flushText();
      if (insideFileBlock) flushFileBlock();
      insideFileBlock = true;
      fileBlockName = fileMatch[1].trim();
      continue;
    }

    if (insideFileBlock) {
      fileBlockLines.push(line);
    } else {
      normalText.push(line);
    }
  }

  if (insideCode) flushCode();
  if (insideFileBlock) flushFileBlock();
  flushText();
}

function renderText(text) {
  const container = document.createElement('div');
  container.className = 'normal-text';

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  parts.forEach(part => {
    if (part.match(urlRegex)) {
      const link = document.createElement('a');
      link.href = part;
      link.textContent = part;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      container.appendChild(link);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  });

  return container;
}

function renderCodeBlock(code, language) {
  const wrapper = document.createElement('div');
  wrapper.className = 'code-block';

  const header = document.createElement('div');
  header.className = 'code-header';

  const lang = document.createElement('span');
  lang.textContent = language.toUpperCase();

  const copyBtn = document.createElement('button');
  copyBtn.innerHTML = ICONS.copy;
  copyBtn.className = 'copy-btn';
  copyBtn.title = 'Copiar código';

  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(code);
      copyBtn.innerHTML = ICONS.check;
      setTimeout(() => { copyBtn.innerHTML = ICONS.copy; }, 1500);
    } catch (error) {
      console.error('No se pudo copiar el código:', error);
    }
  };

  header.appendChild(lang);
  header.appendChild(copyBtn);

  const pre = document.createElement('pre');
  const codeEl = document.createElement('code');

  codeEl.textContent = code;
  pre.appendChild(codeEl);

  wrapper.appendChild(header);
  wrapper.appendChild(pre);

  return wrapper;
}

function showApplyResult(btn, message, type) {
  btn.textContent = message;
  btn.className = type === 'ok'
    ? 'patch-apply-btn patch-apply-btn--ok'
    : 'patch-apply-btn patch-apply-btn--error';
  if (type === 'ok') return; // quedarse en estado ok
  setTimeout(() => {
    btn.className   = 'patch-apply-btn';
    btn.textContent = '⚡ Aplicar';
  }, 3000);
}

function renderPatchBlock(searchText, replaceText, filename) {
  const wrapper = document.createElement('div');
  wrapper.className = 'patch-block';

  const header = document.createElement('div');
  header.className = 'patch-header';

  const fileLabel = document.createElement('span');
  fileLabel.className = 'patch-filename';
  fileLabel.textContent = filename || 'cambio';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.innerHTML = ICONS.copy;
  copyBtn.title = 'Copiar patch';
  copyBtn.onclick = async () => {
    const patchText = `<<<<<<< SEARCH\n${searchText}\n=======\n${replaceText}\n>>>>>>> REPLACE`;
    try {
      await navigator.clipboard.writeText(patchText);
      copyBtn.innerHTML = ICONS.check;
      setTimeout(() => { copyBtn.innerHTML = ICONS.copy; }, 1500);
    } catch (e) { console.error('No se pudo copiar el patch:', e); }
  };

const applyBtn = document.createElement('button');
  applyBtn.className = 'patch-apply-btn';
  applyBtn.textContent = '⚡ Aplicar';
  applyBtn.title = 'Aplicar patch sobre el archivo real';
  applyBtn.dataset.filepath      = filename || '';
  applyBtn.dataset.searchContent  = searchText;
  applyBtn.dataset.replaceContent = replaceText;

  applyBtn.onclick = async () => {
    // Obtener projectId del estado activo
    const { getChatState } = await import('./chatState.js');
    const { projectId } = getChatState();

    if (!projectId || projectId === 'general') {
      showApplyResult(applyBtn, '✗ Solo disponible dentro de un proyecto', 'error');
      return;
    }
    if (!filename) {
      showApplyResult(applyBtn, '✗ Sin ruta de archivo', 'error');
      return;
    }

    // Confirmar antes de aplicar
    const ok = confirm(
      `¿Aplicar patch sobre:\n${filename}\n\nSe creará un backup automático antes de modificar el archivo.`
    );
    if (!ok) return;

    applyBtn.disabled = true;
    applyBtn.textContent = 'Aplicando...';

    try {
      const res  = await fetch(`/project/${projectId}/patch/apply`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          filepath:       filename,
          searchContent:  searchText,
          replaceContent: replaceText,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showApplyResult(applyBtn, '✓ Aplicado', 'ok');
        applyBtn.disabled = true;
      } else {
        showApplyResult(applyBtn, `✗ ${data.error}`, 'error');
        applyBtn.disabled = false;
        applyBtn.textContent = '⚡ Aplicar';
      }
    } catch (_) {
      showApplyResult(applyBtn, '✗ Error de conexión', 'error');
      applyBtn.disabled = false;
      applyBtn.textContent = '⚡ Aplicar';
    }
  };

  header.appendChild(fileLabel);
  header.appendChild(applyBtn);
  header.appendChild(copyBtn);
  wrapper.appendChild(header);

  const diffContainer = document.createElement('div');
  diffContainer.className = 'patch-diff';

  const removedLines = searchText.split('\n');
  const addedLines = replaceText.split('\n');

  removedLines.forEach(line => {
    const el = document.createElement('div');
    el.className = 'patch-line patch-line--removed';
    el.textContent = '- ' + line;
    diffContainer.appendChild(el);
  });

  const separator = document.createElement('div');
  separator.className = 'patch-separator';
  diffContainer.appendChild(separator);

  addedLines.forEach(line => {
    const el = document.createElement('div');
    el.className = 'patch-line patch-line--added';
    el.textContent = '+ ' + line;
    diffContainer.appendChild(el);
  });

  wrapper.appendChild(diffContainer);
  return wrapper;
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