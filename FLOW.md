# Flujo del Sistema - Tempest

## 💬 Flujo normal de chat (con streaming)

1. Usuario escribe mensaje.
2. Frontend valida que no esté vacío.
3. Si no hay chat activo, se crea uno en el contexto correcto.
4. `createStreamingBubble` crea la burbuja de respuesta vacía en el chat.
5. Frontend envía `POST /chat` con `onToken` callback.
6. Backend llama a `detectMode({ rawMessage, files, configMode })`.
7. `mode.router.js` evalúa heurística y devuelve `{ mode, variant, reason }`.
8. Backend loguea: `[MODE ROUTER] mode=X variant=Y reason="Z"`.
9. `buildPrefixedMessage` construye `finalMessage` con prefijo según modo → va al modelo.
10. `rawTrimmed + attachmentContext` construye `historialMessage` sin prefijo → se guarda en memoria.
11. `detectUserData` recibe el mensaje limpio del usuario.
12. Backend llama a `streamToLocalAI` con `finalMessage` y `options.mode`.
13. `buildSystemPrompt` (async) ensambla las 4 capas incluyendo context files del proyecto.
14. `getMaxTokens` asigna presupuesto de tokens según modo.
15. Backend abre conexión SSE (`Content-Type: text/event-stream`).
16. `llamaProvider.stream()` genera tokens uno por uno via callback interno de node-llama-cpp → cola AsyncGenerator.
17. Cada token llega al backend via `for await` → se reenvía al frontend con `res.write()`.
17b. Si el router eligió un modelo diferente al activo, antes del stream se ejecuta `switchModel()` y se emite `[SWITCHING_MODEL]` al frontend.
18. Frontend recibe cada token vía `ReadableStream` → `onToken` lo agrega a `rawEl.textContent`.
19. Si es el primer mensaje del chat, el frontend **ya lanzó el renombrado en paralelo** (antes del stream, sin `await`) — el modelo de títulos genera el nombre mientras el modelo de chat responde.
20. Al terminar el stream, backend envía evento SSE `[DEBUG]` (solo si Dev Mode activo y rol admin) con `{ mode, variant, model, hardwareProfile, contextSize, truncated }`.
21. Backend envía `[DONE]` con metadata de adjuntos.
22. `finalizeStreamingBubble` limpia stop tokens y prefijos filtrados (airbag visual), luego renderiza.
23. Backend guarda `historialMessage` limpio en `chatHistory`.
24. Frontend espera el renombrado paralelo (normalmente ya resuelto) y actualiza el sidebar una sola vez.

---

## 🎯 Flujo del router de modos

```text
chat.controller.js recibe rawMessage + files + config
↓
detectMode({ rawMessage, files, configMode })
↓
mode.router.js evalúa en orden:
  1. ¿config.mode existe? → override, retorna inmediatamente
  1b. ¿patch trigger explícito? → coder/patch
  2. ¿sin texto + adjunto código? → coder/strict
  3. ¿sin texto + adjunto no-código? → explain
  4. ¿adjunto + verbo técnico? → coder/strict
  5. ¿adjunto + verbo lectura? → explain
  6. ¿trigger código + trigger explicación? → coder/hybrid
  7. ¿solo trigger explicación? → explain
  8. ¿solo trigger código? → coder/strict
  9. default → general
↓
{ mode, variant, reason }
↓
buildPrefixedMessage:
  explain    → "Responde SOLO con texto explicativo... {mensaje}"
  hybrid     → "Explica brevemente y luego entrega el código... {mensaje}"
  strict/general → mensaje sin modificar
↓
finalMessage (con prefijo) → streamToLocalAI
historialMessage (sin prefijo) → memory.addChatHistoryMessage
streamOptions.mode = mode → getMaxTokens usa mode para tokens
```

---

## 🧱 Flujo de armado del system prompt (v1.4.0)

```text
localai.service.js
↓ await buildSystemPrompt({ fullMemory, mode, variant, userId, projectId, userMessage })
↓
config/buildSystemPrompt.js
↓ Capa 1: loadGlobalPrompt() → global.system.txt
↓ Capa 2: loadModePrompt(mode, variant) → modes/{mode}.txt
↓ Capa 3: loadProjectPrompt(userId, projectId) → projectSettings.json → prompts.projectPromptText
↓ Capa 4: skipContextFiles ? '' : await getProjectContext({ projectId, userMessage })
  ↓ context.service.js → loadIndex, loadSettings
  ↓ assembler.assemble([uploadProvider, fsProvider], { userMessage, rules })
    ↓ uploadProvider.provide() → lee files/ del disco
    ↓ fsProvider.provide() → stub vacío (v1)
    ↓ budgeter.budget(allBlocks, rules, userMessage)
      ↓ orden: alwaysInclude → mentioned → resto
      ↓ límite: maxFilesPerRequest + maxCharsTotal
      ↓ truncado inteligente con nota si excede
  ↓ formatea con ### CONTEXT: PROJECT FILES ### ... ### CONTEXT: END ###
↓ prompt.builder.buildPrompt({ globalPrompt, projectPrompt, modePrompt, memoryBlock, contextBlock })
↓ system prompt final
```

---

## 🧹 Flujo de sanitización de salida del modelo

```text
LocalAI genera respuesta (streaming o completa)
↓
Backend: cleanReply(text) → llama sanitizeModelOutput(text)
  - elimina stop tokens de Hermes
  - elimina prefijos internos filtrados (si aparecen al final)
  - elimina ruido del modelo (^assistant, ^:)
  - normaliza whitespace
↓
Backend guarda respuesta limpia en chatHistory
↓
Frontend: finalizeStreamingBubble recibe fullText acumulado durante stream
  - aplica VISUAL_STOP_TOKENS (airbag independiente)
  - aplica stripLeakedInstructions (airbag visual)
  - renderMixedContent → renderizado final
```

