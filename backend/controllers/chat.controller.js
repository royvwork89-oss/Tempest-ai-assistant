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
const HARDWARE_PROFILE = process.env.HARDWARE_PROFILE || 'desktop'; // cambiar a 'laptop' en la laptop o a desktop so remplaza por desktop
const { isDevModeEnabled, logRequest } = require('../services/devMode.service');
const { search: webSearch, formatResultsAsContext, loadConfig: loadSearchConfig } = require('../services/search/search.service');
const { getMaxTokens, getContextSize } = require('../services/localai/token.profiles');
const { countTokens } = require('../services/localai/llama.provider');
const { DATA_DIR } = require('../config/appPaths');
// Rate limiting búsqueda web — 3 segundos entre búsquedas por usuario
const _searchCooldowns = new Map();
const SEARCH_COOLDOWN_MS = 3000;
function _isSearchRateLimited(userId) {
  const last = _searchCooldowns.get(userId);
  if (last && Date.now() - last < SEARCH_COOLDOWN_MS) return true;
  _searchCooldowns.set(userId, Date.now());
  return false;
}


// Selecciona el archivo más relevante del snapshot para inyectarlo en el mensaje del usuario en Patch Mode
function buildPatchGrounding(userMessage, projectId, userId) {
  try {
    const projectDataPath = path.join(
      DATA_DIR, 'users', userId, 'projects', projectId
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
    userId: req.user?.id || memory.DEFAULT_USER_ID,
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
  console.log('[chat] request recibido | msg:', (req.body?.message || '').slice(0, 60), '| chatId:', req.body?.chatId);

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
          DATA_DIR, 'users', memoryOptions.userId, 'projects',
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

    //detectMode() analiza el contenido del mensaje y los archivos adjuntos.
    //Clasifica la petición.
    //Devuelve el modo de trabajo que debe usar Tempest.    
    const { mode, variant, reason } = detectMode({ //Clasificar la petición
      rawMessage: rawTrimmed,
      files,
      configMode: effectiveConfigMode
    });

    console.log(`[MODE ROUTER] mode=${mode} variant=${variant} reason="${reason}"`);

    const userMessage = buildPrefixedMessage(rawTrimmed, mode, variant);//Construir el mensaje que se enviará al modelo agregando información según el modo detectado.

    memory.detectUserData(rawTrimmed, memoryOptions);//Revisa si el usuario escribió información que deba guardarse.

    const attachmentContext = await buildAttachmentContext(files); //Hay archivos adjuntos. Necesito convertirlos en contexto.
    console.log(`[PATCH DEBUG] files.length=${files.length} attachmentContext.length=${attachmentContext?.length || 0}`);
    const attachmentNames = getAttachmentNames(files);

    // Si el modo es visual y LLaVA ya describió la imagen, responder directamente
    const isVisionResponse = mode === 'visual' && attachmentContext && attachmentContext.includes('Análisis visual:');//¿Es una petición visual?

    // Extraer descripción para usarla como query de búsqueda web
    let visionDescription = '';
    if (isVisionResponse) {
      const descMatch = attachmentContext.match(/Análisis visual:[^\]]+\]\n\n([\s\S]+?)\n\n--- FIN DE ARCHIVOS ---/s);
      visionDescription = descMatch ? descMatch[1].trim() : '';
    }

    const effectiveContext = (mode === 'coder' && variant === 'patch' && attachmentContext)
      ? attachmentContext.slice(0, 800) + (attachmentContext.length > 800 ? '\n[... truncado para patch mode ...]' : '')
      : attachmentContext;
    if (mode === 'coder' && variant === 'patch') { //¿Es Patch Mode?  Si la respuesta es sí, hace otra preparación especial.
      console.log(`[PATCH CONTEXT] effectiveContext.length=${effectiveContext?.length || 0}`);
    }

    // Patch Mode: inyectar archivo relevante del snapshot en el mensaje del usuario
    let patchGrounding = '';
    if (mode === 'coder' && variant === 'patch' && memoryOptions.projectId && memoryOptions.projectId !== 'general') {
      patchGrounding = buildPatchGrounding(rawTrimmed, memoryOptions.projectId, memoryOptions.userId);
      if (patchGrounding) {
        console.log(`[PATCH GROUNDING] bloque inyectado (${patchGrounding.length} chars)`);
      }
    }

    let baseMessage = patchGrounding
      ? `${patchGrounding}\n${userMessage}${effectiveContext ? '\n\n' + effectiveContext : ''}`
      : (effectiveContext ? `${userMessage}\n\n${effectiveContext}` : userMessage);

    // Búsqueda web — inyectar resultados como contexto si está activa
    let webSearchContext = '';
    const searchCfg = loadSearchConfig();
    const effectiveSearchQuery = (isVisionResponse && visionDescription)
      ? (rawTrimmed ? `${rawTrimmed} ${visionDescription.slice(0, 200)}` : visionDescription.slice(0, 300))
      : rawTrimmed;

    if (config.webSearch && config.searchProvider && searchCfg.globalEnabled && effectiveSearchQuery && effectiveSearchQuery.length >= 8) {
      if (_isSearchRateLimited(memoryOptions.userId)) {
        console.warn(`[WEB SEARCH] Rate limited — userId: ${memoryOptions.userId}`);
      } else {
        const results = await webSearch(effectiveSearchQuery, config.searchProvider); //¿La búsqueda web está habilitada?
        if (results.length > 0) {
          webSearchContext = formatResultsAsContext(results, effectiveSearchQuery);
          console.log(`[WEB SEARCH] provider=${config.searchProvider} | ${results.length} resultados | query: "${effectiveSearchQuery.slice(0, 60)}"`);
        }
      }
    }

    let finalMessage = webSearchContext
      ? `${baseMessage}\n\n${webSearchContext}`
      : baseMessage;

    // Visual + búsqueda: reemplazar mensaje para evitar que el modelo repita el contexto crudo
    if (isVisionResponse && webSearchContext && visionDescription) {
      finalMessage = `[DESCRIPCIÓN DE LA IMAGEN]\n${visionDescription}\n[FIN DESCRIPCIÓN]\n\n${webSearchContext}\n\nINSTRUCCIÓN: NO repitas la descripción. Responde DIRECTAMENTE a la pregunta usando los resultados de búsqueda. Si los resultados identifican el juego/lugar/producto, responde con esa información específica.\n\nPregunta: ${rawTrimmed || 'Analiza la imagen.'}`;
    }

    const historialMessage = rawTrimmed;

    memory.addChatHistoryMessage('user', historialMessage, memoryOptions); //Antes de enviar la petición al modelo, guarda el mensaje del usuario en el historial.

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
            DATA_DIR, 'users', memoryOptions.userId, 'projects',
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

    // Calcular presupuesto de contexto dinámico para el modelo seleccionado
    let dynamicMaxChars = null;
    if (memoryOptions.projectId && memoryOptions.projectId !== 'general') {
      const modelContextTokens = getContextSize(selectedModel);
      const maxOutputTokens = getMaxTokens(selectedModel, rawTrimmed, mode, HARDWARE_PROFILE);
      const messageTokens = countTokens(finalMessage);
      const SYSTEM_PROMPT_TOK = 1400; // global + mode + project + memory prompts
      const HISTORY_TOK = 500;  // historial de chat
      const SAFETY_MARGIN_TOK = 300;  // margen de seguridad
      const availableTokens = Math.max(
        modelContextTokens - maxOutputTokens - messageTokens - SYSTEM_PROMPT_TOK - HISTORY_TOK - SAFETY_MARGIN_TOK,
        0
      );
      dynamicMaxChars = Math.max(Math.floor(availableTokens * 3.5), 500);
      console.log(`[CONTEXT BUDGET] model=${selectedModel} contextTok=${modelContextTokens} maxOut=${maxOutputTokens} msgTok=${messageTokens} availTok=${availableTokens} → dynamicMaxChars=${dynamicMaxChars}`);
    }

    const streamOptions = {
      ...memoryOptions,
      primaryModel: selectedModel,
      hardwareProfile: HARDWARE_PROFILE,
      mode,
      variant,
      skipContextFiles: (mode === 'coder' && variant === 'patch') || mode === 'visual',
      maxTokens: webSearchContext ? 650 : null,
      dynamicMaxChars,
      onSwitchingModel: () => {
        res.write(`data: [SWITCHING_MODEL] ${JSON.stringify({ model: selectedModel })}\n\n`);
      }
    };

    // Visual + búsqueda web: segundo pase con modelo de texto
    if (isVisionResponse && webSearchContext) {
      streamOptions.mode = 'general';
      streamOptions.primaryModel = HARDWARE_PROFILE === 'laptop' ? 'hermes-q4' : 'qwen2.5-7b-q5';
      streamOptions.skipContextFiles = false;
      streamOptions.maxTokens = 450;
      console.log(`[VISUAL+SEARCH] segundo pase — modelo: ${streamOptions.primaryModel}`);
    }
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

    const streamStart = Date.now();

    // Modo visual con descripción de LLaVA — responder directamente sin segundo modelo
    if (isVisionResponse && !webSearchContext) {
      const descMatch = attachmentContext.match(/Análisis visual:[^\]]+\]\n\n([\s\S]+?)\n\n--- FIN DE ARCHIVOS ---/);
      let visionDescription = descMatch ? descMatch[1].trim() : attachmentContext;
      visionDescription = visionDescription.replace(/^(Si es [^.]+\.\s*)+/gi, '').trim();
      visionDescription = visionDescription.replace(/^(Describe [^.]+\.\s*)+/gi, '').trim();

      // Simular streaming dividiendo en palabras
      const words = visionDescription.split(' ');
      for (const word of words) {
        res.write(`data: ${JSON.stringify(word + ' ')}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      const durationMs = Date.now() - streamStart;
      const visionDebugPayload = {
        mode,
        variant: variant || null,
        model: selectedModel,
        hardwareProfile: HARDWARE_PROFILE,
        contextSize,
        truncated: false,
        finishReason: 'stop',
        tokensIn: null,
        tokensOut: Math.round(visionDescription.length / 4),
        durationMs,
        timingPrompt: null,
        timingGeneration: null
      };
      logRequest(visionDebugPayload);
      if (isDevModeEnabled()) {
        res.write(`data: [DEBUG] ${JSON.stringify(visionDebugPayload)}\n\n`);
      }
      res.write(`data: [DONE] ${JSON.stringify({ attachments: attachmentNames, model: selectedModel })}\n\n`);
      res.end();
      memory.addChatHistoryMessage('assistant', visionDescription, memoryOptions);
      return;
    }

    const streamMeta = {};
    let replyLength = 0;
    let fullReply = '';
    for await (const token of streamToLocalAI(finalMessage, streamOptions, streamMeta)) {
      if (token) {
        replyLength += token.length;
        fullReply += token;
        const safe = JSON.stringify(token);
        res.write(`data: ${safe}\n\n`);
      }
    }

    const debugPayload = {
      mode: streamOptions.mode || mode,
      variant: variant || null,
      model: streamOptions.primaryModel || selectedModel,
      hardwareProfile: HARDWARE_PROFILE,
      searchQuery: (config.webSearch && webSearchContext) ? rawTrimmed.slice(0, 120) : null,
      contextSize,
      truncated: streamMeta.finishReason === 'length',
      finishReason: streamMeta.finishReason || null,
      tokensIn: streamMeta.promptTokens || null,
      tokensOut: streamMeta.completionTokens || Math.round(replyLength / 4),
      durationMs: Date.now() - streamStart,
      timingPrompt: streamMeta.timingPrompt || null,
      timingGeneration: streamMeta.timingGeneration || null
    };
    logRequest(debugPayload);
    if (isDevModeEnabled()) {
      res.write(`data: [DEBUG] ${JSON.stringify(debugPayload)}\n\n`);
    }
    res.write(`data: [DONE] ${JSON.stringify({ attachments: attachmentNames, model: selectedModel })}\n\n`);
    res.end();

    if (fullReply) {
      memory.addChatHistoryMessage('assistant', fullReply, memoryOptions);
    }

  } catch (error) {
    console.error('Error en chat.controller:', error);

    const isContextShiftError = error.message?.includes('Failed to compress chat history') ||
      error.message?.includes('context shift') ||
      error.message?.includes('too long prompt');

    const userFacingError = isContextShiftError
      ? 'El contexto del proyecto es demasiado grande para este mensaje. Desactiva algunos archivos del Context Snapshot o reduce el número de archivos indexados.'
      : 'Error interno del servidor';

    if (isContextShiftError) {
      console.warn('[CONTEXT SHIFT] Error capturado — contexto excede ventana del modelo:', error.message);
    }

    if (res.headersSent) {
      res.write(`data: [ERROR] ${userFacingError}\n\n`);
      res.end();
    } else {
      res.status(500).json({ ok: false, error: userFacingError });
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
    const { chatId, newTitle } = req.body;
    if (!chatId || !newTitle) {
      return res.status(400).json({ ok: false, error: 'Faltan chatId o newTitle' });
    }
    memory.renameChat(chatId, newTitle, buildMemoryOptions(req));
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
    const { text, type, model } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ ok: false, error: 'Texto vacío' });
    }
    const title = await generateTitleFromText(text, type || 'chat', model || null);
    return res.json({ ok: true, title });
  } catch (error) {
    console.error('Error generando título:', error);
    return res.status(500).json({ ok: false, error: 'Error generando título' });
  }
}

function getHardwareProfile(req, res) {
  res.json({ hardwareProfile: HARDWARE_PROFILE });
}

/**
 * Persiste un mensaje suelto en el historial del chat activo.
 * Usado por flujos que no pasan por streamToLocalAI (transcripción, documentos generados).
 */
function saveMessage(req, res) {
  try {
    const { role, content } = req.body;
    if (!role || !content) {
      return res.status(400).json({ ok: false, error: 'Faltan role o content' });
    }
    memory.addChatHistoryMessage(role, content, buildMemoryOptions(req));
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error al guardar mensaje:', error);
    return res.status(500).json({ ok: false, error: 'Error interno al guardar mensaje' });
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
  generateTitle,
  getHardwareProfile,
  saveMessage
};