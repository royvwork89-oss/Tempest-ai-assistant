// backend/routes/search.routes.js
const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const {
  getConfig,
  listProfilesHandler,
  createProfileHandler,
  deleteProfileHandler,
  getRecordHandler,
  saveRecordHandler,
  testProvider,
  updateUserProfile
} = require('../controllers/search.controller');

// Usado por el botón de búsqueda web del chat — todos los roles
router.get   ('/search/config', authMiddleware, getConfig);

// Panel Servicios (admin) — perfiles
router.get   ('/search/profiles',     authMiddleware, listProfilesHandler);
router.post  ('/search/profiles',     authMiddleware, createProfileHandler);
router.delete('/search/profiles/:id', authMiddleware, deleteProfileHandler);

// Panel Servicios (admin) — config puntual de un perfil o de un usuario sin perfil
router.get   ('/search/record', authMiddleware, getRecordHandler);
router.patch ('/search/record', authMiddleware, saveRecordHandler);

// Panel Servicios (admin) — probar conexión de un registro puntual
router.post  ('/search/test', authMiddleware, testProvider);

// Panel Servicios (admin) — reasignar el perfil de un usuario
router.patch ('/search/user-profile', authMiddleware, updateUserProfile);

module.exports = router;
