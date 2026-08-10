import { BASE_URL } from '../config.js';
import { fetchWithAuth, logout } from './login.js';
import { HARDWARE_PROFILE, initHardwareProfile } from './models.js';

let _isAdmin = false;
// Formato: "profile:<id>" (incluye "profile:global") o "user:<username>".
let _selectedTarget = 'profile:global';
let _profilesCache = []; // [{id, name, globalEnabled}] — refrescado al abrir Servicios/Usuarios

function _parseTarget(target) {
  const [type, ...rest] = (target || 'profile:global').split(':');
  return { type, id: rest.join(':') };
}

async function _loadProfiles() {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/search/profiles`);
    const data = await res.json();
    _profilesCache = data.ok ? data.profiles : [];
  } catch (e) {
    console.warn('[settings] error cargando perfiles', e.message);
    _profilesCache = [];
  }
  return _profilesCache;
}

async function _loadHTML() {
  const res = await fetch(`${BASE_URL}/settings.html`);
  const html = await res.text();
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
}

async function _initSearchSettings() {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/search/config`);
    const data = await res.json();

    // ── Sección admin ──────────────────────────────────────
    if (_isAdmin) {
      document.getElementById('settingsSearchSection').classList.remove('hidden');

      const testBtn = document.getElementById('settingsSearxngTest');
      const testResult = document.getElementById('settingsSearxngTestResult');
      const newTest = testBtn.cloneNode(true);
      testBtn.replaceWith(newTest);

      // Botón Probar Tavily
      const tavilyTestBtn = document.getElementById('settingsTavilyTest');
      const tavilyTestResult = document.getElementById('settingsTavilyTestResult');
      const newTavilyTest = tavilyTestBtn.cloneNode(true);
      tavilyTestBtn.replaceWith(newTavilyTest);

      newTavilyTest.addEventListener('click', async () => {
        newTavilyTest.disabled = true;
        newTavilyTest.textContent = 'Probando...';
        tavilyTestResult.classList.add('hidden');
        try {
          const { type, id } = _parseTarget(_selectedTarget);
          const r = await fetchWithAuth(`${BASE_URL}/search/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type, id,
              provider: 'tavily',
              testApiKey: document.getElementById('settingsTavilyKey').value.trim()
            })
          });
          const result = await r.json();
          tavilyTestResult.textContent = result.ok
            ? `✓ Conexión exitosa (${result.count} resultado${result.count !== 1 ? 's' : ''})`
            : `✗ Error: ${result.error}`;
          tavilyTestResult.style.color = result.ok ? '#4ade80' : '#f87171';
        } catch {
          tavilyTestResult.textContent = '✗ Error de conexión';
          tavilyTestResult.style.color = '#f87171';
        } finally {
          newTavilyTest.disabled = false;
          newTavilyTest.textContent = 'Probar';
          tavilyTestResult.classList.remove('hidden');
        }
      });

      newTest.addEventListener('click', async () => {
        newTest.disabled = true;
        newTest.textContent = 'Probando...';
        testResult.classList.add('hidden');
        try {
          const { type, id } = _parseTarget(_selectedTarget);
          const r = await fetchWithAuth(`${BASE_URL}/search/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type, id,
              provider: 'searxng',
              testUrl: document.getElementById('settingsSearxngUrl').value.trim()
            })
          });

        } catch {
          testResult.textContent = '✗ Error de conexión';
          testResult.style.color = '#f87171';
        } finally {
          newTest.disabled = false;
          newTest.textContent = 'Probar';
          testResult.classList.remove('hidden');
        }
      });

      // Botón Guardar
      const newSave = document.getElementById('settingsSearchSave');
      if (!newSave._saveListenerAttached) {
        newSave._saveListenerAttached = true;

      newSave.addEventListener('click', async () => {
        const saveResult = document.getElementById('settingsSearchSaveResult');
        try {
          // Guarda SIEMPRE el registro puntual seleccionado (perfil o usuario
          // sin perfil) — nunca una config global compartida. Cada registro
          // es 100% independiente, sin importar si otro comparte los mismos
          // valores.
          const { type, id } = _parseTarget(_selectedTarget);
          const r = await fetchWithAuth(`${BASE_URL}/search/record`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type,
              id,
              globalEnabled: document.getElementById('settingsSearchEnabled').checked,
              providers: {
                searxng: {
                  enabled: document.getElementById('settingsSearxngEnabled').checked,
                  url: document.getElementById('settingsSearxngUrl').value.trim()
                },
                tavily: {
                  enabled: document.getElementById('settingsTavilyEnabled').checked,
                  apiKey: document.getElementById('settingsTavilyKey').value.trim()
                }
              }
            })
          });

          const result = await r.json();

          // Consentimiento de log — solo aplica si el target seleccionado es
          // un usuario puntual (los perfiles no tienen este campo). Se manda
          // junto con el resto de Búsqueda web, recién acá al guardar — el
          // toggle no dispara nada por sí solo al tocarlo (ver comentario en
          // el bloque de arriba que arma este selector).
          const logToggle = document.getElementById('settingsUserLogConsentToggle');
          if (type === 'user' && logToggle) {
            try {
              await fetchWithAuth(`${BASE_URL}/auth/users/${id}/log-consent`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ allowPersonalDataLog: logToggle.checked })
              });
            } catch (err) {
              console.error('[settings] error guardando log-consent:', err);
            }
          }

          saveResult.textContent = result.ok ? '✓ Guardado' : `✗ ${result.error}`;
          saveResult.style.color = result.ok ? '#4ade80' : '#f87171';

          if (result.ok) {
            import('./webSearch.js').then(m => m.initWebSearch());
            await _refreshProviderSelector();
          }
        } catch {
          saveResult.textContent = '✗ Error de conexión';
          saveResult.style.color = '#f87171';
        } finally {
          saveResult.classList.remove('hidden');
          setTimeout(() => saveResult.classList.add('hidden'), 3000);
        }
      });
      } // fin if !_saveListenerAttached
    }

    // ── Sección usuario: selector de provider ──────────────
    await _refreshProviderSelector();

  } catch (e) {
    console.warn('[settings] search init error:', e.message);
  }
}

// ─────────────────────────────────────────────
// Panel: Modelos (catálogo + descarga manual)
// ─────────────────────────────────────────────

