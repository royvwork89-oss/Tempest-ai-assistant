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

function renderMessageActions(sender, text) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copiar';
  copyBtn.className = 'message-action-btn';

  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(String(text || ''));

      copyBtn.textContent = 'Copiado ✓';

      setTimeout(() => {
        copyBtn.textContent = 'Copiar';
      }, 1500);
    } catch (error) {
      copyBtn.textContent = 'Error';
      console.error('No se pudo copiar el mensaje:', error);
    }
  };

  actions.appendChild(copyBtn);

  if (sender === 'Tú') {
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Editar';
    editBtn.className = 'message-action-btn disabled-action';
    editBtn.disabled = true;

    actions.appendChild(editBtn);
  } else {
    const shareBtn = document.createElement('button');
    shareBtn.textContent = 'Compartir';
    shareBtn.className = 'message-action-btn disabled-action';
    shareBtn.disabled = true;

    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Intentarlo nuevamente';
    retryBtn.className = 'message-action-btn disabled-action';
    retryBtn.disabled = true;

    actions.appendChild(shareBtn);
    actions.appendChild(retryBtn);
  }

  return actions;
}

function renderMixedContent(container, text) {
  const lines = String(text || '').split('\n');

  let normalText = [];
  let codeLines = [];
  let insideCode = false;
  let language = 'código';

  function flushText() {
    const value = normalText.join('\n').trim();
    if (value) {
      container.appendChild(renderText(value));
    }
    normalText = [];
  }

  function flushCode() {
    const value = codeLines.join('\n').trim();
    if (value) {
      container.appendChild(renderCodeBlock(value, language));
    }
    codeLines = [];
    language = 'código';
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (!insideCode) {
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
    } else {
      normalText.push(line);
    }
  }

  flushText();

  if (insideCode) {
    flushCode();
  }
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
  copyBtn.textContent = 'Copiar';
  copyBtn.className = 'copy-btn';

  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(code);

      copyBtn.textContent = 'Copiado ✓';

      setTimeout(() => {
        copyBtn.textContent = 'Copiar';
      }, 1500);
    } catch (error) {
      copyBtn.textContent = 'Error';
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