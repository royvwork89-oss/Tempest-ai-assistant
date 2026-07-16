# 🧩 Tempest - Roadmap

## 🚧 Estado actual

Versión actual: **v2.17.1**

Sistema funcional con:

- **Electron real + identidad estable de chats (v2.11.0)** — backend corre en el main process de Electron (sin proceso hijo); frontend cargado via `loadFile` con `BASE_URL` en 7 módulos; fix panel Servicios (`isAdmin`); fix etiqueta `finish_reason` invertida en Dev Panel; solución definitiva al bug "chat se va a otro chat" — `chatId` inmutable separado de `title` mutable
- **Migración a node-llama-cpp (v2.10.0)** — motor de IA migrado de LocalAI+Docker a node-llama-cpp nativo; streaming token a token real via callback→AsyncGenerator; cambio dinámico de modelos con `switchModel()`; `gemma-2-9b-q4` temporalmente reemplazado por `llama-3.1-8b-q5` en alias `explain-deep` por incompatibilidad CUDA
- **Visión con Ollama (v2.10.0)** — `vision.service.js` migrado de LocalAI a Ollama; modelos registrados con Modelfiles; mmproj incluido en registro para soporte multimodal real
- **Bug duplicación resuelto (v2.10.0)** — respuestas duplicadas en JSON y UI eliminadas; `memory.addChatHistoryMessage` centralizado en controller; flags `streaming`/`reloading` en chatBox para bloquear `loadChatHistory`
- **Electron Builder portable (v2.10.0)** — ejecutable `Tempest IA.exe` generado; binarios CUDA de node-llama-cpp incluidos manualmente; `MODELS_DIR` configurable via env
- Chat local con IA (modelos Q4, Q5, Q6 para desktop; Llama 3.2 3B / Qwen2.5 3B para laptop)
- **5 modelos nuevos desktop** — LLaMA 3.1 8B Q5, Qwen2.5 7B Q5, Gemma 2 9B Q4, DeepSeek Coder 6.7B Q6, Qwen Coder 14B Q4
- LocalAI `master-gpu-nvidia-cuda-12` como motor principal con GPU activa (RTX 4070, `gpu-layers: 99`)
- **Análisis visual con Qwen2.5-VL-7B** — descripción de imágenes cuando OCR es insuficiente, integrado en el router de modos
- **Router inteligente de modelos**  - **Perfil laptop con LLaVA** — análisis visual con LLaVA 1.6 en RTX 4050, `qwen2.5-coder-3b-q8` para código, `HARDWARE_PROFILE` propagado via `process.env` — selección automática según tipo de tarea, perfil y hardware
- Memoria por usuario/proyecto/chat
- Chats independientes y por proyecto
- Sidebar tipo workspace
- **Sistema de prompts por capas** — global + modo + proyecto, modificables sin tocar código
- **Estabilización del modelo** — mirostat, temperature correcta, detector de loops, startup buffer
- **processedMessage** — contextualización automática de mensajes cortos
- **isUsefulMessage** — filtrado de historial genérico
- Renombrar y eliminar chats/proyectos
- Modal propio para renombrar con validación inline
- Modal de confirmación para eliminar
- Creación de proyectos con nombre manual
- Renombrado automático de chats con IA
- Generador de títulos optimizado
- Transcripción de audio con exportación TXT/PDF/DOCX — **v2.15.0: VAD real (ffmpeg silencedetect) + whisper.cpp standalone CUDA, timestamps precisos, descarga funcional en Electron** · **v2.16.0: persistencia en chatHistory, limpieza de archivos huérfanos al borrar chat, acceso directo a la carpeta desde Preferencias** · **v2.16.2: fix ruta de modelo Whisper en `.exe` empaquetado (usaba ruta relativa a `__dirname`, ahora usa `MODELS_DIR`) — transcripción generaba archivos vacíos en el ejecutable**
- Menú de herramientas (+)
- Renderizado de bloques de código estilo terminal
- Separación automática de múltiples archivos en bloques individuales
- Router de modos automático — `coder/strict`, `coder/hybrid`, `explain`, `general`
- Botones de acción con íconos SVG — visibles al hacer hover
- Botón enviar con ícono de avión de papel dentro del área de entrada
- Barra de herramientas fija debajo del textarea
- Input multilínea con `Shift + Enter`
- Textarea autoexpandible con límite de altura
- Modo selección para eliminar múltiples chats independientes
- Sistema de adjuntos completo: PDF, DOCX, XLSX, PPTX, TXT, código, imágenes
- Extractor PPTX modular con notas del presentador, tablas y tolerancia a fallos
- sanitize.js — capa centralizada de post-procesado
- Historial limpio — prefijos internos no se guardan en chatHistory
- Airbag visual en frontend
- Streaming de respuesta
- Manejo de errores visual — toast de sistema + burbuja de error en chat
- **Context files por proyecto** — subida manual de archivos, gestión UI, inyección automática en prompt
- **projectSettings.json** — configuración por proyecto (reglas de contexto, prompts)
- **Migración automática** de proyectos existentes al nuevo sistema de context files
- **Patch Mode visual** — detección automática, parser agnóstico (Search/Replace + unified diff + simplified diff + merge conflict), renderizado diff rojo/verde, validación de contexto
- **Context Snapshot** — índice incremental del repo por proyecto (`projectContext.json`), hash + mtime, refresh manual desde UI, `snapshot.provider.js` integrado en assembler
- **Patch Mode funcional** — apply real sobre archivos con backup automático, match normalizado con fallback de ancla, endpoint `POST /project/:id/patch/apply`
- **Modo Desarrollador (Dev Panel) — v2.4.3** — panel transversal de telemetría (modelo, modo, tokens, truncado, perfil hardware) visible solo para perfil `admin`, controlado por `ADMIN_MODE` en `.env`, contrato `GET /me → {role}`
- **Renombrado paralelo de chats — v2.4.3** — el título se genera al mismo tiempo que la respuesta, con `PARALLEL_REQUEST=true` + `LLAMACPP_PARALLEL=2`; modelo de títulos precargado (`hermes-q4` desktop / `llama-3.2-3b-q4` laptop); protección contra chat huérfano
- **Imagen LocalAI fijada por digest — v2.4.3** — congela la versión que funciona, evita auto-actualizaciones de `master` que rompían el parser GGUF
- **Eliminación múltiple de chats por proyecto** — opción "Seleccionar chats" en menú ⋯ de cada proyecto, checkboxes aislados por proyecto
- **Configuración inicial al crear proyecto** — modal de configuración se abre automáticamente tras crear un proyecto
- **Configuración persistente por proyecto** — `preferences.defaultModel` y `preferences.defaultMode` en `projectSettings.json`, leídos como override suave en cada chat, reflejados visualmente en el selector del header
- **Router inteligente por tipo de contexto** — `contextFileTypes` pasa al router para distinguir proyectos de código vs documentos, evita elegir DeepSeek para proyectos con `.docx`/`.pdf`
- **Label de modelo automático en tiempo real** — evento SSE `[MODEL]` antes del stream, callback `onModel` en frontend, `primaryModel` sigue siendo `'auto'`
- **Toggle de Context Snapshot** — activar/desactivar snapshot sin borrarlo, rehabilitación automática al regenerar
- **Explorador de carpetas** — autocompletado via `GET /fs/browse`, navegación con subir/bajar directorios
- **Drag & drop en context files** — arrastrar archivos directamente al contenedor del modal
- **Fix patch mode pipeline** — `effectiveMode` en `model.router/index.js`, historial vacío en patch mode para evitar timeout de DeepSeek
- **Modularización frontend** — `contextFiles.js`, `projectConfig.js`, `transcription.js`, `modals.js`, `chat.js`, `streaming.js`, `autoRename.js`, `patchRenderer.js`, `codeRenderer.js`, `messageRenderer.js` separados como módulos independientes
- **Patch Mode grounding fix** — archivo relevante del snapshot inyectado directamente en el mensaje del usuario (v2.1.1); context files omitidos en patch mode para evitar saturar prefill de DeepSeek; parser y renderer extendidos para formato `SEARCH:/REPLACE:`
- **OCR de imágenes** — extracción de texto via `tesseract.js` en imágenes PNG/JPG/WEBP adjuntas, worker singleton, cache por hash SHA-1, confianza mínima configurable (v2.2.0)
- **OCR PDF escaneado** — detección automática de PDF sin texto, rasterización con Poppler, OCR página por página, límite 5 páginas, fallback si Poppler no disponible (v2.2.1)
- **OCR DOCX imágenes embebidas** — extracción de `word/media/*`, combinación con texto mammoth, límite 15 imágenes (v2.2.2)
- **Preprocesado de imagen con sharp** — `preprocessor.js` como interfaz reemplazable (grayscale + normalize + upscaling), mejora de confianza OCR 77%→87% (v2.2.3)
- **Análisis visual con Qwen2.5-VL-7B** — `vision.service.js` como interfaz reemplazable, fallback automático cuando OCR da confianza < 60%, `removeLoops()` para limpiar repeticiones, `truncated` real propagado (v2.3.0)
- **Docker migrado a `master-gpu-nvidia-cuda-12`** — volumen persistente para backends llama-cpp, sin re-descargas en reinicio (v2.3.0)
- **Endpoint `/hardware-profile`** — frontend detecta perfil automáticamente al arrancar, solo se toca `chat.controller.js` al cambiar de máquina
- **Renombrado asíncrono con timeout 30s** — UI libre inmediatamente, título aparece en segundo plano
- **`getVisionParams()` por perfil** — parámetros de visión optimizados por hardware
- **Limpieza laptop** — solo modelos de laptop en `models-localai/`, arranque Docker ~8min
- **Búsqueda web con SearXNG + Tavily (v2.6.0–v2.7.0)** — contenedor Docker puerto 8081, botón 🌐 dinámico en toolbar, `search.service.js` como interfaz reemplazable con providers (SearXNG + Tavily activos, Brave stub), settings admin (toggle global, URL, test de conexión, API keys), selector dropdown de provider para usuarios, anti prompt-injection, rate limiting 3s por usuario, mínimo 8 chars por query, botón 🌐 sin recarga al guardar config
- **Pipeline visual + búsqueda web (v2.7.0)** — segundo pase con modelo de texto cuando hay imagen + 🌐 activo: descripción de Qwen2.5-VL usada como query de búsqueda, resultados inyectados al modelo de texto para identificar juegos/lugares/productos
- **Chats y proyectos privados por usuario (v2.7.0)** — `buildMemoryOptions` usa `req.user.id` del JWT, eliminado `local-user` hardcodeado en `chat.controller.js` y `context.service.js`, cada usuario tiene su propia carpeta `data/users/{userId}/`
- **Electron Fase 1 (v2.8.0)** — Tempest corre como app de escritorio: `shell/main.js` lanza Express como proceso hijo (`fork`), espera `/health` y abre `BrowserWindow`; Docker/LocalAI sigue igual; carpeta `shell/` + `package.json` raíz con `electron` y `electron-builder`
- **Botón detener respuesta (v2.8.0)** — el botón enviar se convierte en ⏹ rojo durante el stream; `AbortController` en `api.js` corta el fetch; el texto parcial recibido se renderiza y se conserva
- **Bloqueo de UI durante el stream (v2.8.0)** — flag `_isSending` compartido entre `chat.js` y `sidebar.js`: chats, proyectos, menú ⋯, + Nuevo chat (general y por proyecto) y + Nuevo Proyecto quedan inaccesibles mientras la IA responde; el renombrado de título libera la UI sin bloquearla (operación de fondo)
- **Fix historial del asistente (v2.8.0)** — la respuesta del modelo ahora se persiste en `chatHistory` al terminar el stream (`fullReply` en `chat.controller.js`); antes solo se guardaba el mensaje del usuario y la respuesta desaparecía al cambiar de chat
- **Label de modelo unificado (v2.8.0)** — eliminados `MODEL_TYPES`/`getModelType`; el trigger usa solo la nomenclatura de `MODEL_PROFILES` (ej. `Qwen 2.5 7B Q5 - Razonamiento`); `qwen2.5-vl-7b-q4` agregado al menú desktop como `Qwen2.5-VL 7B Q4 - Visión`
- **Selector nativo de carpetas (v2.8.1)** — el botón 📁 de Context Snapshot abre `dialog.showOpenDialog` via IPC (`ipcMain.handle('select-folder')` + `electronAPI.selectFolder()`); fallback automático a `/fs/browse` en navegador
- **Fix auth en modal de context files (v2.8.1)** — los fetch de snapshot (toggle, status, generate, items, `/fs/browse`) ahora envían el JWT via helper `authH()`; antes fallaban con 401 "No autenticado"
- **Fix duplicados en drag & drop (v2.8.1)** — listeners del modal limpiados con `cloneNode+replaceWith` de la lista al abrir; antes cada apertura del modal acumulaba un listener `drop` y un arrastre subía el archivo N veces (bug pre-existente al navegador)
- **Permisos de búsqueda por usuario/perfil (v2.9.0)** — panel Settings rediseñado con navegación lateral, permisos individuales por usuario, Perfil Global para grupos, `searchEnabled`
- **Carpeta vinculada por proyecto (v2.17.0)** — escaneo bajo demanda de una carpeta arbitraria del disco por proyecto (`linked-folder.service.js`), separado a propósito de Context Snapshot (que sigue atado a Patch Mode); indexa PDF/DOCX/PPTX/imágenes además de texto/código, reusa el pipeline de extracción de `attachment.service` (OCR incluido); manifest + contenido cacheado por archivo, diffing por `mtimeMs`+`sizeBytes` para no re-extraer archivos sin cambios; endpoints `POST /context/linked-folder/refresh` y `/toggle`; `linked-folder.provider.js` integrado en el assembler; badge "carpeta" en Lista de archivos junto al de "snapshot"
- **Splash screen de carga de modelos + chequeo de inventario (v2.17.0)** — ventana de carga con progreso real de VRAM (`onLoadProgress` de node-llama-cpp), diálogo nativo de error si el modelo falla en vez de colgarse, verificación no bloqueante de `.gguf` conocidos en disco (`/health.modelsInventory`, `models.inventory.js`)
- **Fix ruta compartida entre proyectos en modal de contexto (v2.17.1)** — el input de "Carpeta del proyecto" reutilizaba el mismo elemento del DOM entre proyectos sin limpiarse al abrir el modal; el proyecto B heredaba visualmente la ruta del proyecto A. Fix: `folderInput.value = ''` explícito al abrir `openContextFilesModal()`
- **Fix diálogo nativo de carpetas sin `defaultPath` (v2.17.1)** — `dialog.showOpenDialog` (`shell/main.js`) no recibía carpeta de referencia, así que Electron recordaba la última ruta visitada de forma global entre proyectos; ahora `preload.js`/`main.js` aceptan `defaultPath` opcional y `contextFiles.js` manda el valor actual del input en cada llamada
- **Fix límite de tamaño en carpeta vinculada (v2.17.1)** — `maxFileSize` subido de 5MB a 100MB (dejaba fuera libros/PDFs reales); log de escaneo truncado corregido para reportar la causa real del corte (tamaño / cantidad / límite de recorrido) en vez de siempre culpar a `maxFiles`
- **Diseño de tool use / function calling documentado (v2.17.1)** — evaluación y diseño acordado para snapshot/carpeta vinculada agénticos vía `node-llama-cpp` function calling; sin implementar todavía, ver DECISIONS.md y sección "🎯 v4.0" más abajo