function _formatBytes(bytes) {
  if (!bytes) return '?';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(1)} ${units[i]}`;
}

// Velocidad estimada del lado del cliente — compara la lectura actual contra
// la anterior (guardadas acá, entre ticks del polling de 1.5s). No requiere
// nada nuevo del backend: es la forma más simple de mostrar "esto se está
// moviendo de verdad" sin sumar tracking de tiempo en model.downloader.service.
const _lastProgress = new Map(); // modelId → { bytes, time }

function _estimateSpeed(modelId, downloadedBytes) {
  const now = Date.now();
  const prev = _lastProgress.get(modelId);
  _lastProgress.set(modelId, { bytes: downloadedBytes, time: now });
  if (!prev) return null;
  const deltaBytes = downloadedBytes - prev.bytes;
  const deltaSeconds = (now - prev.time) / 1000;
  if (deltaSeconds <= 0 || deltaBytes <= 0) return null;
  return deltaBytes / deltaSeconds;
}

// ─── Estado visual por modelo. Devuelve todo lo que necesita el render: color,
// texto, si hay que mostrar barra de progreso (y en qué %), y si corresponde
// botón de Descargar o de Reintentar.
function _modelStatusMeta(m) {
  if (m.exists) {
    _lastProgress.delete(m.modelId); // limpiar tracking si ya terminó
    // "Instalado" y no "Descargado": una vez que el archivo está en su lugar
    // y la app lo detecta, lo que le importa al usuario es que está listo para
    // usar, no cómo llegó ahí. "Descargado" describía el trámite anterior.
    return { text: '✓ Instalado', color: '#4ade80', bar: null, action: null };
  }

  const dl = m.download;

  if (dl?.status === 'queued') {
    return { text: 'En cola — esperando su turno', color: '#9a9aa5', bar: { pct: 0, indeterminate: true }, action: null };
  }

  if (dl?.status === 'downloading') {
    const pct = dl.totalBytes ? Math.round((dl.downloadedBytes / dl.totalBytes) * 100) : null;
    const speed = _estimateSpeed(m.modelId, dl.downloadedBytes || 0);
    const bytesText = `${_formatBytes(dl.downloadedBytes)} / ${_formatBytes(dl.totalBytes)}`;
    const speedText = speed != null ? ` · ${_formatBytes(speed)}/s` : '';
    return {
      text: `Descargando — ${bytesText}${pct != null ? ` (${pct}%)` : ''}${speedText}`,
      color: '#60a5fa',
      bar: { pct: pct ?? 0, indeterminate: pct == null },
      action: null
    };
  }

  if (dl?.status === 'verifying') {
    _lastProgress.delete(m.modelId);
    return { text: 'Verificando integridad (checksum)…', color: '#60a5fa', bar: { pct: 100, indeterminate: true }, action: null };
  }

  if (dl?.status === 'error') {
    _lastProgress.delete(m.modelId);
    return {
      text: `✗ Descarga cancelada — ${dl.error || 'error de conexión o del servidor'}`,
      color: '#f87171',
      bar: null,
      action: 'retry'
    };
  }

  if (!m.hasSource) {
    return { text: 'Sin fuente configurada', color: '#e0a94c', bar: null, action: null };
  }

  return {
    text: m.required ? 'Requerido — pendiente' : 'No instalado',
    color: '#9a9aa5',
    bar: null,
    action: 'download'
  };
}

function _renderProgressBar(bar) {
  if (!bar) return '';
  const fillStyle = bar.indeterminate
    ? 'width:30%; animation: settingsModelBarSlide 1.1s ease-in-out infinite;'
    : `width:${Math.max(4, Math.min(100, bar.pct))}%; transition:width .3s ease;`;
  return `
    <div style="width:100%; height:5px; border-radius:3px; background:#1f2229; overflow:hidden; margin-top:5px; position:relative;">
      <div style="height:100%; border-radius:3px; background:#6c7dff; ${fillStyle}"></div>
    </div>
  `;
}

// ─── Bloque de análisis de imágenes (Ollama) ────────────────────────────────
// Tener los .gguf descargados NO alcanza para analizar imágenes: falta
// registrar el modelo en Ollama (`ollama create`), que copia los pesos a su
// propio almacén. Eso pasaba solo, escondido dentro del primer mensaje con
// imagen — varios minutos de chat aparentemente colgado, sin explicación ni
// aviso del espacio extra. Acá se hace visible: qué falta, cuánto va a ocupar,
// y un botón para hacerlo cuando el usuario quiera. El registro automático
// sigue existiendo como respaldo. Ver DECISIONS.md.
let _visionPollTimer = null;

function _visionStatusMeta(s) {
  if (!s.supported) {
    return { text: 'Modelo de visión personalizado — registro manual', color: '#9a9aa5', action: null };
  }
  if (!s.ollamaInstalled) {
    return {
      text: 'Ollama no está instalado — el análisis de imágenes está desactivado',
      color: '#e0a94c',
      action: null,
      hint: 'Instalá Ollama desde ollama.com/download. Tempest lo detecta solo.'
    };
  }
  if (!s.ggufReady) {
    const faltan = s.missingGGUF.length;
    return {
      text: `Falta descargar ${faltan} archivo${faltan === 1 ? '' : 's'} del modelo de visión`,
      color: '#e0a94c',
      action: null,
      hint: 'Descargalos de la lista de arriba (los pesos y el proyector de visión).'
    };
  }
  const reg = s.registration || {};
  if (reg.status === 'registering') {
    return {
      text: 'Registrando en Ollama — copiando el modelo, puede tardar varios minutos…',
      color: '#60a5fa',
      action: null,
      bar: { pct: 0, indeterminate: true }
    };
  }
  if (s.registered) {
    return { text: '✓ Listo — el análisis de imágenes está activo', color: '#4ade80', action: null };
  }
  if (reg.status === 'error') {
    return {
      text: `✗ El registro falló — ${reg.error || 'error desconocido'}`,
      color: '#f87171',
      action: 'retry'
    };
  }
  return {
    text: 'Descargado, falta registrarlo en Ollama',
    color: '#9a9aa5',
    action: 'register',
    // Se dice "al menos": el número es la suma exacta de los .gguf de origen,
    // pero medido en una instalación real Ollama terminó guardando además una
    // segunda copia de los pesos en su almacén (dos blobs de 4,06 GB, creados
    // con un minuto de diferencia por el mismo `ollama create`). Prometer la
    // cifra exacta y que ocupe casi el doble es peor que dar un piso honesto.
    hint: s.extraBytes
      ? `Al registrarlo, Ollama copia el modelo a su propio almacén: ocupará al menos ${_formatBytes(s.extraBytes)} adicionales en disco (puede ser más, según cómo lo guarde Ollama).`
      : null
  };
}

async function _renderVisionSetup(slot) {
  if (!slot) return;
  if (_visionPollTimer) { clearTimeout(_visionPollTimer); _visionPollTimer = null; }

  let setup;
  try {
    const res = await fetchWithAuth(`${BASE_URL}/models/vision/setup`);
    const data = await res.json();
    if (!data.ok) return;
    setup = data.setup;
  } catch (err) {
    console.error('[settings] error consultando setup de visión:', err);
    return;
  }

  const status = _visionStatusMeta(setup);
  const btnLabel = status.action === 'retry' ? 'Reintentar registro' : 'Registrar en Ollama';

  // Estructura una sola vez, igual que las filas de modelos — este bloque
  // también entra en el polling y también parpadeaba.
  if (!slot.dataset.built) {
    slot.style.cssText = 'padding:8px 0;';
    slot.innerHTML = `
      <div class="settings-model-name" style="font-size:13px;">Registro en Ollama <em style="opacity:.6;">(ollama create)</em></div>
      <div class="settings-hint" id="settingsVisionModel" style="margin:0 0 8px;"></div>
      <div style="display:flex; align-items:center; gap:10px;">
        <span id="settingsVisionStatus" style="flex:1; min-width:0; font-size:12px;"></span>
        <span id="settingsVisionAction"></span>
      </div>
      <div id="settingsVisionBar"></div>
      <div class="settings-hint" id="settingsVisionHint" style="margin:6px 0 0;"></div>
    `;
    slot.dataset.built = '1';
  }

  _setIfChanged(slot.querySelector('#settingsVisionModel'), 'textContent', `Modelo: ${setup.visionModel}`);

  const statusEl = slot.querySelector('#settingsVisionStatus');
  _setIfChanged(statusEl, 'textContent', status.text);
  if (statusEl.dataset.color !== status.color) {
    statusEl.style.color = status.color;
    statusEl.dataset.color = status.color;
  }

  const hintEl = slot.querySelector('#settingsVisionHint');
  _setIfChanged(hintEl, 'textContent', status.hint || '');
  hintEl.style.display = status.hint ? '' : 'none';

  const actionSlot = slot.querySelector('#settingsVisionAction');
  if (!status.action) {
    if (actionSlot.firstChild) actionSlot.textContent = '';
  } else {
    let btn = actionSlot.querySelector('button');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.style.cssText = 'padding:4px 10px; font-size:12px; white-space:nowrap;';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Iniciando…';
        try {
          await fetchWithAuth(`${BASE_URL}/models/vision/register`, { method: 'POST' });
        } catch (err) {
          console.error('[settings] error iniciando registro de visión:', err);
        }
        await _renderModelsList();
      });
      actionSlot.appendChild(btn);
    }
    if (!btn.disabled) _setIfChanged(btn, 'textContent', btnLabel);
  }

  const barSlot = slot.querySelector('#settingsVisionBar');
  const kind = status.bar ? 'indet' : 'none';
  if (barSlot.dataset.kind !== kind) {
    barSlot.innerHTML = _renderProgressBar(status.bar);
    barSlot.dataset.kind = kind;
  }

  // Mientras el registro corre no hay progreso real que reportar (`ollama
  // create` no emite porcentaje), así que se repregunta cada 3s solo para
  // detectar cuándo termina y pasar a "listo" o al error.
  if (setup.registration?.status === 'registering') {
    _visionPollTimer = setTimeout(() => { _renderModelsList(); }, 3000);
  }
}

