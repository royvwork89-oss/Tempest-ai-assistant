'use strict';

const { verifyToken, renewToken } = require('../services/auth.service');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'No autenticado' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }

  // Renovar token en cada request (sliding expiration)
  const newToken = renewToken(payload);
  res.setHeader('X-Renewed-Token', newToken);

  req.user = payload;
  next();
}

function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'No autorizado' });
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware };