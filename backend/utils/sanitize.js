/**
 * sanitize.js — Capa de post-procesado de salidas del modelo
 */

const STOP_TOKEN_REGEX = /<\|im_end\|>|<\|end_of_text\|>|<\|begin_of_text\|>|<\|eot_id\|>|<\|im_start\|>/g;

const INTERNAL_INSTRUCTION_PATTERNS = [
  /Responde SOLO con texto explicativo,?\s*sin bloques de código\.?\s*/gi,
  /Explica brevemente en texto y luego entrega el código organizado por archivos\.?\s*/gi,
  /Analiza los archivos adjuntos\.?\s*/gi,
  /^---\s*\n?MODO:\s*PATCH\s*\n?---?\s*/gim,
  /^MODO:\s*PATCH\s*[\n\r]/gim,
  /^FUNCIÓN:\s*\n/gim
];

const MODEL_NOISE_REGEX = [
  /^[:\s\/\\]+/,
  /^assistant\s*/i,
  /(:\/\/\s*)+$/,
  /(\s*&nbsp;\s*){3,}$/,
  /(\t\/\/[^\n]*)+$/
];

function stripTrailingInstructions(text) {
  let result = text;
  for (const pattern of INTERNAL_INSTRUCTION_PATTERNS) {
    const checkFrom = Math.max(0, result.length - Math.max(300, Math.floor(result.length * 0.2)));
    const tail = result.slice(checkFrom);
    const cleaned = tail.replace(pattern, '').trimEnd();
    if (cleaned !== tail) {
      result = result.slice(0, checkFrom) + cleaned;
    }
  }
  return result;
}

function stripRepetitionLoop(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 4) return text;

  let count = 1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === lines[i - 1]) {
      count++;
      if (count > 3) {
        const cutIndex = text.indexOf(lines[i - 1]);
        const secondIndex = text.indexOf(lines[i - 1], cutIndex + lines[i - 1].length);
        if (secondIndex !== -1) {
          return text.slice(0, secondIndex).trim();
        }
      }
    } else {
      count = 1;
    }
  }
  return text;
}

function sanitizeModelOutput(text, options = {}) {
  const {
    stripStopTokens = true,
    stripInternalInstructions = true,
    stripModelNoise = true,
    normalizeWhitespace = true
  } = options;

  let result = String(text || '');

  if (stripStopTokens) {
    result = result.replace(STOP_TOKEN_REGEX, '');
  }

  if (stripModelNoise) {
    for (const pattern of MODEL_NOISE_REGEX) {
      result = result.replace(pattern, '');
    }
  }

  if (stripInternalInstructions) {
    result = stripTrailingInstructions(result);
  }

  result = stripRepetitionLoop(result);

  // Limpiar texto después del último >>>>>>> REPLACE
  if (result.includes('>>>>>>> REPLACE')) {
    const lastReplace = result.lastIndexOf('>>>>>>> REPLACE');
    result = result.slice(0, lastReplace + '>>>>>>> REPLACE'.length).trim();
  }

  if (normalizeWhitespace) {
    result = result.trim();
  }

  return result;
}

module.exports = { sanitizeModelOutput };