// ─── Render sin parpadeo ────────────────────────────────────────────────────
// El polling de 1.5s reconstruía `container.innerHTML` ENTERO en cada tick:
// destruía y recreaba todos los nodos aunque no hubiera cambiado nada. Eso se
// veía como un parpadeo constante, perdía la selección de texto del usuario y
// reiniciaba la animación de las barras de progreso 40 veces por minuto.
// Reportado por el usuario ("parpadea cada segundo, arregla eso").
//
// Ahora la estructura se construye UNA vez y los ticks siguientes solo tocan
// lo que cambió (texto de estado, color, botón, barra). Se rearma sola si
// cambia el conjunto de filas — que pasa al cambiar el perfil de hardware.
let _modelsRowsSignature = null;

function _buildModelRow(m) {
  const row = document.createElement('div');
  row.className = 'settings-model-row';
  row.dataset.modelId = m.modelId;
  row.style.cssText = 'padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.06);';
  row.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <div style="flex:1; min-width:0;">
        <div class="settings-model-name" style="font-size:13px;">${m.label || m.modelId}${m.required ? ' <em style="opacity:.6;">(requerido)</em>' : ''}</div>
        <div class="settings-model-size settings-hint" style="margin:0;">${_formatBytes(m.sizeBytes)}</div>
      </div>
      <span class="settings-model-status" style="font-size:12px; white-space:nowrap; text-align:right;"></span>
      <span class="settings-model-action"></span>
    </div>
    <div class="settings-model-bar-slot"></div>
  `;
  return row;
}

// Escribe en el DOM solo si el valor cambió. Un write con el mismo valor no
// repinta, pero comparar antes deja explícito que este camino no debe tocar
// nada cuando no hay novedad — que es el 95% de los ticks.
function _setIfChanged(el, prop, value) {
  if (el[prop] !== value) el[prop] = value;
}

function _applyModelRowState(row, m) {
  const status = _modelStatusMeta(m);

  const statusEl = row.querySelector('.settings-model-status');
  _setIfChanged(statusEl, 'textContent', status.text);
  if (statusEl.dataset.color !== status.color) {
    statusEl.style.color = status.color;
    statusEl.dataset.color = status.color;
  }

  // Botón: se crea, se actualiza o se saca, sin recrear la fila entera.
  const actionSlot = row.querySelector('.settings-model-action');
  const btnLabel = status.action === 'retry' ? 'Reintentar' : 'Descargar';
  if (!status.action) {
    if (actionSlot.firstChild) actionSlot.textContent = '';
  } else {
    let btn = actionSlot.querySelector('button');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'settings-model-download-btn btn-secondary';
      btn.dataset.modelId = m.modelId;
      btn.style.cssText = 'padding:4px 10px; font-size:12px; white-space:nowrap;';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Iniciando…';
        try {
          await fetchWithAuth(`${BASE_URL}/models/${m.modelId}/download`, { method: 'POST' });
        } catch (err) {
          console.error('[settings] error iniciando descarga:', err);
        }
        await _renderModelsList();
      });
      actionSlot.appendChild(btn);
    }
    if (!btn.disabled) _setIfChanged(btn, 'textContent', btnLabel);
  }

  // Barra: solo se reconstruye si cambia de tipo (aparece, desaparece, o pasa
  // de indeterminada a porcentaje). Si sigue siendo la misma, se ajusta el
  // ancho — reconstruirla reiniciaba la animación en cada tick.
  const barSlot = row.querySelector('.settings-model-bar-slot');
  const kind = !status.bar ? 'none' : (status.bar.indeterminate ? 'indet' : 'pct');
  if (barSlot.dataset.kind !== kind) {
    barSlot.innerHTML = _renderProgressBar(status.bar);
    barSlot.dataset.kind = kind;
  } else if (kind === 'pct') {
    const fill = barSlot.querySelector('div > div');
    if (fill) fill.style.width = `${Math.max(4, Math.min(100, status.bar.pct))}%`;
  }
}

async function _renderModelsList() {
  const container = document.getElementById('settingsModelsList');
  if (!container) return;

  try {
    const res = await fetchWithAuth(`${BASE_URL}/models/catalog`);
    const data = await res.json();
    if (!data.ok) {
      container.innerHTML = '<p class="settings-hint">No se pudo cargar el catálogo.</p>';
      _modelsRowsSignature = null;
      return;
    }

    // Filtrar por perfil activo — 'both' (ej. Whisper) se muestra siempre.
    // El backend ya manda `required` correcto para este perfil (ver
    // models.routes.js), acá solo se oculta lo que no aplica a esta máquina.
    const visibleModels = data.models.filter(
      (m) => m.profile === HARDWARE_PROFILE || m.profile === 'both'
    );

    // Los de visión al final, en su propio grupo (campo `group` del catálogo).
    // Son opcionales y son varios pasos encadenados; mezclados entre los de
    // chat parecían más de lo mismo y no se entendía que van juntos.
    const generalModels = visibleModels.filter((m) => m.group !== 'vision');
    const visionModels = visibleModels.filter((m) => m.group === 'vision');
    const ordered = [...generalModels, ...visionModels];
    const signature = ordered.map((m) => m.modelId).join('|');

    if (signature !== _modelsRowsSignature) {
      container.innerHTML = `
        <style>
          @keyframes settingsModelBarSlide {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(330%); }
          }
        </style>
        <div id="settingsModelsGeneral"></div>
        ${visionModels.length ? `
          <div style="margin-top:18px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.12);">
            <div class="settings-model-name" style="font-size:13px;">Análisis de imágenes <em style="opacity:.6;">(opcional)</em></div>
            <div class="settings-hint" style="margin:2px 0 8px;">
              Tempest funciona sin esto. Para que pueda describir imágenes hacen falta tres cosas distintas:
              el modelo de visión, su complemento, y el registro en Ollama.
            </div>
          </div>
        ` : ''}
        <div id="settingsModelsVision"></div>
        <div id="settingsVisionBlock"></div>
      `;
      const generalSlot = container.querySelector('#settingsModelsGeneral');
      const visionSlot = container.querySelector('#settingsModelsVision');
      generalModels.forEach((m) => generalSlot.appendChild(_buildModelRow(m)));
      visionModels.forEach((m) => visionSlot.appendChild(_buildModelRow(m)));
      _modelsRowsSignature = signature;
    }

    ordered.forEach((m) => {
      const row = container.querySelector(`.settings-model-row[data-model-id="${m.modelId}"]`);
      if (row) _applyModelRowState(row, m);
    });

    // En su propia consulta: el estado de visión depende de Ollama (proceso
    // externo), no del catálogo. Si falla, la lista de modelos se ve igual —
    // que es lo que casi siempre se viene a mirar acá.
    await _renderVisionSetup(container.querySelector('#settingsVisionBlock'));
  } catch (err) {
    console.error('[settings] error cargando catálogo de modelos:', err);
    container.innerHTML = '<p class="settings-hint">Error de conexión.</p>';
    _modelsRowsSignature = null;
  }
}

// Polling simple (mismo patrón que splash.html) mientras el panel está
// visible — se apaga al cambiar de panel o cerrar el modal para no pegarle
// al backend sin necesidad.
let _modelsPollInterval = null;

function _bindOpenModelsFolderButton() {
  const btn = document.getElementById('settingsOpenModelsFolderBtn');
  if (!btn || btn._openFolderListenerAttached) return;
  btn._openFolderListenerAttached = true;

  if (!window.electronAPI?.openModelsFolder) {
    // Fuera de Electron (navegador) — no hay explorador nativo que abrir.
    btn.disabled = true;
    btn.title = 'Solo disponible en la app de escritorio';
    return;
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const result = await window.electronAPI.openModelsFolder();
      if (!result.ok) {
        console.error('[settings] error abriendo carpeta de modelos:', result.error);
      }
    } finally {
      btn.disabled = false;
    }
  });
}

// ── Perfil de hardware (Preferencias → Rendimiento de esta máquina) ─────────
// Breeze = laptop (modelos livianos), Storm = desktop (modelos grandes). El
// valor real vive en el backend (app-settings.json vía settings.service.js);
// acá solo se refleja y se deja cambiar. Ver DECISIONS.md → "Perfil de
// hardware: laptop no debe bajar hermes-q4".
function _updateProfileButtons(activeProfile) {
  const laptopBtn = document.getElementById('settingsProfileLaptopBtn');
  const desktopBtn = document.getElementById('settingsProfileDesktopBtn');
  if (!laptopBtn || !desktopBtn) return;
  laptopBtn.classList.toggle('active', activeProfile === 'laptop');
  desktopBtn.classList.toggle('active', activeProfile === 'desktop');
}

async function _bindHardwareProfileToggle() {
  const laptopBtn = document.getElementById('settingsProfileLaptopBtn');
  const desktopBtn = document.getElementById('settingsProfileDesktopBtn');
  if (!laptopBtn || !desktopBtn) return;

  // cloneNode+replaceWith — mismo patrón que el resto del panel (ver
  // ARCHITECTURE.md), evita acumular listeners si initSettings corre de nuevo.
  const freshLaptopBtn = laptopBtn.cloneNode(true);
  laptopBtn.replaceWith(freshLaptopBtn);
  const freshDesktopBtn = desktopBtn.cloneNode(true);
  desktopBtn.replaceWith(freshDesktopBtn);

  await initHardwareProfile(); // refresca HARDWARE_PROFILE por si cambió en otra sesión
  _updateProfileButtons(HARDWARE_PROFILE);

  [freshLaptopBtn, freshDesktopBtn].forEach((btn) => {
    btn.addEventListener('click', async () => {
      const profile = btn.dataset.profile;
      if (profile === HARDWARE_PROFILE) return;

      freshLaptopBtn.disabled = true;
      freshDesktopBtn.disabled = true;
      try {
        await fetchWithAuth(`${BASE_URL}/hardware-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hardwareProfile: profile })
        });
        await initHardwareProfile();
        _updateProfileButtons(HARDWARE_PROFILE);
        await _renderModelsList(); // aplica el filtro nuevo si el panel de Modelos está abierto
        // Avisa a app.js para que rearme el menú de modelos locales del chat
        // (el desplegable "Automático/manual") sin necesidad de reiniciar —
        // ver DECISIONS.md → "Menú de modelos locales mostraba siempre la
        // lista de desktop".
        window.dispatchEvent(new CustomEvent('hardwareprofile-changed'));
      } catch (err) {
        console.error('[settings] error guardando perfil de hardware:', err);
      } finally {
        freshLaptopBtn.disabled = false;
        freshDesktopBtn.disabled = false;
      }
    });
  });
}

