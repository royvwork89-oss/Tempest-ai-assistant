import { BASE_URL } from '../config.js';
import { fetchWithAuth, logout } from './login.js';

let _isAdmin = false;
let _selectedTarget = '__global__';

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
          const r = await fetchWithAuth(`${BASE_URL}/search/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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
          const r = await fetchWithAuth(`${BASE_URL}/search/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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
          const target = typeof _selectedTarget !== 'undefined' ? _selectedTarget : '__global__';
          let r;

          if (!target || target === '__global__') {
            // Guardar configuración global
            r = await fetchWithAuth(`${BASE_URL}/search/config`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
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
          } else {
            // Guardar permisos del usuario seleccionado
            const profileSel = document.getElementById('settingsUserProfileSelect');
            const profileId  = profileSel ? profileSel.value : 'none';
            const useGlobal  = profileId === 'global';
            r = await fetchWithAuth(`${BASE_URL}/search/user-providers`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: target,
                profileId,
                useGlobalConfig: useGlobal,
                searchEnabled: document.getElementById('settingsSearchEnabled').checked,
                providers: useGlobal ? null : (() => {
                  const list = [
                    ...(document.getElementById('settingsSearxngEnabled').checked ? ['searxng'] : []),
                    ...(document.getElementById('settingsTavilyEnabled').checked  ? ['tavily']  : [])
                  ];
                  return list.length === 0 ? null : list;
                })()
              })
            });
          }

          const result = await r.json();
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
    return { text: '✓ Descargado', color: '#4ade80', bar: null, action: null };
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
    text: m.required ? 'Requerido — pendiente' : 'No descargado',
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

