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
  });

  // Cerrar sesión
  document.getElementById('logoutBtn').addEventListener('click', async () => {
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

  await _initSearchSettings();
}