import { fetchWithAuth, logout } from './login.js';

let _isAdmin = false;

async function _loadHTML() {
  const res = await fetch('/settings.html');
  const html = await res.text();
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
}

async function _initSearchSettings() {
  try {
    const res  = await fetchWithAuth('/search/config');
    const data = await res.json();

    // ── Sección admin ──────────────────────────────────────
    if (_isAdmin) {
      document.getElementById('settingsSearchSection').classList.remove('hidden');

      const cfg = data.config;
      document.getElementById('settingsSearchEnabled').checked  = cfg.globalEnabled;
      document.getElementById('settingsSearxngEnabled').checked = cfg.providers.searxng.enabled;
      document.getElementById('settingsSearxngUrl').value       = cfg.providers.searxng.url || 'http://localhost:8081';

      // Botón Probar — cloneNode para evitar listeners duplicados
      const testBtn    = document.getElementById('settingsSearxngTest');
      const testResult = document.getElementById('settingsSearxngTestResult');
      const newTest    = testBtn.cloneNode(true);
      testBtn.replaceWith(newTest);

      newTest.addEventListener('click', async () => {
        newTest.disabled    = true;
        newTest.textContent = 'Probando...';
        testResult.classList.add('hidden');
        try {
          const r = await fetchWithAuth('/search/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'searxng',
              testUrl:  document.getElementById('settingsSearxngUrl').value.trim()
            })
          });
          const result = await r.json();
          testResult.textContent = result.ok
            ? `✓ Conexión exitosa (${result.count} resultado${result.count !== 1 ? 's' : ''})`
            : `✗ Error: ${result.error}`;
          testResult.style.color = result.ok ? '#4ade80' : '#f87171';
        } catch {
          testResult.textContent = '✗ Error de conexión';
          testResult.style.color = '#f87171';
        } finally {
          newTest.disabled    = false;
          newTest.textContent = 'Probar';
          testResult.classList.remove('hidden');
        }
      });

      // Botón Guardar
      const saveBtn    = document.getElementById('settingsSearchSave');
      const saveResult = document.getElementById('settingsSearchSaveResult');
      const newSave    = saveBtn.cloneNode(true);
      saveBtn.replaceWith(newSave);

      newSave.addEventListener('click', async () => {
        try {
          const r = await fetchWithAuth('/search/config', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              globalEnabled: document.getElementById('settingsSearchEnabled').checked,
              providers: {
                searxng: {
                  enabled: document.getElementById('settingsSearxngEnabled').checked,
                  url:     document.getElementById('settingsSearxngUrl').value.trim()
                }
              }
            })
          });
          const result = await r.json();
          saveResult.textContent = result.ok ? '✓ Configuración guardada' : `✗ ${result.error}`;
          saveResult.style.color = result.ok ? '#4ade80' : '#f87171';
        } catch {
          saveResult.textContent = '✗ Error de conexión';
          saveResult.style.color = '#f87171';
        } finally {
          saveResult.classList.remove('hidden');
          setTimeout(() => saveResult.classList.add('hidden'), 3000);
        }
      });
    }

    // ── Sección usuario: selector de provider ──────────────
    const globalEnabled    = _isAdmin ? data.config?.globalEnabled    : data.globalEnabled;
    const enabledProviders = _isAdmin
      ? Object.entries(data.config?.providers || {}).filter(([, v]) => v.enabled).map(([k]) => k)
      : (data.enabledProviders || []);

    if (globalEnabled && enabledProviders.length > 1) {
      const provSection = document.getElementById('settingsSearchProviderSection');
      const provList    = document.getElementById('settingsProviderList');
      const saved       = localStorage.getItem('tempest_search_provider') || enabledProviders[0];
      const LABELS      = { searxng: 'SearXNG (local)', brave: 'Brave Search' };

      provList.innerHTML = enabledProviders.map(p => `
        <label class="settings-provider-option">
          <input type="radio" name="searchProvider" value="${p}" ${p === saved ? 'checked' : ''}>
          <span>${LABELS[p] || p}</span>
        </label>
      `).join('');

      provList.querySelectorAll('input[name="searchProvider"]').forEach(radio => {
        radio.addEventListener('change', () => {
          localStorage.setItem('tempest_search_provider', radio.value);
          import('./webSearch.js').then(m => m.setProvider(radio.value));
        });
      });

      provSection.classList.remove('hidden');
    }

  } catch (e) {
    console.warn('[settings] search init error:', e.message);
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

  // Cargar estado actual del debug
  if (_isAdmin) {
    try {
      const res = await fetchWithAuth('/debug/status');
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
  });

  // Cerrar sesión — modal de confirmación
  const logoutConfirmModal = document.getElementById('logoutConfirmModal');
  const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
  const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

  document.getElementById('logoutBtn').addEventListener('click', () => {
    modal.classList.add('hidden');
    logoutConfirmModal.classList.remove('hidden');
  });

  cancelLogoutBtn.addEventListener('click', () => {
    logoutConfirmModal.classList.add('hidden');
    modal.classList.remove('hidden');
  });

  confirmLogoutBtn.addEventListener('click', async () => {
    await logout();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
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
        const res = await fetchWithAuth('/debug/toggle', {
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
        const res = await fetchWithAuth('/auth/users');
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
              <button class="settings-user-pwd-btn btn-secondary" data-username="${u.username}" style="padding: 4px 8px; font-size: 11px;">🔑</button>
              ${u.username !== 'admin' ? `<button class="settings-user-delete" data-username="${u.username}">✕</button>` : ''}
            </div>
          </div>
        `).join('');

        usersList.querySelectorAll('.settings-user-delete').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm(`¿Eliminar usuario "${btn.dataset.username}"?`)) return;
            await fetchWithAuth(`/auth/users/${btn.dataset.username}`, { method: 'DELETE' });
            await loadUsers();
          });
        });

        usersList.querySelectorAll('.settings-user-role-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const newRole = btn.dataset.role === 'admin' ? 'user' : 'admin';
            if (!confirm(`¿Cambiar rol de "${btn.dataset.username}" a ${newRole}?`)) return;
            await fetchWithAuth(`/auth/users/${btn.dataset.username}/role`, {
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
        const res = await fetchWithAuth('/auth/users', {
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
        const res = await fetchWithAuth(`/auth/users/${username}/password`, {
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
  
  await _initSearchSettings();
}