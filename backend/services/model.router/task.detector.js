// Analiza los inputs del request y determina el perfil de tarea.
// NO sabe qué modelos existen — solo clasifica la tarea.
//
// Perfiles de tarea posibles:
//   general       → conversación, preguntas generales
//   explain       → explicaciones, análisis, comparaciones
//   coder-fast    → código simple: funciones, snippets, correcciones
//   coder-heavy   → código complejo: arquitectura, múltiples archivos, refactor

'use strict';

// Triggers que indican código complejo / arquitectura
const HEAVY_CODE_TRIGGERS = /arquitectura|refactor|rediseña|diseña|scaffold|migra|patrones?|system design|estructura del proyecto|múltiples archivos|varios archivos|genera.{0,20}archivos/i;

// Triggers que indican código simple
const LIGHT_CODE_TRIGGERS = /función|funciones|método|métodos|snippet|implementa|endpoint|componente|clase|interface|helper|utilidad|script/i;

// Triggers que indican explicación / análisis
const EXPLAIN_TRIGGERS = /explica|explicame|qué es|cómo funciona|por qué|diferencia|compara|ventajas|desventajas|analiza|describe|resumen|resume|qué significa/i;

// Umbral de contexto pesado: más de 20,000 chars totales
const HEAVY_CONTEXT_THRESHOLD = 20000;

/**
 * Detecta el perfil de tarea basándose en los inputs del request.
 *
 * @param {Object} params
 * @param {string} params.rawMessage      - Mensaje limpio del usuario
 * @param {string} params.mode            - Modo detectado por mode.router.js
 * @param {Array}  params.files           - Archivos adjuntos del request
 * @param {number} [params.contextSize]   - Tamaño total del contexto en chars (context files del proyecto)
 * @returns {{ profile: string, isHeavyContext: boolean, reason: string }}
 */
function detect({ rawMessage = '', mode = 'general', files = [], contextSize = 0 }) {
  const msg = rawMessage.trim();

  // Calcular tamaño total de inputs para detectar contexto pesado
  const totalSize = msg.length + contextSize + files.reduce((acc, f) => acc + (f.size || 0), 0);
  const isHeavyContext = totalSize > HEAVY_CONTEXT_THRESHOLD;

  // --- Clasificación por modo + mensaje ---

  // Modo coder: determinar si es heavy o fast
  if (mode === 'coder/patch') {
    return {
      profile: 'coder-patch',
      isHeavyContext,
      reason: 'modo patch — modelo especializado',
    };
  }

  if (mode === 'coder/strict' || mode === 'coder/hybrid' || mode === 'coder') {
    if (isHeavyContext || HEAVY_CODE_TRIGGERS.test(msg)) {
      return {
        profile: 'coder-heavy',
        isHeavyContext,
        reason: isHeavyContext
          ? 'modo coder con contexto pesado'
          : 'modo coder con triggers de arquitectura/refactor',
      };
    }
    return {
      profile: 'coder-fast',
      isHeavyContext,
      reason: 'modo coder sin indicadores de complejidad alta',
    };
  }

  // Modo explain: siempre explain-deep
  if (mode === 'explain') {
    return {
      profile: 'explain',
      isHeavyContext,
      reason: 'modo explain detectado por mode.router',
    };
  }

  // Modo general: analizar el mensaje para afinar
  if (HEAVY_CODE_TRIGGERS.test(msg)) {
    return {
      profile: 'coder-heavy',
      isHeavyContext,
      reason: 'mensaje general con triggers de código complejo',
    };
  }

  if (LIGHT_CODE_TRIGGERS.test(msg)) {
    return {
      profile: 'coder-fast',
      isHeavyContext,
      reason: 'mensaje general con triggers de código simple',
    };
  }

  if (EXPLAIN_TRIGGERS.test(msg)) {
    return {
      profile: 'explain',
      isHeavyContext,
      reason: 'mensaje general con triggers de explicación/análisis',
    };
  }

  // Default: conversación general
  return {
    profile: 'general',
    isHeavyContext,
    reason: 'sin triggers específicos — conversación general',
  };
}

module.exports = { detect };