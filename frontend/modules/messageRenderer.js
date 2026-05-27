import { renderCodeBlock } from './codeRenderer.js';
import { renderPatchBlock } from './patchRenderer.js';

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

  const patchBlockRegex = /(?:Archivo:\s*(.+?)\n)?(?:[^\n]*\n)*?<<<<<<<[^\n]*\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>>[^\n]*/g;
  const patchLabelRegex = /(?:Archivo:\s*(.+?)\n)?SEARCH:\s*\r?\n(?:CÓDIGO\s*\r?\n)?```[^\n]*\r?\n([\s\S]*?)```[\s\S]*?REPLACE:\s*\r?\n(?:CÓDIGO\s*\r?\n)?```[^\n]*\r?\n([\s\S]*?)```/g;
  let patchMatch;
  let lastPatchIndex = 0;
  let hasPatch = false;
  const tempText = String(text || '');

  const groundingFilepath = container.dataset?.groundingFilepath || '';

  while ((patchMatch = patchBlockRegex.exec(tempText)) !== null) {
    hasPatch = true;
    const before = tempText.slice(lastPatchIndex, patchMatch.index).trim();
    if (before) container.appendChild(renderText(before));
    const filepath = (patchMatch[1] || '').trim() || groundingFilepath;
    container.appendChild(renderPatchBlock(patchMatch[2], patchMatch[3], filepath));
    lastPatchIndex = patchMatch.index + patchMatch[0].length;
  }

  if (!hasPatch) {
    // Recuperar filepath del grounding inyectado por buildPatchGrounding (guardado en dataset antes de limpiar)
    const groundingFilepath = container.dataset?.groundingFilepath || '';

    patchLabelRegex.lastIndex = 0;
    while ((patchMatch = patchLabelRegex.exec(tempText)) !== null) {
      hasPatch = true;
      const before = tempText.slice(lastPatchIndex, patchMatch.index).trim();
      if (before) container.appendChild(renderText(before));
      const filepath = (patchMatch[1] || '').trim() || groundingFilepath;
      container.appendChild(renderPatchBlock(patchMatch[2].trim(), patchMatch[3].trim(), filepath));
      lastPatchIndex = patchMatch.index + patchMatch[0].length;
    }
  }

  if (hasPatch) {
    // Todo lo que viene después del primer bloque patch es ruido del modelo — se ignora
    return;
  }

  for (const line of lines) {
    const trimmed = line.trim();

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

    if (insideCode) { codeLines.push(line); continue; }

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