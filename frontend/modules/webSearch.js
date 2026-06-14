// frontend/modules/webSearch.js
import { fetchWithAuth } from './login.js';

let _active           = false;
let _provider         = null;
let _enabledProviders = [];
let _button           = null;
let _panel            = null;

const LABELS = {
  searxng: 'SearXNG',
  brave:   'Brave',
  tavily:  'Tavily (IA)'
};

export async function initWebSearch() {
  try {
    const res  = await fetchWithAuth('/search/config');
    const data = await res.json();

    _enabledProviders = data.enabledProviders ||
      ((() => {
        const globalEnabled = data.globalEnabled ?? data.config?.globalEnabled;
        if (!globalEnabled) return [];
        return Object.entries(data.config?.providers || {})
          .filter(([, v]) => v.enabled)
          .map(([k]) => k);
      })());

    if (_enabledProviders.length === 0) {
      document.getElementById('webSearchBtn')?.remove();
      document.getElementById('webSearchPanel')?.remove();
      _active = false;
      _button = null;
      _panel  = null;
      return;
    }

    const saved = localStorage.getItem('tempest_search_provider');
    _provider = (saved && _enabledProviders.includes(saved))
      ? saved
      : _enabledProviders[0];

    _renderButton();
  } catch (e) {
    console.warn('[webSearch] No se pudo inicializar:', e.message);
  }
}

function _renderButton() {
  const toolbar = document.querySelector('.input-toolbar');
  if (!toolbar) return;

  document.getElementById('webSearchWrapper')?.remove();
  document.getElementById('webSearchBtn')?.remove();

  _button = document.createElement('button');
  _button.id        = 'webSearchBtn';
  _button.className = 'web-search-btn';
  _button.title     = 'Activar búsqueda web';
  _button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>`;

  _button.addEventListener('click', _toggle);

  const sendBtn = document.getElementById('sendBtn');
  toolbar.insertBefore(_button, sendBtn);
}

function _toggle() {
  _active = !_active;
  _button.classList.toggle('web-search-btn--active', _active);
  _button.title = _active
    ? `Búsqueda web activa — ${LABELS[_provider] || _provider}`
    : 'Activar búsqueda web';
}

function _setProvider(provider) {
  _provider = provider;
  localStorage.setItem('tempest_search_provider', provider);
}

export function getWebSearchConfig() {
  if (!_active || !_provider) return {};
  return { webSearch: true, searchProvider: _provider };
}

export function setProvider(provider) {
  if (!_enabledProviders.includes(provider)) return;
  _setProvider(provider);
}