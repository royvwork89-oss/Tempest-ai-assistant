/**
 * Ensambla las capas del system prompt.
 * No lee disco, no valida rutas — solo une piezas.
 *
 * @param {Object} params
 * @param {string} params.globalPrompt
 * @param {string} params.projectPrompt
 * @param {string} params.modePrompt
 * @param {string} params.memoryBlock   — perfil + memoria del proyecto
 * @returns {string}
 */
function buildPrompt({ globalPrompt, projectPrompt, modePrompt, memoryBlock, contextBlock }) {
  const layers = [globalPrompt];

  if (projectPrompt) layers.push(projectPrompt);
  if (modePrompt)    layers.push(modePrompt);
  if (memoryBlock)   layers.push(memoryBlock);
  if (contextBlock)  layers.push(contextBlock);

  return layers
    .map(layer => layer.trim())
    .filter(Boolean)
    .join('\n\n');
}

module.exports = { buildPrompt };