async function _renderModelsList() {
  const container = document.getElementById('settingsModelsList');
  if (!container) return;

  try {
    const res = await fetchWithAuth(`${BASE_URL}/models/catalog`);
    const data = await res.json();
    if (!data.ok) {
      container.innerHTML = '<p class="settings-hint">No se pudo cargar el catálogo.</p>';
      return;
    }

    container.innerHTML = `
      <style>
        @keyframes settingsModelBarSlide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(330%); }
        }
      </style>
    ` + data.models.map((m) => {
      const status = _modelStatusMeta(m);
      const btnLabel = status.action === 'retry' ? 'Reintentar' : 'Descargar';
      return `
        <div class="settings-model-row" data-model-id="${m.modelId}" style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="flex:1; min-width:0;">
              <div class="settings-model-name" style="font-size:13px;">${m.modelId}${m.required ? ' <em style="opacity:.6;">(requerido)</em>' : ''}</div>
              <div class="settings-model-size settings-hint" style="margin:0;">${_formatBytes(m.sizeBytes)}</div>
            </div>
            <span class="settings-model-status" style="font-size:12px; color:${status.color}; white-space:nowrap; text-align:right;">${status.text}</span>
            ${status.action ? `<button class="settings-model-download-btn btn-secondary" data-model-id="${m.modelId}" style="padding:4px 10px; font-size:12px; white-space:nowrap;">${btnLabel}</button>` : ''}
          </div>
          ${_renderProgressBar(status.bar)}
        </div>
      `;
    }).join('');

    container.querySelectorAll('.settings-model-download-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Iniciando…';
        try {
          await fetchWithAuth(`${BASE_URL}/models/${btn.dataset.modelId}/download`, { method: 'POST' });
        } catch (err) {
          console.error('[settings] error iniciando descarga:', err);
        }
        await _renderModelsList();
      });
    });
  } catch (err) {
    console.error('[settings] error cargando catálogo de modelos:', err);
    container.innerHTML = '<p class="settings-hint">Error de conexión.</p>';
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
  const modal     = document.getElementById('updateCheckModal');
  const title     = document.getElementById('updateModalTitle');
  const message   = document.getElementById('updateModalMessage');
  const primary   = document.getElementById('updateModalPrimaryBtn');
  const secondary = document.getElementById('updateModalSecondaryBtn');
  if (!modal || !title || !message || !primary || !secondary) return;

  // cloneNode+replaceWith para no acumular listeners de revisiones previas
  // (mismo patrón que los modales compartidos de context files — ver ARCHITECTURE.md).
  const newPrimary = primary.cloneNode(true);
  primary.replaceWith(newPrimary);
  const newSecondary = secondary.cloneNode(true);
  secondary.replaceWith(newSecondary);

  const close = () => modal.classList.add('hidden');
  newSecondary.addEventListener('click', close);

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
      newPrimary.disabled = true;
      newPrimary.textContent = 'Descargando…';
      try {
        const dl = await window.electronAPI.downloadUpdate();
        if (!dl.ok) {
          message.textContent = `Error al descargar la actualización: ${dl.error || 'error desconocido'}`;
          newPrimary.classList.add('hidden');
        } else {
          message.textContent = 'Descargando actualización… te avisamos apenas esté lista para reiniciar.';
          newPrimary.classList.add('hidden');
          newSecondary.textContent = 'Cerrar';
        }
      } catch (err) {
        message.textContent = `Error al descargar la actualización: ${err.message || 'error desconocido'}`;
        newPrimary.classList.add('hidden');
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

  const btn = document.getElementById('settingsBtn');
  const modal = document.getElementById('settingsModal');
  const closeBtn = document.getElementById('closeSettingsBtn');
  const devSection = document.getElementById('settingsDevModeSection');
  const debugToggle = document.getElementById('settingsDebugToggle');

  // Mostrar sección de debug solo para admin
  if (_isAdmin) devSection.classList.remove('hidden');

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
        const res = await fetchWithAuth(`${BASE_URL}/auth/users`);
        const data = await res.json();
        if (!data.ok) return;
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
                <option value="global" ${u.profileId === 'global' ? 'selected' : ''}>Global</option>
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
            const useGlobalConfig = profileId === 'global';
            await fetchWithAuth(`${BASE_URL}/search/user-providers`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username,
                profileId,
                useGlobalConfig,
                providers: useGlobalConfig ? null : undefined
              })
            });
          });
        });

      } catch (err) {
        console.error('[settings] loadUsers error:', err);
      }
    }

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
    });
  });

  // ─────────────────────────────────────────────
  // Cargar selector de Servicios (perfiles + usuarios)
  // ─────────────────────────────────────────────

  if (_isAdmin) {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/auth/users`);
      const data = await res.json();

      if (data.ok) {
        const select       = document.getElementById('settingsUserSelect');
        const btnYo        = document.getElementById('settingsUserSelectMe');
        const globalRow    = document.getElementById('settingsUserGlobalRow');
        const globalCheck  = document.getElementById('settingsUserGlobalCheck') || { checked: false, addEventListener: () => {} };
        const permsRow     = document.getElementById('settingsUserProvidersRow') || { classList: { add: () => {}, remove: () => {} }, style: {} };
        const permHint     = document.getElementById('settingsUserPermHint');
        const myUsername   = JSON.parse(localStorage.getItem('tempest_user') || '{}').username;
        _selectedTarget = '__global__'; // resetear al abrir Servicios

        // Ordenar: admins primero (admin principal siempre el primero), luego users — ambos alfabético
        const admins = data.users
          .filter(u => u.role === 'admin')
          .sort((a, b) => {
            if (a.username === 'admin') return -1;
            if (b.username === 'admin') return 1;
            return a.username.localeCompare(b.username);
          });
        const users = data.users
          .filter(u => u.role !== 'admin')
          .sort((a, b) => a.username.localeCompare(b.username));

        // Construir dropdown: Perfil Global → admins → separator → users
        select.innerHTML = `<option value="__global__">— Perfil Global —</option>`;
        if (admins.length) {
          admins.forEach(u => {
            select.innerHTML += `<option value="${u.username}">${u.username} (admin)</option>`;
          });
        }
        if (users.length) {
          select.innerHTML += `<optgroup label="────────────────"></optgroup>`;
          users.forEach(u => {
            select.innerHTML += `<option value="${u.username}">${u.username}</option>`;
          });
        }

        // ── Función: cargar permisos del seleccionado ──────
        async function loadSelectedPerms(value) {
          globalRow.classList.add('hidden');
          permsRow.classList.add('hidden');
          permHint.classList.add('hidden');
          // Rehabilitar todos los controles al inicio
          ['settingsSearxngEnabled', 'settingsTavilyEnabled', 'settingsBraveEnabled'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = false;
          });
          document.getElementById('settingsSearxngUrl').disabled = false;
          document.getElementById('settingsTavilyKey').disabled = false;
          document.getElementById('settingsSearchSave').disabled = false;
          document.getElementById('settingsSearchSave')?.classList.remove('hidden');
          document.getElementById('settingsSearchSaveResult')?.classList.add('hidden');

          const searchSection = document.getElementById('settingsSearchSection');

          if (value === '__global__') {
            globalRow.classList.add('hidden');
            if (searchSection) {
              searchSection.classList.remove('hidden');
              const masterRow = searchSection.querySelector('.settings-row');
              const masterHint = searchSection.querySelector('.settings-hint');
              if (masterRow) masterRow.style.display = '';
              if (masterHint) masterHint.style.display = '';
            }
            // Recargar valores globales en los toggles
            try {
              const r = await fetchWithAuth(`${BASE_URL}/search/config`);
              const d = await r.json();
              const cfg = d.config;
              if (cfg) {
                document.getElementById('settingsSearchEnabled').checked = cfg.globalEnabled;
                document.getElementById('settingsSearxngEnabled').checked = cfg.providers?.searxng?.enabled || false;
                document.getElementById('settingsSearxngUrl').value = cfg.providers?.searxng?.url || '';
                document.getElementById('settingsTavilyEnabled').checked = cfg.providers?.tavily?.enabled || false;
                document.getElementById('settingsTavilyKey').value = cfg.providers?.tavily?.apiKey || '';
              }
            } catch (_) {}
            permHint.textContent = 'Editando providers del Perfil Global. Los cambios afectan a todos los usuarios con este perfil asignado.';
            permHint.classList.remove('hidden');
            return;
          }

          globalRow.classList.remove('hidden');

          // Cargar perfil del usuario antes de decidir visibilidad
          try {
            const r    = await fetchWithAuth(`${BASE_URL}/auth/users`);
            const d    = await r.json();
            const user = d.users?.find(u => u.username === value);
            if (!user) return;

            const profileId = user.profileId ?? 'none';
            const profileSel = document.getElementById('settingsUserProfileSelect');
            if (profileSel) profileSel.value = profileId;

            const hasProfile = profileId !== 'none';

            // Sin perfil → mostrar sección de providers (config individual)
            // Con perfil → ocultar sección (hereda del perfil)
            if (searchSection) {
              if (hasProfile) {
                searchSection.classList.add('hidden');
              } else {
                searchSection.classList.remove('hidden');
                // Mostrar toggle maestro para usuarios individuales también
                const masterRow = searchSection.querySelector('.settings-row');
                const masterHint = searchSection.querySelector('.settings-hint');
                if (masterRow) masterRow.style.display = '';
                if (masterHint) masterHint.style.display = '';
              }
            }

            // Deshabilitar URL/Key/Guardar si tiene perfil
            ['settingsSearxngEnabled', 'settingsTavilyEnabled', 'settingsBraveEnabled'].forEach(id => {
              const el = document.getElementById(id);
              if (el) el.disabled = hasProfile;
            });
            document.getElementById('settingsSearxngUrl').disabled = hasProfile;
            document.getElementById('settingsTavilyKey').disabled = hasProfile;
            const saveBtn = document.getElementById('settingsSearchSave');
            if (saveBtn) {
              saveBtn.disabled = hasProfile;
              hasProfile ? saveBtn.classList.add('hidden') : saveBtn.classList.remove('hidden');
            }

            if (!hasProfile) {
              // Sin perfil → cargar providers propios del usuario
              const allowed = user.searchProviders;
              document.getElementById('settingsSearchEnabled').checked = user.searchEnabled !== false;
              document.getElementById('settingsSearxngEnabled').checked = allowed === null || (allowed?.includes('searxng'));
              document.getElementById('settingsTavilyEnabled').checked  = allowed === null || (allowed?.includes('tavily'));
            }
            return;
          } catch (err) {
            console.error('[settings] error cargando permisos de usuario', err);
          }
        }

        // ── Función: guardar permisos ──────────────────────
        async function saveUserPerms(username, useGlobal) {
          const providers = useGlobal ? null : [
            ...(document.getElementById('settingsSearxngEnabled').checked ? ['searxng'] : []),
            ...(document.getElementById('settingsTavilyEnabled').checked  ? ['tavily']  : []),
          ];

          await fetchWithAuth(`${BASE_URL}/search/user-providers`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username,
              providers,
              useGlobalConfig: useGlobal
            })
          });
        }

        // ── Listener: cambio de selección ─────────────────
        select.addEventListener('change', () => {
          _selectedTarget = select.value;
          loadSelectedPerms(_selectedTarget);
        });

        // ── Botón Yo ──────────────────────────────────────
        btnYo.addEventListener('click', () => {
          select.value = myUsername;
          _selectedTarget = myUsername;
          loadSelectedPerms(myUsername);
        });

        document.getElementById('settingsUserProfileSelect')?.addEventListener('change', async () => {
          const username = _selectedTarget;
          if (!username || username === '__global__') return;
          const profileId = document.getElementById('settingsUserProfileSelect').value;
          const useGlobalConfig = profileId === 'global';
          await fetchWithAuth(`${BASE_URL}/search/user-providers`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, profileId, useGlobalConfig, providers: useGlobalConfig ? null : undefined })
          });
          await loadSelectedPerms(username);
        });

        

        // Cargar Perfil Global por defecto al abrir
        await loadSelectedPerms('__global__');
      }
    } catch (err) {
      console.error('[settings] error cargando selector de servicios', err);
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

  _bindUpdateCheck();

  await _initSearchSettings();
}