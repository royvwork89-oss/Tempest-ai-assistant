// Registro central de modelos disponibles por hardware.
// Mapea alias lógicos → modelo real de LocalAI.
//
// REGLA: nunca usar nombres de modelos directamente fuera de este archivo.
// Si cambia un modelo, solo se toca aquí.
//
// Alias lógicos disponibles:
//   general-fast       → conversación rápida, respuestas cortas
//   general-standard   → conversación de calidad, razonamiento general
//   explain-deep       → explicaciones detalladas, análisis
//   coder-fast         → código simple, funciones, snippets
//   coder-heavy        → código complejo, arquitectura, múltiples archivos
//   coder-patch        → diff/patch quirúrgico, DeepSeek especializado
//   visual             → análisis de imagen, modelo multimodal (LLaVA)
//   fallback           → modelo de emergencia si todo falla

'use strict';

const MATRIX = {
  desktop: {
    'general-fast':     { modelId: 'hermes-q4',              provider: 'localai' },
    'general-standard': { modelId: 'qwen2.5-7b-q5',          provider: 'localai' },
    'explain-deep':     { modelId: 'gemma-2-9b-q4',          provider: 'localai' },
    'coder-fast':       { modelId: 'hermes-q4',              provider: 'localai' },
    'coder-patch':      { modelId: 'deepseek-coder-6.7b-q6', provider: 'localai' },
    'coder-heavy':      { modelId: 'hermes-q5',              provider: 'localai' },
    'visual':           { modelId: 'qwen2.5-vl-7b-q4',       provider: 'localai' },
    'fallback':         { modelId: 'hermes-q5',              provider: 'localai' },
  },
  laptop: {
    'general-fast':     { modelId: 'qwen2.5-3b-q4', provider: 'localai' },
    'general-standard': { modelId: 'qwen2.5-3b-q5', provider: 'localai' },
    'explain-deep':     { modelId: 'qwen2.5-3b-q5', provider: 'localai' },
    'coder-fast':       { modelId: 'qwen2.5-coder-3b-q8', provider: 'localai' },
    'coder-heavy':      { modelId: 'qwen2.5-coder-3b-q8', provider: 'localai' },
    'coder-patch':      { modelId: 'qwen2.5-coder-3b-q8', provider: 'localai' },
    'visual':           { modelId: 'llava-1.6',      provider: 'localai' },
    'fallback':         { modelId: 'qwen2.5-3b-q4', provider: 'localai' },
  },
};

/**
 * Resuelve un alias lógico al modelo real según el hardware.
 * Si el alias no existe en la matrix, usa el fallback del hardware.
 *
 * @param {string} alias        - Alias lógico (ej. 'coder-heavy')
 * @param {string} hardware     - Perfil de hardware ('desktop' | 'laptop')
 * @param {string[]} exclude    - ModelIds a excluir (usados por fallback manager)
 * @returns {{ modelId: string, provider: string, alias: string }}
 */
function resolve(alias, hardware = 'desktop', exclude = []) {
  const pool = MATRIX[hardware] ?? MATRIX.desktop;

  // Intentar con el alias solicitado
  const target = pool[alias];
  if (target && !exclude.includes(target.modelId)) {
    return { ...target, alias };
  }

  // Si el alias está excluido o no existe, usar fallback del hardware
  const fb = pool['fallback'];
  if (fb && !exclude.includes(fb.modelId)) {
    return { ...fb, alias: 'fallback' };
  }

  // Último recurso: primer modelo disponible que no esté excluido
  for (const [key, entry] of Object.entries(pool)) {
    if (!exclude.includes(entry.modelId)) {
      return { ...entry, alias: key };
    }
  }

  // No hay ningún modelo disponible (situación crítica)
  throw new Error(`[capability.matrix] No hay modelos disponibles para hardware="${hardware}" con exclude=[${exclude.join(', ')}]`);
}

/**
 * Devuelve todos los modelIds disponibles para un hardware.
 * Útil para validar overrides manuales del frontend.
 *
 * @param {string} hardware
 * @returns {string[]}
 */
function getAvailableModelIds(hardware = 'desktop') {
  const pool = MATRIX[hardware] ?? MATRIX.desktop;
  return [...new Set(Object.values(pool).map(e => e.modelId))];
}

module.exports = { resolve, getAvailableModelIds, MATRIX };