## 🎯 v1.0 — Uso diario real ✅

- [x] Streaming de respuesta
- [x] Modal propio para renombrar
- [x] Generador de títulos optimizado
- [x] Renombrar chat cuando el primer mensaje es solo archivo adjunto
- [x] Validación de nombres
- [x] Manejo de errores visual

---

## 🎯 v1.1 — Experiencia de uso mejorada ✅

- [x] Router de modos automático — `coder/strict`, `coder/hybrid`, `explain`, `general`
- [x] Botones de acción con íconos SVG
- [x] Acciones visibles solo al hover, sin interferir con selección de texto
- [x] Botón enviar con ícono de avión de papel
- [x] Barra de herramientas fija debajo del textarea

---

## 🎯 v1.2 — Adjuntos completos + sanitización ✅

- [x] Lectura de PPTX (extractor modular, notas del presentador, tablas)
- [x] sanitize.js — capa centralizada de post-procesado
- [x] Historial limpio — prefijos internos separados del historial
- [x] Airbag visual en frontend

---

## 🎯 v1.3 — Estabilización LocalAI + Sistema de prompts por capas ✅

- [x] Sistema de prompts por capas — `global.system.txt` + `modes/` + `project.loader.js`
- [x] `buildSystemPrompt.js` — orquestador público importado en `localai.service.js`
- [x] GPU activa — `gpu-layers: 99` al nivel raíz del YAML (fuera de `parameters`)
- [x] `f16: true` para precisión float16 en GPU
- [x] `temperature: 0.35` — elimina token trapping en modelos Q4
- [x] `mirostat: 2` — control de entropía, defensa principal contra loops
- [x] `repeat_penalty: 1.18` — penalización de repetición calibrada
- [x] Template ChatML con `{{if .System}}` — correcto para Hermes-3 en LocalAI v2.24
- [x] Stopwords correctos — sin stopwords de código que cortaban bloques
- [x] Startup buffer — descarta tokens basura al inicio sin eliminar saltos de línea legítimos
- [x] Detector de loops en tiempo real con regex de n-gramas
- [x] `processedMessage` — contextualiza mensajes cortos ambiguos
- [x] `isUsefulMessage` — filtra historial genérico antes de enviarlo al modelo
- [x] `preguntaWords` — preguntas completas van directo al modelo sin modificar
- [x] `token.profiles.js` desktop actualizado — `code: 1200` para generación de múltiples archivos
- [x] YAMLs laptop actualizados — hermes-q5, hermes-q6, llama-3.2-3b-q4, qwen2.5-3b-q4, qwen2.5-3b-q5
- [x] `MODELS.md` — documentación crítica de configuración de modelos

---

## 🎯 v1.4 — Context Files por proyecto ✅

- [x] `projectSettings.json` — configuración por proyecto (reglas de contexto, prompts futuros)
- [x] `context/index.json` — inventario de archivos de contexto por proyecto
- [x] Providers + Assembler + Budgeter — arquitectura modular y expandible
- [x] `upload.provider.js` — lee archivos subidos desde `context/files/`
- [x] `fs.provider.js` — stub seguro para lectura de disco (v2/Electron)
- [x] `budgeter.js` — presupuesto de contexto con orden de prioridad y truncado inteligente
- [x] Deduplicación por hash SHA-256
- [x] Endpoints REST: listar, subir, actualizar, eliminar, settings
- [x] Inyección automática como Capa 4 del system prompt (`### CONTEXT: PROJECT FILES ###`)
- [x] `buildSystemPrompt` pasa a `async` — integra contexto en cada request
- [x] UI en sidebar — botón "Archivos de contexto" en menú de proyecto
- [x] Modal de gestión — subir archivos, toggle activo/siempre, eliminar
- [x] Script de migración para proyectos existentes (`scripts/migrate-projects.js`)
- [x] `initProject` — inicializa estructura al crear proyectos nuevos

---

## 🎯 v1.5 — Router inteligente de modelos ✅

- [x] `model.router/` — arquitectura modular con 5 submódulos independientes
- [x] `capability.matrix.js` — registro central de modelos por hardware, alias lógicos
- [x] `task.detector.js` — heurísticas de detección de tipo de tarea
- [x] `profile.mapper.js` — mapeo tarea + perfil → alias lógico
- [x] `fallback.manager.js` — fallback simple ante errores técnicos
- [x] `index.js` — orquestador público con logging estructurado
- [x] Integración en `chat.controller.js` — selección automática o manual
- [x] `HARDWARE_PROFILE` hardcodeado en controller — simple y estable
- [x] Opción "Automático" en el menú de modelos del frontend
- [x] `resolveAutoModel` eliminado del frontend — decisión movida al backend
- [x] 5 YAMLs nuevos para modelos desktop — templates y stopwords correctos
- [x] `token.profiles.js` actualizado con perfiles de los 5 modelos nuevos
- [x] GPU activa confirmada — 33/33 capas en VRAM, 42 tok/s en hermes-q4
- [x] docker-compose.yml corregido — montaje `/usr/lib/wsl/lib`, `wsl --shutdown` como prerequisito

---

## 🎯 v1.6 — Patch Mode visual ✅

- [x] `patch.parser.js` — parser agnóstico: Search/Replace, unified diff, simplified diff
- [x] `coder.patch.txt` — system prompt con formato obligatorio y few-shot example
- [x] Detección automática de modo patch por triggers en `mode.router.js`
- [x] Renderizado visual diff rojo/verde en frontend (`ui.js` + `styles.css`)
- [x] Validación de contexto — bloquea patch sin archivo adjunto o context file
- [x] Model router alias `coder-patch` → DeepSeek 6.7B Q6
- [x] Truncado inteligente de contexto adjunto en modo patch (800 chars)
- [x] Detector de loops específico para bloques patch en streaming
- [x] Mensaje de error amigable cuando no hay contexto
- [x] ⚠️ Patch Mode funcional completo — Context Snapshot + apply real con backup automático (v1.7.0)
- [x] Apply patch sobre archivos reales

---

## 🎯 v1.7 — Context Snapshot + Patch Mode funcional ✅

