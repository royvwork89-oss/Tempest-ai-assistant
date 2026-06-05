// Rutas para el contexto de un proyecto
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const ctrl    = require('../controllers/context.controller');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');

const upload = multer({
  dest: path.join(__dirname, '../uploads/context-tmp/'),
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
});

router.get('/project/:projectId/context/items',          authMiddleware, ctrl.listItems);
router.post('/project/:projectId/context/upload', authMiddleware, upload.array('files', 20), ctrl.uploadFiles);
router.patch('/project/:projectId/context/item/:id',      authMiddleware, ctrl.updateItem);
router.delete('/project/:projectId/context/item/:id',     authMiddleware, ctrl.deleteItem);
router.get('/project/:projectId/settings',               authMiddleware, ctrl.getSettings);
router.patch('/project/:projectId/settings',              authMiddleware, ctrl.updateSettings);
router.post('/project/:projectId/context/snapshot',        authMiddleware, ctrl.createSnapshot);
router.get('/project/:projectId/context/snapshot/status', authMiddleware, ctrl.getSnapshotStatus);
router.post('/project/:projectId/patch/apply',             authMiddleware, ctrl.applyPatch);
router.post('/project/:projectId/context/snapshot/toggle', authMiddleware, ctrl.toggleSnapshot);
router.get('/fs/browse', authMiddleware, ctrl.browsePath);

module.exports = router;