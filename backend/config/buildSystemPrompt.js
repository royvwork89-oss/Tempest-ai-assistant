const { loadGlobalPrompt }   = require('./prompts/loaders/global.loader');
const { loadModePrompt }     = require('./prompts/loaders/mode.loader');
const { loadProjectPrompt }  = require('./prompts/loaders/project.loader');
const { buildPrompt }        = require('./prompts/loaders/prompt.builder');
const { getProjectContext }  = require('../services/context/context.service');

async function buildSystemPrompt({ fullMemory = {}, mode = 'general', variant = null, userId, projectId, userMessage = '', skipContextFiles = false, dynamicMaxChars = null }) {
  const profile       = fullMemory.profile       || {};
  const projectMemory = fullMemory.projectMemory || {};

  console.log('[buildSystemPrompt] START mode:', mode, 'projectId:', projectId);
  const globalPrompt  = loadGlobalPrompt();
  console.log('[buildSystemPrompt] global OK');
  const projectPrompt = loadProjectPrompt(userId, projectId);
  console.log('[buildSystemPrompt] project OK');
  const modePrompt    = loadModePrompt(mode, variant);
  console.log('[buildSystemPrompt] mode OK');
  const memoryBlock = (mode === 'coder' && variant === 'patch')
    ? ''
    : buildMemoryBlock(profile, projectMemory);
  console.log('[buildSystemPrompt] memory OK');
  const contextBlock = skipContextFiles
    ? ''
    : await getProjectContext({ projectId, userMessage, userId, dynamicMaxChars });
  console.log('[buildSystemPrompt] context OK' + (skipContextFiles ? ' [SKIPPED — patch mode]' : ''));

  console.log('[buildSystemPrompt] global:', globalPrompt.slice(0, 50));
  console.log('[buildSystemPrompt] mode:', mode, '| modePrompt:', modePrompt.slice(0, 50));
  console.log('[buildSystemPrompt] project:', projectPrompt ? 'SÍ' : 'vacío');
  console.log('[buildSystemPrompt] contextFiles:', contextBlock ? `${contextBlock.length} chars` : 'vacío');

  return buildPrompt({ globalPrompt, projectPrompt, modePrompt, memoryBlock, contextBlock });
}

function buildMemoryBlock(profile, projectMemory) {
  const hasProfile = Object.keys(profile).length > 0;
  const hasProject = Object.keys(projectMemory).length > 0;

  if (!hasProfile && !hasProject) return '';

  const lines = ['CONTEXTO DE MEMORIA (solo para consultas explícitas):'];

  if (hasProfile) {
    lines.push(`\nPERFIL DEL USUARIO:\n${JSON.stringify(profile, null, 2)}`);
  }

  if (hasProject) {
    lines.push(`\nMEMORIA DEL PROYECTO:\n${JSON.stringify(projectMemory, null, 2)}`);
  }

  return lines.join('\n');
}

module.exports = { buildSystemPrompt };