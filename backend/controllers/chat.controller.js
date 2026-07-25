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
const { resolve: resolveCapability } = require('../services/model.router/capability.matrix');
const { loadManifest, readFileContent } = require('../services/context/snapshot.service');
const { loadStore, searchSimilar } = require('../services/context/vector.store');
const { getEmbedding } = require('../services/context/embed.provider');
const { resolvePatchIntent } = require('../services/patch/intent.resolver');
// HARDWARE_PROFILE ya no es una constante fija leída una sola vez al cargar
// el módulo — antes eso hacía que cambiar de perfil requiriera reiniciar el
// proceso completo. getHardwareProfile() lee el valor persistido (o el .env
// como fallback) en cada request, mismo patrón que ya usa vision.service.js
// con getVisionModel() (ver DECISIONS.md v2.4.0) para el mismo problema.
const {
  getHardwareProfile: readHardwareProfile,
  setHardwareProfile: persistHardwareProfile
} = require('../services/settings.service');
const { isDevModeEnabled, logRequest } = require('../services/devMode.service');
const { search: webSearch, formatResultsAsContext, getEffectiveRecord: getEffectiveSearchRecord } = require('../services/search/search.service');
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


// Resuelve el archivo objetivo por búsqueda semántica cuando el mensaje no
// menciona el nombre exacto — reusa el mismo store de embeddings por proyecto
// que ya genera generate-embeddings.js y consume snapshot.provider.js (v2.14.0),
// en vez de agarrar el primer archivo del snapshot a ciegas.
async function findTargetBySemanticSearch(userMessage, projectDataPath, items) {
  try {
    const store = loadStore(projectDataPath);
    if (!store || Object.keys(store.chunks).length === 0) return null;

    const queryVector = await getEmbedding(userMessage);
    if (!queryVector) return null;

    const topChunks = searchSimilar(store, queryVector, 5);
    for (const chunk of topChunks) {
      const match = items.find(i => i.relPath === chunk.relPath);
      if (match) {
        console.log(`[PATCH GROUNDING] archivo resuelto por búsqueda semántica: ${chunk.relPath} (score=${chunk.score.toFixed(3)})`);
        return match;
      }
    }
    return null;
  } catch (e) {
    console.warn('[PATCH GROUNDING] búsqueda semántica falló, usando fallback ciego:', e.message);
    return null;
  }
}

