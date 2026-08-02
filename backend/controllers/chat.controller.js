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
// Consentimiento de log de pregunta/respuesta — por usuario, no un switch
// global (ver DECISIONS.md → "Trace de ejecución por request —
// consentimiento de log por usuario"). Gestionado desde Servicios →
// Búsqueda web (junto al selector de usuario).
const { getUserLogConsent } = require('../services/auth.service');
const { search: webSearch, formatResultsAsContext, getEffectiveRecord: getEffectiveSearchRecord } = require('../services/search/search.service');
const { getMaxTokens, getContextSize } = require('../services/localai/token.profiles');
const { countTokens } = require('../services/localai/llama.provider');
const { DATA_DIR, OUTPUTS_DIR } = require('../config/appPaths');
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
//
// Devuelve { text, targetFile } en vez de solo el string (v3.0.0, ver
// DECISIONS.md → "Trace de ejecución por request") — antes no había forma de
// saber, después de los hechos, qué archivo del snapshot terminó resolviendo
// esta función; ahora `targetFile` queda disponible para el trace persistido
// del request. Único caller (chat()) ya actualizado a este contrato.
async function buildPatchGrounding(userMessage, projectId, userId, preResolvedMatch = null) {
  try {
    const projectDataPath = path.join(
      DATA_DIR, 'users', userId, 'projects', projectId
    );

    const items = loadProjectSnapshotItems(projectId, userId);
    if (items.length === 0) return { text: '', targetFile: null, reason: 'no_snapshot' };

    const manifest = loadManifest(projectDataPath);
    if (!manifest || !manifest.files) return { text: '', targetFile: null, reason: 'no_snapshot' };

    const msgLower = userMessage.toLowerCase();
    let target = items.find(i => {
      const name = (i.name || '').toLowerCase();
      return msgLower.includes(name) || msgLower.includes(name.replace(/\.[^.]+$/, ''));
    });

    // Si el usuario NOMBRÓ un archivo explícitamente y ninguno del proyecto
    // coincide, se corta acá — ANTES de cualquier fallback semántico.
    //
    // Encontrado probando en v3.0.0: pidiendo "snapshot.service.js" en un
    // proyecto que no lo tiene, el resolvedor semántico devolvía
    // `auth.middleware.js` (score 0.575) y se le inyectaba ESE archivo al
    // modelo. Como sí había código, la validación de grounding no saltaba —
    // el modelo recibía código real del archivo equivocado y terminaba
    // inventando igual (`function getSnapshot(id)`). La pregunta correcta no
    // es "¿hay código?" sino "¿es el archivo que pidió?".
    //
    // El orden importa: esto va antes de `preResolvedMatch`, porque ese match
    // ya viene calculado por el gate de intención (`[PATCH INTENT]`) y llega
    // siempre poblado — si se chequeara después, nunca se ejecutaría.
    //
    // El fallback semántico sigue vivo para pedidos SIN nombre de archivo
    // ("agregá un log al middleware de auth"), que es para lo que se creó.
    if (!target) {
      const mentionedFiles = String(userMessage).match(MENTIONED_FILE_REGEX) || [];
      if (mentionedFiles.length > 0) {
        console.warn(`[PATCH GROUNDING] archivo(s) nombrado(s) no encontrado(s) en el proyecto: ${mentionedFiles.join(', ')}`);
        return {
          text: '', targetFile: null, reason: 'file_not_found',
          requestedNames: mentionedFiles, totalIndexed: items.length
        };
      }
    }

    // Sin mención de archivo — reusar el match semántico ya resuelto
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
    if (!target) return { text: '', targetFile: null, reason: 'file_not_found', totalIndexed: items.length };

    const fileEntry = manifest.files[target.relPath];
    if (!fileEntry) return { text: '', targetFile: null, reason: 'file_not_found', totalIndexed: items.length };

    // `unreadable` es el caso de las rutas absolutas colgadas: el snapshot
    // sabe que el archivo existía y dónde, pero esa ruta ya no resuelve —
    // típicamente porque la carpeta del proyecto cambió de disco o se movió
    // después de indexar. Se distingue de `file_not_found` a propósito: la
    // acción que tiene que tomar el usuario es distinta (reindexar, no
    // cambiar de proyecto).
    let content = readFileContent(fileEntry.absolutePath);
    if (!content) {
      console.warn(`[PATCH GROUNDING] ruta del snapshot ilegible: ${fileEntry.absolutePath}`);
      return { text: '', targetFile: target.relPath || null, reason: 'unreadable', deadPath: fileEntry.absolutePath };
    }

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
    const text = `Archivo: ${relPath}\n### CONTENIDO ACTUAL DEL ARCHIVO ###\n${content}\n### FIN DEL ARCHIVO ###\nINSTRUCCION: El bloque SEARCH debe ser texto literal copiado del contenido anterior.\n`;
    return { text, targetFile: relPath, reason: null };

  } catch (e) {
    console.warn('[PATCH GROUNDING] No se pudo cargar archivo del snapshot:', e.message);
    return { text: '', targetFile: null, reason: 'error', errorMessage: e.message };
  }
}