El frontend mantiene su propio airbag porque renderiza durante el stream, antes de que backend procese y guarde en historial.

---

## 📁 Flujo de subida de context files

1. Usuario abre menú `⋯` de un proyecto → "Archivos de contexto".
2. Modal muestra lista actual de items del proyecto.
3. Usuario presiona "+ Subir archivos" y selecciona archivos.
4. Frontend llama `POST /project/:projectId/context/upload` con FormData.
5. Backend recibe archivos vía multer en `uploads/context-tmp/`.
6. Para cada archivo: `extractText(file)` reutilizando `attachment.service`.
7. Se calcula SHA-256 del contenido — si ya existe ese hash, se descarta (deduplicación).
8. Se guarda `f_XXX.txt` (contenido) y `f_XXX.meta.json` (metadata) en `context/files/`.
9. Se agrega item al `context/index.json` del proyecto.
10. Frontend actualiza la lista del modal.
11. Temporales de multer se limpian inmediatamente.

---

## ⚡ Flujo de tokenización real (v2.12.0)

```text
Usuario envía mensaje
↓
chat.controller.js → countTokens(finalMessage)
  → llama.provider.js → _model.tokenize(text).length
  → fallback: text.length / 3.5 si modelo no está listo
↓
availableTokens = contextTokens - maxOutput - messageTokens - SYSTEM_PROMPT_TOK - HISTORY_TOK - SAFETY_MARGIN_TOK
↓
dynamicMaxChars = availableTokens * 3.5
↓
getProjectContext recibe budget preciso en chars
```

---

## 📊 Flujo de métricas de tokens (v2.13.0)

```text
Stream termina
↓
localai.service.js → finally block
  → meta.promptTokens = countTokens(messages.join())   ← tokens reales
  → meta.completionTokens = countTokens(fullReply)      ← tokens reales
  → _addTokens(model, promptTokens, completionTokens)   ← acumulador interno
↓
GET /localai/metrics
  → metrics.routes.js → getTokenMetrics()
  → devuelve _tokenAccum por modelo
↓
Dev Panel muestra: "hermes-q5 prompt: 2728 · completion: 522"
```

## 🧠 Flujo de embeddings semánticos (v2.14.0)

### Generación de embeddings (al regenerar snapshot)
```text
Usuario presiona "Generar snapshot"
↓
context.controller.js → generateSnapshot() → projectContext.json actualizado
↓
context.controller.js → spawn('node', ['generate-embeddings.js', projectId, userId])
  → child process independiente (sin node-llama-cpp)
  → lee projectContext.json → lista de archivos
  → por cada archivo: chunkText() → chunks de ~4000 chars
  → por cada chunk: POST http://localhost:11434/api/embeddings (Ollama)
  → guarda vector en embeddings.json
↓
child process termina → embeddings.json actualizado
↓
Electron no se bloquea — proceso completamente en background
```

### Búsqueda semántica (al preguntar)
```text
Usuario envía mensaje
↓
assembler.js → snapshotProvider.provide({ userMessage })
↓
snapshot.provider.js
↓ loadStore() → lee embeddings.json
↓ ¿hay chunks? → SÍ → modo semántico
  → getEmbedding(userMessage) via Ollama HTTP
  → searchSimilar(store, queryVector, 8) → top 8 chunks por similitud coseno
  → agrupa por archivo → devuelve bloques de contexto relevantes
↓ NO → modo fallback (primeros 5 archivos por mtime)
↓
budgeter → selecciona bloques que caben en el budget
↓
system prompt con chunks semánticos más relevantes
```
---

## 📎 Flujo de chat con archivos adjuntos

1. Usuario adjunta archivos (botón + o drag & drop).
2. Frontend muestra chips visuales de los archivos.
3. Al enviar, `api.js` construye un `FormData` con el mensaje y los archivos.
4. Backend recibe la petición via multer, guarda temporales en `uploads/attachments/`.
5. `detectMode` evalúa tipo de adjunto + texto para determinar modo.
6. `attachment.service.js` valida cada archivo (mimetype + extensión + magic bytes).
7. Para PPTX, delega a `attachment/extractors/pptx.extractor.js`.
8. El texto se trunca inteligentemente según tipo.
9. Se construye el bloque `--- ARCHIVOS ADJUNTOS ---` y se inyecta al `finalMessage`.
10. `historialMessage` guarda el contenido del adjunto sin el prefijo de instrucción.
11. LocalAI recibe el contexto completo y responde vía streaming.
12. Bloque `finally`: `cleanupFiles` elimina los temporales (Capa A).
13. Frontend renderiza la respuesta final.

---

## 🧠 Flujo con memoria

1. Frontend envía `userId`, `projectId` y `chatId`.
2. Backend localiza memoria global, de proyecto y de chat.
3. Se construye contexto.
4. Se consulta LocalAI vía stream con `finalMessage`.
5. Se actualiza `chatHistory` con `historialMessage` limpio al terminar el stream.

---

## 🆕 Flujo de nuevo chat sin proyecto

