'use strict';

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');

router.get('/localai/metrics', authMiddleware, async (req, res) => {
  try {
    const response = await fetch('http://localhost:8080/metrics');
    const text = await response.text();

    const result = {
      ok: true,
      tokens: {},
      requests: {}
    };

    // Parsear localai_tokens_total
    const tokenRegex = /localai_tokens_total\{[^}]*?kind="([^"]+)"[^}]*?served_model="([^"]+)"[^}]*?\}\s+([\d.]+)|localai_tokens_total\{[^}]*?served_model="([^"]+)"[^}]*?kind="([^"]+)"[^}]*?\}\s+([\d.]+)/g;
    let match;
    while ((match = tokenRegex.exec(text)) !== null) {
      const model = match[2] || match[4];
      const kind = match[1] || match[5];
      const value = parseInt(match[3] || match[6]);
      if (!result.tokens[model]) result.tokens[model] = {};
      result.tokens[model][kind] = value;
    }

    // Parsear localai_billed_requests_total
    const reqRegex = /localai_billed_requests_total\{[^}]*served_model="([^"]+)"[^}]*\}\s+([\d.]+)/g;
    while ((match = reqRegex.exec(text)) !== null) {
      result.requests[match[1]] = parseInt(match[2]);
    }

    res.json(result);
  } catch (err) {
    res.json({ ok: false, error: 'No se pudo conectar con LocalAI metrics' });
  }
});

module.exports = router;