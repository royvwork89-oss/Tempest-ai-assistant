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
  getHardwareProfile
} = require('../controllers/chat.controller');

const attachmentsDir = path.join(__dirname, '..', 'uploads', 'attachments');

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

router.post('/chat', upload.array('attachments', 8), chat);
router.get('/chat/history', getChatHistory);

router.get('/chats', listChats);
router.post('/chat/create', createChat);
router.post('/chat/delete', deleteChat);

router.get('/projects', listProjects);
router.post('/project/create', createProject);
router.post('/project/delete', deleteProject);
router.post('/chat/rename', renameChat);
router.post('/project/rename', renameProject);
router.post('/title/generate', generateTitle);
router.get('/hardware-profile', getHardwareProfile);

module.exports = router;