- [x] `snapshot.service.js` — crawl incremental por hash+mtime, filtrado por extensión, límite 30KB por archivo, respeta `.gitignore`
- [x] `snapshot.provider.js` — tercer provider en el assembler, contrato idéntico a upload.provider
- [x] `projectContext.json` — manifest con snapshotRoot, totalFiles, hash+mtime por archivo
- [x] Endpoint `POST /project/:projectId/context/snapshot` — generación manual desde UI
- [x] Endpoint `GET /project/:projectId/context/snapshot/status` — estado del snapshot
- [x] UI snapshot en modal de context files — input de ruta, botón regenerar, estado en verde/gris
- [x] Badge "snapshot" en items de la lista de context files
- [x] `apply.service.js` — exact match normalizado, fallback por ancla de 5 líneas, reemplazo completo si searchContent >80% del archivo
- [x] Backup obligatorio antes de apply — carpeta `projects/{projectId}/backups/`
- [x] Endpoint `POST /project/:projectId/patch/apply` — containment check, backup, write
- [x] Botón ⚡ Aplicar en bloques diff — modal de confirmación, feedback visual verde/rojo
- [x] `patch.parser.js` — soporte para formato `merge_conflict` (`<<<<<<< HEAD ... >>>>>>> hash`)
- [x] `patchBlockRegex` en `ui.js` — acepta cualquier variante de markers (`HEAD`, `SEARCH`, hash)
- [x] Eliminación múltiple de chats por proyecto — "Seleccionar chats" en menú ⋯, aislado por proyecto

---

## 🎯 v2.0 — Tempest como asistente de programación contextual ✅

- [x] Modal de configuración inicial abre automáticamente al crear un proyecto nuevo
- [x] `preferences: { defaultModel, defaultMode }` agregado a `projectSettings.json` con defaults seguros (`'auto'`)
- [x] `context.controller.js` — `updateSettings` acepta y persiste `preferences` con merge profundo
- [x] `chat.controller.js` — lee `preferences` del proyecto como override suave: selección manual > preferencia del proyecto > automático
- [x] `openProjectConfigModal` en `sidebar.js` — muestra y guarda `defaultModel` y `defaultMode`
- [x] Selectores de modelo y modo en `index.html` dentro del modal de configuración
- [x] `sidebarDeps.onProjectModelChange` — callback que actualiza `primaryModel` y refresca el header al entrar a un chat de proyecto
- [x] Bug fix: `server.js` montaba `contextRoutes` en `/project` causando rutas duplicadas → corregido a `/`

---

## 🎯 v2.0.2 — Tempest como asistente de programación contextual

### 🧠 Contexto y comprensión del proyecto
- [x] Context Snapshot del repo — `projectContext.json` con estructura, archivos relevantes, hash y mtime
- [x] Context files por proyecto — subida manual, gestión UI, inyección en prompt
- [x] UI para configurar prompts de proyecto

### 🤖 Inteligencia y selección de modelos
- [x] Router inteligente de modelos — `model.router/` con capability matrix, task detector, profile mapper
- [x] DeepSeek-Coder 6.7B disponible como modelo de código diario
- [x] Qwen2.5-Coder 14B disponible para arquitectura y razonamiento complejo

### 🛠️ Edición y flujo de desarrollo
- [x] Patch Mode visual — parser, renderer, validación, model router (v1.6.0)
- [x] Patch Mode funcional completo — Context Snapshot + apply real con backup (v1.7.0)
- [x] Apply patch sobre archivos reales

### ⚙️ Experiencia de proyecto
- [x] Pantalla de configuración inicial al crear proyecto (v2.0.0)
- [x] Configuración persistente por proyecto — modelo y modo por defecto (v2.0.0)
- [x] Router inteligente por tipo de contexto — distingue código vs documentos, evita DeepSeek en proyectos .docx/.pdf (v2.0.1)
- [x] Fix patch mode pipeline — effectiveMode en model.router/index.js, historial vacío para evitar timeout (v2.0.1)
- [x] Label de modelo automático en tiempo real — evento [MODEL] SSE antes del stream (v2.0.1)
- [x] Toggle de Context Snapshot — activar/desactivar sin borrar, rehabilitación automática al regenerar (v2.0.2)
- [x] Explorador de carpetas para snapshot root — autocompletado via /fs/browse, navegación por directorios (v2.0.2)
- [x] Drag & drop en context files — arrastrar archivos directamente al contenedor del modal (v2.0.2)
- [x] Sugerencia de modelo en modal de configuración — sugiere modelo según tipo de archivos del proyecto (v2.0.2)

---

## 🎯 v2.1.1 — Patch Mode grounding fix ✅

- [x] `buildPatchGrounding` en `chat.controller.js` — selecciona archivo más relevante del snapshot por nombre mencionado en el mensaje, fallback al primero disponible
- [x] Truncado por zonas — cabecera (800 chars) + cola (400 chars), límite total 2500 chars
- [x] `skipContextFiles` en `streamOptions` — omite Capa 4 del system prompt en patch mode
- [x] `buildSystemPrompt.js` acepta `skipContextFiles` — evita inyectar 12K chars de context files que saturaban el prefill de DeepSeek
- [x] `patch.parser.js` — reconoce formato `SEARCH:/REPLACE:` con bloques de código como variante adicional
- [x] `messageRenderer.js` — `patchLabelRegex` renderiza formato `SEARCH:/REPLACE:` en rojo/verde
- [x] `streaming.js` — `stripLeakedInstructions` revisa todo el texto (no solo el final) y limpia system prompt filtrado
- [x] Ruido post-patch ignorado en renderer — `return` inmediato tras encontrar primer bloque diff válido

---

## 🎯 v2.11.0 — Electron real + identidad estable de chats ✅

- [x] Backend como main process de Electron — `shell/main.js` carga `backend/server.js` via `require()` directo en el mismo proceso, eliminando el spawn/child_process anterior; `MODELS_DIR` se resuelve automáticamente según `app.isPackaged`
- [x] Frontend como renderer de Electron — `loadFile` en lugar de `loadURL`; ventana abre sin esperar a que Express levante
- [x] `frontend/config.js` (NUEVO) — `BASE_URL` detecta automáticamente `file://` (Electron) vs `http://` (navegador) y prefija las rutas según corresponda
- [x] `BASE_URL` aplicado en 7 módulos frontend — `api.js`, `login.js`, `models.js`, `contextFiles.js`, `settings.js`, `webSearch.js`, `devPanel.js` — todas las rutas relativas (`fetch('/ruta')`) que fallaban silenciosamente desde `file://` quedaron corregidas
- [x] Fix bug "Sin perfil" / pestaña Servicios no aparecía — causa raíz: `devPanel.js` (`initDevPanel`) llamaba `fetchWithAuth('/me')` sin `BASE_URL`; desde `file://` resolvía a una ruta de disco inválida, el fetch fallaba y `isAdmin` quedaba en `false` aunque el usuario sí fuera admin
- [x] Fix etiqueta `finish_reason` invertida en Dev Panel — `localai.service.js` asignaba `meta.finishReason = stopped ? 'stop' : 'length'` al revés: `stopped=true` es cuando el detector de loops corta a propósito, no cuando el modelo termina bien. Corregido a `stopped ? 'loop_detected' : 'stop'`
- [x] Solución definitiva al bug "respuesta/pregunta se va a otro chat" — causa raíz: `chatId` se usaba simultáneamente como nombre de archivo en disco y como identificador en memoria del frontend; al renombrar (`autoRename.js`), ambos cambiaban al mismo valor nuevo, creando una ventana de colisión cuando un renombrado en paralelo terminaba justo mientras se enviaba el siguiente mensaje
- [x] `memory.service.js` — `chatId` pasa a ser inmutable (nunca cambia, es el nombre del archivo de por vida); `renameChat(chatId, newTitle)` ya no usa `fs.renameSync`, solo actualiza el campo `title` dentro del JSON; `listChats` devuelve `[{chatId, title}, ...]` en vez de array de strings; `createChat` inicializa `title = chatId`
- [x] `chat.controller.js` — endpoint `/chat/rename` actualizado a `{chatId, newTitle}` en vez de `{oldChatId, newChatId}`
- [x] `api.js` — `renameChat(chatId, newTitle, projectId)` actualizado al nuevo contrato
- [x] `autoRename.js` — eliminado el guard especial de protección contra colisión (ya no es necesario porque `chatId` nunca cambia); ya no llama `setActiveChat` al renombrar
- [x] `sidebar.js` — `loadChats`/`loadProjectChats`/`createActionsMenu` operan con `chatId` (identidad) y muestran `title` (presentación) como campos separados
- [x] `modals.js` — `openRenameModal` pre-carga el input con `title` en vez de `id` para chats; compara contra `title` para detectar cambios reales
- [x] Compatibilidad con datos existentes — sin necesidad de script de migración; los chats ya creados conservan su `chatId` actual (su nombre de archivo de hoy) como identificador inmutable permanente, y su campo `title` ya existente pasa a ser la fuente de verdad visual

---

## 🎯 v2.11.1 — OCR de PDF sin dependencias del SO ✅

- [x] `pdf.rasterizer.js` reemplaza Poppler (`pdftoppm`, binario externo del SO) por `pdfjs-dist` + `@napi-rs/canvas` — sin dependencias del sistema operativo, 100% empaquetable en el instalador único de Electron
- [x] Contrato público sin cambios: `rasterizePdf(pdfPath, outDir, maxPages) → string[]` — `pdf.ocr.extractor.js` no requirió ninguna modificación
- [x] Eliminada la última dependencia de binario externo del pipeline OCR — el usuario final ya no necesita Poppler instalado para que el OCR de PDF escaneado funcione
- [x] Tres errores resueltos durante la implementación: carga ESM de `pdfjs-dist` v6.x vía `import()` dinámico; normalización de ruta `standardFontDataUrl` de backslash Windows a formato URL; render en blanco resuelto con `NodeCanvasFactory` explícito + cambio de `canvas` a `@napi-rs/canvas`
- [x] Validado end-to-end en la app: PDF escaneado → detección automática → rasterización → OCR (93% confianza Tesseract) → respuesta coherente del modelo

---

## 🐛 v2.11.2 — Budget dinámico de contexto + seguridad del snapshot ✅

- **Budget dinámico de contexto post-model-router** — `budgeter.js` dejó de usar el límite
  estático de `projectSettings.json` y ahora recibe `dynamicMaxChars` calculado en
  `chat.controller.js` después de que el Model Router elige el modelo. La fórmula:
  `(MODEL_CONTEXT_SIZES[model] - maxOutputTokens) * 4 - RESERVED_BASE_CHARS`.
  Mínimo absoluto de 500 chars. Resultado en prueba: 54 archivos indexados → 5 seleccionados
  dentro del límite dinámico → respuesta sin crash.

- **`MODEL_CONTEXT_SIZES` y `getContextSize()` en `token.profiles.js`** — mapa de ventanas
  de contexto reales por modelo (en tokens). `getContextSize(model)` devuelve el valor o
  4096 como fallback conservador.

- **`budget()` en `budgeter.js`** — nuevo parámetro `dynamicMaxChars`; si se pasa, tiene
  prioridad sobre `rules.maxCharsTotal`. Nunca baja de 500 chars. Log diferenciado
  `(dinámico)` vs `(estático)`.

- **`assemble()` en `assembler.js`** — acepta y pasa `dynamicMaxChars` a `budget()`.

- **`getProjectContext()` en `context.service.js`** — acepta y pasa `dynamicMaxChars`
  a `assemble()`.

- **`buildSystemPrompt()` en `buildSystemPrompt.js`** — acepta y pasa `dynamicMaxChars`
  a `getProjectContext()`.

