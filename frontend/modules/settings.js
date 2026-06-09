import { fetchWithAuth, logout } from './login.js';

let _isAdmin = false;

async function _loadHTML() {
  const res = await fetch('/settings.html');
  const html = await res.text();
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
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
        console.log('[settings] loadUsers:', JSON.stringify(data));
        if (!data.ok) return;
        usersList.innerHTML = data.users.map(u => `
          <div class="settings-user-row">
            <div class="settings-user-info">
              <span class="settings-user-name">${u.username}</span>
              <span class="settings-user-role ${u.role === 'admin' ? 'role-admin' : 'role-user'}">${u.role}</span>
            </div>
            ${u.username !== 'admin' ? `<button class="settings-user-delete" data-username="${u.username}">✕</button>` : ''}
          </div>
        `).join('');

        usersList.querySelectorAll('.settings-user-delete').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm(`¿Eliminar usuario "${btn.dataset.username}"?`)) return;
            await fetchWithAuth(`/auth/users/${btn.dataset.username}`, { method: 'DELETE' });
            await loadUsers();
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
}