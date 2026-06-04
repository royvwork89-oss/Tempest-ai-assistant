const express = require('express');
const router = express.Router();
const { isAdmin, isDevModeEnabled, toggleDevMode } = require('../services/devMode.service');

router.get('/me', (req, res) => {
  res.json({ role: isAdmin() ? 'admin' : 'user' });
});

router.post('/debug/toggle', (req, res) => {
  if (!isAdmin()) return res.status(403).json({ ok: false, error: 'No autorizado' });
  const { enabled } = req.body;
  const result = toggleDevMode(enabled);
  res.json({ ok: true, devMode: result });
});

router.get('/debug/status', (req, res) => {
  if (!isAdmin()) return res.status(403).json({ ok: false, error: 'No autorizado' });
  res.json({ ok: true, devMode: isDevModeEnabled() });
});

module.exports = router;