- **`streamToLocalAI()` en `localai.service.js`** — extrae `options.dynamicMaxChars` y lo
  pasa a `buildSystemPrompt()`.

- **`chat.controller.js`** — importa `getContextSize` de `token.profiles.js`; calcula
  `dynamicMaxChars` después de resolver el modelo y lo pasa en `streamOptions`; el `catch`
  detecta el error de context shift de `node-llama-cpp` por mensaje (`Failed to compress
  chat history`, `context shift`, `too long prompt`) y devuelve mensaje claro al usuario
  en vez del error crudo.

- **Exclusión de archivos sensibles del snapshot** — `getDefaultSettings()` en
  `context.service.js` ampliado con patrones de seguridad en `ignoreGlobs`:
  `**/search-config.json`, `**/*.env`, `**/.env*`, `**/secrets*`, `**/credentials*`.
  Aplica a todos los proyectos nuevos. Proyectos existentes requieren actualización manual
  de `projectSettings.json` + refresh del snapshot.

---

## 🔥 Prioridad alta

### 🗂️ Sidebar

- [ ] Invertir orden del sidebar: proyectos arriba, chats independientes abajo
- [ ] Ordenar chats por fecha de último mensaje (más reciente arriba)
- [ ] Mover chat al tope de la lista al generar un nuevo mensaje
- [ ] Guardar estado de proyecto colapsado/expandido en localStorage
- [x] Extender eliminación múltiple a chats dentro de proyectos

### 💬 Acciones por mensaje

- [ ] Mostrar opciones de acción al seleccionar texto manualmente
- [ ] Activar edición de consultas del usuario
- [ ] Activar compartir respuestas
- [ ] Activar intentar nuevamente en respuestas de Tempest
---
## 🔧 v2.11.3 — Soporte .md en snapshot + calibración de budget ✅

- **`.md` y `.txt` indexados por el Context Snapshot** — `snapshot.service.js` ahora
  incluye estas extensiones en `ALLOWED_EXTENSIONS` para que la documentación del proyecto
  entre al contexto automáticamente.

- **Truncado en `upload.provider.js`** — archivos subidos manualmente truncados a 3000
  chars para evitar saturar el contexto (antes se leían completos sin límite).

- **Truncado diferenciado en `snapshot.provider.js`** — 3000 chars para `.md`/`.txt`,
  500 chars para `.js` y resto. Log de diagnóstico de items seleccionados agregado.

- **Calibración del budget** — ratio ajustado de `* 4` a `* 3` chars/token en
  `chat.controller.js` para texto en español; `hermes-q5` limitado a 6000 tokens en
  `MODEL_CONTEXT_SIZES` como margen conservador para el system prompt completo.

---

## v2.14.1 — Fix regex loop detector modelo 14B
- [x] Fix `SyntaxError: Invalid regular expression` al usar `qwen2.5-14b-q3` — `loopMaxLength` ajustado por modelo

---

## v2.12.0 — Tokenización real de contexto
- [x] Tokenización real con `model.tokenize()` — reemplaza estimación fija `* 3` por conteo real de tokens via `node-llama-cpp`. Expuesto como `countTokens()` en `llama.provider.js` e integrado en `chat.controller.js` para calcular el budget de contexto dinámico con precisión.

## v2.13.0 — Modelo de ventana grande + mejoras de estabilidad
- [x] Integración Qwen2.5-14B Q3_K_M como alias `large-context` para análisis documental (solo desktop)
- [x] Loop detector calibrado por modelo — ventana y fragmento mínimo ajustables según peso del modelo
- [x] Acumulador de tokens real — reemplaza estimación LocalAI Docker por conteo real con `countTokens()`
- [x] Fix `generateTitleFromText` — evita switch de modelo cuando el 14B está activo (fallback de título)
- [x] Fix `contextSize` — ahora se pasa correctamente desde `token.profiles` hasta `llama.provider`

## v2.14.0 — Búsqueda semántica con embeddings

- [x] Infraestructura de embeddings completa — `chunk.service.js`, `vector.store.js`, `embed.provider.js` (Ollama), `snapshot.provider.js` con búsqueda semántica y fallback por mtime
- [x] Generación de embeddings via Ollama (`nomic-embed-text`) — sin dependencia de node-llama-cpp, sin límite de memoria V8
- [x] Script standalone `generate-embeddings.js` — proceso completamente aislado, sin imports de Tempest, lanzado automáticamente como child process al regenerar snapshot
- [x] Búsqueda semántica activa en `snapshot.provider.js` — recupera chunks relevantes por similitud coseno en vez de orden por mtime
- [x] Límite por archivo (`MAX_CHUNKS_PER_FILE=15`) y total (`MAX_CHUNKS=300`) para cubrir 20+ archivos por escaneo
- [x] Crawl ampliado a 500KB por archivo — permite indexar `DECISIONS.md`, `ARCHITECTURE.md` y documentos grandes

## v2.16.0 — Persistencia de transcripciones + limpieza de huérfanos

- [x] Persistencia de mensajes de transcripción en `chatHistory` — endpoint `POST /chat/message/save`, reconstrucción visual de la card al recargar el historial
- [x] Limpieza de archivos huérfanos al borrar el chat que los generó
- [x] Acceso directo a la carpeta de transcripciones desde Preferencias

## v2.15.0 — Transcripción: VAD real + whisper.cpp standalone

- [x] VAD real con ffmpeg silencedetect — corte por silencio en vez de tiempo fijo, interfaz reemplazable (`vad.detector.js`)
- [x] whisper.cpp standalone CUDA (`whisper-cli.exe`) reemplaza a la solución anterior
- [x] Timestamps precisos por fragmento
- [x] Descarga funcional en Electron

## v2.16.1 — Fix empaquetado Electron (electron-builder)

- [x] **Causa raíz ICU** — antivirus (Windows Defender) bloqueaba/truncaba silenciosamente la extracción de `icudtl.dat`, `v8_context_snapshot.bin` y los `.pak` de Electron durante el build, causando `[ERROR:base\i18n\icu_util.cc] Invalid file descriptor to ICU data received.` al abrir el `.exe`. Resuelto agregando exclusión de Defender para la carpeta del proyecto. No es un fix de código — es un requisito de entorno para máquinas de build.
- [x] **Causa raíz `backend/node_modules` no empaquetado** — `electron-builder` filtra automáticamente qué `node_modules` incluir basándose en las `dependencies` del `package.json` del `appDirectory` (raíz); como el root solo tiene `devDependencies` y `backend/` es un proyecto npm anidado con su propio `package.json`, ese filtro no lo detecta y excluye `backend/node_modules` completo pese a `"files": ["**/*"]`. Fix: entrada `extraResources` en `package.json` que copia `backend/node_modules` como archivo crudo, sin pasar por el filtro.
- [x] **Bug `MODELS_DIR` ignorado** — `shell/main.js` seteaba un valor de fallback para `MODELS_DIR` antes de que `server.js` cargara el `.env`; como `dotenv` no sobreescribe variables ya presentes en `process.env`, el valor correcto del `.env` quedaba descartado silenciosamente. Fix: cargar `dotenv` explícitamente al inicio de `startBackend()`, antes del fallback.
- [x] **`auth.service.js` sin auto-creación de carpeta** — `saveUsers()` fallaba con `ENOENT` en el primer arranque porque `backend/data/` (excluida del build a propósito) no existía. Fix: `fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true })` antes de escribir. Nota: `backend/data/users/` y `backend/outputs/transcriptions/` **ya se autocreaban solos** (`memory.service.js`, `transcription.service.js`) — no requirieron cambios.
- [x] **Falso positivo: drag & drop no funcionaba en el `.exe`** — ocurría solo al ejecutar el `.exe` desde una terminal con privilegios de Administrador; Windows bloquea el drag-and-drop de archivos entre procesos de distinto nivel de integridad (UIPI) cuando el Explorador no está elevado. Confirmado que funciona normal sin privilegios elevados — no es un bug de la app.
- [x] Validado end-to-end: arranque del `.exe`, carga y cambio entre 3 modelos (Hermes 8B, Qwen 7B, Qwen 14B), chat, adjuntos (PDF), persistencia de chats dentro de la sesión — sin ningún paso manual.

---

## 🎯 v2.17.0 — Splash screen con progreso real + Carpeta vinculada por proyecto ✅

- [x] **Splash screen de carga de modelos** — `shell/splash.html` (NUEVO), ventana frameless mostrada antes que la ventana principal; `shell/main.js` espera en dos fases (Express arriba → modelo listo en VRAM) usando `onLoadProgress` real de node-llama-cpp; fallback a progreso indeterminado si el motor no lo dispara; diálogo nativo de error si el modelo falla en vez de colgarse indefinidamente
- [x] **Chequeo de inventario de modelos** — `models.inventory.js` (NUEVO, `backend/services/localai/`) verifica con `fs.existsSync` que todos los `.gguf` conocidos en `MODEL_FILES` (`localai.service.js`) existan en disco, sin cargarlos; expuesto en `/health.modelsInventory`; aviso no bloqueante en el splash si falta alguno
- [x] **Carpeta vinculada por proyecto** — `linked-folder.service.js` (NUEVO, `backend/services/context/`): escaneo bajo demanda de una carpeta arbitraria del disco por proyecto, independiente de Context Snapshot (que sigue atado exclusivamente a Patch Mode); indexa PDF/DOCX/PPTX/imágenes además de texto/código, reusando el pipeline de extracción y OCR de adjuntos; manifest + contenido cacheado por archivo con diffing por `mtimeMs`/`sizeBytes` para no re-extraer archivos sin cambios
- [x] `linked-folder.provider.js` (NUEVO, `backend/services/context/providers/`) — integrado en el assembler con el mismo contrato que `upload.provider.js`/`snapshot.provider.js`
- [x] Endpoints `POST /project/:projectId/context/linked-folder/refresh` y `/toggle`
- [x] Badge "carpeta" propio en Lista de archivos, junto al badge "snapshot" existente
- [x] UI: input "Carpeta del proyecto" + checkbox "Documentos (PDF, Word, imágenes...)" en el modal de context files, junto al checkbox existente "Código (patch mode)" del snapshot

---

## 🔧 v2.17.1 — Fixes de Carpeta del proyecto + parche maxFileSize ✅