1. Usuario presiona `+ Nuevo Chat`.
2. Se muestra pantalla inicial.
3. No se crea chat todavía.
4. Usuario escribe primer mensaje (o adjunta archivos sin texto).
5. Se crea chat dentro de `general`.
6. Se envía el mensaje con streaming. **En paralelo** (sin esperar) se lanza la generación del título — el modelo de chat responde y el modelo de títulos genera el nombre al mismo tiempo (`PARALLEL_REQUEST` en LocalAI).
7. La IA genera un título corto basado en el mensaje o en los nombres de archivos adjuntos.
8. Al terminar el stream, el chat se renombra (el título normalmente ya está listo por correr en paralelo).
9. El sidebar muestra el nuevo nombre. Si el usuario cambió de chat durante la generación, el renombrado no roba el foco (verifica `chatId` activo).9. El sidebar muestra el nuevo nombre. **Desde v2.11.0:** `chatId` es inmutable — el renombrado solo actualiza el campo `title` en disco, nunca cambia la identidad del chat. Ya no existe riesgo de "robar" el foco de otro chat, sin importar cuándo termine la generación del título.
---

## 📁 Flujo de nuevo proyecto

1. Usuario presiona `+ Nuevo Proyecto`.
2. Se abre modal para escribir nombre.
3. Se valida el nombre (caracteres inválidos, longitud).
4. Usuario confirma.
5. Se crea carpeta del proyecto.
6. `initProject(projectId)` inicializa `projectSettings.json`, `context/index.json` y `context/files/`.
7. Se muestra pantalla inicial.
8. Usuario escribe el primer mensaje.
9. Se crea un chat dentro del proyecto.
10. La IA genera el nombre del chat.
11. El sidebar muestra proyecto y chat.

---

## ✏️ Flujo de renombrar

1. Usuario abre menú de tres puntos.
2. Selecciona `Renombrar`.
3. Se abre modal propio con el nombre actual pre-cargado — para chats, precarga `title` (no `chatId`) desde v2.11.0.
4. Usuario escribe nuevo nombre.
5. Se valida el nombre.
6. Si hay error, se muestra en rojo sin cerrar el modal.
7. Si es válido, Frontend llama a `/chat/rename` (`{chatId, newTitle}`) o `/project/rename` (`{oldProjectId, newProjectId}`).
8. **Chats (v2.11.0):** backend actualiza solo el campo `title` dentro del JSON — el archivo nunca cambia de nombre, `chatId` permanece igual. **Proyectos (sin cambios):** backend sigue renombrando la carpeta física.
9. Sidebar se actualiza.

---

## 🗑️ Flujo de eliminar

1. Usuario abre menú de tres puntos.
2. Selecciona `Eliminar`.
3. Se abre modal de confirmación.
4. Usuario confirma.
5. Frontend llama a `/chat/delete` o `/project/delete`.
6. **Chats (v2.16.0):** antes de borrar el `.json`, `deleteChat` escanea `chatHistory` buscando el patrón `[Ver documento](url)`, convierte cada URL a ruta de disco real y borra el archivo generado correspondiente (ej. transcripciones en `outputs/transcriptions/`) — evita archivos huérfanos, el ciclo de vida del archivo queda atado al del chat que lo generó.
7. Backend elimina el archivo `.json` (chat) o la carpeta completa (proyecto).
8. UI vuelve a pantalla inicial.
9. Sidebar se actualiza.

**Limitación conocida (v2.16.0):** `deleteProject` borra la carpeta completa del proyecto de forma recursiva sin pasar por la limpieza del paso 6 — si el proyecto contiene chats con transcripciones, esos archivos quedan huérfanos. Pendiente en ROADMAP.

---

## 🎙️ Flujo de transcripción de audio (v2.15.0)

1. Usuario abre menú de herramientas (+).
2. Selecciona `Transcripción`.
3. Selecciona audio, modo (`plain`/`timestamps`) y formato (`txt`/`pdf`/`docx`).
4. Frontend envía `POST /transcribe` con FormData (audio + mode + format).
5. Backend guarda audio temporal en `backend/uploads/audio/`.
6. **VAD — corte por silencio real:**
   - `vad.detector.js` invoca ffmpeg con filtro `silencedetect=noise=-35dB:d=0.8`
   - Parsea `silence_end` de stderr, filtra puntos con `MIN_CHUNK_SECONDS=20` / `MAX_CHUNK_SECONDS=90`
   - Fallback automático a corte fijo de 60s si no se detectan silencios (audio con música continua)
7. Para cada segmento, ffmpeg genera un WAV mono 16kHz PCM en `backend/uploads/chunks/session-{ts}/`. Los chunks son objetos `{ path, startTime }` con el timestamp real de inicio.
8. **whisper.cpp standalone transcribe fragmentos:**
   - `execFileAsync('whisper-bin/whisper-cli.exe', ['-m', ggml-large-v3.bin, '-f', chunk.wav, '-l', 'es', '-otxt', '-of', outputBase])`
   - Whisper genera un `.txt` temporal junto al WAV, backend lo lee y lo borra
   - Motor CUDA (RTX 4070) — ~1s por chunk de 60s
9. Backend une resultados:
   - Modo `plain` → `mergeTranscriptionsPlain` + `cleanTranscriptText` (limpia espacios de inicio de línea, colapsa saltos, agrega puntuación)
   - Modo `timestamps` → `mergeTranscriptionsWithTimestamps` usando `startTime` real de cada chunk (no `index * CHUNK_SECONDS`)
10. Se genera archivo TXT/PDF/DOCX en `backend/outputs/transcriptions/`.
11. `toPublicUrl` devuelve URL **absoluta** `http://localhost:3005/outputs/...` (v2.15.0 — antes devolvía ruta relativa que no funcionaba en Electron con `loadFile`).
12. Frontend muestra card con opciones Ver documento / Descargar.
13. Cleanup en `finally`: borra `sessionDir` y audio temporal original.

