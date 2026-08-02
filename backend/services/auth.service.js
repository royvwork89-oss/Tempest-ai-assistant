'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { DATA_DIR } = require('../config/appPaths');

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'tempest_secret_key';
const TOKEN_EXPIRY = '2h';

const revokedTokens = new Set();

function revokeToken(token) {
  revokedTokens.add(token);
}

function isTokenRevoked(token) {
  return revokedTokens.has(token);
}

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

async function initDefaultAdmin() {
  const users = loadUsers();
  if (users.length > 0) return;

  const hash = await bcrypt.hash('admin', 10);
  saveUsers([{
    id: 'admin',
    username: 'admin',
    passwordHash: hash,
    role: 'admin',
    createdAt: new Date().toISOString()
  }]);
  console.log('[auth] Usuario admin creado con contraseña por defecto: admin');
}

async function login(username, password) {
  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  return { token, user: { id: user.id, username: user.username, role: user.role } };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function renewToken(payload) {
  const token = jwt.sign(
    { id: payload.id, username: payload.username, role: payload.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
  return token;
}

async function createUser(username, password, role = 'user') {
  const users = loadUsers();
  if (users.find(u => u.username === username)) {
    throw new Error('El usuario ya existe');
  }
  const hash = await bcrypt.hash(password, 10);
  const newUser = {
    id: username,
    username,
    passwordHash: hash,
    role,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  saveUsers(users);
  return { id: newUser.id, username: newUser.username, role: newUser.role };
}

function deleteUser(username) {
  const users = loadUsers();
  const filtered = users.filter(u => u.username !== username);
  if (filtered.length === users.length) throw new Error('Usuario no encontrado');
  if (!filtered.find(u => u.role === 'admin')) throw new Error('No puedes eliminar el último admin');
  saveUsers(filtered);
}

function listUsers() {
  return loadUsers().map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
    searchProviders: u.searchProviders ?? null,
    useGlobalConfig: u.useGlobalConfig ?? false,
    profileId: u.profileId ?? 'none',
    searchEnabled: u.searchEnabled ?? true,
    allowPersonalDataLog: u.allowPersonalDataLog ?? false
  }));
}

async function changePassword(username, newPassword) {
  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) throw new Error('Usuario no encontrado');
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  saveUsers(users);
}

function changeRole(username, newRole, currentToken = null) {
  if (!['admin', 'user'].includes(newRole)) throw new Error('Rol inválido');
  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) throw new Error('Usuario no encontrado');
  if (username === 'admin') throw new Error('No puedes cambiar el rol del admin principal');
  user.role = newRole;
  saveUsers(users);
  if (currentToken) revokeToken(currentToken);
}

const VALID_SEARCH_PROVIDERS = ['searxng', 'brave', 'tavily'];

function setSearchProviders(username, providers, useGlobalConfig = false, profileId = 'none', searchEnabled = true) {
  // null = sin restricción (todos); [] = búsqueda deshabilitada; array = lista permitida
  if (providers !== null) {
    if (!Array.isArray(providers)) throw new Error('searchProviders debe ser un array o null');
    const invalid = providers.filter(p => !VALID_SEARCH_PROVIDERS.includes(p));
    if (invalid.length) throw new Error(`Providers inválidos: ${invalid.join(', ')}`);
  }
  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) throw new Error('Usuario no encontrado');
  user.searchProviders = providers;
  user.useGlobalConfig = useGlobalConfig;
  user.profileId = profileId;
  user.searchEnabled = searchEnabled;
  saveUsers(users);
}

function getUserSearchProviders(username) {
  const user = loadUsers().find(u => u.username === username);
  if (!user) return null;
  return user.searchProviders ?? null; // null = sin restricción
}

// Reasigna el perfil de búsqueda de un usuario. 'none' = usuario "sin
// perfil" — pasa a tener su propio registro independiente de providers/
// apiKeys en search-config.json (ver search.service.js), en vez de heredar
// la config de un perfil compartido.
function setUserProfile(username, profileId) {
  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) throw new Error('Usuario no encontrado');
  user.profileId = profileId || 'none';
  saveUsers(users);
}

// Usado al eliminar un perfil de búsqueda: todos los usuarios que lo tenían
// asignado quedan "sin perfil" (nunca heredan silenciosamente otro perfil).
function reassignProfileUsers(oldProfileId, newProfileId = 'none') {
  const users = loadUsers();
  let changed = false;
  for (const u of users) {
    if (u.profileId === oldProfileId) { u.profileId = newProfileId; changed = true; }
  }
  if (changed) saveUsers(users);
  return changed;
}

// Consentimiento por usuario para incluir texto de pregunta/respuesta en el
// trace de diagnóstico (requests-*.jsonl) — ver DECISIONS.md → "Trace de
// ejecución por request". Antes era un switch global en Configuración →
// Preferencias, pero eso activaba/desactivaba TODOS los usuarios de la
// instalación a la vez; un admin no podía elegir "esto sí para fulano, esto
// no para mengano". Ahora vive por usuario, gestionado desde Servicios →
// Búsqueda web (junto al selector de usuario) — un solo campo booleano
// (`allowPersonalDataLog`, antes dos campos separados para pregunta/
// respuesta — se combinaron en uno solo a pedido del usuario, más simple de
// entender: "guardo contenido personal de este usuario, sí o no"). Default
// false para todos.
function setUserLogConsent(username, { allowPersonalDataLog } = {}) {
  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) throw new Error('Usuario no encontrado');
  if (typeof allowPersonalDataLog === 'boolean') user.allowPersonalDataLog = allowPersonalDataLog;
  saveUsers(users);
  return { allowPersonalDataLog: user.allowPersonalDataLog ?? false };
}

function getUserLogConsent(username) {
  const user = loadUsers().find(u => u.username === username);
  if (!user) return { allowPersonalDataLog: false };
  return { allowPersonalDataLog: user.allowPersonalDataLog ?? false };
}

module.exports = {
  initDefaultAdmin, login, verifyToken, renewToken, createUser, deleteUser, listUsers,
  changePassword, changeRole, isTokenRevoked, setSearchProviders, getUserSearchProviders,
  setUserProfile, reassignProfileUsers, setUserLogConsent, getUserLogConsent
};