- [x] **Fix ruta compartida entre proyectos en modal de contexto** — causa raíz: el input `contextProjectFolderInput` es un elemento del DOM reutilizado entre proyectos (mismo patrón documentado antes para `snapshotToggle`/`snapshotBtn`/`closeBtn`) y nunca se limpiaba al abrir el modal; el proyecto B heredaba visualmente la ruta escrita para el proyecto A. Fix: `folderInput.value = ''` explícito al abrir `openContextFilesModal()` en `contextFiles.js`, antes de que `refreshSnapshotStatus()`/`refreshLinkedFolderStatus()` prellenen con la ruta real de ese proyecto
- [x] **Fix diálogo nativo de carpetas sin `defaultPath`** — causa raíz: `dialog.showOpenDialog` (`shell/main.js`, `ipcMain.handle('select-folder')`) no recibía ninguna carpeta de referencia, así que Electron recordaba la última ruta visitada de forma global en el proceso, independientemente del proyecto o campo activo. Fix: `selectFolder(defaultPath)` en `preload.js`/`main.js` acepta un `defaultPath` opcional; `contextFiles.js` manda el valor actual del input (`inputEl.value.trim() || undefined`) en cada llamada
- [x] **Reversión de UI a un solo input compartido** — se había explorado (e implementado, luego revertido en esta misma sesión) un diseño con dos inputs de ruta independientes para Código y Documentos; el diseño correcto y ya confirmado por el usuario es un único input "Carpeta del proyecto" con dos checkboxes de estado debajo (`Código (patch mode)` / `Documentos`), como estaba antes — el bug nunca fue la falta de inputs separados, sino los dos causa-raíz de arriba
- [x] **Parche `maxFileSize` de Carpeta vinculada** — subido de 5MB a 100MB en `DEFAULTS` (`linked-folder.service.js`); el límite anterior excluía silenciosamente libros/PDFs reales de tamaño normal. Solución rápida intencional — la solución real (chunking + selección por relevancia) queda diseñada y pendiente bajo tool use (ver v4.0 más abajo y DECISIONS.md)
- [x] **Fix log de escaneo truncado engañoso** — `generateLinkedFolderIndex()` calculaba `truncated` como una sola condición combinada y el `console.warn` siempre culpaba a `maxFiles` sin importar la causa real; ahora se trackean `oversizedCount` y `truncatedByCount` por separado y se reporta la causa real (tamaño / cantidad / límite de recorrido) en el mensaje
- [x] **Diseño de tool use / function calling documentado (sin implementar)** — evaluación completa y diseño de UI acordado para hacer agénticos Context Snapshot y Carpeta vinculada vía `node-llama-cpp` function calling; registrado en DECISIONS.md y como pendientes de v4.0 (ver sección "🤖 Tool use / function calling" más abajo)

---

## 🎯 v3.0 — Tempest como sistema operativo contextual de proyectos

**Nota:** casi todo lo planeado bajo "v3.0" ya está completado (marcado `[x]` abajo, con su versión real de entrega). Esto es lo único que sigue genuinamente pendiente:

### 🔓 Pendiente real de v3.0
- [ ] Reemplazar `preprocessor.js` (sharp) por `jimp` si sharp da problemas con `electron-rebuild`
- [ ] Lectura de carpeta del disco por proyecto sin servidor HTTP separado
- [ ] Electron Builder — `.dmg` (macOS), `.AppImage` (Linux)
- [ ] Auto-actualizaciones con `electron-updater`
- [ ] Instalador que incluye modelos GGUF o los descarga en primer arranque
- [x] Splash screen de carga de modelos — ventana frameless con progreso real de carga
      en VRAM (`onLoadProgress` de node-llama-cpp, fallback indeterminado si el motor no
      lo dispara), espera en dos fases (Express arriba → modelo listo), diálogo nativo de
      error si el modelo falla en vez de colgarse indefinidamente (v2.17.0 — ver DECISIONS.md)
- [x] Chequeo de inventario de modelos al arrancar — verifica que todos los `.gguf`
      conocidos existan en disco (`fs.existsSync`, sin cargarlos), expuesto en
      `/health.modelsInventory`, aviso no bloqueante en el splash si falta alguno (v2.17.0)
- [ ] Firma de código para Windows/macOS

### 🧾 UI/UX
- [ ] Autocorrector/corrector ortográfico en el input del chat — activar `spellcheck: true` en `webPreferences` de `shell/main.js` +      atributo `spellcheck="true"` en el `<textarea>` del input; Electron ya trae el corrector nativo de Chromium integrado, no requiere librería externa

### 🧠 Context Snapshot — mejoras pendientes (historial — completado)

- [x] **Modelo con ventana grande para análisis documental** — evaluar `Qwen2.5-14B Q4`
  (32K contexto) o `Mistral-7B v0.3` (32K contexto) para preguntas sobre arquitectura y
  documentación donde los modelos 8K se quedan cortos. Pendiente de evaluación y descarga.

- [x] **Tokenización real con `model.tokenize()`** — reemplazar la estimación de
  chars/token por el conteo real de `node-llama-cpp` para calcular el budget de contexto
  con precisión. Requiere exponer el objeto `model` desde `llama.provider.js` hasta
  `chat.controller.js`.

- [x] **Ranking semántico de bloques** — ordenar los archivos del snapshot por relevancia
  al mensaje del usuario antes de aplicar el budget, en vez del orden por mtime actual.

### 🧩 Modularización frontend
- [x] Separar `contextFiles.js` — modal de context files + snapshot + toggle + browse (v2.0.3)
- [x] Separar `projectConfig.js` — modal de configuración del proyecto (v2.0.4)
- [x] Separar `transcription.js` — modal de transcripción (v2.0.5)
- [x] Separar `chat.js` — lógica de envío y creación de chats (de `app.js`) (v2.0.7)
- [x] Separar `streaming.js` — createStreamingBubble, finalizeStreamingBubble (de `ui.js`) (v2.0.7)
- [x] Separar `autoRename.js` — renombrado automático con IA (de `app.js`) (v2.0.8)
- [x] Separar `patchRenderer.js` — diff rojo/verde, botón aplicar (de `ui.js`) (v2.0.9)
- [x] Separar `codeRenderer.js` — bloques de código terminal (de `ui.js`) (v2.0.10)
- [x] Separar `messageRenderer.js` — mensajes, links, acciones (de `ui.js`) (v2.0.11)
- [x] Separar CSS en archivos por responsabilidad: base, layout, chat, sidebar, modals, diff, components
- [x] `app.js` queda solo como orquestador
- [x] `ui.js` queda solo con funciones base de DOM

### 🖼️ Lectura de imágenes (v3.0)

**Fase 1 — OCR con tesseract.js** ✅
- [x] Imágenes sueltas (PNG, JPG, WEBP) → extraer texto impreso (v2.2.0)
- [x] PDFs escaneados → OCR página por página con Poppler (v2.2.1)
- [x] DOCX con imágenes embebidas → extraer texto de imágenes internas (v2.2.2)
- [x] Preprocesado con `sharp` — `preprocessor.js` como interfaz reemplazable (v2.2.3)

**Fase 2 — Análisis visual con modelo multimodal (v2.3.0)** ✅
- [x] `vision.service.js` — cliente multimodal con interfaz reemplazable, contrato `describeImage(filePath) → { description, model, truncated }`
- [x] Modelo Qwen2.5-VL-7B-Q4 configurado en LocalAI con `qwen2_5-vl-7b-q4.yaml` y mmproj
- [x] `image.extractor.js` — fallback automático a visión cuando OCR da confianza < 60%
- [x] `capability.matrix.js` — alias `visual` apunta a `qwen2.5-vl-7b-q4` en desktop, `llava-1.6` en laptop
- [x] `task.detector.js` — modo `visual` detectado cuando hay imagen adjunta sin código
- [x] `mode.router.js` — modo `visual` para adjuntos de imagen sin código
- [x] `visual.txt` — prompt especializado para análisis visual
- [x] `removeLoops()` — eliminación de texto repetido en respuestas del modelo visual
- [x] Respuesta sin truncado artificial hasta 2000 chars (controlado por `max_tokens: 1024`)
- [x] `truncated` real del modelo propagado desde `vision.service.js` a `image.extractor.js`
- [x] Docker actualizado a `master-gpu-nvidia-cuda-12` con volumen persistente para backends
- [x] `localai-backends:/var/lib/local-ai/backends` — backends no se re-descargan en cada reinicio

**Fase 3 — Perfil visual laptop con LLaVA (v2.4.0)** ✅
- [x] Verificar que `llava.yaml` carga correctamente en LocalAI laptop con `gpu-layers: 35` (RTX 4050, 6GB VRAM)
- [x] Confirmar que `capability.matrix.js` laptop → alias `visual` → `llava-1.6` funciona correctamente
- [x] Verificar que `vision.service.js` trabaja igual con LLaVA que con Qwen2.5-VL (mismo contrato)
- [x] Calibrar `max_tokens` para LLaVA en laptop — LLaVA tiende a loops, ajustar `repeat_penalty` y `frequency_penalty`
- [x] Probar análisis visual en laptop con imagen de prueba real
- [x] Verificar que OCR pipeline completo funciona en laptop — imágenes, PDF escaneado, DOCX con imágenes
- [x] Confirmar `HARDWARE_PROFILE = 'laptop'` en `chat.controller.js` al usar la laptop
- [x] Documentar diferencias de comportamiento LLaVA vs Qwen2.5-VL

### 🌐 Búsqueda web 
- [x] Contenedor SearXNG en Docker (puerto 8081)
- [x] `search.service.js` — interfaz reemplazable con providers
- [x] `searxng.provider.js` — activo, JSON API, timeout 8s, máx 5 resultados
- [x] `brave.provider.js` — stub para v2.7.x
- [x] Botón 🌐 dinámico en toolbar
- [x] Settings admin — toggle global, URL, test de conexión
- [x] Settings usuario — selector de provider (visible si hay 2+ activos)
- [x] Anti prompt-injection — `sanitizeSnippet()`, 400 chars máx por snippet
- [x] Rate limiting — 3s por usuario
- [x] Query mínima 8 chars — evita búsquedas sin sentido
- [x] `maxTokens: 350` con búsqueda activa — evita loops
- [x] Queries registradas en logs JSONL
- [x] Fix prompt global — reordenado, regla "nunca firmar respuestas"
- [x] Pipeline visual + búsqueda — descripción de Qwen2.5-VL como query, segundo pase con modelo de texto, identificación de juegos/lugares/productos (v2.7.0)
- [x] Botón 🌐 sin recarga — `initWebSearch()` se re-ejecuta al guardar config (v2.7.0)
- [x] Tavily provider — `include_answer: true`, snippets 800 chars, 1,000/mes gratis (v2.7.0)
- [x] Sección Búsqueda web: SearXNG (local/gratis) vs API externa (pago) — implementado v2.6.0, Brave Search API stub para v2.7.x


### 🩹 Patch Mode — fix (v2.1.1) ✅
- [x] Patch Mode fallaba cuando el contexto llegaba solo via system prompt — modelo generaba diffs inventados
- [x] `buildPatchGrounding` en `chat.controller.js` — inyecta archivo relevante del snapshot en el mensaje del usuario
- [x] `skipContextFiles` — omite Capa 4 en patch mode para no saturar prefill de DeepSeek
- [x] `patch.parser.js` — soporte para formato `SEARCH:/REPLACE:` con bloques de código
- [x] `messageRenderer.js` — `patchLabelRegex` detecta y renderiza formato `SEARCH:/REPLACE:` en rojo/verde
- [x] `streaming.js` — patrones adicionales en `stripLeakedInstructions` para limpiar system prompt filtrado
- [x] Ruido post-REPLACE ignorado en renderer — solo se muestra el primer bloque diff válido

### 🖥️ Electron + node-llama-cpp