// ── Revisar actualizaciones (Preferencias → Actualizaciones) ────────────────
// Flujo 100% manual: click → spinner mientras main.js consulta GitHub vía
// electron-updater → modal chico con el resultado. Nada se descarga sin que
// el usuario lo confirme explícitamente en ese modal (ver shell/main.js).
function _bindUpdateCheck() {
  const btn     = document.getElementById('settingsCheckUpdateBtn');
  const spinner = document.getElementById('settingsCheckUpdateSpinner');
  const label   = document.getElementById('settingsCheckUpdateBtnLabel');
  const verEl   = document.getElementById('settingsCurrentVersion');
  if (!btn) return;

  if (window.electronAPI?.getAppVersion && verEl) {
    window.electronAPI.getAppVersion().then((v) => { verEl.textContent = `v${v}`; }).catch(() => {});
  }

  if (!window.electronAPI?.checkForUpdates) {
    // Fuera de Electron (navegador) — no hay updater que consultar.
    btn.disabled = true;
    btn.title = 'Solo disponible en la app de escritorio';
    return;
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    spinner?.classList.remove('hidden');
    if (label) label.textContent = 'Revisando…';
    try {
      const result = await window.electronAPI.checkForUpdates();
      _showUpdateModal(result);
    } catch (err) {
      _showUpdateModal({ ok: false, error: err.message || 'Error desconocido' });
    } finally {
      btn.disabled = false;
      spinner?.classList.add('hidden');
      if (label) label.textContent = 'Revisar actualizaciones';
    }
  });
}

function _showUpdateModal(result) {
  const modal       = document.getElementById('updateCheckModal');
  const title       = document.getElementById('updateModalTitle');
  const message     = document.getElementById('updateModalMessage');
  const primary     = document.getElementById('updateModalPrimaryBtn');
  const secondary   = document.getElementById('updateModalSecondaryBtn');
  const cancelBtn   = document.getElementById('updateModalCancelBtn');
  const progressBox = document.getElementById('updateModalProgressBar');
  if (!modal || !title || !message || !primary || !secondary || !cancelBtn || !progressBox) return;

  // cloneNode+replaceWith para no acumular listeners de revisiones previas
  // (mismo patrón que los modales compartidos de context files — ver ARCHITECTURE.md).
  const newPrimary = primary.cloneNode(true);
  primary.replaceWith(newPrimary);
  const newSecondary = secondary.cloneNode(true);
  secondary.replaceWith(newSecondary);
  const newCancel = cancelBtn.cloneNode(true);
  cancelBtn.replaceWith(newCancel);

  progressBox.innerHTML = '';
  progressBox.classList.add('hidden');
  newCancel.classList.add('hidden');

  const close = () => modal.classList.add('hidden');
  newSecondary.addEventListener('click', close);

  // Listener del botón Cancelar atado UNA sola vez acá (no dentro del click
  // de "Actualizar ahora", que puede dispararse de nuevo en un reintento) —
  // si se atara ahí adentro, cada reintento sumaría un listener más al mismo
  // botón sin reemplazarlo, y un solo click terminaría llamando a
  // cancelDownloadUpdate() varias veces. El botón solo es clickeable mientras
  // está visible (durante una descarga en curso), así que no hace falta
  // ninguna guarda extra acá — llamarlo sin descarga activa ya devuelve un
  // error inofensivo del lado de main.js.
  let _cancelledByUser = false;
  newCancel.addEventListener('click', async () => {
    newCancel.disabled = true;
    newCancel.textContent = 'Cancelando…';
    _cancelledByUser = true;
    await window.electronAPI.cancelDownloadUpdate?.();
  });

  // Vuelve el modal al estado "botón para reintentar" — usado tanto al
  // cancelar como al fallar, para no dejar al usuario sin forma de
  // reintentar sin cerrar y volver a abrir el modal.
  const resetToRetry = (msg) => {
    message.textContent = msg;
    progressBox.classList.add('hidden');
    newCancel.classList.add('hidden');
    newPrimary.classList.remove('hidden');
    newPrimary.disabled = false;
    newPrimary.textContent = 'Reintentar';
    newSecondary.classList.remove('hidden');
    newSecondary.textContent = 'Cerrar';
  };

  if (!result.ok) {
    title.textContent = 'No se pudo revisar';
    message.textContent = result.error || 'Ocurrió un error revisando actualizaciones.';
    newPrimary.classList.add('hidden');
    newSecondary.textContent = 'Cerrar';
  } else if (result.updateAvailable) {
    title.textContent = 'Actualización disponible';
    message.textContent = `Hay una nueva versión disponible: v${result.latestVersion} (tenés v${result.currentVersion}). ¿Querés actualizar ahora?`;
    newSecondary.textContent = 'Ahora no';
    newPrimary.textContent = 'Actualizar ahora';
    newPrimary.classList.remove('hidden');
    newPrimary.addEventListener('click', async () => {
      // Pedido del usuario: durante la descarga no se ven los dos botones de
      // la pregunta inicial — se reemplazan por una barra de progreso real y
      // un botón Cancelar que sí cancela de verdad (antes no existía forma
      // de cancelar una descarga ya confirmada). Ver DECISIONS.md.
      newPrimary.classList.add('hidden');
      newSecondary.classList.add('hidden');
      newCancel.classList.remove('hidden');
      newCancel.disabled = false;
      newCancel.textContent = 'Cancelar';
      progressBox.classList.remove('hidden');
      progressBox.innerHTML = _renderProgressBar({ pct: 0, indeterminate: true });
      message.textContent = 'Iniciando descarga…';
      _cancelledByUser = false; // reset por si es un reintento después de un cancel anterior

      // Progreso real — antes esto no existía y "Descargando…" quedaba fijo
      // sin cambiar nunca, indistinguible de una descarga colgada (ver
      // DECISIONS.md). window.electronAPI.onUpdateDownloadProgress devuelve
      // una función para desuscribirse, que se llama apenas termina (ok,
      // error o cancelado) para no dejar el listener pegado a un modal ya
      // cerrado.
      const unsubscribe = window.electronAPI.onUpdateDownloadProgress?.((progress) => {
        const pct = Math.round(progress.percent || 0);
        const transferred = _formatBytes(progress.transferred);
        const total = _formatBytes(progress.total);
        const speed = _formatBytes(progress.bytesPerSecond);
        message.textContent = `Descargando actualización… ${transferred} / ${total} (${pct}%) · ${speed}/s`;
        progressBox.innerHTML = _renderProgressBar({ pct, indeterminate: false });
      });

      try {
        const dl = await window.electronAPI.downloadUpdate();
        unsubscribe?.();
        if (!dl.ok) {
          if (dl.cancelled || _cancelledByUser) {
            resetToRetry('Descarga cancelada.');
          } else {
            message.textContent = `Error al descargar la actualización: ${dl.error || 'error desconocido'}`;
            progressBox.classList.add('hidden');
            newCancel.classList.add('hidden');
            newSecondary.classList.remove('hidden');
            newSecondary.textContent = 'Cerrar';
          }
        } else {
          message.textContent = 'Descarga completa. Te avisamos apenas esté lista para reiniciar.';
          progressBox.classList.add('hidden');
          newCancel.classList.add('hidden');
          newSecondary.classList.remove('hidden');
          newSecondary.textContent = 'Cerrar';
        }
      } catch (err) {
        unsubscribe?.();
        message.textContent = `Error al descargar la actualización: ${err.message || 'error desconocido'}`;
        progressBox.classList.add('hidden');
        newCancel.classList.add('hidden');
        newSecondary.classList.remove('hidden');
        newSecondary.textContent = 'Cerrar';
      }
    });
  } else {
    title.textContent = 'Actualizaciones';
    message.textContent = `No hay actualizaciones disponibles por el momento. Estás en la última versión (v${result.currentVersion}).`;
    newPrimary.classList.add('hidden');
    newSecondary.textContent = 'Cerrar';
  }

  modal.classList.remove('hidden');
}

