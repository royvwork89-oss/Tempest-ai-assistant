const TOKEN_KEY = 'tempest_token';
const USER_KEY = 'tempest_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}

export async function initLogin() {
  if (isAuthenticated()) return true;

  return new Promise((resolve) => {
    _showLoginScreen(resolve);
  });
}

export async function logout() {
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
  } catch { }
  clearSession();
  location.reload();
}

function _showLoginScreen(onSuccess) {
  const app = document.querySelector('.app');
  app.style.display = 'none';

  const loginEl = document.createElement('div');
  loginEl.id = 'loginScreen';
  loginEl.innerHTML = `
    <div class="login-box">
      <h1 class="login-title">Tempest</h1>
      <p class="login-subtitle">Asistente IA local</p>
      <div class="login-form">
        <input id="loginUsername" type="text" placeholder="Usuario" autocomplete="username" />
        <input id="loginPassword" type="password" placeholder="Contraseña" autocomplete="current-password" />
        <p id="loginError" class="login-error hidden"></p>
        <button id="loginBtn">Ingresar</button>
      </div>
    </div>
  `;
  document.body.appendChild(loginEl);

  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');

  async function attemptLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      _showError(loginError, 'Ingresa usuario y contraseña');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Ingresando...';

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.ok) {
        saveSession(data.token, data.user);
        loginEl.remove();
        app.style.display = '';
        onSuccess(true);
      } else {
        _showError(loginError, data.error || 'Credenciales incorrectas');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Ingresar';
      }
    } catch {
      _showError(loginError, 'No se pudo conectar con el servidor');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Ingresar';
    }
  }

  loginBtn.addEventListener('click', attemptLogin);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptLogin();
  });
  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') passwordInput.focus();
  });
}

function _showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

export function fetchWithAuth(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}