**Fase 1 — Shell Electron sobre Express (v2.8.0)** ✅
- [x] `shell/main.js` — lanza `backend/server.js` con `child_process.fork`, espera `GET /health` (polling 30×500ms), abre `BrowserWindow` en `http://localhost:3005`
- [x] `shell/preload.js` — `contextBridge` mínimo (`electronAPI.isElectron`), base para IPC en Fase 2
- [x] `package.json` raíz — `main: shell/main.js`, scripts `start`/`dev`/`build`, `electron` + `electron-builder` como devDependencies
- [x] Endpoint `GET /health` en `server.js` — señal de arranque para el shell
- [x] Links externos se abren en el navegador del sistema (`setWindowOpenHandler` + `shell.openExternal`)
- [x] Backend, frontend y Docker/LocalAI sin cambios — Fase 1 es envolver sin romper

**Fase 2 — Eliminar Docker (v2.11.0 ✅ parcial)**
- [x] Reemplazar LocalAI (Go/Docker) por `node-llama-cpp` — bindings nativos C++/Node.js, GPU via CUDA, compatible con archivos GGUF existentes (v2.10.0)
- [x] Reemplazar `localai.service.js` — nuevo contrato para `node-llama-cpp` (v2.10.0)
- [x] Migrar SearXNG Docker a Tavily/Brave como providers principales — sin contenedor externo (v2.10.0)
- [x] Selector nativo de carpetas via `dialog.showOpenDialog` — implementado en v2.8.1 (botón 📁 con fallback a `/fs/browse` en navegador)
- [x] Drag & drop de archivos — funciona en Electron sin cambios de código; duplicados corregidos en v2.8.1
- [x] Empaquetar backend Node.js como proceso principal de Electron (`main process`) — v2.11.0: `shell/main.js` carga `server.js` via `require()` directo en el mismo proceso, sin `spawn`/child_process
- [x] Empaquetar frontend como renderer de Electron (sin servidor Express externo) — v2.11.0: `loadFile` en lugar de `loadURL`; `BASE_URL` agregado en 7 módulos frontend (`api.js`, `login.js`, `models.js`, `contextFiles.js`, `settings.js`, `webSearch.js`, `devPanel.js`) para que los fetch sigan resolviendo a `http://localhost:3005`
- [x] Reemplazar `pdf.rasterizer.js` (Poppler) por `pdfjs-dist` + `@napi-rs/canvas` — sin dependencias del SO (v2.11.x — ver DECISIONS.md para detalle de implementación y bugs resueltos; nota: se usó `@napi-rs/canvas` en vez de `canvas` como decía el ítem original, ver razón en DECISIONS.md)

### 📦 Instalador
- [x] Electron Builder — generar `.exe` Windows portable (v2.10.0 — build inicial; automatización completa y funcionamiento end-to-end confirmado en v2.16.0 — ver DECISIONS.md para detalle de causas raíz y fixes)
- [ ] Electron Builder — `.dmg` (macOS), `.AppImage` (Linux)
- [ ] Auto-actualizaciones con `electron-updater`
- [ ] Instalador que incluye modelos GGUF o los descarga en primer arranque
- [x] Splash screen de carga de modelos (v2.17.0 — ver detalle arriba en "Pendiente real de v3.0" / DECISIONS.md)
- [ ] Firma de código para Windows/macOS

### 🏗️ Empaquetado Electron — pendientes
- [x] Automatizar inclusión de `backend/node_modules/` en electron-builder (v2.16.0 — `extraResources` en package.json, bypasea el filtro automático de node_modules de producción de electron-builder que no detectaba backend/package.json por ser un proyecto npm anidado)

### 👥 Permisos por usuario
- [x] Permisos de búsqueda web por usuario — admin asigna desde el modal de usuarios qué providers puede usar cada quien (v2.9.0)
  - **Parte 1 — Backend**: agregar campo `searchProviders: ['searxng', 'tavily']` en `users.json` por usuario; `/search/config` filtra providers según usuario autenticado
  - **Parte 2 — Settings admin**: en la fila de cada usuario agregar toggles de providers disponibles (junto a Rol y contraseña)
  - **Parte 3 — Settings usuario**: selector solo muestra providers que el admin le asignó; si solo hay uno, no muestra selector
  - **Regla global**: si admin desactiva un provider globalmente, se deshabilita para todos independientemente de permisos individuales

  ### 🐛 Bug fixes
  - [x] **Budget dinámico de contexto post-model-router** — `budgeter.js` ahora calcula el
          límite de caracteres dinámicamente según el `context_size` real del modelo seleccionado,
          descontando tokens de salida y reserva base. Elimina el crash de context shift con
          Context Snapshots grandes (caso probado: 54 archivos indexados, respondió sin error).
          Archivos modificados: `token.profiles.js`, `budgeter.js`, `assembler.js`,
          `context.service.js`, `buildSystemPrompt.js`, `localai.service.js`, `chat.controller.js`.
  - [x] **Captura de error de context shift** — el `catch` de `chat.controller.js` ahora
        detecta el error específico de `node-llama-cpp` y devuelve un mensaje claro al usuario
        en vez del error crudo, como safety net ante edge cases no cubiertos por el budget dinámico.
  - [x] **Exclusión de archivos sensibles del snapshot** — `ignoreGlobs` por defecto ampliado
        con patrones de seguridad (`search-config.json`, `.env*`, `secrets*`, `credentials*`).
        Evita que el modelo lea y exponga credenciales al analizar proyectos.

- [x] **Parte 1 — Backend**
  - [x] Agregar campo `searchProviders: ['searxng', 'tavily']` en `users.json` por usuario
  - [x] Actualizar `/search/config` para filtrar providers según usuario autenticado

- [x] **Parte 2 — Settings admin**
  - [x] Agregar toggles de providers en la fila de cada usuario (junto a Rol y contraseña)

- [x] **Parte 3 — Settings usuario**
  - [x] Selector solo muestra providers que el admin le asignó
  - [x] Si solo hay un provider asignado, no muestra selector

- [x] **Regla global**
  - [x] Si admin desactiva un provider globalmente, se deshabilita para todos independientemente de permisos individuales
  - [x] **Fix bug "Sin perfil" mostraba toggles apagados — v2.11.0** — causa raíz: `devPanel.js` (`initDevPanel`) hacía `fetchWithAuth('/me')` con ruta relativa sin `BASE_URL`; desde `loadFile` (Electron) eso resolvía a una ruta de disco inválida, el fetch fallaba, y `isAdmin` quedaba en `false` aunque el usuario sí fuera admin — por eso la pestaña "Servicios" no se renderizaba en absoluto. Resuelto agregando `BASE_URL` a los 3 fetch de `devPanel.js` (`/me`, `/gpu/stats`, `/localai/metrics`)

---
  ### 🔥 Sidebar
- [x] Extender eliminación múltiple a chats dentro de proyectos

---

### 💻 Hardware profiles
- [x] Mantener laptop profile ligero y estable — qwen2.5-3b-q5, llama-3.2-3b-q4, qwen2.5-coder-3b-q8
- [x] Routing inteligente que evite modelos pesados en laptop
- [x] Patch Mode funcional en laptop con modelos 3B

---

## 🛠️ Modo Desarrollador (transversal)

Panel de debug visible solo para perfil `admin`. Aplica a todo Tempest, no a una fase específica. **Base implementada en v2.4.3.**

- [x] Panel lateral con información de cada request: modelo usado, modo, variante, `truncated`, perfil hardware — v2.4.3
- [x] Indicador de hardware profile activo (desktop/laptop) visible en el frontend — v2.4.3
- [x] Control de acceso por rol admin/user (`ADMIN_MODE` en `.env`, contrato `GET /me`) — v2.4.3
- [x] Duración real del stream por request en el panel (ms, rojo si >5000ms) — v2.4.5
- [x] Tokens entrada estimados (prompt completo real / 4) y tokens salida (chars generados / 4) — v2.4.5
- [x] `finish_reason` real del modelo — v2.4.5
- [x] Logs estructurados en backend por request — JSONL rotado por día en `backend/logs/requests-YYYY-MM-DD.jsonl` — v2.4.7
- [x] Toggle de modo debug desde el frontend sin reinicio — modal ⚙ en sidebar — v2.4.6
- [x] **Login real admin/user — v2.4.8** — JWT con sliding expiration (2h), bcrypt, pantalla de login
- [x] **Gestión de usuarios en UI — v2.4.9** — listar, crear y eliminar usuarios desde el modal ⚙. Separación HTML en `settings.html`
- [x] **Cambiar contraseña y rol — v2.4.10** — cada usuario cambia su propia contraseña; admin cambia contraseña y rol. Revocación de tokens al cambiar rol
- [x] **Indicador visual OCR — v2.4.11** — badge ⚠ en chips de adjuntos OCR-risky, badge rojo en mensajes con error real
- [x] **Label de modelo con tipo — v2.4.11** — el header muestra el tipo del modelo activo: `[general]`, `[visual]`, `[código]`, `[razonamiento]`, `[análisis]`
- [x] **Debug panel en modo visual — v2.4.11** — métricas de requests visuales (LLaVA/Qwen-VL)
- [x] **Profiling GPU + métricas LocalAI — v2.5.0** — sección GPU en Dev Panel (temperatura, VRAM, utilización) con polling cada 5s. Tokens acumulados por modelo desde `/metrics` de LocalAI

---

## 🎯 v4.0 — Features avanzados

### 🔌 Git Integration
- [ ] Comparar commits automáticamente con `simple-git`
- [ ] Detectar regresiones entre versiones
- [ ] Diffs visuales por versión
- [ ] Snapshots git-aware
- [ ] Análisis IA de cambios arquitectónicos
- [ ] Detectar contratos rotos entre módulos tras cambios
- [ ] "¿Qué cambió entre v2.0.0 y v2.0.1?"

### 📄 Document Mode / Grounding real
- [ ] Modo `document` dedicado como variante del sistema de prompts
- [ ] Prompts que prohíben invención fuera del contexto
- [ ] Few-shot grounding
- [ ] Chunking inteligente para documentos largos
- [ ] Resúmenes jerárquicos
- [ ] Forcing citations
- [ ] Respuestas basadas únicamente en chunks encontrados
- [ ] Memoria documental por proyecto

### 🖥️ VS Code Integration
- [ ] Abrir archivos via `code CLI`
- [ ] Abrir línea específica: `code -g file.js:42`
- [ ] Diff visual: `code --diff old.js new.js`
- [ ] Integración contextual al aplicar patches
- [ ] Orquestación IA + Git + VSCode via `child_process`

### 🗂️ Context Snapshot v2: soporte documental
- [ ] Indexar `.md` / `.txt` además de código (Fase 1)
- [ ] Indexar `.pdf` / `.docx` usando extracción (Fase 2)
- [ ] UX: mensaje claro si snapshot genera 0 items
- [ ] Worker thread para generación de embeddings en proceso principal (sin OOM)
- [ ] Embeddings para archivos subidos manualmente via botón "Subir archivos"

