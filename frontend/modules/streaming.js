import { renderMixedContent, renderMessageActions } from './messageRenderer.js';
import { handleDebugEvent } from './devPanel.js';

const VISUAL_STOP_TOKENS = /<\|im_end\|>|<\|end_of_text\|>|<\|begin_of_text\|>|<\|eot_id\|>|<\|im_start\|>/g;

const VISUAL_INSTRUCTION_PATTERNS = [
  /Responde SOLO con texto explicativo,?\s*sin bloques de código\.?\s*/gi,
  /Explica brevemente en texto y luego entrega el código organizado por archivos\.?\s*/gi,
  /Analiza los archivos adjuntos\.?\s*/gi,
  /^---\s*\n?MODO:\s*PATCH\s*\n?---?\s*/gim,
  /^MODO:\s*PATCH\s*[\n\r]/gim,
  /^FUNCIÓN:\s*\n/gim,
  /Eres un experto en[\s\S]*?MODO PATCH\.[\s\S]*?>>>>>>> REPLACE\s*/gi,
  /MODO PATCH\.\s*Tu (única )?tarea[\s\S]*/gi,
  /<<<FILE_BEGIN:[\s\S]*?FILE_END>>>\s*REGLA:[^\n]*/gi,
  /### CONTENIDO ACTUAL DEL ARCHIVO ###[\s\S]*?### FIN DEL ARCHIVO ###\s*INSTRUCCION:[^\n]*/gi
];

function stripLeakedInstructions(text) {
  let result = text;
  for (const pattern of VISUAL_INSTRUCTION_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result.trim();
}

export function createStreamingBubble(chatBox) {
  chatBox.dataset.streaming = 'true';
  const row = document.createElement('div');
  row.className = 'message-row bot';

  const bubble = document.createElement('div');
  bubble.className = 'message bot';

  const label = document.createElement('div');
  label.className = 'message-label';
  label.textContent = 'Tempest';

  const rawEl = document.createElement('pre');
  rawEl.className = 'streaming-raw';
  rawEl.style.cssText = [
    'white-space: pre-wrap',
    'word-break: break-word',
    'font-family: inherit',
    'margin: 0',
    'min-height: 1.2em'
  ].join(';');

  bubble.appendChild(label);
  bubble.appendChild(rawEl);
  row.appendChild(bubble);
  chatBox.appendChild(row);

  chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });

  return { row, bubble, rawEl };
}

export function finalizeStreamingBubble(bubble, rawEl, fullText) {
  bubble.closest('#chatBox')?.removeAttribute('data-streaming');
  const withoutStopTokens = fullText.replace(VISUAL_STOP_TOKENS, '').trim();
  const withoutWrappedPatch = withoutStopTokens.replace(
    /```[a-z]*\s*\n([\s\S]*?<<<<<<< SEARCH[\s\S]*?>>>>>>> REPLACE[\s\S]*?)\n```/g,
    '$1'
  );

  // Extraer filepath de la línea "Archivo:" antes de que stripLeakedInstructions la elimine
  const archivoMatch = /^Archivo:\s*(.+?)$/m.exec(withoutWrappedPatch);
  const groundingFilepath = archivoMatch ? archivoMatch[1].trim() : '';

  const cleanText = stripLeakedInstructions(withoutWrappedPatch);
  bubble.removeChild(rawEl);

  const content = document.createElement('div');
  content.className = 'message-content';
  if (groundingFilepath) content.dataset.groundingFilepath = groundingFilepath;
  renderMixedContent(content, cleanText);

  const actions = renderMessageActions('Tempest', cleanText);

  bubble.appendChild(content);
  bubble.appendChild(actions);
}