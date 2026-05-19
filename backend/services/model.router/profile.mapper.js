// Cruza el perfil de tarea + perfil de velocidad/calidad → alias lógico.
// NO sabe qué modelos existen — solo devuelve alias.
//
// Perfiles de velocidad/calidad:
//   rapido      → prioriza velocidad, menor calidad
//   balanceado  → equilibrio (default)
//   calidad     → prioriza calidad, puede ser más lento
//
// Perfiles de tarea (vienen de task.detector.js):
//   general
//   explain
//   coder-fast
//   coder-heavy

'use strict';

// Matriz de decisión: autoProfile → taskProfile → alias lógico
const PROFILE_MAP = {
  rapido: {
    'general':      'general-fast',
    'explain':      'general-fast',
    'coder-fast':   'coder-fast',
    'coder-heavy':  'coder-fast',
    'coder-patch':  'coder-patch',
  },
  balanceado: {
    'general':      'general-standard',
    'explain':      'explain-deep',
    'coder-fast':   'coder-fast',
    'coder-heavy':  'coder-heavy',
    'coder-patch':  'coder-patch',
  },
  calidad: {
    'general':      'general-standard',
    'explain':      'explain-deep',
    'coder-fast':   'coder-heavy',
    'coder-heavy':  'coder-heavy',
    'coder-patch':  'coder-patch',
  },
};

/**
 * Devuelve el alias lógico según el perfil de tarea y el perfil de velocidad/calidad.
 * Si el contexto es muy pesado, fuerza alias de mayor capacidad independientemente del perfil.
 *
 * @param {Object} params
 * @param {string} params.taskProfile    - Perfil de tarea detectado por task.detector.js
 * @param {string} params.autoProfile    - Perfil de velocidad/calidad ('rapido'|'balanceado'|'calidad')
 * @param {boolean} params.isHeavyContext - Si el contexto total supera el umbral
 * @returns {{ alias: string, reason: string }}
 */
function map({ taskProfile, autoProfile = 'balanceado', isHeavyContext = false }) {
  // Si el contexto es muy pesado, forzar modelos con mayor ventana de contexto
  // independientemente del perfil seleccionado
  if (isHeavyContext && (taskProfile === 'coder-fast' || taskProfile === 'general')) {
    return {
      alias: taskProfile === 'coder-fast' ? 'coder-heavy' : 'general-standard',
      reason: `contexto pesado forzó upgrade de alias: ${taskProfile} → ${taskProfile === 'coder-fast' ? 'coder-heavy' : 'general-standard'}`,
    };
  }

  const profileRow = PROFILE_MAP[autoProfile] ?? PROFILE_MAP.balanceado;
  const alias = profileRow[taskProfile] ?? 'general-standard';

  return {
    alias,
    reason: `perfil="${autoProfile}" + tarea="${taskProfile}" → alias="${alias}"`,
  };
}

module.exports = { map, PROFILE_MAP };