### 🤖 Tool use / function calling — snapshot y carpeta vinculada agénticos
Diseño acordado en DECISIONS.md ("Tool use — diseño acordado"). `node-llama-cpp` soporta
`functions` nativo en `LlamaChatSession.prompt()`, con mejor soporte en modelos Llama 3
Instruct (el modelo principal actual entra en esa categoría).
- [ ] Loop de function calling en `localai.service.js` — herramientas de solo lectura:
      listar archivos (manifest), leer archivo (por chunks), buscar texto
- [ ] Reusar `isPathSafe` (`fs.provider.js`) para validar cualquier ruta que el modelo pida
- [ ] Reusar `chunk.service.js` para lectura de archivos por partes
- [ ] Tope duro de iteraciones del loop (propuesto 5-8) — evitar ciclos lentos de inferencia
- [ ] Nunca escritura/modificación de código vía tool use — eso se queda exclusivamente en
      Patch Mode, sin mezclar los dos caminos
- [ ] Rediseño UI del modal de contexto: Carpeta del proyecto con un solo checkbox
      (pausa/permite tool use, sin separar Código/Documentos), sin texto de estado ni
      contador; botón "+ Subir archivos" reubicado debajo
- [ ] Lista de archivos deja de mostrar los escaneados de Carpeta del proyecto — solo
      archivos subidos a mano; `alwaysInclude` ("siempre") se mantiene ahí exclusivamente
- [ ] Chunking + selección por relevancia para Carpeta del proyecto — reemplaza
      `maxFileSize` como límite duro (ver parche temporal de 100MB en DECISIONS.md,
      sección "Parche: maxFileSize dejaba fuera libros/PDFs grandes")
- [ ] Reranking — paso extra sobre el mismo pipeline de búsqueda, mismo alcance de versión
      o parche inmediatamente posterior
- [ ] RAG resulta automático de esta versión (embeddings + tool use juntos) — sin ítem de
      implementación propio

### ⏱️ Router de modos — afinación de triggers
- [ ] "cuéntame sobre X" dispara `explain` innecesariamente — reservar para explicaciones técnicas profundas
- [ ] Ajustar triggers en `mode.router.js`
- [ ] Revisar sobre-ruteo a modelos pesados en preguntas casuales

### 🔐 Seguridad y autenticación
- [ ] **Tokens reales en streaming** — bug conocido de llama.cpp. Revisar cuando LocalAI ≥ v2.26.x
- [ ] **Expulsión en tiempo real con WebSockets** — notificación instantánea al cambiar rol
- [ ] **Multi-tenant B2B** — aislamiento de datos por organización

### 🌐 Búsqueda web — pendientes
- [ ] Brave Search API — implementar `brave.provider.js` completo
- [ ] **Estado del botón 🌐 no se refresca sin reiniciar la app** — `frontend/modules/webSearch.js` calcula `_provider`/`_enabledProviders` una sola vez en `initWebSearch()` al cargar la app; si el admin cambia providers en Servicios (activar/desactivar, agregar API key) sin reiniciar, el botón del chat sigue con el estado viejo. Contradice la descripción existente ("botón 🌐 sin recarga al guardar config") — revisar si ese mecanismo de refresco existe y por qué no está disparando, o si nunca se implementó
- [ ] **Adaptar SearXNG para correr sin Docker** — el toggle sigue apuntando a `http://localhost:8081`, un contenedor Docker que ya no se usa desde que el proyecto migró a `node-llama-cpp` nativo. Evaluar correrlo standalone (instalación directa sin contenedor) o remover el provider si no vale la pena mantenerlo

### 🗄️ Base de datos
- [ ] Migrar JSON a SQLite/PostgreSQL
- [ ] Búsqueda semántica con embeddings

### 🩹 Limpieza post-migración node-llama-cpp
- [ ] `/localai/metrics` muestra "No disponible" en Dev Panel — endpoint sigue parseando Prometheus de LocalAI, que ya no corre desde la migración a node-llama-cpp. Eliminar sección o reemplazar por métrica equivalente si `node-llama-cpp` expone alguna
- [ ] Investigar por qué `qwen2.5-7b-q5` da respuestas pobres/desactualizadas con contexto de búsqueda web real disponible — confirmado vía dev panel que el modelo SÍ recibe los resultados completos (finish_reason: stop, no truncado); el problema es de uso/calidad del modelo ante ese contexto, no de inyección

### 🐍 Motor Python alternativo — modelos y OCR incompatibles con node-llama-cpp / tesseract.js
- [ ] Investigar motor de inferencia vía Python (transformers, vLLM, u otro) como alternativa para modelos con incompatibilidad CUDA en `node-llama-cpp`
- [ ] Caso concreto ya conocido: `gemma-2-9b-q4` reemplazado temporalmente por `llama-3.1-8b-q5` en alias `explain-deep` por incompatibilidad CUDA (ver "Estado actual")
- [ ] Evaluar PaddleOCR o Surya (Python) como alternativa/mejora a `tesseract.js` — mejor manejo de layouts complejos, tablas, columnas múltiples y multilenguaje; podría reducir cuántas veces se necesita el fallback a Qwen2.5-VL por baja confianza OCR
- [ ] Definir arquitectura: ¿proceso Python separado vía `execFile`/IPC (mismo patrón que whisper-cli.exe/ffmpeg), o servidor local aparte?
- [ ] Evaluar impacto en empaquetado Electron — un runtime Python sumaría peso y complejidad al instalador

### 🔌 Separación Motor/Modelo (arquitectura multi-engine)

**Contexto:** generaliza el punto anterior ("Motor Python alternativo"). En vez de tratar
Python como una excepción puntual para modelos incompatibles, la idea es que Tempest
nunca dependa de un único motor de ejecución para ninguna tarea (chat, OCR, visión, audio,
embeddings). Motor = quién ejecuta (node-llama-cpp, Ollama, Transformers, vLLM, ONNX
Runtime, TensorRT, PaddleOCR, faster-whisper...). Modelo = qué red neuronal corre dentro
de ese motor. Un mismo Motor puede correr varios Modelos; una misma Capability puede
resolverse por más de un Motor.

- [ ] Definir interfaz común de "motor" — basada en la forma que ya tiene `llama.provider.js`
      (`init`, `switchModel`, `generate`, `stream`, `getStatus`) para que los motores sean
      intercambiables sin tocar quien los llama
- [ ] Extender `MODEL_FILES` (`localai.service.js`) con campo `engine` por entrada — sembrado
      en v3.0 (ver DECISIONS.md), sin uso real todavía
- [ ] Introducir concepto "Capability" por encima de los alias actuales de
      `capability.matrix.js` — Chat, OCR, Visión, Audio, Embeddings como categorías de
      tarea, no solo variantes dentro de Chat
- [ ] Reemplazar los perfiles harcodeados `desktop`/`laptop` (`capability.matrix.js`,
      `models.js`) por configuración plana editable por instalación
- [ ] UI de "Perfiles" en Configuración — elegir Motor+Modelo por Capability
- [ ] Capa opcional de sugerencia/validación según VRAM detectada (asesora, no decide)
- [ ] Decisión de empaquetado del runtime Python para motores no-nativos (ver también
      "Motor Python alternativo" arriba)
- [ ] Motor Transformers + TrOCR para Capability=OCR
- [ ] Motor faster-whisper para Capability=Audio — evaluar si reemplaza o complementa
      whisper.cpp standalone (v2.15.0)
- [ ] Motor Ollama como alternativa de Capability=Chat
- [ ] Unificar con el pendiente existente de `capability.matrix.js` soportando providers
      remotos (`localai` | `groq` | `openai` | `claude`, sección "🤖 Integración IA")
      bajo el mismo concepto de Motor, en vez de dos sistemas separados
- [ ] Evaluar motores adicionales: vLLM, ONNX Runtime, TensorRT, PaddleOCR

---

## 🔮 vX.x

### 🖼️ OCR Pipeline — pendientes

- [ ] Divisor de páginas PDF como herramienta independiente
- [ ] Selector de idioma OCR por proyecto desde `projectSettings.json`
- [ ] TTL para cache OCR — limpieza automática por antigüedad

### 🔥 Sidebar
- [ ] Invertir orden: proyectos arriba, chats independientes abajo
- [ ] Ordenar chats por fecha de último mensaje
- [ ] Mover chat al tope al generar nuevo mensaje
- [ ] Guardar estado colapsado/expandido en localStorage
- [x] Extender eliminación múltiple a chats dentro de proyectos

### 💬 Acciones por mensaje
- [ ] Mostrar opciones al seleccionar texto
- [ ] Edición de consultas del usuario
- [ ] Compartir respuestas
- [ ] Intentar nuevamente en respuestas de Tempest

### 📎 Adjuntos
- [ ] LibreOffice headless para mejor extracción
- [ ] Soporte visual de adjuntos en historial del chat
- [ ] Orden real de slides PPTX
- [ ] OCR de imágenes embebidas en PPTX — mismo patrón que `docx.ocr.extractor.js` (v2.2.2): 
      extraer `ppt/media/*` vía JSZip/unzipper, OCR por imagen con `ocr.service.js`, 
      combinar con texto ya extraído por `pptx.extractor.js`. Hoy PPTX solo extrae texto 
      de slides/notas, no imágenes

### 🧠 Memoria
- [ ] Mejorar detección de datos importantes
- [ ] Evitar duplicados en perfil/memoria
- [ ] Resumen automático por chat y por proyecto
- [ ] Limpiar historial viejo sin perder resumen
- [ ] Respaldo/exportación de memoria

### 🧾 UI/UX
- [ ] Loader animado de respuesta
- [ ] Confirmación visual al renombrar
- [ ] Diseño móvil

### 🧪 Testing
- [ ] Probar todos los endpoints
- [ ] Probar adjuntos: PDF, DOCX, XLSX, PPTX, TXT, código, imágenes
- [ ] Probar router de modos: explain / coder strict / coder hybrid / general
- [ ] Probar sanitize.js con distintos tipos de basura del modelo
- [ ] Pruebas de humo de LocalAI después de cambios en YAML (ver MODELS.md)

### ⚙️ Transcripción
- [x] Corte por silencio real (VAD) — ffmpeg silencedetect, interfaz reemplazable `vad.detector.js`
- [x] Persistencia de mensajes en chatHistory (v2.16.0) — endpoint `POST /chat/message/save`, reconstrucción visual de la card al recargar historial, limpieza de archivos huérfanos al borrar el chat que los generó
- [ ] `deleteProject` no limpia archivos generados de los chats que contiene (huérfanos si se borra un proyecto completo) — mismo fix que `deleteChat` v2.16.0, pendiente extender
- [ ] Elegir idioma del audio
- [ ] Limpiar uploads/audio y uploads/chunks automáticamente
- [ ] Análisis automático de transcripción
- [ ] Enviar transcripción al chat como contexto opcional
- [ ] Voz al chat: hablar → texto → consulta
- [ ] Stream de audio en vivo con Faster-Whisper
- [ ] ElevenLabs TTS — voces naturales en español, doblaje de audio, clonación de voz. Plan $5/mes como alternativa a Piper (después de estabilizar transcripción)

