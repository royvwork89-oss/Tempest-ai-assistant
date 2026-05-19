const { sendToLocalAI, streamToLocalAI, generateTitleFromText } = require('../services/localai.service');
const memory = require('../services/memory.service');
const {
  buildAttachmentContext,
  getAttachmentNames,
  cleanupFiles
} = require('../services/attachment.service');
const { detectMode } = require('../services/mode.router');
// Al inicio del archivo, después de los requires existentes
const { initProject } = require('../services/context/context.service');
const { detectBestModel } = require('../services/model.router');
const HARDWARE_PROFILE = 'desktop'; // cambiar a 'laptop' en la laptop

function buildMemoryOptions(req) {
  return {
    userId: req.body?.userId || req.query?.userId || memory.DEFAULT_USER_ID,
    projectId: req.body?.projectId || req.query?.projectId || memory.DEFAULT_PROJECT_ID,
    chatId: req.body?.chatId || req.query?.chatId || memory.DEFAULT_CHAT_ID
  };
}

function buildPrefixedMessage(rawMessage, mode, variant) {
  const base = rawMessage.trim() || 'Analiza los archivos adjuntos.';
  if (mode === 'explain') {
    return `Responde SOLO con texto explicativo, sin bloques de código. ${base}`;
  }
  if (mode === 'coder' && variant === 'hybrid') {
    return `Explica brevemente en texto y luego entrega el código organizado por archivos. ${base}`;
  }
  // coder/strict y general no necesitan prefijo
  return base;
}

async function chat(req, res) {
  const files = req.files || [];

  try {
    const rawMessage = req.body?.message || '';

    if ((!rawMessage || !rawMessage.trim()) && files.length === 0) {
      return res.status(400).json({ ok: false, error: 'El mensaje está vacío' });
    }

    let config = req.body?.config || {};
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch { config = {}; }
    }
    console.log('[CONFIG]', { primaryModel: config.primaryModel, hardwareProfile: config.hardwareProfile, mode: config.mode });

    const rawTrimmed = rawMessage.trim();
    const { mode, variant, reason } = detectMode({
      rawMessage: rawTrimmed,
      files,
      configMode: config.mode || null
    });

    console.log(`[MODE ROUTER] mode=${mode} variant=${variant} reason="${reason}"`);

    const userMessage = buildPrefixedMessage(rawTrimmed, mode, variant);
    const memoryOptions = buildMemoryOptions(req);

    // detectUserData recibe el mensaje limpio, sin prefijos de instrucción
    memory.detectUserData(rawTrimmed, memoryOptions);

    const attachmentContext = await buildAttachmentContext(files);
    const attachmentNames = getAttachmentNames(files);

    // finalMessage: con prefijo → va al modelo
    const finalMessage = attachmentContext
      ? `${userMessage}\n\n${attachmentContext}`
      : userMessage;

    // historialMessage: sin prefijo → se guarda en memoria
    const historialMessage = attachmentContext
      ? `${rawTrimmed}\n\n${attachmentContext}`
      : rawTrimmed;

    memory.addChatHistoryMessage('user', historialMessage, memoryOptions);

    if (attachmentContext) {
      memory.addMessage('user', attachmentContext, memoryOptions);
    }

    // Selección de modelo: manual o automático
    let selectedModel = config.primaryModel || 'hermes-q4';

    if (config.primaryModel === 'auto') {
      const routerDecision = detectBestModel({
        rawMessage:   rawTrimmed,
        mode,
        files,
        contextSize:  0,
        autoProfile:  config.autoProfile || 'balanceado',
        hardware:     HARDWARE_PROFILE,
      });
      selectedModel = routerDecision.model;
    }

    const streamOptions = {
      ...memoryOptions,
      primaryModel:    selectedModel,
      hardwareProfile: HARDWARE_PROFILE,
      mode,
      variant
    };

    // Validación de contexto para Patch Mode
    if (mode === 'coder' && variant === 'patch') {
      const hasAttachments = files.length > 0;
      const hasContextFiles = attachmentContext && attachmentContext.length > 0;
      if (!hasAttachments && !hasContextFiles) {
        return res.status(400).json({
          ok: false,
          error: 'patch_no_context',
          message: 'Patch Mode requiere un archivo de contexto. Adjunta el archivo que quieres modificar o agrégalo como Context File del proyecto.'
        });
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let fullReply = '';

    for await (const token of streamToLocalAI(finalMessage, streamOptions)) {
      if (token) {
        const safe = JSON.stringify(token);
        res.write(`data: ${safe}\n\n`);
      }
    }

    res.write(`data: [DONE] ${JSON.stringify({ attachments: attachmentNames })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Error en chat.controller:', error);
    if (res.headersSent) {
      res.write(`data: [ERROR] ${error.message}\n\n`);
      res.end();
    } else {
      res.status(500).json({ ok: false, error: 'Error interno del servidor' });
    }

  } finally {
    cleanupFiles(files);
  }
}

function getChatHistory(req, res) {
  try {
    const history = memory.getChatHistory(buildMemoryOptions(req));
    return res.json({ ok: true, history });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    return res.status(500).json({ ok: false, error: 'Error interno al obtener historial' });
  }
}

function listChats(req, res) {
  const chats = memory.listChats(buildMemoryOptions(req));
  res.json({ ok: true, chats });
}

function createChat(req, res) {
  const { chatId } = req.body;
  memory.createChat(chatId, buildMemoryOptions(req));
  res.json({ ok: true });
}

function deleteChat(req, res) {
  const { chatId } = req.body;
  memory.deleteChat(chatId, buildMemoryOptions(req));
  res.json({ ok: true });
}

function listProjects(req, res) {
  const projects = memory.listProjects(buildMemoryOptions(req));
  res.json({ ok: true, projects });
}

function createProject(req, res) {
  const { projectId } = req.body;
  memory.createProject(projectId, buildMemoryOptions(req));
  initProject(projectId);
  res.json({ ok: true });
}

function deleteProject(req, res) {
  const { projectId } = req.body;
  memory.deleteProject(projectId, buildMemoryOptions(req));
  res.json({ ok: true });
}

function renameChat(req, res) {
  try {
    const { oldChatId, newChatId } = req.body;
    if (!oldChatId || !newChatId) {
      return res.status(400).json({ ok: false, error: 'Faltan oldChatId o newChatId' });
    }
    memory.renameChat(oldChatId, newChatId, buildMemoryOptions(req));
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error al renombrar chat:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Error al renombrar chat' });
  }
}

function renameProject(req, res) {
  try {
    const { oldProjectId, newProjectId } = req.body;
    if (!oldProjectId || !newProjectId) {
      return res.status(400).json({ ok: false, error: 'Faltan oldProjectId o newProjectId' });
    }
    memory.renameProject(oldProjectId, newProjectId, buildMemoryOptions(req));
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error al renombrar proyecto:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Error al renombrar proyecto' });
  }
}

async function generateTitle(req, res) {
  try {
    const { text, type } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ ok: false, error: 'Texto vacío' });
    }
    const title = await generateTitleFromText(text, type || 'chat');
    return res.json({ ok: true, title });
  } catch (error) {
    console.error('Error generando título:', error);
    return res.status(500).json({ ok: false, error: 'Error generando título' });
  }
}

module.exports = {
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
  generateTitle
};