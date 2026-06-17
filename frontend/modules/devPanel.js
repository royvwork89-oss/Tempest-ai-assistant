let panelVisible = false;
let panelEnabled = false;
let isAdmin = false;
let lastRequests = [];
const MAX_HISTORY = 10;

const STORAGE_KEY = 'tempest_devpanel_open';

import { fetchWithAuth } from './login.js';
import { BASE_URL } from '../config.js';

export async function initDevPanel() {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/me`);
    const data = await res.json();
    isAdmin = data.role === 'admin';
  } catch {
    isAdmin = false;
  }
  if (!isAdmin) return false;

  _injectHTML();
  _bindEvents();

  const wasOpen = localStorage.getItem(STORAGE_KEY) === 'true';
  if (wasOpen) _showPanel();
  else _hidePanel();

  _startPolling();

  return isAdmin;
}

export function handleDebugEvent(payload) {
  if (!isAdmin) return;

  lastRequests.unshift(payload);
  if (lastRequests.length > MAX_HISTORY) lastRequests.pop();

  _renderPanel(payload);
}

function _injectHTML() {
  const existing = document.getElementById('devPanelWrapper');
  if (existing) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'devPanelWrapper';
  wrapper.innerHTML = `
    <div id="devPanelToggle" title="Dev Mode">›</div>
    <div id="devPanel">
      <div class="dev-panel-header">
        <span>⚙ Dev Mode</span>
        <span id="devHwBadge" class="dev-hw-badge"></span>
      </div>
      <div class="dev-section">
        <div class="dev-section-title">Último request</div>
        <div id="devLastRequest" class="dev-empty">Sin datos aún</div>
      </div>
      <div class="dev-section">
        <div class="dev-section-title">Historial</div>
        <div id="devHistory" class="dev-empty">—</div>
      </div>
      <div class="dev-section">
        <div class="dev-section-title">GPU</div>
        <div id="devGpuStats" class="dev-empty">Cargando...</div>
      </div>
      <div class="dev-section">
        <div class="dev-section-title">LocalAI — Tokens acumulados</div>
        <div id="devLocalAIMetrics" class="dev-empty">Cargando...</div>
      </div>
    </div>
  `;

  const app = document.querySelector('.app');
  app.style.overflow = 'hidden';
  app.appendChild(wrapper);
}

function _bindEvents() {
  document.getElementById('devPanelToggle').addEventListener('click', () => {
    panelVisible ? _hidePanel() : _showPanel();
  });
}

function _showPanel() {
  panelVisible = true;
  document.getElementById('devPanel').classList.add('dev-panel--visible');
  document.getElementById('devPanelToggle').textContent = '›';
  document.getElementById('devPanelWrapper').classList.add('dev-wrapper--open');
  localStorage.setItem(STORAGE_KEY, 'true');
}

function _hidePanel() {
  panelVisible = false;
  document.getElementById('devPanel').classList.remove('dev-panel--visible');
  document.getElementById('devPanelToggle').textContent = '‹';
  document.getElementById('devPanelWrapper').classList.remove('dev-wrapper--open');
  localStorage.setItem(STORAGE_KEY, 'false');
}

function _renderPanel(latest) {
  const hwBadge = document.getElementById('devHwBadge');
  if (hwBadge && latest.hardwareProfile) {
    hwBadge.textContent = latest.hardwareProfile;
  }

  const lastEl = document.getElementById('devLastRequest');
  if (lastEl) {
    lastEl.innerHTML = _renderRequest(latest, true);
  }

  const histEl = document.getElementById('devHistory');
  if (histEl) {
    histEl.innerHTML = lastRequests.length === 0
      ? '<span class="dev-empty">—</span>'
      : lastRequests.map(r => _renderHistoryItem(r)).join('');
  }
}

function _renderRequest(r, full = false) {
  const modeLabel = r.variant ? `${r.mode}/${r.variant}` : r.mode;
  const durationClass = r.durationMs > 5000 ? 'dev-value--warn' : 'dev-value--ok';
  const truncBadge = r.truncated
    ? '<span class="dev-tag dev-tag--warn">truncado</span>'
    : '<span class="dev-tag dev-tag--ok">completo</span>';

  return `
    <div class="dev-row"><span class="dev-label">Modelo</span><span class="dev-value">${r.model || '—'}</span></div>
    <div class="dev-row"><span class="dev-label">Modo</span><span class="dev-tag dev-tag--info">${modeLabel}</span></div>
    ${full && r.durationMs != null ? `<div class="dev-row"><span class="dev-label">Duración</span><span class="dev-value ${durationClass}">${r.durationMs.toLocaleString()} ms</span></div>` : ''}
    ${full ? `<div class="dev-row"><span class="dev-label">Tokens entrada</span><span class="dev-value">${r.tokensIn ?? '—'}</span></div>` : ''}
    ${full ? `<div class="dev-row"><span class="dev-label">Tokens salida</span><span class="dev-value">${r.tokensOut ?? '—'}</span></div>` : ''}
    ${full && r.timingPrompt != null ? `<div class="dev-row"><span class="dev-label">T. prompt (ms)</span><span class="dev-value">${r.timingPrompt.toFixed(1)}</span></div>` : ''}
    ${full && r.timingGeneration != null ? `<div class="dev-row"><span class="dev-label">T. generación (ms)</span><span class="dev-value">${r.timingGeneration.toFixed(1)}</span></div>` : ''}
    ${full ? `<div class="dev-row"><span class="dev-label">Finish reason</span><span class="dev-tag dev-tag--ok">${r.finishReason ?? '—'}</span></div>` : ''}
    <div class="dev-row"><span class="dev-label">Truncado</span>${truncBadge}</div>
  `;
}

function _renderHistoryItem(r) {
  const modeLabel = r.variant ? `${r.mode}/${r.variant}` : r.mode;
  return `
    <div class="dev-history-item">
      <span class="dev-history-model">${r.model || '—'}</span>
      <span class="dev-history-meta">${modeLabel}${r.durationMs != null ? ' · ' + r.durationMs.toLocaleString() + ' ms' : ''}</span>
    </div>
  `;
}

let _pollingInterval = null;

function _startPolling() {
  _fetchGpuStats();
  _fetchLocalAIMetrics();
  _pollingInterval = setInterval(() => {
    _fetchGpuStats();
    _fetchLocalAIMetrics();
  }, 5000);
}

async function _fetchGpuStats() {
  const el = document.getElementById('devGpuStats');
  if (!el) return;
  try {
    const res = await fetchWithAuth(`${BASE_URL}/gpu/stats`);
    const data = await res.json();
    if (!data.ok) { el.innerHTML = '<span class="dev-empty">No disponible</span>'; return; }
    const g = data.gpu;
    const vramPct = Math.round((g.vramUsedMB / g.vramTotalMB) * 100);
    const vramClass = vramPct > 90 ? 'dev-value--warn' : vramPct > 70 ? 'dev-value--warn' : 'dev-value--ok';
    const tempClass = g.tempC > 80 ? 'dev-value--warn' : 'dev-value--ok';
    el.innerHTML = `
      <div class="dev-row"><span class="dev-label">Nombre</span><span class="dev-value" style="font-size:10px">${g.name}</span></div>
      <div class="dev-row"><span class="dev-label">Temperatura</span><span class="dev-value ${tempClass}">${g.tempC}°C</span></div>
      <div class="dev-row"><span class="dev-label">Utilización</span><span class="dev-value">${g.utilizationPct}%</span></div>
      <div class="dev-row"><span class="dev-label">VRAM</span><span class="dev-value ${vramClass}">${g.vramUsedMB} / ${g.vramTotalMB} MB (${vramPct}%)</span></div>
    `;
  } catch {
    el.innerHTML = '<span class="dev-empty">Error al obtener GPU</span>';
  }
}

async function _fetchLocalAIMetrics() {
  const el = document.getElementById('devLocalAIMetrics');
  if (!el) return;
  try {
    const res = await fetchWithAuth(`${BASE_URL}/localai/metrics`);
    const data = await res.json();
    if (!data.ok) { el.innerHTML = '<span class="dev-empty">No disponible</span>'; return; }
    const rows = Object.entries(data.tokens).map(([model, kinds]) => {
      const prompt = kinds.prompt || 0;
      const completion = kinds.completion || 0;
      return `
        <div class="dev-history-item">
          <span class="dev-history-model">${model}</span>
          <span class="dev-history-meta">prompt: ${prompt} · completion: ${completion}</span>
        </div>
      `;
    }).join('');
    el.innerHTML = rows || '<span class="dev-empty">Sin datos</span>';
  } catch {
    el.innerHTML = '<span class="dev-empty">Error al obtener métricas</span>';
  }
}