### 📄 Exportación
- [ ] Mejorar formato PDF y DOCX
- [ ] Descarga directa desde frontend
- [ ] Nombres de archivo más descriptivos
- [ ] Persistir mensajes de `generateDocument` (chat.js) en `chatHistory` — mismo patrón implementado para transcripción en v2.16.0; hoy los documentos generados desde el chat normal tienen el mismo gap que tenía transcripción antes del fix

### 🤖 Integración IA
- [ ] Cada modo carga su modelo automáticamente
- [ ] Subir al contexto archivos mencionados explícitamente
- [ ] Claude API como motor alternativo
- [ ] OpenAI API como motor alternativo
- [ ] Modo híbrido LocalAI + API externa
- [ ] Búsqueda web con SearXNG — motor open source en Docker, gratuito y sin límites, resultados inyectados como contexto al modelo local
- [ ] Groq API como motor alternativo (Llama 3.1 70B)
- [ ] Toggle en frontend: LocalAI vs API externa
- [ ] `capability.matrix.js` soporta providers: `localai` | `groq` (y después `openai` | `claude`)
- [ ] Fallback automático a Groq si LocalAI no responde (timeout + retry)
- [ ] Documentar límites de uso para no exceder tier gratuito

### 📄 Grounding documental
- [ ] Prompts más estrictos para priorizar contexto sobre conocimiento preentrenado
- [ ] Prohibir invención de lore/información no presente en el contexto
- [ ] Respuesta explícita cuando la información no existe en el contexto
- [ ] Few-shot grounding en el system prompt
- [ ] Document Mode — modo especial para lectura documental tipo RAG
- [ ] Forcing citations desde el contexto
- [ ] Chunking inteligente para documentos largos
- [ ] Resúmenes jerárquicos
- [ ] Referencias internas entre documentos
- [ ] Navegación semántica
- [ ] Memoria documental por proyecto
- [ ] Respuestas basadas únicamente en documentos ("biblioteca IA personal")

### 📚 Herramientas de estudio (independientes — sin versión asignada)
Evaluadas junto con tool use pero SIN dependencia técnica de él ni del rediseño de UI —
cada una es solo "tomar contenido + pedirle algo puntual al modelo de chat", sin
infraestructura nueva. Candidatas a una versión chica y rápida en cualquier momento, antes
o después de tool use, sin bloquearse entre sí (ver DECISIONS.md, agrupación de métodos).
- [ ] Summarization — llamada aparte al modelo pidiendo que resuma un documento/archivo
- [ ] Generación de preguntas/flashcards — tarjetas de repaso pregunta/respuesta a partir
      del contenido, para estudio activo (más efectivo que solo leer resúmenes)
- [ ] Extracción de conceptos/glosario — términos clave, definiciones, nombres, fechas
      identificados y listados aparte del texto principal

### 🕸️ Mapas de conceptos / knowledge graphs (futuro sin fecha)
El más pesado de los métodos evaluados para estudio — no depende de tool use pero tampoco
es rápido. Necesita almacenamiento nuevo (relaciones tipo grafo, no solo texto plano), UI
de visualización nueva, y lógica de extracción de relaciones ("X causa Y", "A es un tipo
de B"). Sin versión asignada hasta validar que las herramientas de estudio más simples de
arriba realmente se usan.
- [ ] Definir modelo de datos para relaciones extraídas (grafo simple, no vector)
- [ ] Extracción de relaciones vía prompt dedicado al modelo de chat
- [ ] UI de visualización navegable (evaluar librerías ligeras, sin dependencias pesadas)

### 🧹 Stop tokens y limpieza
- [ ] Agregar `Human:` y `Assistant:` a stopwords en YAMLs relevantes
- [ ] Limpieza post-response en `sanitize.js` para autocompletado basura
- [ ] Verificar `<|endoftext|>` en todos los modelos desktop

### 💻 Hardware profiles
- [ ] Evitar que snapshots grandes destruyan rendimiento en laptop
- [ ] Degradación elegante: capability.matrix desktop no debe romper laptop profile

### 🤖 Modelos a investigar
- [ ] Mejores modelos para grounding documental
- [ ] Mejores modelos para patch mode en laptop (deepseek-coder-6.7b-q4)
- [ ] Modelos híbridos razonamiento + coding
- [ ] Mantener compatibilidad: ligeros laptop / coder / documentales / reasoning
- [ ] CodeLlama 13B como backup/comparación frente a DeepSeek-Coder y Qwen-Coder (idea antigua, evaluar si sigue vigente)

### 📬 Outlook
- [ ] OAuth 2.0 con Microsoft Graph API
- [ ] Leer, resumir y responder correos
- [ ] Organizar correos desde el chat

### 🖥️ App desktop y base de datos
- [ ] Migrar JSON a SQLite/PostgreSQL
- [ ] Sistema de login y múltiples usuarios
- [ ] Búsqueda semántica con embeddings

### 🎙️ Doblaje de audio/video

- [ ] Extraer audio de video con ffmpeg
- [ ] Transcribir audio original con Whisper
- [ ] Traducir transcripción al idioma destino
- [ ] Sintetizar voz con proveedor configurado en Panel de Configuración
- [ ] Sincronización de audio doblado con video original

### ⚙️ Panel de Configuración de Proveedores

Panel global donde el usuario configura qué modelo o servicio usar para cada funcionalidad que tiene múltiples opciones.

- [ ] Modal o página de configuración accesible desde el header o menú
- [ ] Sección TTS: OpenVoice V2 (local/gratis) vs ElevenLabs (pago)
- [ ] Sección Doblaje: OpenVoice V2 vs ElevenLabs
- [ ] Guardar preferencias en `projectSettings.json` o `profile.json`
- [ ] Indicador visual de qué proveedor está activo en cada herramienta

### 👥 Perfiles de búsqueda
- [ ] **Creador de perfiles** — UI para crear, editar y eliminar perfiles de búsqueda (nombre, providers habilitados, usuarios asignados). Ver hoja de ruta técnica en DECISIONS.md
- [ ] **Perfiles dinámicos en selector** — el `<select>` de "Perfil asignado" en panel Usuarios se puebla desde el backend en lugar de opciones hardcodeadas (`none`/`global`)
- [ ] **Dropdown de Servicios dinámico** — los perfiles nuevos aparecen arriba de los usuarios en el selector, antes de admins
- [ ] **Asignar perfil al crear usuario** — agregar selector de perfil en modal "Nuevo usuario" para vincular desde el momento de creación

### 🖼️ Visión multimodal — mejoras pendientes
- [ ] Migrar `vision.service.js` a `llamaProvider.describeImage()` cuando node-llama-cpp v4.x soporte multimodal — eliminar dependencia de Ollama
- [ ] Mejorar descripción de imágenes: identificar juegos, lugares, productos específicos con más precisión (actualmente describe elementos genéricos sin identificar el título del juego)
- [ ] Hint automático al modelo visual con el texto OCR extraído como contexto adicional

### 🖨️ Renderizado visual de DOCX/PPTX — Aspose + alternativas locales (v4.x, exploratorio)

**Contexto:** extracción de texto/estructura de DOCX/PPTX ya está resuelta sin dependencias (`mammoth`, `unzipper`+XML). Esto es específicamente para **renderizar visualmente una slide/página como imagen** (necesario para OCR de slides complejas o vista previa fiel) — ningún parser puro JS/Python reimplementa el motor de layout de Office; es un límite técnico real, no de lenguaje.

**Jerarquía de motores (mismo patrón de interfaz reemplazable que `capability.matrix.js`):**

- [ ] **Motor A — Aspose.Slides / Aspose.Words (vía Node.js o Python), piso garantizado:** librería con motor de renderizado propio embebido, sin depender de Office/LibreOffice instalados — funciona out-of-the-box para el 100% de los usuarios, incluso si no tienen nada más instalado
- [ ] **Pendiente real de A — costo de licencia:** Aspose es comercial; evaluar versión de evaluación (con marca de agua) durante desarrollo vs. licencia completa más adelante. No es decisión de monetización del producto — es costo de la librería en sí, independiente de si Tempest se vende o no. Revisar cuando se llegue a implementar, no bloquea anotarlo ahora
- [ ] **Motor B — LibreOffice (`soffice --headless`), alternativa seleccionable:** aparece como opción en el selector solo si Tempest detecta LibreOffice instalado en el equipo del usuario; el usuario puede elegir usarla en vez de A si prefiere
- [ ] **Motor C — Office vía COM Automation (Windows-only), alternativa seleccionable:** mismo criterio que B — solo aparece si Office está instalado/activado en esa máquina; sin login, sin nube, sin Microsoft Graph API, usa la instalación local ya existente
- [ ] Si no hay B ni C detectados, el usuario se queda con A sin que nada se rompa — A nunca depende de lo que tenga instalado el usuario
- [ ] Selector de motor en menú de configuración: A siempre visible, B/C visibles solo si fueron detectadas
- [ ] Riesgo conocido a investigar en Motor C: procesos zombie de Word/Excel si la sesión COM no se cierra correctamente — manejo cuidadoso de lifecycle, no es un cambio menor
- [ ] Evaluar si tiene sentido fusionar con el pendiente existente "LibreOffice headless para mejor extracción" (sección Adjuntos) en vez de mantenerlos separados

### 🏗️ Empaquetado Electron — pendientes
- [ ] Incluir binarios `@node-llama-cpp/win-x64-cuda` automáticamente en el build
- [ ] `MODELS_DIR` configurable desde UI de primer arranque
- [ ] Instalador silencioso de Ollama para visión multimodal
- [ ] Desinstalar Docker completamente del flujo de desarrollo

### 🤖 Compatibilidad de modelos con node-llama-cpp
- [ ] Reactivar `gemma-2-9b-q4` en `capability.matrix.js` cuando node-llama-cpp corrija CUDA error con arquitectura Gemma 2
- [ ] Investigar compatibilidad de otros modelos (phi-3, llava) con node-llama-cpp
- [ ] **Bug: `deepseek-coder-6.7b-q6` (alias `coder-patch`) falla con `InsufficientMemoryError: A context size of 16384 is too large for the available VRAM`** al activarse Patch Mode — reproducible incluso en sesión recién abierta (RTX 4070). Mismo patrón ya resuelto antes en `hermes-q5` (8192→6000) y `qwen2.5-14b` (→6144): bajar `context_size` de `deepseek-coder-6.7b-q6` en `token.profiles.js` a un valor que entre en la VRAM disponible.
---

### 🏷️ Renombrado automático — pulido (vX.x)

**Síntoma:** títulos con palabras basura ocasionales: fragmentos como "como", "se", o palabras cortadas ("hab" de "habla", "Matemáticas Suma hab").

**Estado:** mitigado pero no 100%. El prompt few-shot con patrón `→` hace ~90%; `cleanGeneratedTitle` (blacklist + detección de frases con verbos) limpia el resto.

**Tareas:**
- [ ] Limpiar fragmentos sueltos al final del título (palabras de ≤3 caracteres que no son palabras completas).
- [ ] Ajustar más el prompt. Preferencia: mejorar el prompt sobre ampliar la blacklist.

**Prioridad:** baja. Los títulos son funcionales y descriptivos en la mayoría de los casos.
