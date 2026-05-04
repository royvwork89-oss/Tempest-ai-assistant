export const HARDWARE_PROFILE = 'laptop';
// laptop  = RTX 4050
// desktop = RTX 4070

export const APP_MODE = 'dev';

export const MODEL_PROFILES = {
  laptop: [
    { model: 'qwen2.5-3b-q4',  label: 'Qwen 2.5 3B Q4 - Rápido' },
    { model: 'qwen2.5-3b-q5',  label: 'Qwen 2.5 3B Q5 - Equilibrado' },
    { model: 'llama-3.2-3b-q4', label: 'LLaMA 3.2 3B Q4 - Inteligente' },
    { model: 'auto',            label: 'Automático' }
  ],
  desktop: [
    { model: 'hermes-q4',      label: 'Hermes 8B Q4 - Rápido' },
    { model: 'hermes-q5',      label: 'Hermes 8B Q5 - Equilibrado' },
    { model: 'hermes-q6',      label: 'Hermes 8B Q6 - Inteligente' },
    { model: 'qwen2.5-3b-q5',  label: 'Qwen 2.5 3B Q5 - Generador rápido' },
    { model: 'auto',           label: 'Automático' }
  ]
};

export function resolveAutoModel(message) {
  const text = message.toLowerCase();

  const isComplex =
    text.includes('código') || text.includes('codigo') ||
    text.includes('express') || text.includes('mysql') ||
    text.includes('backend') || text.includes('arquitectura') ||
    text.includes('paso a paso') || text.includes('explica') ||
    text.length > 180;

  const isMedium =
    text.length > 80 || text.includes('ejemplo') ||
    text.includes('comparar') || text.includes('recomienda') ||
    text.includes('cómo') || text.includes('como');

  const profiles = MODEL_PROFILES[HARDWARE_PROFILE];
  if (isComplex) return profiles[2].model;
  if (isMedium)  return profiles[1].model;
  return profiles[0].model;
}

export function getLabel(model) {
  const localModels = MODEL_PROFILES[HARDWARE_PROFILE] || [];
  const localMatch = localModels.find(item => item.model === model);
  if (localMatch) return localMatch.label;

  const labels = {
    'gpt-4o-mini':      'GPT-4o-mini',
    'gpt-4.1-mini':     'GPT-4.1-mini',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-pro':   'Gemini 2.5 Pro'
  };
  return labels[model] || model;
}

export function renderLocalModels(menuViewLocal, onSelect) {
  menuViewLocal.innerHTML = '';

  const backButton = document.createElement('button');
  backButton.className = 'menu-back';
  backButton.dataset.back = 'root';
  backButton.textContent = '← volver';
  backButton.addEventListener('click', () => onSelect('back'));
  menuViewLocal.appendChild(backButton);

  MODEL_PROFILES[HARDWARE_PROFILE].forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'menu-item local-model';
    btn.dataset.model = item.model;
    btn.textContent = item.label;
    btn.addEventListener('click', () => onSelect(item.model));
    menuViewLocal.appendChild(btn);
  });
}

export function refreshLocalActiveState(menuViewLocal, primaryModel) {
  menuViewLocal.querySelectorAll('.local-model').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.model === primaryModel);
  });
}

export function updateMenuTriggerLabel(menuTrigger, primaryModel, assistantsState) {
  let label = primaryModel === 'auto'
    ? (APP_MODE === 'dev' ? 'modo: Automático local' : 'modo: Automático')
    : `modelo: ${getLabel(primaryModel)}`;

  const activeServices = [];
  if (assistantsState.openai.enabled) activeServices.push('OpenAI');
  if (assistantsState.google.enabled) activeServices.push('Google');
  if (activeServices.length > 0) label += ' + ' + activeServices.join(' + ');

  menuTrigger.textContent = label;
}