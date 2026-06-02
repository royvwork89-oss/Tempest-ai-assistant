export const HARDWARE_PROFILE = 'laptop';
// laptop  = RTX 4050
// desktop = RTX 4070

export const APP_MODE = 'dev';

export const MODEL_PROFILES = {
  laptop: [
    { model: 'auto',                   label: '⚡ Automático' },
    { model: 'qwen2.5-3b-q4',          label: 'Qwen 3B Q4 - Rápido' },
    { model: 'qwen2.5-3b-q5',          label: 'Qwen 3B Q5 - Moderado' },
    { model: 'llama-3.2-3b-q8',        label: 'LLaMA 3B Q8 - Inteligente' },
    { model: 'qwen2.5-coder-3b-q8',    label: 'Qwen Coder 3B Q8 - Código' },
    { model: 'llava-1.6',              label: 'LLaVA 1.6 - Visión' },
  ],
  desktop: [
    { model: 'auto',                   label: '⚡ Automático' },
    { model: 'hermes-q4',              label: 'Hermes 8B Q4 - Rápido' },
    { model: 'hermes-q5',              label: 'Hermes 8B Q5 - Equilibrado' },
    { model: 'hermes-q6',              label: 'Hermes 8B Q6 - Preciso' },
    { model: 'llama-3.1-8b-q5',        label: 'LLaMA 3.1 8B Q5 - General' },
    { model: 'qwen2.5-7b-q5',          label: 'Qwen 2.5 7B Q5 - Razonamiento' },
    { model: 'gemma-2-9b-q4',          label: 'Gemma 2 9B Q4 - Análisis' },
    { model: 'deepseek-coder-6.7b-q6', label: 'DeepSeek Coder 6.7B - Código rápido' },
    { model: 'qwen-coder-14b-q4',      label: 'Qwen Coder 14B - Código complejo' },
  ]
};

// resolveAutoModel eliminado — la decisión la toma el backend (model.router)

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

export function updateMenuTriggerLabel(menuTrigger, primaryModel, assistantsState, autoResolvedModel = null) {
  let label;
  if (primaryModel === 'auto') {
    const base = APP_MODE === 'dev' ? 'Automático local' : 'Automático';
    label = autoResolvedModel
      ? `modelo: ${base} · ${getLabel(autoResolvedModel)}`
      : `modo: ${base}`;
  } else {
    label = `modelo: ${getLabel(primaryModel)}`;
  }

  const activeServices = [];
  if (assistantsState.openai.enabled) activeServices.push('OpenAI');
  if (assistantsState.google.enabled) activeServices.push('Google');
  if (activeServices.length > 0) label += ' + ' + activeServices.join(' + ');

  menuTrigger.textContent = label;
}