**Persistencia en chatHistory (v2.16.0):** el mensaje inicial (🎙️ Estoy transcribiendo...) y el mensaje final con la card de resultado se guardan explícitamente vía `POST /chat/message/save` — antes de este fix ambos mensajes solo vivían en el DOM y desaparecían al cambiar de chat y volver. El chat destino (`targetChat`) se captura al **inicio** del flujo, antes de que el usuario pueda navegar, para evitar que el mensaje final se guarde en un chat distinto si la transcripción termina mientras el usuario ve otra conversación. Al recargar el historial, `loadChatHistory` (`app.js`) detecta el patrón de texto vía `parseDocumentCardMessage` y reconstruye la card visual con botones Ver/Descargar en lugar de mostrar texto plano.

**Motores del pipeline:**
- `vad.detector.js` — ffmpeg silencedetect (reemplazable por Silero VAD)
- `whisper-cli.exe` — whisper.cpp v1.9.1 CUDA 12.4 (reemplazable por modelo diferente cambiando `WHISPER_MODEL`)
- Modelo activo: `ggml-large-v3.bin` (3 GB VRAM)

---

## 🧹 Flujo de limpieza de temporales

**Capa A — inmediata:**
- Tras cada request en `chat.controller.js`, el bloque `finally` llama a `cleanupFiles`.
- Borra todos los archivos subidos en esa petición.
- En `context.controller.js`, los temporales de multer se borran al terminar cada upload de context files.

**Capa B — job escoba:**
- `server.js` ejecuta `setInterval` cada 6 horas.
- Recorre `uploads/attachments/` y elimina archivos con más de 24h de antigüedad.
- Actúa como red de seguridad si la Capa A falla.

---

## 🌊 Flujo de streaming SSE

```
frontend/app.js
↓ createStreamingBubble → burbuja vacía en el DOM
↓
api.js → POST /chat (JSON o FormData)
↓ ReadableStream reader
↓ onToken callback → rawEl.textContent += token
↓
backend/controllers/chat.controller.js
↓ detectMode → { mode, variant, reason }
↓ buildPrefixedMessage → finalMessage (con prefijo, al modelo)
↓ rawTrimmed + attachmentContext → historialMessage (sin prefijo, a memoria)
↓ res.setHeader('Content-Type', 'text/event-stream')
↓ for await (token of streamToLocalAI(finalMessage, ...))
↓ res.write(`data: ${JSON.stringify(token)}\n\n`)
↓
services/localai.service.js → streamToLocalAI (AsyncGenerator)
↓ await buildSystemPrompt({ ..., userMessage }) → 4 capas incluyendo context files
↓ fetch LocalAI con stream: true
↓ getMaxTokens(model, message, options.mode, hardwareProfile)
↓ ReadableStream → yield token por token
↓
LocalAI genera tokens individuales
↓
Al terminar: res.write('[DONE] {...}') → res.end()
↓ memory.addChatHistoryMessage('assistant', fullReply, memoryOptions)  ← v2.8.0: respuesta persistida en chatHistory
↓
frontend: finalizeStreamingBubble
↓ VISUAL_STOP_TOKENS regex → limpia stop tokens
↓ stripLeakedInstructions → airbag visual para prefijos filtrados
↓ renderMixedContent → bloques de código, links, acciones
```
## 🩹 Flujo de Patch Mode (v2.1.1)

1. Usuario escribe trigger patch (ej. "dame el diff para...") en un chat de proyecto con snapshot activo.
2. `detectMode` detecta `variant=patch` por trigger explícito.
3. `chat.controller.js` valida que haya archivo adjunto, context files o proyecto con snapshot — si no, devuelve error 400.
4. `attachmentContext` se trunca a 800 chars si hay adjunto temporal.
5. `buildPatchGrounding(rawMessage, projectId)` busca el archivo más relevante del snapshot:
   - Busca por nombre mencionado en el mensaje del usuario
   - Fallback al primer archivo del snapshot disponible
   - Truncado por zonas: cabecera 800 chars + cola 400 chars, máximo 2500 chars total
   - Devuelve bloque `<<<FILE_BEGIN: relPath\n{contenido}\nFILE_END>>>`
6. `finalMessage` se construye como: `{patchGrounding}\n{userMessage}` — el archivo va antes del pedido.
7. `streamOptions.skipContextFiles = true` — omite Capa 4 del system prompt para no saturar prefill.
8. `buildSystemPrompt` carga `coder.patch.txt` como Capa 2, omite Capa 4 por `skipContextFiles`.
9. `model.router` selecciona `deepseek-coder-6.7b-q6` via alias `coder-patch`.
10. Modelo genera respuesta en alguno de los formatos soportados (Search/Replace, unified diff, SEARCH:/REPLACE:).
11. `patch.parser.js` detecta el formato y normaliza a bloques `{ filepath, searchContent, replaceContent }`.
12. `finalizeStreamingBubble` llama `stripLeakedInstructions` — limpia system prompt filtrado si lo hay.
13. `messageRenderer.js` detecta bloque patch con `patchBlockRegex` o `patchLabelRegex` y llama `renderPatchBlock`.
14. UI renderiza diff rojo/verde con nombre de archivo y botón ⚡ Aplicar.
15. Todo lo que venga después del primer bloque patch se ignora (ruido del modelo).

---

## 🗂️ Flujo de Context Snapshot (v1.7.0)

