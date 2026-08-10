'use strict';

const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const { getTokenMetrics } = require('../services/localai.service');

router.get('/localai/metrics', authMiddleware, (req, res) => {
  const tokens = getTokenMetrics();
  res.json({ ok: true, tokens, requests: {} });
});

module.exports = router;