// Selecciona el archivo más relevante del snapshot para inyectarlo en el
// mensaje del usuario en Patch Mode. `preResolvedMatch` es el resultado (si
// lo hay) de resolvePatchIntent() ya calculado antes de detectMode() — evita
// pedirle a Ollama el mismo embedding dos veces por request.
async function buildPatchGrounding(userMessage, projectId, userId, preResolvedMatch = null) {
  try {
    const projectDataPath = path.join(
      DATA_DIR, 'users', userId, 'projects', projectId
    );

    const items = loadProjectSnapshotItems(projectId, userId);
    if (items.length === 0) return '';

    const manifest = loadManifest(projectDataPath);
    if (!manifest || !manifest.files) return '';

    const msgLower = userMessage.toLowerCase();
    let target = items.find(i => {
      const name = (i.name || '').toLowerCase();
      return msgLower.includes(name) || msgLower.includes(name.replace(/\.[^.]+$/, ''));
    });

    // Sin mención exacta del nombre — reusar el match semántico ya resuelto
    // (gate de intención, antes de detectMode) si hay uno.
    if (!target && preResolvedMatch) {
      target = items.find(i => i.relPath === preResolvedMatch.relPath);
    }

    // Sin match previo (p. ej. se llamó a esta función por otro camino) —
    // resolverlo acá mismo por relevancia semántica.
    if (!target) {
      target = await findTargetBySemanticSearch(userMessage, projectDataPath, items);
    }

    // Último recurso — sin embeddings generados o falló la búsqueda semántica.
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

// Items del Context Snapshot del proyecto (solo source==='snapshot', que es
// el único que cuenta para Patch Mode — buildPatchGrounding también filtra
// exclusivamente por ese source; la Carpeta vinculada es a propósito una
// fuente separada, ver DECISIONS.md). Centraliza la lectura de
// context/index.json que antes se repetía en más de un lugar.
function loadProjectSnapshotItems(projectId, userId) {
  if (!projectId || projectId === 'general') return [];
  try {
    const ctxIndexPath = path.join(
      DATA_DIR, 'users', userId, 'projects', projectId, 'context/index.json'
    );
    const ctxIndex = JSON.parse(fs.readFileSync(ctxIndexPath, 'utf8'));
    const items = ctxIndex.items || [];
    return items.filter(i => i.enabled !== false && i.source === 'snapshot');
  } catch (_) {
    return [];
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
    // Se lee una sola vez por request — barato (un fs.readFileSync chico),
    // y evita quedar pegado al valor que tenía el proceso al arrancar si el
    // usuario cambia el perfil desde Configuración sin reiniciar la app.
    const hardwareProfile = readHardwareProfile();

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

    // Modo Proyecto: dentro de un proyecto con snapshot, se asume que el
    // mensaje se refiere a ese proyecto salvo que la relevancia semántica
    // contra el contenido real sea baja — resolvePatchIntent() consulta los
    // embeddings ANTES de decidir el modo, así "quiero que el botón Copiar
    // también copie el Markdown" puede activar Patch Mode sin que el usuario
    // tenga que nombrar el archivo ni usar un verbo específico. Si no hay
    // relación clara, no fuerza nada — sigue el flujo normal de detección.
    const projectSnapshotItems = loadProjectSnapshotItems(memoryOptions.projectId, memoryOptions.userId);
    const hasProjectContext = projectSnapshotItems.length > 0;

    let semanticPatchMatch = null;
    if (hasProjectContext) {
      const projectDataPath = path.join(DATA_DIR, 'users', memoryOptions.userId, 'projects', memoryOptions.projectId);
      semanticPatchMatch = await resolvePatchIntent(rawTrimmed, projectDataPath, projectSnapshotItems);
    }

    //detectMode() analiza el contenido del mensaje y los archivos adjuntos.
    //Clasifica la petición.
    //Devuelve el modo de trabajo que debe usar Tempest.
    const { mode, variant, reason } = detectMode({ //Clasificar la petición
      rawMessage: rawTrimmed,
      files,
      configMode: effectiveConfigMode,
      hasProjectContext,
      hasSemanticPatchMatch: !!semanticPatchMatch
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
      patchGrounding = await buildPatchGrounding(rawTrimmed, memoryOptions.projectId, memoryOptions.userId, semanticPatchMatch);
      if (patchGrounding) {
        console.log(`[PATCH GROUNDING] bloque inyectado (${patchGrounding.length} chars)`);
      }
    }

    let baseMessage = patchGrounding
      ? `${patchGrounding}\n${userMessage}${effectiveContext ? '\n\n' + effectiveContext : ''}`
      : (effectiveContext ? `${userMessage}\n\n${effectiveContext}` : userMessage);

    // Búsqueda web — inyectar resultados como contexto si está activa.
    // Se resuelve el registro (perfil asignado o config propia "sin perfil")
    // del usuario que realmente está preguntando — nunca un config global
    // compartido, así cada perfil/usuario usa SU PROPIA API key en runtime.
    let webSearchContext = '';
    const requestUsername = req.user?.username;
    const searchRecord = getEffectiveSearchRecord(requestUsername);
    const effectiveSearchQuery = (isVisionResponse && visionDescription)
      ? (rawTrimmed ? `${rawTrimmed} ${visionDescription.slice(0, 200)}` : visionDescription.slice(0, 300))
      : rawTrimmed;

    if (config.webSearch && config.searchProvider && searchRecord?.globalEnabled && effectiveSearchQuery && effectiveSearchQuery.length >= 8) {
      if (_isSearchRateLimited(memoryOptions.userId)) {
        console.warn(`[WEB SEARCH] Rate limited — userId: ${memoryOptions.userId}`);
      } else {
        const results = await webSearch(effectiveSearchQuery, config.searchProvider, { username: requestUsername }); //¿La búsqueda web está habilitada?
        if (results.length > 0) {
          webSearchContext = formatResultsAsContext(results, effectiveSearchQuery);
          console.log(`[WEB SEARCH] provider=${config.searchProvider} | user=${requestUsername || '(sin sesión)'} | ${results.length} resultados | query: "${effectiveSearchQuery.slice(0, 60)}"`);
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
        hardware: hardwareProfile,
      });
      selectedModel = routerDecision.model;
    }

    // Calcular presupuesto de contexto dinámico para el modelo seleccionado
    let dynamicMaxChars = null;
    if (memoryOptions.projectId && memoryOptions.projectId !== 'general') {
      const modelContextTokens = getContextSize(selectedModel);
      const maxOutputTokens = getMaxTokens(selectedModel, rawTrimmed, mode, hardwareProfile);
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
      hardwareProfile: hardwareProfile,
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
      // Antes: 'hermes-q4' fijo para laptop (bug — es el modelo pesado de
      // desktop). Se corrige usando el mismo alias 'general-standard' que ya
      // resuelve capability.matrix.js para el resto del router: qwen2.5-7b-q5
      // en desktop (mismo modelo de antes, sin cambio), qwen2.5-3b-q5 en laptop.
      streamOptions.primaryModel = resolveCapability('general-standard', hardwareProfile).modelId;
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
        hardwareProfile: hardwareProfile,
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

    // Salvaguarda ante InsufficientMemoryError (node-llama-cpp): mismo error que ya
    // se documentó dos veces por separado — deepseek-coder-6.7b-q6 en desktop y
    // llava-1.6 en laptop, siempre arreglado a mano bajando MODEL_CONTEXT_SIZES.
    // Acá se reintenta UNA vez con la mitad del contextSize del modelo, sin recargar
    // el modelo (createContext es liviano comparado con switchModel). Solo aplica si
    // todavía no se emitió ningún token — el fallo ocurre al crear el contexto, antes
    // de generar, así que reintentar es seguro (no hay salida parcial que descartar).
    let memoryRetried = false;
    let contextSizeOverride = null;
    while (true) {
      try {
        for await (const token of streamToLocalAI(finalMessage, { ...streamOptions, contextSizeOverride }, streamMeta)) {
          if (token) {
            replyLength += token.length;
            fullReply += token;
            const safe = JSON.stringify(token);
            res.write(`data: ${safe}\n\n`);
          }
        }
        break;
      } catch (streamErr) {
        const isMemoryError = streamErr.name === 'InsufficientMemoryError' ||
          /too large for the available VRAM/i.test(streamErr.message || '');

        if (isMemoryError && !memoryRetried && replyLength === 0) {
          memoryRetried = true;
          const baseContextSize = getContextSize(streamOptions.primaryModel);
          contextSizeOverride = Math.max(1024, Math.floor(baseContextSize / 2));
          console.warn(`[MEMORY RETRY] InsufficientMemoryError con modelo=${streamOptions.primaryModel} (contextSize base=${baseContextSize}) — reintentando con contextSize=${contextSizeOverride}`);
          continue;
        }
        throw streamErr;
      }
    }

    const debugPayload = {
      mode: streamOptions.mode || mode,
      variant: variant || null,
      model: streamOptions.primaryModel || selectedModel,
      hardwareProfile: hardwareProfile,
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
  res.json({ hardwareProfile: readHardwareProfile() });
}

// Guarda el perfil elegido en Configuración → Preferencias (o por el
// instalador en el primer setup) — ver settings.service.js. No requiere
// reiniciar la app para que el próximo mensaje use el perfil nuevo (chat()
// lee el perfil por request), pero el modelo YA cargado en VRAM no cambia
// solo: el usuario tiene que mandar un mensaje o cambiar de modelo para que
// switchModel() lo reemplace.
function setHardwareProfileEndpoint(req, res) {
  try {
    const { hardwareProfile } = req.body || {};
    const saved = persistHardwareProfile(hardwareProfile);
    res.json({ ok: true, hardwareProfile: saved });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
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
  setHardwareProfileEndpoint,
  saveMessage
};