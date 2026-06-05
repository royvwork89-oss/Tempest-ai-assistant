const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { transcribeAudio } = require('../controllers/transcription.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

const audioDir = path.join(__dirname, '../uploads/audio');

if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, audioDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_');

    const uniqueName = `${Date.now()}-${safeName}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.post('/transcribe', authMiddleware, upload.single('audio'), transcribeAudio);

module.exports = router;