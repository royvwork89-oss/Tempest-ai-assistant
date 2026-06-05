const express = require('express');
const router = express.Router();
const { isAdmin, isDevModeEnabled, toggleDevMode } = require('../services/devMode.service');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.middleware');

router.get('/me', authMiddleware, (req, res) => {
  res.json({ role: req.user.role });
});

router.post('/debug/toggle', authMiddleware, adminMiddleware, (req, res) => {
  if (!isAdmin()) return res.status(403).json({ ok: false, error: 'No autorizado' });
  const { enabled } = req.body;
  const result = toggleDevMode(enabled);
  res.json({ ok: true, devMode: result });
});

router.get('/debug/status', authMiddleware, adminMiddleware, (req, res) => {
  if (!isAdmin()) return res.status(403).json({ ok: false, error: 'No autorizado' });
  res.json({ ok: true, devMode: isDevModeEnabled() });
});

module.exports = router;