'use strict';

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { authMiddleware } = require('../middleware/auth.middleware');

router.get('/gpu/stats', authMiddleware, (req, res) => {
  exec(
    'nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits',
    (err, stdout) => {
      if (err) {
        return res.json({ ok: false, error: 'nvidia-smi no disponible' });
      }
      const parts = stdout.trim().split(',').map(s => s.trim());
      if (parts.length < 5) {
        return res.json({ ok: false, error: 'Formato inesperado de nvidia-smi' });
      }
      res.json({
        ok: true,
        gpu: {
          name: parts[0],
          tempC: parseInt(parts[1]),
          utilizationPct: parseInt(parts[2]),
          vramUsedMB: parseInt(parts[3]),
          vramTotalMB: parseInt(parts[4]),
        }
      });
    }
  );
});

module.exports = router;