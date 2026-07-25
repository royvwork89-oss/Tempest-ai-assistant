const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const {
  chat,
  getChatHistory,
  listChats,
  createChat,
  deleteChat,
  listProjects,
  createProject,
  deleteProject,
  renameChat,
  renameProject,
  generateTitle,
  getHardwareProfile,
  setHardwareProfileEndpoint,
  saveMessage
} = require('../controllers/chat.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { UPLOADS_DIR } = require('../config/appPaths');

const attachmentsDir = path.join(UPLOADS_DIR, 'attachments');

if (!fs.existsSync(attachmentsDir)) {
  fs.mkdirSync(attachmentsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, attachmentsDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_');

    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    files: 8,
    fileSize: 10 * 1024 * 1024
  }
});

router.post('/chat', authMiddleware, upload.array('attachments', 8), chat);
router.get('/chat/history', authMiddleware, getChatHistory);
router.post('/chat/message/save', authMiddleware, saveMessage);

router.get('/chats', authMiddleware, listChats);
router.post('/chat/create', authMiddleware, createChat);
router.post('/chat/delete', authMiddleware, deleteChat);

router.get('/projects', authMiddleware, listProjects);
router.post('/project/create', authMiddleware, createProject);
router.post('/project/delete', authMiddleware, deleteProject);
router.post('/chat/rename', authMiddleware, renameChat);
router.post('/project/rename', authMiddleware, renameProject);
router.post('/title/generate', authMiddleware, generateTitle);
router.get('/hardware-profile', getHardwareProfile);
// Sin authMiddleware, igual que el GET de arriba — es config local de la
// máquina, no datos de usuario. La UI de Preferencias y el futuro instalador
// la usan sin depender de que haya sesión iniciada todavía.
router.post('/hardware-profile', setHardwareProfileEndpoint);

module.exports = router;