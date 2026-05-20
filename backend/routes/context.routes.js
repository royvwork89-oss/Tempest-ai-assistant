// Rutas para el contexto de un proyecto
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const ctrl    = require('../controllers/context.controller');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '../uploads/context-tmp/'),
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
});

router.get('/project/:projectId/context/items',          ctrl.listItems);
router.post('/project/:projectId/context/upload', upload.array('files', 20), ctrl.uploadFiles);
router.patch('/project/:projectId/context/item/:id',      ctrl.updateItem);
router.delete('/project/:projectId/context/item/:id',     ctrl.deleteItem);
router.get('/project/:projectId/settings',               ctrl.getSettings);
router.patch('/project/:projectId/settings',              ctrl.updateSettings);
router.post('/project/:projectId/context/snapshot',        ctrl.createSnapshot);
router.get('/project/:projectId/context/snapshot/status', ctrl.getSnapshotStatus);
router.post('/project/:projectId/patch/apply',             ctrl.applyPatch);

module.exports = router;