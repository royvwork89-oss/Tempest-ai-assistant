'use strict';

const express = require('express');
const router = express.Router();
const { login, createUser, deleteUser, listUsers } = require('../services/auth.service');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.middleware');

// Login
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Usuario y contraseña requeridos' });
    }
    const result = await login(username, password);
    if (!result) {
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    }
    res.json({ ok: true, token: result.token, user: result.user });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Logout (el frontend elimina el token)
router.post('/auth/logout', authMiddleware, (req, res) => {
  res.json({ ok: true });
});

// Listar usuarios (solo admin)
router.get('/auth/users', authMiddleware, adminMiddleware, (req, res) => {
  try {
    res.json({ ok: true, users: listUsers() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Crear usuario (solo admin)
router.post('/auth/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Usuario y contraseña requeridos' });
    }
    const user = await createUser(username, password, role || 'user');
    res.json({ ok: true, user });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});
// Cambiar contraseña (el usuario cambia la suya, o admin cambia la de cualquiera)
router.patch('/auth/users/:username/password', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ ok: false, error: 'Contraseña requerida' });
    if (req.user.username !== req.params.username && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'No autorizado' });
    }
    const { changePassword } = require('../services/auth.service');
    await changePassword(req.params.username, password);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Cambiar rol (solo admin)
router.patch('/auth/users/:username/role', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ ok: false, error: 'Rol requerido' });
    const { changeRole } = require('../services/auth.service');
    const token = req.headers['authorization'].split(' ')[1];
    await changeRole(req.params.username, role, token);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Consentimiento de log por usuario — permite/deniega que la pregunta Y la
// respuesta de ESE usuario en particular se guarden en el trace de
// diagnóstico (requests-*.jsonl). Un solo campo para ambas cosas: son "datos
// personales" y se aceptan o no en bloque. Solo admin. Ver DECISIONS.md →
// "Trace de ejecución por request — consentimiento de log por usuario".
router.patch('/auth/users/:username/log-consent', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { allowPersonalDataLog } = req.body || {};
    const { setUserLogConsent } = require('../services/auth.service');
    const result = setUserLogConsent(req.params.username, { allowPersonalDataLog });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Eliminar usuario (solo admin)
router.delete('/auth/users/:username', authMiddleware, adminMiddleware, (req, res) => {
  try {
    deleteUser(req.params.username);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;