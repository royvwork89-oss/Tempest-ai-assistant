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
16. LocalAI genera tokens uno por uno con `stream: true`.
17. Cada token llega al backend → se reenvía al frontend con `res.write()`.
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
9. El sidebar muestra el nuevo nombre. Si el usuario cambió de chat durante la generación, el renombrado no roba el foco (verifica `chatId` activo).

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
3. Se abre modal propio con el nombre actual pre-cargado.
4. Usuario escribe nuevo nombre.
5. Se valida el nombre.
6. Si hay error, se muestra en rojo sin cerrar el modal.
7. Si es válido, Frontend llama a `/chat/rename` o `/project/rename`.
8. Backend renombra archivo o carpeta.
9. Sidebar se actualiza.

---

## 🗑️ Flujo de eliminar

1. Usuario abre menú de tres puntos.
2. Selecciona `Eliminar`.
3. Se abre modal de confirmación.
4. Usuario confirma.
5. Frontend llama a `/chat/delete` o `/project/delete`.
6. Backend elimina archivo o carpeta.
7. UI vuelve a pantalla inicial.
8. Sidebar se actualiza.

---

## 🎙️ Flujo de transcripción de audio

1. Usuario abre menú de herramientas (+).
2. Selecciona `Transcripción`.
3. Selecciona audio.
4. Elige modo y formato.
5. Frontend envía `POST /transcribe`.
6. Backend guarda audio temporal.
7. ffmpeg divide en fragmentos.
8. LocalAI Whisper transcribe fragmentos.
9. Backend une resultados.
10. Se genera archivo TXT/PDF/DOCX.
11. Se devuelve URL pública.
12. Frontend muestra ruta y link.

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
↓ checkPoppler() → true
↓ extractPdfOCR(file, raw)
↓
pdf.ocr.extractor.js
↓ rasterizePdf(filePath, outDir, maxPages=5)
↓
pdf.rasterizer.js (Poppler)
↓ pdftoppm -png -r 200 -l 5 input.pdf outDir/page
↓ devuelve [page-1.png, page-2.png, ...]
↓
pdf.ocr.extractor.js
↓ por cada página: recognizeImage(pagePng) via ocr.service.js + preprocessor.js
↓ finally: cleanupRasterDir(outDir)
↓ { name, type: 'pdf', content: header + páginas, truncated, meta }

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

## 🖥️ Flujo de arranque en Electron (v2.8.0)

npm start (raíz)
↓
shell/main.js → app.whenReady()
↓ startBackend() → fork(backend/server.js, env: { IS_ELECTRON: 'true' })
↓ waitForBackend() → polling GET /health (30 intentos × 500ms)
↓ 200 OK → createWindow() → BrowserWindow carga http://localhost:3005
↓ frontend funciona idéntico al navegador (mismo Express, mismo LocalAI en Docker)
↓
Cierre de ventana → window-all-closed → backendProcess.kill() → app.quit()

Si `/health` nunca responde (backend caído, puerto ocupado): error en consola y `app.quit()`.

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