function _bindDownloadAllButton() {
  const btn = document.getElementById('settingsModelsDownloadAllBtn');
  if (!btn || btn._downloadAllListenerAttached) return;
  btn._downloadAllListenerAttached = true;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Encolando…';
    try {
      await fetchWithAuth(`${BASE_URL}/models/download-all`, { method: 'POST' });
    } catch (err) {
      console.error('[settings] error en descargar todos:', err);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Descargar todos';
    }
    await _renderModelsList();
  });
}

function _startModelsPolling() {
  _stopModelsPolling();
  _bindDownloadAllButton();
  _bindOpenModelsFolderButton();
  _renderModelsList();
  _modelsPollInterval = setInterval(_renderModelsList, 1500);
}

function _stopModelsPolling() {
  if (_modelsPollInterval) {
    clearInterval(_modelsPollInterval);
    _modelsPollInterval = null;
  }
}

async function _refreshProviderSelector() {
  try {
    const res  = await fetchWithAuth(`${BASE_URL}/search/config`);
    const data = await res.json();
    const enabledProviders = data.enabledProviders || [];
    const provSection = document.getElementById('settingsSearchProviderSection');
    const select      = document.getElementById('settingsProviderSelect');
    if (!provSection || !select) return;

    if (enabledProviders.length > 1) {
      const saved  = localStorage.getItem('tempest_search_provider') || enabledProviders[0];
      const LABELS = { searxng: 'SearXNG (local)', brave: 'Brave Search', tavily: 'Tavily (IA)' };

      select.innerHTML = enabledProviders.map(p => `
        <option value="${p}" ${p === saved ? 'selected' : ''}>${LABELS[p] || p}</option>
      `).join('');

      const newSelect = select.cloneNode(true);
      select.replaceWith(newSelect);
      newSelect.addEventListener('change', () => {
        localStorage.setItem('tempest_search_provider', newSelect.value);
        import('./webSearch.js').then(m => m.setProvider(newSelect.value));
      });

      provSection.classList.remove('hidden');
    } else {
      provSection.classList.add('hidden');
    }
  } catch (e) {
    console.warn('[settings] error recargando selector de provider:', e.message);
  }
}