1. Usuario abre modal de context files → "↻ Generar snapshot".
2. Frontend llama `POST /project/:projectId/context/snapshot` con `{ snapshotRoot }`.
3. `snapshot.service.js` hace crawl del directorio, filtra por extensión y tamaño (<30KB).
4. Calcula hash SHA-256 por archivo, compara con manifest anterior (refresh incremental).
5. Genera `projectContext.json` con snapshotRoot, totalFiles, hash+mtime por archivo.
6. Controller registra archivos nuevos en `context/index.json` como `source='snapshot'`.
7. Limpia items snapshot cuyos archivos ya no existen en disco.
8. UI muestra estado actualizado: "✓ N archivos · fecha".

---

## 🗂️ Flujo de Carpeta vinculada por proyecto (v2.17.0)

1. Usuario abre modal de context files → escribe/selecciona una ruta en "Carpeta del proyecto" → activa el checkbox "Documentos".
2. Frontend llama `POST /project/:projectId/context/linked-folder/refresh` con `{ folderRoot }`.
3. `linked-folder.service.js` hace crawl recursivo (`maxDepth=6`) respetando `EXCLUDED_DIRS`/`ignoreGlobs`, filtra por extensión soportada (texto/código + PDF/DOCX/XLSX/PPTX/imágenes).
4. Filtra por tamaño (`maxFileSize`, 100MB) y selecciona hasta `maxFiles` (200) más recientes por `mtimeMs`.
5. Para cada archivo nuevo o modificado (diffing por `mtimeMs`+`sizeBytes`), extrae contenido reusando `attachment.service.extractText()` — mismo pipeline que adjuntos del chat, incluye OCR.
6. Escribe el contenido extraído en `context/linked-folder-files/{contentId}.txt` (contentId = md5 del relPath) y actualiza el manifest `context/linkedFolder.json`.
7. Limpia contenido cacheado de archivos que salieron del set (borrados, renombrados, excluidos, o desplazados por el límite).
8. Controller registra/actualiza los items en `context/index.json` como `source='linked-folder'`.
9. UI muestra estado actualizado: "✓ N archivos · fecha" (o el aviso de escaneo truncado con la causa real: tamaño / cantidad / límite de recorrido).
10. Al preguntar: `linked-folder.provider.js` lee únicamente lo ya cacheado (nunca vuelve a tocar el filesystem original) y lo agrega como Capa 4 del system prompt, igual que el resto de providers.

**Fixes v2.17.1 (selector de carpeta):**
- Al abrir el modal, el input "Carpeta del proyecto" se limpia explícitamente (`folderInput.value = ''`) antes de prellenarse con la ruta real de *ese* proyecto — antes era un elemento del DOM compartido entre proyectos y arrastraba la ruta del último proyecto abierto.
- El diálogo nativo (`dialog.showOpenDialog` vía IPC `select-folder`) ahora recibe la ruta actual del input como `defaultPath` — antes recordaba la última carpeta visitada de forma global, sin importar el proyecto o campo.

Ver DECISIONS.md, secciones "Lectura de carpeta vinculada por proyecto" y "Parche: maxFileSize dejaba fuera libros/PDFs grandes", para el detalle completo de diseño y bugs resueltos.

---

## 🩹 Flujo de Apply Patch (v1.7.0)

1. Usuario pide diff en chat del proyecto → modelo genera bloque merge_conflict o search_replace.
2. `patch.parser.js` detecta formato y extrae `{ filepath, searchContent, replaceContent }`.
3. Frontend renderiza diff rojo/verde con botón ⚡ Aplicar.
4. Usuario pulsa ⚡ Aplicar → modal de confirmación con nombre del archivo.
5. Usuario acepta → `POST /project/:projectId/patch/apply` con los tres campos.
6. Controller obtiene `snapshotRoot` del manifest del proyecto.
7. `apply.service.js` lee el archivo real, normaliza para matching.
8. Intenta exact match → si falla, intenta ancla de 5 líneas → si searchContent >80% del archivo, reemplaza completo.
9. Crea backup en `projects/{projectId}/backups/{timestamp}_{filename}.bak`.
10. Escribe el archivo modificado en disco.
11. Frontend muestra "✓ Aplicado" en verde en el botón.

---

---

## 🏷️ Flujo del label de modelo automático (v2.0.1)

```text
1. chat.controller.js resuelve selectedModel via detectBestModel o preferencias del proyecto
2. Antes del stream: res.write('data: [MODEL] {"model": selectedModel}')
3. api.js detecta payload [MODEL] → llama onModel(usedModel) callback → guarda en usedModel
4. app.js recibe onModel → updateMenuTriggerLabel(menuTrigger, 'auto', assistantsState, model)
5. models.js muestra "modelo: Automático local · [label del modelo]"
6. primaryModel sigue siendo 'auto' — label solo visual
7. Al terminar stream: [DONE] incluye model → data.usedModel disponible como confirmación
```

---

## 🛠️ Flujo del evento [DEBUG] — Dev Panel (v2.4.3)

```text
1. chat.controller.js verifica isDevModeEnabled() al terminar el stream (flujo normal, no visual)
2. Antes de [DONE]: res.write('data: [DEBUG] {mode, variant, model, hardwareProfile, contextSize, truncated}')
3. api.js detecta payload [DEBUG] → llama onDebug(payload) callback
4. chat.js pasa el callback como _deps.onDebug
5. app.js → handleDebugEvent(payload) → devPanel.js renderiza el panel
6. Si rol no es admin, initDevPanel no inyectó el DOM → el evento se descarta sin efecto
```

---

## 🗂️ Flujo del toggle de Context Snapshot (v2.0.2)