// Items del Context Snapshot del proyecto (solo source==='snapshot', que es
// el único que cuenta para Patch Mode — buildPatchGrounding también filtra
// exclusivamente por ese source; la Carpeta vinculada es a propósito una
// fuente separada, ver DECISIONS.md). Centraliza la lectura de
// context/index.json que antes se repetía en más de un lugar.
// Detecta nombres de archivo mencionados en el mensaje del usuario. Se usa
// una LISTA CERRADA de extensiones, no un patrón genérico tipo `\.[a-z]{1,5}`:
// ese matchea `console.log`, que aparece en casi todos los pedidos de patch
// ("agregá un console.log al middleware de auth") y habría producido rechazos
// falsos por "archivo no encontrado" en pedidos que no nombran ningún archivo.
const MENTIONED_FILE_REGEX = /[\w.-]+\.(?:js|jsx|ts|tsx|mjs|cjs|json|md|txt|py|java|c|cpp|h|hpp|cs|php|rb|go|rs|sh|bash|html|htm|css|scss|sass|less|yml|yaml|xml|sql|ini|toml|env|vue|svelte|kt|swift|dart)\b/gi;

// Resuelve el nombre de un archivo adjunto contra el índice de contexto del
// proyecto para obtener su ruta relativa REAL. Sin esto, en patch mode con
// adjunto el modelo no tiene forma de saber dónde vive el archivo y se
// inventa la ruta del encabezado ("backend/middlewares/logger.middleware.js"
// cuando la real es "middlewares/logger.middleware.js") — el patch queda
// correcto pero "Aplicar" falla siempre con "Archivo no encontrado".
//
// Busca en TODAS las fuentes del índice (snapshot y carpeta vinculada), no
// solo snapshot: al usuario le da igual de dónde salió el archivo, lo que
// necesita es la ruta con la que se va a aplicar. Devuelve null si el archivo
// no pertenece a este proyecto — caso legítimo (adjuntar algo de otra
// carpeta), y ahí es correcto que "Aplicar" falle diciendo que no existe.
function resolveAttachmentRelPath(fileName, projectId, userId) {
  if (!fileName || !projectId || projectId === 'general') return null;
  try {
    const ctxIndexPath = path.join(
      DATA_DIR, 'users', userId, 'projects', projectId, 'context/index.json'
    );
    const ctxIndex = JSON.parse(fs.readFileSync(ctxIndexPath, 'utf8'));
    const target = String(fileName).toLowerCase();
    const match = (ctxIndex.items || []).find(
      i => String(i.name || '').toLowerCase() === target
    );
    return match?.relPath || null;
  } catch (_) {
    return null;
  }
}

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

  // Declaradas afuera del try (en vez de con const/let adentro) a propósito:
  // variables declaradas dentro de un bloque try son de ese bloque nomás —
  // el catch NO puede verlas (ReferenceError), aunque ya se hayan asignado
  // antes de que algo fallara más abajo. Hoisteadas acá para que el catch
  // pueda loguear modo/modelo/proyecto reales y el log sea diagnosticable.
  // Ver DECISIONS.md → "Logger de errores centralizado".
  let memoryOptions, mode, variant, reason, selectedModel, fullReply = '';

  // Trace de ejecución del request — objeto mutable, declarado afuera del
  // try por la misma razón que las variables de arriba (visibilidad en el
  // catch), pero acá con `const` porque nunca se reasigna el binding, solo
  // se le van agregando propiedades a medida que el request avanza. Se
  // persiste SIEMPRE al final (éxito o error) vía logRequest() — antes el
  // log de requests exitosos (requests-YYYY-MM-DD.jsonl) no traía
  // projectId/chatId/adjuntos/archivo de Patch Mode resuelto/detalle de
  // búsqueda web, y nunca se escribía nada si el request fallaba a mitad de
  // camino. Ver DECISIONS.md → "Trace de ejecución por request".
  const trace = {};

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
    memoryOptions = buildMemoryOptions(req);
    trace.userId = memoryOptions.userId;
    trace.projectId = memoryOptions.projectId;
    trace.chatId = memoryOptions.chatId;
    // Consentimiento por usuario (Servicios → Búsqueda web, junto al
    // selector de usuario; default OFF para todos) — la pregunta del
    // usuario NO se guarda en el trace de diagnóstico salvo que un admin lo
    // haya habilitado a propósito para
    // ESE usuario puntual. Ver DECISIONS.md → "Trace de ejecución por
    // request — consentimiento de log por usuario".
    if (getUserLogConsent(req.user?.username).allowPersonalDataLog) {
      trace.question = rawTrimmed.slice(0, 500);
    }
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
    ({ mode, variant, reason } = detectMode({ //Clasificar la petición
      rawMessage: rawTrimmed,
      files,
      configMode: effectiveConfigMode,
      hasProjectContext,
      hasSemanticPatchMatch: !!semanticPatchMatch
    }));

    console.log(`[MODE ROUTER] mode=${mode} variant=${variant} reason="${reason}"`);

    const userMessage = buildPrefixedMessage(rawTrimmed, mode, variant);//Construir el mensaje que se enviará al modelo agregando información según el modo detectado.

    memory.detectUserData(rawTrimmed, memoryOptions);//Revisa si el usuario escribió información que deba guardarse.

    const { context: attachmentContext, meta: attachmentsMeta } = await buildAttachmentContext(files); //Hay archivos adjuntos. Necesito convertirlos en contexto.
    console.log(`[PATCH DEBUG] files.length=${files.length} attachmentContext.length=${attachmentContext?.length || 0}`);
    const attachmentNames = getAttachmentNames(files);
    trace.attachments = attachmentsMeta; // [{name, type, truncated, confidence?, visionUsed?, ...}] — ver attachment.service.js

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
    let patchGroundingInfo = null;
    if (mode === 'coder' && variant === 'patch' && memoryOptions.projectId && memoryOptions.projectId !== 'general') {
      const groundingResult = await buildPatchGrounding(rawTrimmed, memoryOptions.projectId, memoryOptions.userId, semanticPatchMatch);
      patchGrounding = groundingResult.text;
      patchGroundingInfo = groundingResult;
      trace.patchTargetFile = groundingResult.targetFile;
      if (groundingResult.reason) trace.patchGroundingReason = groundingResult.reason;
      if (patchGrounding) {
        console.log(`[PATCH GROUNDING] bloque inyectado (${patchGrounding.length} chars)`);
      }
    }

    // Patch mode con adjunto y SIN grounding del snapshot: el bloque del
    // snapshot es el que normalmente le dice al modelo la ruta del archivo
    // (`Archivo: <relPath>`), y de ahí la saca el botón "Aplicar". Sin él, el
    // modelo la inventa. Se le da la ruta real resuelta contra el índice del
    // proyecto; si el adjunto no pertenece a este proyecto se usa el nombre a
    // secas y "Aplicar" fallará diciendo que no existe, que es la verdad.
    let attachmentPathHeader = '';
    if (mode === 'coder' && variant === 'patch' && !patchGrounding && effectiveContext) {
      const firstName = attachmentsMeta?.[0]?.name;
      if (firstName) {
        const relPath = resolveAttachmentRelPath(firstName, memoryOptions.projectId, memoryOptions.userId) || firstName;
        attachmentPathHeader = `Archivo: ${relPath}\n`;
        trace.patchTargetFile = relPath;
      }
    }

    let baseMessage = patchGrounding
      ? `${patchGrounding}\n${userMessage}${effectiveContext ? '\n\n' + effectiveContext : ''}`
      : (effectiveContext ? `${attachmentPathHeader}${userMessage}\n\n${effectiveContext}` : userMessage);

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

    // Patch mode nunca busca en la web. La consulta que se mandaría es el
    // pedido literal del usuario ("dame el diff para agregar un console.log a
    // index.js"), que como término de búsqueda no significa nada: devuelve
    // tutoriales genéricos de console.log. Ese ruido entra al prompt y compite
    // por el presupuesto de contexto con lo único que importa en patch mode,
    // que es el contenido real del archivo — y el presupuesto ahí ya es
    // ajustado (ver [CONTEXT BUDGET] con deepseek). `coder/hybrid` SÍ conserva
    // la búsqueda: ahí consultar documentación o una API sí aporta.
    const skipSearchForPatch = (mode === 'coder' && variant === 'patch');
    trace.webSearch = {
      enabled: !!config.webSearch,
      provider: config.searchProvider || null,
      attempted: false,
      rateLimited: false,
      resultCount: 0,
      skippedForPatch: skipSearchForPatch
    };
    if (!skipSearchForPatch && config.webSearch && config.searchProvider && searchRecord?.globalEnabled && effectiveSearchQuery && effectiveSearchQuery.length >= 8) {
      if (_isSearchRateLimited(memoryOptions.userId)) {
        trace.webSearch.rateLimited = true;
        console.warn(`[WEB SEARCH] Rate limited — userId: ${memoryOptions.userId}`);
      } else {
        trace.webSearch.attempted = true;
        const results = await webSearch(effectiveSearchQuery, config.searchProvider, { username: requestUsername }); //¿La búsqueda web está habilitada?
        trace.webSearch.resultCount = results.length;
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
    selectedModel = resolvedModel;
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
        // Salida temprana: NO lanza excepción, así que el catch de abajo nunca
        // corre y este rechazo quedaba fuera del log (encontrado en las pruebas
        // de v3.0.0 — el rechazo más común de patch mode era invisible para el
        // diagnóstico). Se registra explícitamente acá, con la misma forma que
        // el resto de las salidas: trace completo + ok:false + errorMessage.
        logRequest({
          ...trace,
          mode,
          variant,
          model: selectedModel || null,
          ok: false,
          errorMessage: 'patch_no_context'
        });

        const patchNoContextMsg = '⚠️ Patch Mode requiere un archivo de contexto. Adjunta el archivo que quieres modificar o agrégalo como Context File del proyecto.';

        // Se persiste el aviso en el historial. El mensaje del usuario YA se
        // guardó más arriba (antes de la validación), así que sin esto el chat
        // quedaba con una pregunta huérfana sin ninguna respuesta al volver a
        // abrirlo. Se guarda del lado del backend, no del frontend, para que
        // sea una sola fuente de verdad.
        //
        // CONTRAPARTIDA ASUMIDA: al ser un mensaje normal de `assistant`, el
        // modelo lo va a recibir como contexto en los turnos siguientes de ese
        // chat, y también va a aparecer en los .md exportados. Se eligió esta
        // opción sobre un rol aparte filtrado del prompt por simplicidad — si
        // en la práctica genera respuestas raras (el modelo imitando el aviso),
        // la alternativa está descrita en DECISIONS.md.
        memory.addChatHistoryMessage('assistant', patchNoContextMsg, memoryOptions);

        return res.status(400).json({
          ok: false,
          error: 'patch_no_context',
          message: 'Patch Mode requiere un archivo de contexto. Adjunta el archivo que quieres modificar o agrégalo como Context File del proyecto.'
        });
      }

      // ── Segunda validación: ¿hay código REAL en el prompt? ────────────────
      // La de arriba sólo comprueba que el chat *tenga* alguna fuente de
      // contexto configurada (adjunto / context files / proyecto). Pasarla no
      // garantiza que el modelo vaya a ver una sola línea de código: si el
      // proyecto existe pero el snapshot no resuelve el archivo (no indexado,
      // o rutas absolutas colgadas porque la carpeta se movió de disco),
      // `patchGrounding` queda vacío y el flujo seguía igual — el modelo
      // recibía "generá un SEARCH/REPLACE" sin nada que leer y lo INVENTABA,
      // devolviendo un patch con función y firma imaginarias sobre el que la
      // UI ofrecía un botón "Aplicar". Ver DECISIONS.md.
      //
      // Se corta sólo si NO hay ninguna de las dos fuentes de código:
      //   - patchGrounding  → archivo leído del snapshot del proyecto
      //   - effectiveContext → archivo adjuntado al mensaje
      // Con adjunto el modelo tiene código real aunque el snapshot esté roto,
      // así que ese camino sigue funcionando intacto.
      if (!patchGrounding && !effectiveContext) {
        const REASON_MSG = {
          no_snapshot: 'Este proyecto no tiene archivos indexados todavía. Vinculá una carpeta o agregá Context Files al proyecto, o adjuntá el archivo directamente al mensaje.',
          // Se nombra el proyecto en el que está parado el usuario, que es el
          // dato que le falta para entender el rechazo — normalmente pidió un
          // archivo de OTRO proyecto. Se evaluó listar además los archivos
          // indexados y se descartó: en un proyecto real son decenas y el
          // mensaje se vuelve un volcado del índice (ver DECISIONS.md).
          file_not_found: `No encontré ese archivo en el proyecto "${memoryOptions.projectId}". Verificá que estés en el proyecto correcto, o adjuntá el archivo al mensaje.`,
          // "Reindexar" a secas NO alcanza y era un callejón sin salida: el
          // reindexado reusa el mismo snapshotRoot guardado, que también
          // apunta a la ruta vieja, y falla con "La ruta del proyecto no
          // existe". Hay que ACTUALIZAR la ruta primero, en el campo de
          // carpeta de "Archivos de contexto" (viene precargado con la
          // anterior), y recién ahí reindexar.
          unreadable: 'El snapshot de este proyecto apunta a rutas que ya no existen (la carpeta se movió o cambió de unidad). Abrí "Archivos de contexto" del proyecto, corregí la ruta de la carpeta y volvé a indexar. También podés adjuntar el archivo al mensaje.',
          error: 'No pude leer el archivo del snapshot del proyecto. Volvé a indexarlo, o adjuntá el archivo al mensaje.'
        };
        const detail = REASON_MSG[patchGroundingInfo?.reason]
          || 'No pude acceder al contenido del archivo que querés modificar. Adjuntá el archivo al mensaje, o verificá que estés en el proyecto correcto.';

        // Dos versiones del mismo texto a propósito: el que va en la respuesta
        // lo pinta addErrorMessage() en el frontend, que YA agrega su propio
        // ⚠️; el que se persiste en el historial se re-renderiza después como
        // un mensaje normal (addMessage), sin ícono, así que lo necesita
        // embebido. Sin esta distinción se ve "⚠️ ⚠️" en vivo, o ningún ícono
        // al recargar el chat.
        const msg = `No puedo generar el patch sin ver el archivo. ${detail}`;
        const msgForHistory = `⚠️ ${msg}`;

        logRequest({
          ...trace,
          mode,
          variant,
          model: selectedModel || null,
          ok: false,
          errorMessage: `patch_no_grounding:${patchGroundingInfo?.reason || 'unknown'}`,
          patchDeadPath: patchGroundingInfo?.deadPath || null
        });

        memory.addChatHistoryMessage('assistant', msgForHistory, memoryOptions);

        return res.status(400).json({
          ok: false,
          error: 'patch_no_grounding',
          message: msg
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
      fullReply = visionDescription;
      if (getUserLogConsent(req.user?.username).allowPersonalDataLog) {
        trace.response = visionDescription.slice(0, 500);
      }
      // logRequest() persiste el trace completo (mode/variant/model +
      // projectId/chatId/adjuntos/búsqueda web acumulados en `trace`) — el
      // payload de SSE de abajo (visionDebugPayload) se mantiene igual, sin
      // tocar, para no afectar lo que ya renderiza el Dev Panel.
      logRequest({ ...trace, ...visionDebugPayload, ok: true });
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
    fullReply = '';

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

    if (getUserLogConsent(req.user?.username).allowPersonalDataLog) {
      trace.response = fullReply.slice(0, 500);
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
    // Mismo criterio que en el retorno temprano de visión — el trace
    // completo va a disco, el payload de SSE (debugPayload) no cambia.
    logRequest({ ...trace, ...debugPayload, ok: true });
    if (isDevModeEnabled()) {
      res.write(`data: [DEBUG] ${JSON.stringify(debugPayload)}\n\n`);
    }
    res.write(`data: [DONE] ${JSON.stringify({ attachments: attachmentNames, model: selectedModel })}\n\n`);
    res.end();

    if (fullReply) {
      memory.addChatHistoryMessage('assistant', fullReply, memoryOptions);
    }

  } catch (error) {
    // Contexto extra (modo/modelo/proyecto) para que el log de errores sea
    // diagnosticable después de los hechos, no solo el mensaje crudo del
    // error — ver DECISIONS.md → "Logger de errores centralizado".
    console.error('Error en chat.controller:', {
      mode: mode || null,
      variant: variant || null,
      model: selectedModel || null,
      projectId: memoryOptions?.projectId || null,
      error
    });

    // A diferencia de logRequest() en el camino feliz (que solo se llamaba
    // al terminar bien), acá se persiste el trace también cuando el request
    // murió a mitad de camino — antes esos casos no dejaban NINGÚN registro
    // en requests-*.jsonl, solo el mensaje de error suelto en consola/
    // errors-*.jsonl, sin el contexto de qué se estaba intentando hacer.
    // `trace` solo tiene las propiedades que ya se alcanzaron a asignar
    // antes del fallo — el resto queda undefined, lo cual es información
    // en sí (indica hasta dónde llegó el request). `fullReply` también está
    // hoisteado arriba por el mismo motivo — si el stream ya había generado
    // texto antes de romperse, esa respuesta parcial es justo lo que hace
    // falta para diagnosticar un fallo a mitad de generación.
    if (getUserLogConsent(req.user?.username).allowPersonalDataLog && fullReply) {
      trace.response = fullReply.slice(0, 500);
      trace.responsePartial = true;
    }
    logRequest({
      ...trace,
      mode: mode || null,
      variant: variant || null,
      model: selectedModel || null,
      ok: false,
      errorMessage: error?.message || String(error)
    });

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

// Exporta el chat completo a un .md legible, dentro de una carpeta propia
// del chat (OUTPUTS_DIR/chat-exports/<chatId>/) — misma carpeta que abre el
// botón "Abrir carpeta" del menú de cada chat, así el usuario ve el archivo
// apenas lo genera. Markdown en vez de .txt/PDF/ZIP a propósito: se puede
// abrir/leer directo desde el explorador de archivos sin extraer nada
// (descarta ZIP) y preserva estructura básica (encabezados, separadores)
// mejor que texto plano — ver DECISIONS.md → "Exportar chat — elección de
// formato". chatId ya es un nombre de archivo válido (es el nombre real del
// .json en disco, inmutable — ver contrato de chatId en ARCHITECTURE.md),
// así que reusarlo como nombre de carpeta es seguro sin sanitizar de nuevo.
// Arma el .md de un chat. Separado de exportChat() porque exportProject()
// reusa exactamente el mismo formato para la copia legible de cada chat del
// proyecto — así un .md sacado de un export de proyecto también se puede
// importar solo con "Importar chat".
// Formato de fecha de los .md exportados. Reloj de 24hs EXPLÍCITO: antes esto
// usaba `toLocaleString('es-AR')` a secas, que en Node devuelve reloj de 12
// horas SIN el marcador a.m./p.m. — "31/7/2026, 03:41:09" para algo ocurrido
// a las 15:41. En un archivo pensado para archivar, toda hora de la tarde
// quedaba mal por 12 horas. Se pasa `undefined` como locale (el del sistema,
// en vez de hardcodear un país que no es el del usuario) y se fija el formato
// campo por campo, así el resultado no depende de las defaults del locale.
const MD_DATE_FORMAT = {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false
};

function formatMarkdownDate(value) {
  return new Date(value).toLocaleString(undefined, MD_DATE_FORMAT);
}

function buildChatMarkdown(chatMemory, chatId) {
  const title = chatMemory.title || chatId;
  const history = Array.isArray(chatMemory.chatHistory) ? chatMemory.chatHistory : [];

  const ROLE_LABEL = { user: 'Usuario', assistant: 'Tempest' };
  const lines = [
    `# ${title}`,
    '',
    `Exportado: ${formatMarkdownDate(Date.now())}`,
    `Chat ID: ${chatId}`,
    '',
    '---'
  ];
  for (const msg of history) {
    const who = ROLE_LABEL[msg.role] || msg.role;
    const when = msg.timestamp ? formatMarkdownDate(msg.timestamp) : '';
    lines.push('', `**${who}**${when ? ` — ${when}` : ''}`, '', msg.content || '', '', '---');
  }

  // Bloque de datos al final, dentro de un comentario HTML: invisible al
  // renderizar el .md pero presente en el texto plano. Es lo que lee
  // importChat() para restaurar el chat EXACTO (roles y timestamps
  // originales) en vez de tener que adivinar parseando el texto. Se eligió
  // comentario HTML y no un bloque ``` visible para no ensuciar la lectura
  // del archivo, que es todo el punto de exportar en Markdown.
  const payload = {
    v: 1,
    chatId,
    title,
    exportedAt: new Date().toISOString(),
    chatHistory: history
  };

  return lines.join('\n')
    + '\n\n<!-- TEMPEST-CHAT-V1\n'
    + JSON.stringify(payload)
    + '\nTEMPEST-CHAT-END -->\n';
}

function exportChat(req, res) {
  try {
    const memoryOptions = buildMemoryOptions(req);
    const chatMemory = memory.loadChatMemory(memoryOptions);
    const title = chatMemory.title || memoryOptions.chatId;
    const markdown = buildChatMarkdown(chatMemory, memoryOptions.chatId);

    const exportDir = path.join(OUTPUTS_DIR, 'chat-exports', memoryOptions.chatId);
    fs.mkdirSync(exportDir, { recursive: true });

    // Nombre de archivo separado del chatId (que puede ser un id opaco) —
    // usa el título saneado + timestamp, así cada exportación queda como un
    // snapshot con nombre legible en vez de pisar siempre el mismo archivo.
    const safeSlug = title
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'chat';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${safeSlug}_${stamp}.md`;

    fs.writeFileSync(path.join(exportDir, fileName), markdown, 'utf8');

    return res.json({ ok: true, fileName, chatId: memoryOptions.chatId });
  } catch (error) {
    console.error('Error exportando chat:', error);
    return res.status(500).json({ ok: false, error: 'Error interno al exportar el chat' });
  }
}

// ─── Importar chat ──────────────────────────────────────────────────────────
// Reconstruye un chat a partir de un .md generado por exportChat(). Dos
// caminos, en orden de preferencia:
//   1. Bloque <!-- TEMPEST-CHAT-V1 ... --> → restauración exacta (roles y
//      timestamps originales). Es lo que va a tener cualquier export hecho
//      con esta versión o posteriores.
//   2. Parseo del Markdown a ojo (encabezados **Usuario** / **Tempest**) →
//      fallback para .md exportados antes de que existiera el bloque de
//      datos, o editados a mano. Recupera el texto pero pierde los
//      timestamps originales (se marcan con la fecha de importación).
function parseExportedMarkdown(markdown) {
  const dataMatch = markdown.match(/<!--\s*TEMPEST-CHAT-V1\s*\n([\s\S]*?)\nTEMPEST-CHAT-END\s*-->/);
  if (dataMatch) {
    try {
      const payload = JSON.parse(dataMatch[1]);
      if (Array.isArray(payload.chatHistory)) {
        return {
          title: payload.title || null,
          originalChatId: payload.chatId || null,
          chatHistory: payload.chatHistory,
          exact: true
        };
      }
    } catch (_) {
      // JSON corrupto (archivo editado/truncado) — se sigue al fallback en
      // vez de fallar: el texto legible del .md sigue estando intacto.
    }
  }

  // ── Fallback: parseo del texto ──
  const ROLE_BY_LABEL = { Usuario: 'user', Tempest: 'assistant' };
  const lines = markdown.split(/\r?\n/);

  let title = null;
  const chatHistory = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    // Se sacan los `---` separadores y las líneas en blanco de los bordes,
    // que son formato del export y no parte del mensaje.
    const content = current.buffer.join('\n').replace(/\n*---\s*$/, '').trim();
    if (content) chatHistory.push({ role: current.role, content, timestamp: new Date().toISOString() });
    current = null;
  };

  for (const line of lines) {
    if (!title) {
      const t = line.match(/^#\s+(.+)$/);
      if (t) { title = t[1].trim(); continue; }
    }
    const header = line.match(/^\*\*(.+?)\*\*(?:\s+—\s+.*)?$/);
    if (header) {
      flush();
      const label = header[1].trim();
      current = { role: ROLE_BY_LABEL[label] || label.toLowerCase(), buffer: [] };
      continue;
    }
    if (current) current.buffer.push(line);
  }
  flush();

  return { title, originalChatId: null, chatHistory, exact: false };
}

function importChat(req, res) {
  try {
    const { markdown } = req.body || {};
    if (typeof markdown !== 'string' || !markdown.trim()) {
      return res.status(400).json({ ok: false, error: 'Archivo vacío o ilegible' });
    }

    const parsed = parseExportedMarkdown(markdown);
    if (!parsed.chatHistory.length) {
      return res.status(400).json({
        ok: false,
        error: 'No se encontraron mensajes en el archivo. ¿Es un chat exportado por Tempest?'
      });
    }

    const baseOptions = buildMemoryOptions(req);

    // Nunca se pisa un chat existente: si el chatId original ya está en uso
    // (o el usuario importa el mismo archivo dos veces) se crea uno nuevo con
    // sufijo. Importar es siempre aditivo — el peor caso es un chat duplicado,
    // nunca perder uno.
    const existing = new Set(memory.listChats(baseOptions).map(c => c.chatId));
    const base = parsed.originalChatId
      || (parsed.title || 'chat').replace(/[\\/:*?"<>|\s]/g, '_').slice(0, 40)
      || 'chat';
    let chatId = base;
    let n = 2;
    while (existing.has(chatId)) chatId = `${base}-${n++}`;

    const options = { ...baseOptions, chatId };
    memory.createChat(chatId, options);

    const chatMemory = memory.loadChatMemory(options);
    chatMemory.chatId = chatId;
    // El título visible se conserva del export (es el campo mutable del
    // contrato de chatId), aunque el chatId de disco haya cambiado por
    // colisión. Si hubo colisión se marca para que el usuario los distinga.
    chatMemory.title = (parsed.title || chatId) + (chatId === base ? '' : ' (importado)');
    chatMemory.chatHistory = parsed.chatHistory;
    memory.saveChatMemory(chatMemory, options);

    return res.json({ ok: true, chatId, title: chatMemory.title, messages: parsed.chatHistory.length, exact: parsed.exact });
  } catch (error) {
    console.error('Error importando chat:', error);
    return res.status(500).json({ ok: false, error: 'Error interno al importar el chat' });
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

// ─── Exportar / importar proyecto ───────────────────────────────────────────
// Un proyecto no es un archivo, es un árbol: chats/*.json, projectMemory.json,
// projectSettings.json, projectContext.json y toda la carpeta context/
// (index.json, embeddings.json, files/, linked-folder-files/). Por eso el
// respaldo de un proyecto NO puede ser un solo .md legible como el de un chat.
//
// Formato elegido — un `.tempestproj` (JSON) con el árbol completo, más una
// copia legible de cada chat en .md al lado:
//   project-exports/<projectId>/
//     ├── <projectId>_<timestamp>.tempestproj   ← respaldo completo, importable
//     └── chats/<título>.md                     ← legible, importable individual
// La duplicación es a propósito: el .tempestproj restaura el proyecto tal cual
// (incluyendo embeddings ya calculados, que si no habría que regenerar con
// Ollama), y los .md cubren el caso de "sólo quiero leer/recuperar una
// conversación" sin abrir nada raro. Se descartó ZIP por lo mismo que en el
// export de chats (hay que extraerlo para ver algo) y porque agregaría una
// dependencia nueva sólo para comprimir: todo el contenido de un proyecto ya
// es texto.
const PROJECT_EXPORT_VERSION = 1;

// Lee un árbol de directorios a un objeto plano { 'ruta/relativa': {enc, data} }.
// Detecta binarios por byte nulo y los guarda en base64 — hoy todo lo que
// escribe la app en un proyecto es texto (.json/.txt), pero un adjunto o una
// carpeta vinculada podrían no serlo y el respaldo no debe corromperlos.
function readDirTree(dir, baseDir = dir, out = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      readDirTree(full, baseDir, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = path.relative(baseDir, full).split(path.sep).join('/');
    const buf = fs.readFileSync(full);
    out[rel] = buf.includes(0)
      ? { enc: 'base64', data: buf.toString('base64') }
      : { enc: 'utf8', data: buf.toString('utf8') };
  }
  return out;
}

function exportProject(req, res) {
  try {
    const { projectId } = req.body || {};
    if (!projectId) return res.status(400).json({ ok: false, error: 'projectId requerido' });

    const options = { ...buildMemoryOptions(req), projectId };
    const { projectDir } = memory.getPaths(options);
    if (!fs.existsSync(projectDir)) {
      return res.status(404).json({ ok: false, error: 'El proyecto no existe' });
    }

    const files = readDirTree(projectDir);
    const payload = {
      v: PROJECT_EXPORT_VERSION,
      projectId,
      exportedAt: new Date().toISOString(),
      files
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportDir = path.join(OUTPUTS_DIR, 'project-exports', projectId);
    const chatsOutDir = path.join(exportDir, 'chats');
    fs.mkdirSync(chatsOutDir, { recursive: true });

    const projFileName = `${projectId}_${stamp}.tempestproj`;
    fs.writeFileSync(path.join(exportDir, projFileName), JSON.stringify(payload), 'utf8');

    // Copia legible de cada chat, con el mismo formato (y el mismo bloque de
    // datos) que el export individual — así cada .md suelto también se puede
    // importar solo, sin el .tempestproj.
    let mdCount = 0;
    for (const { chatId } of memory.listChats(options)) {
      const chatMemory = memory.loadChatMemory({ ...options, chatId });
      const md = buildChatMarkdown(chatMemory, chatId);
      const slug = (chatMemory.title || chatId)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 60) || chatId;
      fs.writeFileSync(path.join(chatsOutDir, `${slug}.md`), md, 'utf8');
      mdCount++;
    }

    return res.json({ ok: true, projectId, fileName: projFileName, chats: mdCount });
  } catch (error) {
    console.error('Error exportando proyecto:', error);
    return res.status(500).json({ ok: false, error: 'Error interno al exportar el proyecto' });
  }
}

function importProject(req, res) {
  try {
    const { data } = req.body || {};
    if (typeof data !== 'string' || !data.trim()) {
      return res.status(400).json({ ok: false, error: 'Archivo vacío o ilegible' });
    }

    let payload;
    try {
      payload = JSON.parse(data);
    } catch (_) {
      return res.status(400).json({ ok: false, error: 'El archivo no es un respaldo válido (.tempestproj)' });
    }
    if (!payload || !payload.files || typeof payload.files !== 'object') {
      return res.status(400).json({ ok: false, error: 'El archivo no tiene la estructura de un proyecto exportado' });
    }
    if (payload.v > PROJECT_EXPORT_VERSION) {
      return res.status(400).json({
        ok: false,
        error: 'El respaldo es de una versión más nueva de Tempest. Actualizá la app para importarlo.'
      });
    }

    const baseOptions = buildMemoryOptions(req);

    // Mismo criterio que importar un chat: nunca se pisa un proyecto que ya
    // existe — se crea uno nuevo con sufijo. Importar es siempre aditivo.
    const existing = new Set(memory.listProjects(baseOptions));
    const base = String(payload.projectId || 'proyecto').replace(/[\\/:*?"<>|]/g, '_') || 'proyecto';
    let projectId = base;
    let n = 2;
    while (existing.has(projectId)) projectId = `${base}-${n++}`;

    const { projectDir } = memory.getPaths({ ...baseOptions, projectId });
    fs.mkdirSync(projectDir, { recursive: true });

    let written = 0;
    for (const [rel, entry] of Object.entries(payload.files)) {
      // Path traversal: un .tempestproj editado a mano podría traer rutas como
      // "../../users.json" y sobrescribir datos fuera del proyecto. Se resuelve
      // la ruta final y se verifica que siga adentro de projectDir.
      const dest = path.resolve(projectDir, rel);
      if (dest !== projectDir && !dest.startsWith(projectDir + path.sep)) {
        console.warn('[importProject] ruta fuera del proyecto, ignorada:', rel);
        continue;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(entry.data || '', entry.enc === 'base64' ? 'base64' : 'utf8'));
      written++;
    }

    if (!written) {
      fs.rmSync(projectDir, { recursive: true, force: true });
      return res.status(400).json({ ok: false, error: 'El respaldo no contenía archivos válidos' });
    }

    initProject(projectId);

    return res.json({
      ok: true,
      projectId,
      files: written,
      chats: memory.listChats({ ...baseOptions, projectId }).length,
      renamed: projectId !== base
    });
  } catch (error) {
    console.error('Error importando proyecto:', error);
    return res.status(500).json({ ok: false, error: 'Error interno al importar el proyecto' });
  }
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

// NOTA: los endpoints de log-question-text/log-response-text que vivían acá
// (switch global en Configuración → Preferencias) se eliminaron — el
// consentimiento de log ahora es por usuario, ver `setUserLogConsent`/
// `getUserLogConsent` en auth.service.js y `PATCH
// /auth/users/:username/log-consent` en auth.routes.js, gestionado desde
// Servicios → Búsqueda web (junto al selector de usuario). Ver DECISIONS.md
// → "Trace de ejecución por request — consentimiento de log por usuario".

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
  exportChat,
  importChat,
  exportProject,
  importProject,
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