export async function initSettings(isAdmin) {
  _isAdmin = isAdmin;
  await _loadHTML();

  // Reasignadas más abajo (solo si _isAdmin) a las funciones reales que
  // vuelven a pedir datos al backend. Se llaman cada vez que se abre la
  // pestaña correspondiente — el modal en sí solo alterna una clase CSS
  // (no recarga nada), así que sin este enganche los paneles quedaban
  // pegados a los datos que había al arrancar la app hasta reiniciarla.
  let _refreshServiciosPanel = async () => {};
  let _refreshUsuariosPanel  = async () => {};

  const btn = document.getElementById('settingsBtn');
  const modal = document.getElementById('settingsModal');
  const closeBtn = document.getElementById('closeSettingsBtn');
  const devSection = document.getElementById('settingsDevModeSection');
  const debugToggle = document.getElementById('settingsDebugToggle');

  // Mostrar sección de debug solo para admin
  if (_isAdmin) devSection.classList.remove('hidden');

  // Mostrar sección de logs de errores solo para admin — mismo criterio que
  // el resto de este bloque: _isAdmin viene del rol real del usuario (JWT vía
  // /me, ver devPanel.js), no de un flag de entorno. La carpeta de logs puede
  // exponer detalles internos (rutas, stacks) que no son para cualquier
  // usuario. Ver DECISIONS.md → "Logger de errores centralizado".
  const logsSection = document.getElementById('settingsLogsSection');
  if (logsSection && _isAdmin) logsSection.classList.remove('hidden');

  // Mostrar sección de actualizaciones solo para admin — movida de
  // Preferencias a Servicios a pedido explícito del usuario: un usuario sin
  // rol admin no debería poder ver ni disparar la revisión/instalación de
  // actualizaciones de la app.
  const updatesSection = document.getElementById('settingsUpdatesSection');
  if (updatesSection && _isAdmin) updatesSection.classList.remove('hidden');

  // Mostrar botón Servicios solo para admin
  const navServicios = document.getElementById('settingsNavServicios');
  if (navServicios) {
    if (_isAdmin) navServicios.classList.remove('hidden');
    else navServicios.classList.add('hidden');
  }

  // Cargar estado actual del debug
  if (_isAdmin) {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/debug/status`);
      const data = await res.json();
      debugToggle.checked = data.devMode;
    } catch {
      debugToggle.checked = false;
    }
  }

  // NOTA: acá vivían los toggles globales "incluir pregunta/respuesta en el
  // log" — se eliminaron. El consentimiento ahora es por usuario, ver el
  // bloque de "Gestión de usuarios" más abajo (checkboxes por fila) y
  // auth.service.js's getUserLogConsent/setUserLogConsent. El botón "Abrir
  // carpeta de logs" sigue acá (ver más abajo, dentro del bloque admin de
  // Servicios) — eso sí es global, no por usuario.

  // Abrir modal
  btn.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  // Cerrar modal
  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    _stopModelsPolling();
  });

  // Cerrar sesión
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await logout();
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      _stopModelsPolling();
    }
  });

  function _updatePanelVisibility(enabled) {
    const wrapper = document.getElementById('devPanelWrapper');
    if (!wrapper) return;
    wrapper.style.display = enabled ? '' : 'none';
  }

  // Aplicar visibilidad inicial
  _updatePanelVisibility(debugToggle.checked);

  // Toggle debug
  if (_isAdmin) {
    debugToggle.addEventListener('change', async () => {
      try {
        const res = await fetchWithAuth(`${BASE_URL}/debug/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: debugToggle.checked })
        });
        const data = await res.json();
        _updatePanelVisibility(debugToggle.checked);
      } catch (err) {
        console.error('[settings] toggle error:', err);
        debugToggle.checked = !debugToggle.checked;
      }
    });
  }

  // ── Gestión de usuarios (solo admin) ──────────────────────
  if (_isAdmin) {
    const usersSection = document.getElementById('settingsUsersSection');
    const usersList = document.getElementById('settingsUsersList');
    const addUserBtn = document.getElementById('settingsAddUserBtn');
    const createUserModal = document.getElementById('createUserModal');
    const cancelCreateUserBtn = document.getElementById('cancelCreateUserBtn');
    const confirmCreateUserBtn = document.getElementById('confirmCreateUserBtn');
    const createUserError = document.getElementById('createUserError');

    usersSection.classList.remove('hidden');

    async function loadUsers() {
      try {
        const [res, profiles] = await Promise.all([
          fetchWithAuth(`${BASE_URL}/auth/users`).then(r => r.json()),
          _loadProfiles()
        ]);
        const data = res;
        if (!data.ok) return;
        const profileOptions = profiles.map(p =>
          `<option value="${p.id}">${p.id === 'global' ? 'Perfil Global' : p.name}</option>`
        ).join('');
        usersList.innerHTML = data.users.map(u => `
          <div class="settings-user-row">
            <div class="settings-user-info">
              <span class="settings-user-name">${u.username}</span>
              <span class="settings-user-role ${u.role === 'admin' ? 'role-admin' : 'role-user'}">${u.role}</span>
            </div>
            <div class="settings-user-actions">
              ${u.username !== 'admin' ? `<button class="settings-user-role-btn btn-secondary" data-username="${u.username}" data-role="${u.role}" style="padding: 4px 8px; font-size: 11px;">Rol ▼</button>` : ''}
              ${u.username !== 'admin' ? `
              <select class="settings-user-profile-select settings-select" data-username="${u.username}" style="font-size:11px; padding:3px 6px; min-width:110px;">
                <option value="none" ${!u.profileId || u.profileId === 'none' ? 'selected' : ''}>Sin perfil</option>
                ${profileOptions.replace(`value="${u.profileId}"`, `value="${u.profileId}" selected`)}
              </select>` : ''}
              <button class="settings-user-pwd-btn btn-secondary" data-username="${u.username}" style="padding: 4px 8px; font-size: 11px;">🔑</button>
              ${u.username !== 'admin' ? `<button class="settings-user-delete" data-username="${u.username}">✕</button>` : ''}
            </div>
          </div>
        `).join('');

        usersList.querySelectorAll('.settings-user-delete').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm(`¿Eliminar usuario "${btn.dataset.username}"?`)) return;
            await fetchWithAuth(`${BASE_URL}/auth/users/${btn.dataset.username}`, { method: 'DELETE' });
            await loadUsers();
          });
        });

        usersList.querySelectorAll('.settings-user-role-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const newRole = btn.dataset.role === 'admin' ? 'user' : 'admin';
            if (!confirm(`¿Cambiar rol de "${btn.dataset.username}" a ${newRole}?`)) return;
            await fetchWithAuth(`${BASE_URL}/auth/users/${btn.dataset.username}/role`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: newRole })
            });
            await loadUsers();
          });
        });

        usersList.querySelectorAll('.settings-user-pwd-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            _openChangePassword(btn.dataset.username);
          });
        });

        usersList.querySelectorAll('.settings-user-profile-select').forEach(sel => {
          sel.addEventListener('change', async () => {
            const username = sel.dataset.username;
            const profileId = sel.value;
            await fetchWithAuth(`${BASE_URL}/search/user-profile`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, profileId })
            });
          });
        });

        // NOTA: el consentimiento de log por usuario (allowPersonalDataLog)
        // se gestiona desde la pestaña Servicios → Búsqueda web, atado al
        // selector de usuario que ya existe ahí (settingsUserSelect) — no en
        // esta lista de Usuarios. Ver DECISIONS.md → "Trace de ejecución por
        // request — consentimiento de log por usuario".

      } catch (err) {
        console.error('[settings] loadUsers error:', err);
      }
    }

    _refreshUsuariosPanel = loadUsers;
    await loadUsers();

    addUserBtn.addEventListener('click', () => {
      document.getElementById('newUserUsername').value = '';
      document.getElementById('newUserPassword').value = '';
      document.getElementById('newUserRole').value = 'user';
      createUserError.classList.add('hidden');
      createUserModal.classList.remove('hidden');
    });
    

    cancelCreateUserBtn.addEventListener('click', () => {
      createUserModal.classList.add('hidden');
    });

    confirmCreateUserBtn.addEventListener('click', async () => {
      const username = document.getElementById('newUserUsername').value.trim();
      const password = document.getElementById('newUserPassword').value;
      const role = document.getElementById('newUserRole').value;

      if (!username || !password) {
        createUserError.textContent = 'Usuario y contraseña son requeridos';
        createUserError.classList.remove('hidden');
        return;
      }

      try {
        const res = await fetchWithAuth(`${BASE_URL}/auth/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role })
        });
        const data = await res.json();
        if (!data.ok) {
          createUserError.textContent = data.error || 'Error al crear usuario';
          createUserError.classList.remove('hidden');
          return;
        }
        createUserModal.classList.add('hidden');
        await loadUsers();
      } catch (err) {
        createUserError.textContent = 'Error de conexión';
        createUserError.classList.remove('hidden');
      }
    });
  }

  // ── Cambiar contraseña propia ──────────────────────────────
  document.getElementById('changeOwnPasswordBtn').addEventListener('click', () => {
    const user = JSON.parse(localStorage.getItem('tempest_user') || '{}');
    _openChangePassword(user.username);
  });

  function _openChangePassword(username) {
    const modal = document.getElementById('changePasswordModal');
    const input = document.getElementById('changePasswordInput');
    const confirm = document.getElementById('changePasswordConfirm');
    const error = document.getElementById('changePasswordError');
    const cancelBtn = document.getElementById('cancelChangePasswordBtn');
    const confirmBtn = document.getElementById('confirmChangePasswordBtn');

    input.value = '';
    confirm.value = '';
    error.classList.add('hidden');
    modal.classList.remove('hidden');

    const newCancel = cancelBtn.cloneNode(true);
    const newConfirm = confirmBtn.cloneNode(true);
    cancelBtn.replaceWith(newCancel);
    confirmBtn.replaceWith(newConfirm);

    newCancel.addEventListener('click', () => modal.classList.add('hidden'));

    newConfirm.addEventListener('click', async () => {
      const pwd = input.value;
      const pwdConfirm = confirm.value;
      const errorEl = document.getElementById('changePasswordError');

      if (!pwd) {
        errorEl.textContent = 'La contraseña no puede estar vacía';
        errorEl.classList.remove('hidden');
        return;
      }
      if (pwd !== pwdConfirm) {
        errorEl.textContent = 'Las contraseñas no coinciden';
        errorEl.classList.remove('hidden');
        return;
      }

      try {
        const res = await fetchWithAuth(`${BASE_URL}/auth/users/${username}/password`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        if (!data.ok) {
          errorEl.textContent = data.error || 'Error al cambiar contraseña';
          errorEl.classList.remove('hidden');
          return;
        }
        modal.classList.add('hidden');
        alert(`Contraseña de "${username}" actualizada correctamente.`);
      } catch {
        errorEl.textContent = 'Error de conexión';
        errorEl.classList.remove('hidden');
      }
    });
  }

  // ─────────────────────────────────────────────
  // Navegación entre paneles
  // ─────────────────────────────────────────────

  const navButtons = document.querySelectorAll('.settings-nav-btn');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {

      const target = btn.dataset.section;

      // quitar activo
      navButtons.forEach(b => b.classList.remove('active'));

      // activar botón seleccionado
      btn.classList.add('active');

      // ocultar paneles
      document.querySelectorAll('.settings-panel').forEach(panel => {
        panel.classList.add('hidden');
      });

      // mostrar panel correspondiente
      const targetPanel = document.querySelector(
        `.settings-panel[data-panel="${target}"]`
      );

      if (targetPanel) {
        targetPanel.classList.remove('hidden');
      }

      // Panel de Modelos: arrancar/parar el polling de descarga según
      // corresponda — evita pegarle a /models/catalog cuando no se está viendo.
      if (target === 'modelos') {
        _startModelsPolling();
      } else {
        _stopModelsPolling();
      }

      // Servicios/Usuarios: recargar datos frescos del backend cada vez que
      // se entra a la pestaña — el modal no se recarga solo al abrir/cerrar,
      // así que sin esto quedaban pegados a lo que había al arrancar la app.
      if (target === 'servicios') _refreshServiciosPanel();
      if (target === 'usuarios')  _refreshUsuariosPanel();
    });
  });

  // ─────────────────────────────────────────────
  // Cargar selector de Servicios (perfiles + usuarios)
  //
  // Cada perfil (incluido Perfil Global) y cada usuario "sin perfil" es un
  // registro 100% independiente — su propia config de providers/apiKeys. Un
  // usuario CON perfil asignado no se edita acá, solo se muestra qué perfil
  // tiene (referencia de solo lectura) y se puede reasignar. Ver
  // DECISIONS.md → "Hoja de ruta para el creador de perfiles".
  // ─────────────────────────────────────────────

  if (_isAdmin) {
    try {
      const select          = document.getElementById('settingsUserSelect');
      const btnYo           = document.getElementById('settingsUserSelectMe');
      const globalRow        = document.getElementById('settingsUserGlobalRow');
      const profileSel       = document.getElementById('settingsUserProfileSelect');
      const assignedHint     = document.getElementById('settingsUserAssignedHint');
      const permHint         = document.getElementById('settingsUserPermHint');
      const newProfileInput  = document.getElementById('settingsNewProfileName');
      const newProfileBtn    = document.getElementById('settingsNewProfileBtn');
      const deleteProfileBtn = document.getElementById('settingsDeleteProfileBtn');
      const profileActionMsg = document.getElementById('settingsProfileActionResult');
      const myUsername       = JSON.parse(localStorage.getItem('tempest_user') || '{}').username;
      // Consentimiento de log por usuario — un solo toggle, vive dentro de
      // "Búsqueda web" (justo debajo de "Activar búsqueda web"), atado al
      // mismo selector de usuario de esta pestaña. No se guarda al tocarlo
      // — queda pendiente hasta que se aprieta "Guardar configuración"
      // (mismo botón que ya guarda el resto de Búsqueda web), igual que
      // todos los demás campos de esa sección. Ver DECISIONS.md → "Trace de
      // ejecución por request — consentimiento de log por usuario".
      const logConsentRow  = document.getElementById('settingsUserLogConsentRow');
      const logConsentHint = document.getElementById('settingsUserLogConsentHint');
      const logConsentToggle = document.getElementById('settingsUserLogConsentToggle');

      // admins/users/profiles quedan como arrays mutados EN SITIO (.length=0
      // + .push) en cada refresh, en vez de reasignados — así todas las
      // funciones de acá abajo (cerradas sobre estas mismas referencias)
      // siempre ven los datos más recientes sin tener que redefinirse.
      const admins   = [];
      const users     = [];
      const profiles = [];

      function _targetStillValid(target) {
        const { type, id } = _parseTarget(target);
        if (type === 'profile') return profiles.some(p => p.id === id);
        return admins.some(u => u.username === id) || users.some(u => u.username === id);
      }

      // ── Función: releer usuarios + perfiles del backend ──────
      // Se llama al abrir la pestaña Servicios (no solo la primera vez que
      // arranca la app) y después de crear/eliminar un perfil.
      async function refreshServiciosData(preferredTarget) {
        const [usersRes, freshProfiles] = await Promise.all([
          fetchWithAuth(`${BASE_URL}/auth/users`).then(r => r.json()),
          _loadProfiles()
        ]);
        if (!usersRes.ok) return;

        // Ordenar: admins primero (admin principal siempre el primero), luego users — ambos alfabético
        const freshAdmins = usersRes.users
          .filter(u => u.role === 'admin')
          .sort((a, b) => {
            if (a.username === 'admin') return -1;
            if (b.username === 'admin') return 1;
            return a.username.localeCompare(b.username);
          });
        const freshUsers = usersRes.users
          .filter(u => u.role !== 'admin')
          .sort((a, b) => a.username.localeCompare(b.username));

        admins.length = 0;   admins.push(...freshAdmins);
        users.length = 0;    users.push(...freshUsers);
        profiles.length = 0; profiles.push(...freshProfiles);

        const target = preferredTarget
          || (_targetStillValid(_selectedTarget) ? _selectedTarget : 'profile:global');

        _rebuildMainSelect(target);
        _selectedTarget = target;
        await loadSelectedPerms(target);
      }

      function _rebuildMainSelect(selected) {
          select.innerHTML = profiles.map(p =>
            `<option value="profile:${p.id}">${p.id === 'global' ? '— Perfil Global —' : `📁 ${p.name}`}</option>`
          ).join('');
          if (admins.length) {
            select.innerHTML += `<optgroup label="────────────────"></optgroup>`;
            admins.forEach(u => {
              select.innerHTML += `<option value="user:${u.username}">${u.username} (admin)</option>`;
            });
          }
          if (users.length) {
            select.innerHTML += `<optgroup label="────────────────"></optgroup>`;
            users.forEach(u => {
              select.innerHTML += `<option value="user:${u.username}">${u.username}</option>`;
            });
          }
          select.value = selected;
        }

        function _rebuildProfileAssignSelect(currentProfileId) {
          profileSel.innerHTML = `<option value="none">Sin perfil</option>` +
            profiles.map(p => `<option value="${p.id}">${p.id === 'global' ? 'Perfil Global' : p.name}</option>`).join('');
          profileSel.value = currentProfileId;
        }

        // ── Función: cargar el registro del target seleccionado ──────
        async function loadSelectedPerms(target) {
          const { type, id } = _parseTarget(target);
          globalRow.classList.add('hidden');
          assignedHint.classList.add('hidden');
          permHint.classList.add('hidden');
          deleteProfileBtn.classList.add('hidden');
          profileActionMsg.classList.add('hidden');
          logConsentRow?.classList.add('hidden');
          logConsentHint?.classList.add('hidden');

          // Rehabilitar todos los controles al inicio
          ['settingsSearxngEnabled', 'settingsTavilyEnabled', 'settingsBraveEnabled'].forEach(cid => {
            const el = document.getElementById(cid);
            if (el) el.disabled = false;
          });
          document.getElementById('settingsSearxngUrl').disabled = false;
          document.getElementById('settingsTavilyKey').disabled = false;
          document.getElementById('settingsSearchSave').disabled = false;
          document.getElementById('settingsSearchSave')?.classList.remove('hidden');
          document.getElementById('settingsSearchSaveResult')?.classList.add('hidden');

          const searchSection = document.getElementById('settingsSearchSection');

          function _fillRecordFields(record) {
            document.getElementById('settingsSearchEnabled').checked = !!record?.globalEnabled;
            document.getElementById('settingsSearxngEnabled').checked = record?.providers?.searxng?.enabled || false;
            document.getElementById('settingsSearxngUrl').value = record?.providers?.searxng?.url || '';
            document.getElementById('settingsTavilyEnabled').checked = record?.providers?.tavily?.enabled || false;
            document.getElementById('settingsTavilyKey').value = record?.providers?.tavily?.apiKey || '';
          }

          if (type === 'profile') {
            deleteProfileBtn.classList.toggle('hidden', id === 'global');
            searchSection?.classList.remove('hidden');
            try {
              const r = await fetchWithAuth(`${BASE_URL}/search/record?type=profile&id=${encodeURIComponent(id)}`);
              const d = await r.json();
              _fillRecordFields(d.record);
            } catch (_) {}
            const profileMeta = profiles.find(p => p.id === id);
            permHint.textContent = id === 'global'
              ? 'Editando el Perfil Global. Los cambios afectan a todos los usuarios con este perfil asignado.'
              : `Editando el perfil "${profileMeta?.name || id}". Los cambios afectan a todos los usuarios con este perfil asignado.`;
            permHint.classList.remove('hidden');
            return;
          }

          // type === 'user'
          globalRow.classList.remove('hidden');
          try {
            const r    = await fetchWithAuth(`${BASE_URL}/auth/users`);
            const d    = await r.json();
            const user = d.users?.find(u => u.username === id);
            if (!user) return;

            // Consentimiento de log — independiente de si tiene perfil de
            // búsqueda asignado o no, así que se muestra siempre que el
            // target sea un usuario puntual (no un perfil).
            if (logConsentToggle) {
              logConsentRow?.classList.remove('hidden');
              logConsentHint?.classList.remove('hidden');
              logConsentToggle.checked = !!user.allowPersonalDataLog;
            }

            const profileId = user.profileId ?? 'none';
            _rebuildProfileAssignSelect(profileId);
            const hasProfile = profileId !== 'none';

            if (hasProfile) {
              // Con perfil asignado — solo referencia de solo lectura, no se
              // edita acá. Reasignar a "Sin perfil" arriba para habilitar edición.
              searchSection?.classList.add('hidden');
              const profileMeta = profiles.find(p => p.id === profileId);
              assignedHint.textContent = `Este usuario usa el perfil "${profileMeta?.name || profileId}". No tiene configuración propia — cámbialo a "Sin perfil" arriba para darle una independiente.`;
              assignedHint.classList.remove('hidden');
            } else {
              // Sin perfil — registro propio, independiente de todo lo demás.
              searchSection?.classList.remove('hidden');
              try {
                const rr = await fetchWithAuth(`${BASE_URL}/search/record?type=user&id=${encodeURIComponent(id)}`);
                const dd = await rr.json();
                _fillRecordFields(dd.record);
              } catch (_) {}
              permHint.textContent = `Editando la configuración propia de ${id}. Es independiente de cualquier perfil — no se comparte con otros usuarios ni perfiles, aunque uses la misma API key.`;
              permHint.classList.remove('hidden');
            }
          } catch (err) {
            console.error('[settings] error cargando registro de usuario', err);
          }
        }

        // ── Listener: cambio de selección ─────────────────
        select.addEventListener('change', () => {
          _selectedTarget = select.value;
          loadSelectedPerms(_selectedTarget);
        });

        // ── Botón Yo ──────────────────────────────────────
        btnYo.addEventListener('click', () => {
          const target = `user:${myUsername}`;
          select.value = target;
          _selectedTarget = target;
          loadSelectedPerms(target);
        });

        // ── Reasignar perfil de un usuario ─────────────────
        profileSel.addEventListener('change', async () => {
          const { type, id: username } = _parseTarget(_selectedTarget);
          if (type !== 'user') return;
          const newProfileId = profileSel.value;
          await fetchWithAuth(`${BASE_URL}/search/user-profile`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, profileId: newProfileId })
          });
          await loadSelectedPerms(_selectedTarget);
        });

        // NOTA: el consentimiento de log (`logConsentToggle`) NO tiene un
        // listener de `change` propio a propósito — a pedido del usuario,
        // el cambio queda pendiente en el checkbox y solo se persiste al
        // apretar "Guardar configuración" (`settingsSearchSave`, más abajo
        // en `_initSearchSettings`), igual que el resto de los campos de
        // Búsqueda web. Ver DECISIONS.md.

        // ── Crear perfil nuevo ──────────────────────────────
        newProfileBtn.addEventListener('click', async () => {
          const name = newProfileInput.value.trim();
          if (!name) return;
          profileActionMsg.classList.add('hidden');
          try {
            const r = await fetchWithAuth(`${BASE_URL}/search/profiles`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name })
            });
            const d = await r.json();
            if (d.ok) {
              newProfileInput.value = '';
              await refreshServiciosData(`profile:${d.profile.id}`);
              profileActionMsg.textContent = `✓ Perfil "${d.profile.name}" creado`;
              profileActionMsg.style.color = '#4ade80';
            } else {
              profileActionMsg.textContent = `✗ ${d.error}`;
              profileActionMsg.style.color = '#f87171';
            }
          } catch (e) {
            profileActionMsg.textContent = '✗ Error de conexión';
            profileActionMsg.style.color = '#f87171';
          } finally {
            profileActionMsg.classList.remove('hidden');
          }
        });

        // ── Eliminar perfil (usuarios asignados quedan "sin perfil") ──────
        deleteProfileBtn.addEventListener('click', async () => {
          const { type, id } = _parseTarget(_selectedTarget);
          if (type !== 'profile' || id === 'global') return;
          const profileMeta = profiles.find(p => p.id === id);
          if (!confirm(`¿Eliminar el perfil "${profileMeta?.name || id}"? Los usuarios que lo tengan asignado quedarán "sin perfil".`)) return;
          try {
            const r = await fetchWithAuth(`${BASE_URL}/search/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
            const d = await r.json();
            if (d.ok) {
              await refreshServiciosData('profile:global');
            } else {
              profileActionMsg.textContent = `✗ ${d.error}`;
              profileActionMsg.style.color = '#f87171';
              profileActionMsg.classList.remove('hidden');
            }
          } catch (e) {
            console.error('[settings] error eliminando perfil', e);
          }
        });

      _refreshServiciosPanel = refreshServiciosData;

      // Carga inicial — Perfil Global por defecto al abrir la app
      await refreshServiciosData('profile:global');
    } catch (err) {
      console.error('[settings] error cargando selector de servicios', err);
    }
  }

  // ── Abrir carpeta de documentos generados por chat (solo Electron) ──────
  const openDocumentsBtn = document.getElementById('settingsOpenDocumentsBtn');
  if (openDocumentsBtn) {
    if (window.electronAPI?.openDocumentsFolder) {
      openDocumentsBtn.addEventListener('click', async () => {
        openDocumentsBtn.disabled = true;
        try {
          const result = await window.electronAPI.openDocumentsFolder();
          if (!result.ok) {
            console.error('[settings] error abriendo carpeta:', result.error);
          }
        } finally {
          openDocumentsBtn.disabled = false;
        }
      });
    } else {
      // Fuera de Electron (navegador) — la función no aplica
      openDocumentsBtn.disabled = true;
      openDocumentsBtn.title = 'Solo disponible en la app de escritorio';
    }
  }

  // ── Abrir carpeta de transcripciones (solo Electron) ──────────
  const openTranscriptionsBtn = document.getElementById('settingsOpenTranscriptionsBtn');
  if (openTranscriptionsBtn) {
    if (window.electronAPI?.openTranscriptionsFolder) {
      openTranscriptionsBtn.addEventListener('click', async () => {
        openTranscriptionsBtn.disabled = true;
        try {
          const result = await window.electronAPI.openTranscriptionsFolder();
          if (!result.ok) {
            console.error('[settings] error abriendo carpeta:', result.error);
          }
        } finally {
          openTranscriptionsBtn.disabled = false;
        }
      });
    } else {
      // Fuera de Electron (navegador) — la función no aplica
      openTranscriptionsBtn.disabled = true;
      openTranscriptionsBtn.title = 'Solo disponible en la app de escritorio';
    }
  }

  // ── Abrir carpeta de logs (solo Electron, solo admin) ──────────
  const openLogsBtn = document.getElementById('settingsOpenLogsFolderBtn');
  if (openLogsBtn) {
    if (window.electronAPI?.openLogsFolder) {
      openLogsBtn.addEventListener('click', async () => {
        openLogsBtn.disabled = true;
        try {
          const result = await window.electronAPI.openLogsFolder();
          if (!result.ok) {
            console.error('[settings] error abriendo carpeta de logs:', result.error);
          }
        } finally {
          openLogsBtn.disabled = false;
        }
      });
    } else {
      // Fuera de Electron (navegador) — la función no aplica
      openLogsBtn.disabled = true;
      openLogsBtn.title = 'Solo disponible en la app de escritorio';
    }
  }

  // Igual que la sección: solo bindear el chequeo de updates para admin —
  // defensa en profundidad además de ocultar la sección, no solo cosmético.
  if (_isAdmin) _bindUpdateCheck();
  await _bindHardwareProfileToggle();

  await _initSearchSettings();
}