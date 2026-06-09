// backend/routes/search.routes.js
const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const { getConfig, updateConfig, testProvider } = require('../controllers/search.controller');

router.get  ('/search/config',  authMiddleware, getConfig);
router.patch('/search/config',  authMiddleware, updateConfig);
router.post ('/search/test',    authMiddleware, testProvider);

module.exports = router;