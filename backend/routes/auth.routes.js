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