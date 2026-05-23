import { renderMixedContent, renderMessageActions } from './messageRenderer.js';

const VISUAL_STOP_TOKENS = /<\|im_end\|>|<\|end_of_text\|>|<\|begin_of_text\|>|<\|eot_id\|>|<\|im_start\|>/g;

const VISUAL_INSTRUCTION_PATTERNS = [
  /Responde SOLO con texto explicativo,?\s*sin bloques de código\.?\s*/gi,
  /Explica brevemente en texto y luego entrega el código organizado por archivos\.?\s*/gi,
  /Analiza los archivos adjuntos\.?\s*/gi,
  /^---\s*\n?MODO:\s*PATCH\s*\n?---?\s*/gim,
  /^MODO:\s*PATCH\s*[\n\r]/gim,
  /^FUNCIÓN:\s*\n/gim
];

function stripLeakedInstructions(text) {
  let result = text;
  for (const pattern of VISUAL_INSTRUCTION_PATTERNS) {
    const checkFrom = Math.max(0, result.length - Math.max(300, Math.floor(result.length * 0.2)));
    const tail = result.slice(checkFrom);
    const cleaned = tail.replace(pattern, '').trimEnd();
    if (cleaned !== tail) {
      result = result.slice(0, checkFrom) + cleaned;
    }
  }
  return result.trim();
}

export function createStreamingBubble(chatBox) {
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
  const withoutStopTokens = fullText.replace(VISUAL_STOP_TOKENS, '').trim();
  const withoutWrappedPatch = withoutStopTokens.replace(
    /```[a-z]*\s*\n([\s\S]*?<<<<<<< SEARCH[\s\S]*?>>>>>>> REPLACE[\s\S]*?)\n```/g,
    '$1'
  );
  const cleanText = stripLeakedInstructions(withoutWrappedPatch);
  bubble.removeChild(rawEl);

  const content = document.createElement('div');
  content.className = 'message-content';
  renderMixedContent(content, cleanText);

  const actions = renderMessageActions('Tempest', cleanText);

  bubble.appendChild(content);
  bubble.appendChild(actions);
}