```text
1. Usuario abre modal de context files de un proyecto
2. openContextFilesModal resetea snapshotToggle: checked=true, disabled=false (limpieza de estado anterior)
3. Se usa cloneNode+replaceWith en snapshotToggle para limpiar listeners acumulados
4. Se lee context/index.json → filtra items con source='snapshot'
5. Si snapshotItems.length === 0 → disabled=true, title="Genera un snapshot primero"
6. Si snapshotItems.length > 0 → checked = snapshotItems.some(i => i.enabled !== false)
7. Usuario hace clic → onChange → POST /project/:projectId/context/snapshot/toggle
8. toggleSnapshot en controller → pone enabled en todos los items snapshot del index
9. refreshSnapshotStatus actualiza el label: "✓ Snapshot activo" o "⏸ Snapshot pausado"
10. renderItems actualiza la lista — items desactivados siguen visibles pero no se inyectan al prompt
```

---

## 🖼️ Flujo OCR de adjuntos (v2.2.x)

### Imágenes sueltas (PNG/JPG/WEBP)
attachment.service.js → extractText(file)
↓ IMAGE_EXTENSIONS.has(ext) → extractImage(file)
↓
image.extractor.js → recognizeImage(file.path)
↓
ocr.service.js
↓ sha1(filePath) → busca cache en data/ocr-cache/{hash}.json
↓ cache hit → return cached
↓ cache miss → preprocessImage(filePath)
↓
preprocessor.js (sharp)
↓ grayscale → normalize → upscale si width < 1000px
↓ outputPath = filePath + '.preprocessed.png'
↓
ocr.service.js
↓ worker.recognize(outputPath)
↓ finally: unlink(outputPath) si wasProcessed
↓ confidence < 30% → placeholder "sin texto legible"
↓ confidence >= 30% → { text, confidence, cached: false }
↓ writeFile cache
↓
image.extractor.js → { name, type: 'image', content, truncated: false, meta }

### PDF escaneado
attachment.service.js → extractText(file)
↓ ext === '.pdf'
↓ pdf2json intenta extraer texto → raw
↓ isScannedPdf(raw) → raw.trim().length < 50 → true
↓ checkPoppler() → true (legado — ya no se usa Poppler, ver nota abajo)
↓ extractPdfOCR(file, raw)
↓
pdf.ocr.extractor.js
↓ rasterizePdf(filePath, outDir, maxPages=5)
↓
pdf.rasterizer.js (pdfjs-dist + @napi-rs/canvas, v2.11.x — ver DECISIONS.md)
↓ getDocument({ data, standardFontDataUrl, canvasFactory: NodeCanvasFactory }) → pdfDoc
↓ por cada página: getPage() → getViewport(scale) → page.render({ canvasContext, viewport, canvasFactory })
↓ canvas.toBuffer('image/png') → writeFile
↓ devuelve [page-1.png, page-2.png, ...]
↓
pdf.ocr.extractor.js
↓ por cada página: recognizeImage(pagePng) via ocr.service.js + preprocessor.js
↓ finally: cleanupRasterDir(outDir)
↓ { name, type: 'pdf', content: header + páginas, truncated, meta }

> **Nota:** `checkPoppler()` se mantiene como función en el código solo por compatibilidad — ahora siempre retorna `true` y no se invoca ningún binario externo. Candidata a limpieza en una pasada futura.

