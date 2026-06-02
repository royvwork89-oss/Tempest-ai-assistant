const fs = require('fs');
const path = require('path');
const { sendToLocalAI, streamToLocalAI, generateTitleFromText } = require('../services/localai.service');
const memory = require('../services/memory.service');
const {
  buildAttachmentContext,
  getAttachmentNames,
  cleanupFiles
} = require('../services/attachment.service');
const { detectMode } = require('../services/mode.router');
const { initProject } = require('../services/context/context.service');
const { detectBestModel } = require('../services/model.router');
const { loadManifest, readFileContent } = require('../services/context/snapshot.service');
const HARDWARE_PROFILE = 'laptop'; // cambiar a 'laptop' en la laptop o a desktop so remplaza por desktop
process.env.HARDWARE_PROFILE = HARDWARE_PROFILE;

// Selecciona el archivo más relevante del snapshot para inyectarlo en el mensaje del usuario en Patch Mode
function buildPatchGrounding(userMessage, projectId) {
  try {
    const projectDataPath = path.join(
      __dirname, '../data/users/local-user/projects', projectId
    );

    const ctxIndexPath = path.join(projectDataPath, 'context/index.json');
    const ctxIndex = JSON.parse(fs.readFileSync(ctxIndexPath, 'utf8'));
    const items = (ctxIndex.items || []).filter(i =>
      i.enabled !== false && i.source === 'snapshot'
    );
    if (items.length === 0) return '';

    const manifest = loadManifest(projectDataPath);
    if (!manifest || !manifest.files) return '';

    const msgLower = userMessage.toLowerCase();
    let target = items.find(i => {
      const name = (i.name || '').toLowerCase();
      return msgLower.includes(name) || msgLower.includes(name.replace(/\.[^.]+$/, ''));
    });

    if (!target) target = items.find(i => manifest.files[i.relPath]);
    if (!target) return '';

    const fileEntry = manifest.files[target.relPath];
    if (!fileEntry) return '';

    let content = readFileContent(fileEntry.absolutePath);
    if (!content) return '';

    // Truncado centrado en la función mencionada
    const MAX_TOTAL = 2000;
    if (content.length > MAX_TOTAL) {
      const funcMatch = userMessage.match(/función\s+(\w+)|funcion\s+(\w+)|function\s+(\w+)/i);
      const funcName = funcMatch ? (funcMatch[1] || funcMatch[2] || funcMatch[3]) : null;
      const funcIndex = funcName ? content.indexOf(`function ${funcName}`) : -1;

      if (funcIndex > 0) {
        const start = Math.max(0, funcIndex - 200);
        const end = Math.min(content.length, start + MAX_TOTAL);
        content = content.slice(start, end);
      } else {
        content = content.slice(0, MAX_TOTAL);
      }
    }

    const relPath = target.relPath || target.name || target.id;
    return `Archivo: ${relPath}\n### CONTENIDO ACTUAL DEL ARCHIVO ###\n${content}\n### FIN DEL ARCHIVO ###\nINSTRUCCION: El bloque SEARCH debe ser texto literal copiado del contenido anterior.\n`;

  } catch (e) {
    console.warn('[PATCH GROUNDING] No se pudo cargar archivo del snapshot:', e.message);
    return '';
  }
}

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
    const memoryOptions = buildMemoryOptions(req);

    // Leer preferencias del proyecto como override suave
    let projectPreferences = {};
    if (memoryOptions.projectId && memoryOptions.projectId !== 'general') {
      try {
        const settingsPath = path.join(
          __dirname, '../data/users/local-user/projects',
          memoryOptions.projectId,
          'projectSettings.json'
        );
        const raw = fs.readFileSync(settingsPath, 'utf8');
        projectPreferences = JSON.parse(raw)?.preferences || {};
      } catch (_) { }
    }

    // Modo: selección manual > preferencia del proyecto > automático
    const effectiveConfigMode = config.mode ||
      (projectPreferences.defaultMode && projectPreferences.defaultMode !== 'auto'
        ? projectPreferences.defaultMode
        : null);

    const { mode, variant, reason } = detectMode({
      rawMessage: rawTrimmed,
      files,
      configMode: effectiveConfigMode
    });

    console.log(`[MODE ROUTER] mode=${mode} variant=${variant} reason="${reason}"`);

    const userMessage = buildPrefixedMessage(rawTrimmed, mode, variant);

    memory.detectUserData(rawTrimmed, memoryOptions);

    const attachmentContext = await buildAttachmentContext(files);
    console.log(`[PATCH DEBUG] files.length=${files.length} attachmentContext.length=${attachmentContext?.length || 0}`);
    const attachmentNames = getAttachmentNames(files);

    // Si el modo es visual y LLaVA ya describió la imagen, responder directamente
    const isVisionResponse = mode === 'visual' && attachmentContext && attachmentContext.includes('Análisis visual:');

    const effectiveContext = (mode === 'coder' && variant === 'patch' && attachmentContext)
      ? attachmentContext.slice(0, 800) + (attachmentContext.length > 800 ? '\n[... truncado para patch mode ...]' : '')
      : attachmentContext;
    if (mode === 'coder' && variant === 'patch') {
      console.log(`[PATCH CONTEXT] effectiveContext.length=${effectiveContext?.length || 0}`);
    }

    // Patch Mode: inyectar archivo relevante del snapshot en el mensaje del usuario
    let patchGrounding = '';
    if (mode === 'coder' && variant === 'patch' && memoryOptions.projectId && memoryOptions.projectId !== 'general') {
      patchGrounding = buildPatchGrounding(rawTrimmed, memoryOptions.projectId);
      if (patchGrounding) {
        console.log(`[PATCH GROUNDING] bloque inyectado (${patchGrounding.length} chars)`);
      }
    }

    const finalMessage = patchGrounding
      ? `${patchGrounding}\n${userMessage}${effectiveContext ? '\n\n' + effectiveContext : ''}`
      : (effectiveContext ? `${userMessage}\n\n${effectiveContext}` : userMessage);

    const historialMessage = rawTrimmed;

    memory.addChatHistoryMessage('user', historialMessage, memoryOptions);

    if (attachmentContext) {
      memory.addMessage('user', attachmentContext, memoryOptions);
    }

    // Selección de modelo: manual > preferencia del proyecto > automático
    const resolvedModel = config.primaryModel || projectPreferences.defaultModel || 'auto';

    let contextSize = 0;
    let contextFileTypes = [];
    let selectedModel = resolvedModel;
    if (resolvedModel === 'auto') {
      if (memoryOptions.projectId && memoryOptions.projectId !== 'general') {
        try {
          const ctxIndexPath = path.join(
            __dirname, '../data/users/local-user/projects',
            memoryOptions.projectId,
            'context/index.json'
          );
          const ctxIndex = JSON.parse(fs.readFileSync(ctxIndexPath, 'utf8'));
          const items = ctxIndex.items || [];
          items.forEach(item => {
            if (item.enabled !== false) {
              contextSize += item.sizeBytes || 0;
              const ext = (item.name || '').split('.').pop().toLowerCase();
              contextFileTypes.push(ext);
            }
          });
        } catch (_) { }
      }

      const routerDecision = detectBestModel({
        rawMessage: rawTrimmed,
        mode,
        variant,
        files,
        contextSize,
        contextFileTypes,
        autoProfile: config.autoProfile || 'balanceado',
        hardware: HARDWARE_PROFILE,
      });
      selectedModel = routerDecision.model;
    }

    const streamOptions = {
      ...memoryOptions,
      primaryModel: selectedModel,
      hardwareProfile: HARDWARE_PROFILE,
      mode,
      variant,
      skipContextFiles: (mode === 'coder' && variant === 'patch') || mode === 'visual'
    };

    // Validación de contexto para Patch Mode
    if (mode === 'coder' && variant === 'patch') {
      const hasAttachments = files.length > 0;
      const hasContextFiles = attachmentContext && attachmentContext.length > 0;
      const hasProjectContext = memoryOptions.projectId && memoryOptions.projectId !== 'general';
      if (!hasAttachments && !hasContextFiles && !hasProjectContext) {
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

    // Mandar modelo elegido al frontend antes de empezar el stream
    res.write(`data: [MODEL] ${JSON.stringify({ model: selectedModel })}\n\n`);

    // Modo visual con descripción de LLaVA — responder directamente sin segundo modelo
    if (isVisionResponse) {
      const descMatch = attachmentContext.match(/Análisis visual:[^\]]+\]\n\n([\s\S]+?)\n\n--- FIN DE ARCHIVOS ---/);
      let visionDescription = descMatch ? descMatch[1].trim() : attachmentContext;
      console.log('[VISION] descMatch:', !!descMatch, '| visionDescription inicio:', visionDescription.slice(0, 100));
      // Limpiar el prompt que LLaVA repite al inicio de su respuesta
      visionDescription = visionDescription.replace(/^(Si es [^.]+\.\s*)+/gi, '').trim();
      visionDescription = visionDescription.replace(/^(Describe [^.]+\.\s*)+/gi, '').trim();
      const safe = JSON.stringify(visionDescription);
      res.write(`data: ${safe}\n\n`);
      res.write(`data: [DONE] ${JSON.stringify({ attachments: attachmentNames, model: selectedModel })}\n\n`);
      res.end();
      memory.addChatHistoryMessage('assistant', visionDescription, memoryOptions);
      return;
    }

    for await (const token of streamToLocalAI(finalMessage, streamOptions)) {
      if (token) {
        const safe = JSON.stringify(token);
        res.write(`data: ${safe}\n\n`);
      }
    }

    res.write(`data: [DONE] ${JSON.stringify({ attachments: attachmentNames, model: selectedModel })}\n\n`);
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