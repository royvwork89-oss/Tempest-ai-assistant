'use strict';

const { detect }             = require('./task.detector');
const { map }                = require('./profile.mapper');
const { resolve }            = require('./capability.matrix');
const { getAbsoluteFallback} = require('./fallback.manager');

/**
 * Punto de entrada del router inteligente de modelos.
 * Orquesta task.detector → profile.mapper → capability.matrix.
 *
 * @param {Object} params
 * @param {string}   params.rawMessage     - Mensaje limpio del usuario
 * @param {string}   params.mode           - Modo detectado por mode.router.js
 * @param {Array}    params.files          - Archivos adjuntos del request
 * @param {number}   params.contextSize    - Tamaño total de context files del proyecto en chars
 * @param {string}   params.autoProfile    - Perfil de velocidad/calidad ('rapido'|'balanceado'|'calidad')
 * @param {string}   params.hardware       - Perfil de hardware ('desktop'|'laptop')
 * @param {string[]} params.excludeModels  - ModelIds a excluir (usado en reintento por fallback)
 * @returns {{ model: string, provider: string, reason: string, confidence: string }}
 */
function detectBestModel({
  rawMessage    = '',
  mode          = 'general',
  variant       = null,
  files         = [],
  contextSize   = 0,
  autoProfile   = 'balanceado',
  hardware      = 'desktop',
  excludeModels = [],
}) {
  try {
    // 1. Detectar perfil de tarea — combinar mode + variant para patch
    const effectiveMode = (mode === 'coder' && variant === 'patch')
      ? 'coder/patch'
      : mode;
    console.log(`[MODEL ROUTER DEBUG] effectiveMode=${effectiveMode} mode=${mode} variant=${variant}`);
    const task = detect({ rawMessage, mode: effectiveMode, files, contextSize });

    // 2. Mapear tarea + autoProfile → alias lógico
    const { alias, reason: mapReason } = map({
      taskProfile:    task.profile,
      autoProfile,
      isHeavyContext: task.isHeavyContext,
    });

    // 3. Resolver alias → modelo real según hardware
    const resolved = resolve(alias, hardware, excludeModels);

    const reason = [task.reason, mapReason].join(' | ');

    _log({ mode, hardware, autoProfile, task, alias, resolved, reason });

    return {
      model:      resolved.modelId,
      provider:   resolved.provider,
      reason,
      confidence: task.isHeavyContext ? 'HIGH' : 'MEDIUM',
    };

  } catch (err) {
    console.error('[MODEL ROUTER] Error crítico — usando fallback absoluto:', err.message);
    return getAbsoluteFallback(hardware);
  }
}

/**
 * Log estructurado de la decisión del router.
 * Se imprime en cada request con model='auto'.
 */
function _log({ mode, hardware, autoProfile, task, alias, resolved, reason }) {
  console.log('\n[MODEL ROUTER] ─────────────────────────────');
  console.log(`  hardware    : ${hardware}`);
  console.log(`  autoProfile : ${autoProfile}`);
  console.log(`  mode        : ${mode}`);
  console.log(`  taskProfile : ${task.profile}${task.isHeavyContext ? ' (heavy context)' : ''}`);
  console.log(`  alias       : ${alias}`);
  console.log(`  → model     : ${resolved.modelId} (${resolved.provider})`);
  console.log(`  reason      : ${reason}`);
  console.log('[MODEL ROUTER] ─────────────────────────────\n');
}

module.exports = { detectBestModel };