### DOCX con imágenes embebidas
attachment.service.js → extractText(file)
↓ ext === '.docx'
↓ mammoth.extractRawText → raw (texto normal)
↓ extractDocxImagesOCR(file, raw)
↓
docx.ocr.extractor.js
↓ JSZip.loadAsync(buffer)
↓ filtra word/media/*.{png,jpg,webp,...} → mediaPaths
↓ mediaPaths.length === 0 → return null (usa flujo normal mammoth)
↓ por cada imagen (máx 15):
↓ zip.file(p).async('nodebuffer') → imgBuffer
↓ writeFile(tempPath, imgBuffer)
↓ recognizeImage(tempPath) via ocr.service.js + preprocessor.js
↓ finally: unlink(tempPath)
↓ combina rawText + imageResults
↓ { name, type: 'docx', content: texto + OCR, truncated, meta }

### Imágenes — fallback visual (v2.3.0)
image.extractor.js
↓ recognizeImage → { text, confidence }
↓ confidence < MIN_CONFIDENCE (60%) o text vacío
↓ isVisionAvailable() → GET /v1/models → busca 'qwen2.5-vl-7b-q4'
↓ describeImage(filePath)
↓
vision.service.js
↓ sharp → resize 1024px, JPEG quality 70 → tmpPath
↓ toBase64DataURL(tmpPath) → data:image/jpeg;base64,...
↓ POST /v1/chat/completions con image_url + prompt en español
↓ removeLoops(response) → elimina párrafos y frases duplicadas
↓ truncated = finish_reason === 'length'
↓ finally: unlink(tmpPath)
↓ { description, model: 'qwen2.5-vl-7b-q4', truncated }
↓
image.extractor.js
↓ { name, type: 'image', content: '[Imagen | Análisis visual: qwen2.5-vl-7b-q4]\n\n{description}', truncated }

## 🌐 Flujo de búsqueda web (v2.6.0–v2.7.0)

### Chat con búsqueda web activa (🌐 ON)
```text
Usuario escribe mensaje + 🌐 activo
↓
frontend: getWebSearchConfig() → { webSearch: true, searchProvider: 'tavily' }
↓ spread en config del chat request
backend chat.controller.js
↓ loadSearchConfig() → verifica globalEnabled + provider habilitado
↓ _isSearchRateLimited(userId) → 3s cooldown por usuario
↓ effectiveSearchQuery = rawTrimmed (texto normal)
                       | rawTrimmed + visionDescription (modo visual)
↓ search(query, providerName) → provider.search(query, config)
↓ formatResultsAsContext(results, query)
↓ finalMessage = baseMessage + '\n\n' + [BÚSQUEDA WEB...][FIN BÚSQUEDA WEB] + instrucciones
↓ streamToLocalAI con maxTokens: 350
↓ modelo responde usando resultados como contexto
```

### Pipeline visual + búsqueda web (v2.7.0)
```text
Imagen adjunta + 🌐 activo
↓
image.extractor.js → OCR (confianza < 60%) → vision.service.js
↓ describeImage() → { description, model, truncated }
↓ attachmentContext = '[Imagen | Análisis visual: modelo]\n\n{description}'
↓
chat.controller.js
↓ isVisionResponse = true
↓ visionDescription extraída via regex del attachmentContext
↓ effectiveSearchQuery = userMessage + ' ' + visionDescription.slice(0, 200)
↓ search(effectiveSearchQuery, provider) → 5-6 resultados
↓ webSearchContext = formatResultsAsContext(results, query)
↓
if (isVisionResponse && webSearchContext):
  → SALTA fast-path (no stream directo de descripción)
  → finalMessage = [DESCRIPCIÓN]\n{visionDescription}\n[FIN]\n\n{webSearchContext}\n\nINSTRUCCIÓN\n\nPregunta: {rawTrimmed}
  → streamOptions.primaryModel = 'qwen2.5-7b-q5' (texto, no visual)
  → streamOptions.mode = 'general'
  → streamOptions.maxTokens = 450
  → streamToLocalAI → modelo identifica juego/lugar/producto
```

## 🖥️ Flujo de arranque en Electron (v2.8.0 → v2.17.0)

npm start (raíz)
↓
shell/main.js → app.whenReady()
↓ createSplashWindow() → BrowserWindow frameless, show:false hasta 'ready-to-show'
↓   splash.html hace fetch propio a /health cada 400ms (sin preload/IPC) — muestra
↓   estado y progreso mientras dura todo lo que sigue
↓
try {
  ↓ startBackend() → require('../backend/server.js') en el mismo proceso (sin
  ↓   fork/spawn desde v2.11.0), IS_ELECTRON='true' inyectado antes del require
  ↓ waitForBackend() → polling GET /health hasta status 200 (60 intentos × 500ms)
  ↓   → Express está arriba, pero el modelo puede seguir cargando
  ↓ waitForModelReady() → polling GET /health hasta ai==='ready' o ai==='error'
  ↓   (600 intentos × 500ms = 5 min de margen)
  ↓ createWindow() → BrowserWindow con show:false, loadFile(frontend/index.html)
  ↓   → al disparar 'ready-to-show': mainWindow.show() + cierra el splash
} catch (err) {
  ↓ dialog.showErrorBox('Tempest no pudo iniciar', err.message) → app.quit()
  ↓   (cubre: server.js no encontrado, Express no responde, o modelo con ai==='error')
}
↓
Cierre de ventana → window-all-closed → app.quit()
  (ya no hay backendProcess.kill() — Express corre en el mismo proceso desde v2.11.0)

---

## ⏹️ Flujo del botón detener (v2.8.0)
Usuario envía mensaje
↓ chat.js: _sending=true, setSendingState(true)
↓ botón enviar → ⏹ rojo (ICON_STOP, .stop-mode), userInput deshabilitado
↓ sidebar bloqueado: chats, proyectos, menú ⋯, nuevo chat, nuevo proyecto (guard _isSending / getSendingState)
↓
[Caso A — stream termina normal]
↓ [DONE] → _sending=false inmediato (no espera el título)
↓ titlePromise.then(() => loadSidebar())  ← renombrado como operación de fondo
↓ finally: botón → ICON_SEND, UI liberada
↓
[Caso B — usuario hace clic en ⏹]
↓ abortCurrentStream() → _abortController.abort()
↓ api.js: reader.read() lanza AbortError → return { ok: 'aborted' }
↓ chat.js catch: fullText parcial → finalizeStreamingBubble (se conserva) | vacío → bubble.remove()
↓ loadSidebar() + finally: UI liberada
↓ (LocalAI sigue generando unos segundos server-side; los tokens ya no llegan)

---

## ⚠️ Manejo de errores

- Mensaje vacío.
- Error de conexión con backend.
- Error de LocalAI.
- Error de archivo no seleccionado.
- Error en transcripción.
- Nombre de chat/proyecto con caracteres inválidos (mostrado inline en modal).
- Nombre demasiado corto o largo.
- Archivo con mimetype o extensión no permitida.
- Magic bytes inválidos (PDF, ZIP/PPTX).
- Error de extracción de texto (PDF corrupto, DOCX dañado, PPTX con slide rota, etc.).
- Error en stream: si los headers SSE ya se enviaron, se escribe `[ERROR]` y se cierra la conexión.
- Toast de sistema para errores de conexión.
- Burbuja de error en chat para errores contextuales.
- Deduplicación silenciosa en context files (log en consola del servidor).

---

## 🔄 Flujo de cambio dinámico de modelo (v2.10.0)

```text
Usuario manda mensaje
↓
chat.controller.js → detectBestModel() → selectedModel = 'qwen2.5-7b-q5'
↓
streamOptions.onSwitchingModel = () => res.write('[SWITCHING_MODEL]...')
↓
localai.service.js → resolveModelPath('qwen2.5-7b-q5') → ruta GGUF
↓
¿llamaProvider.getActiveModel() === ruta? 
→ SÍ → continúa directo al stream
→ NO → options.onSwitchingModel() → frontend muestra "Cambiando a qwen2.5-7b-q5..."
      → llamaProvider.switchModel(ruta) → dispose() modelo anterior → loadModel() nuevo
      → [llama] Modelo listo ✅ → continúa al stream
↓
llamaProvider.stream(messages, options) → AsyncGenerator tokens
↓
streamToLocalAI hace yield de cada token con detección de loops
```

## 🏗️ Flujo de arranque del modelo (v2.10.0 → v2.18.0)

​```text
npm start / Tempest IA.exe
↓
shell/main.js → app.whenReady() → startBackend()
↓
startBackend():
  1. dotenv.config({ path: '../.env' })  ← carga .env ANTES de cualquier fallback (v2.16.1)
  2. process.env.IS_ELECTRON = 'true' / NODE_ENV = 'production'
  3. if (!process.env.MODELS_DIR) → fallback según app.isPackaged
  4. require('../backend/server.js')  ← mismo proceso, sin spawn/child_process (desde v2.11.0)
↓
server.js → dotenv.config(...) [no-op, ya cargado] → initDefaultAdmin() → app.listen(3005)
↓
(síncrono, dentro del mismo callback de initDefaultAdmin().then(), en try/catch propio)
_modelsInventory = checkModelsInventory()  ← v2.17.0, reescrito v2.18.0 sobre models.catalog.js
  → recorre getAllModelIds() del catálogo (chat de MODEL_FILES + Whisper "extra")
  → resuelve cada ruta con resolveCatalogPath() (delega en resolveModelPath() para chat)
  → fs.existsSync() por archivo — NO carga ningún modelo
  → falta alguno → console.warn(), no bloquea el arranque
  → try/catch propio: un fallo acá nunca debe impedir que llamaProvider.init() corra
  → devuelve también okRequired (solo hermes-q4 + whisper-large-v3) separado de ok (todos)
↓
(await, dentro del mismo callback — v2.18.0)
if (!_modelsInventory.okRequired):
  ensureRequiredModels(_modelsInventory.missingRequired)
    → por cada modelo requerido que falte, secuencial:
      downloadModel(modelId)  ← model.downloader.service.js
        → fetch(url) sigue redirects (HF resuelve a CDN)
        → stream a '<archivo>.part', hash sha256 incremental en cada chunk
        → verifica sha256 contra el catálogo (o warning si no hay uno configurado)
        → fs.renameSync('.part', destino) — atómico, nunca deja archivo corrupto con nombre final
        → si falla: borra el .part, deja el modelo como 'error' con mensaje
    → progreso publicado en vivo vía getDownloadState(modelId)
  → _modelsInventory = checkModelsInventory()  ← refrescar tras descargar
  → si falla: se loguea y se sigue igual (llamaProvider.init() va a fallar de forma visible)
↓
(en segundo plano, no bloquea el servidor)
llamaProvider.init(resolveModelPath('hermes-q4'), gpuLayers=99)  ← v2.18.0: ya no hardcodea el nombre de archivo
  → getLlama({ gpu: 'cuda' }) → detecta/compila binarios CUDA
  → _progress = 0
  → _llama.loadModel({ modelPath, gpuLayers, onLoadProgress })  ← v2.17.0
      → onLoadProgress(p) actualiza _progress en cada evento del motor
      → si el motor no dispara el callback, _progress se queda en 0 (indeterminado)
  → _status = 'ready' → _progress = 1 → [llama] Modelo listo ✅
↓
GET /health → {
  status: 'ok',
  ai: 'loading' | 'ready' | 'error',
  aiError,
  aiProgress: 0..1,                                 ← v2.17.0
  modelsInventory: { ok, okRequired, total, missing, missingRequired, checked },  ← v2.18.0 agrega okRequired/missingRequired
  modelsDownload: { inProgress, current, index, total, error,
                     downloadedBytes, totalBytes, progress }                     ← NUEVO v2.18.0
}
↓
shell/splash.html (polling propio) y shell/main.js (waitForModelReady) leen el
mismo /health en paralelo — el splash lo usa para mostrar progreso (prioriza
modelsDownload sobre el label de carga en VRAM mientras haya una descarga en
curso), main.js lo usa para decidir cuándo crear la ventana principal
​```

## 📥 Flujo de descarga manual de modelos (panel Configuración → Modelos, v2.18.0)

​```text
Usuario abre Configuración → pestaña "Modelos"
↓
settings.js: _startModelsPolling() → _renderModelsList() inmediato + setInterval(1.5s)
↓
GET /models/catalog → backend combina:
  - models.catalog.getCatalog()      ← metadata estática (url, sha256, tamaño, required)
  - models.inventory.checkModelsInventory()  ← exists por modelo
  - model.downloader.getDownloadState(modelId)  ← progreso si hay descarga en curso
↓
Render: por modelo → nombre + tamaño + estado (✓ Descargado / Descargando NN% /
Verificando / ✗ Error / Sin fuente configurada / Requerido — pendiente)
↓
Usuario click "Descargar" (solo visible si !exists && hasSource && !downloading)
↓
POST /models/:id/download → downloadModel(modelId) dispara en background (no
espera), responde de inmediato — el progreso se seguía viendo por el polling
que ya está corriendo
↓
Usuario cambia de pestaña o cierra el modal → _stopModelsPolling()
​```