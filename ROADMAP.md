# 🧩 Tempest - Roadmap

## 🚧 Estado actual

Versión actual: **v3.0.0**

Sistema funcional con:

- **Estabilización final pre-release público (v3.0.0)** — ronda completa de pruebas de
  regresión antes de hacer pública esta versión. Embeddings migrados de Ollama a
  node-llama-cpp directo (`embed.provider.js`/`generate-embeddings.js`, modelo dedicado
  `nomic-embed-text-v1.5.Q4_K_M.gguf` ~80MB, carga perezosa e independiente del modelo de
  chat) — Ollama deja de ser requisito para cualquier función de Tempest. GGUF de
  `deepseek-coder-6.7b-q6` reemplazado (TheBloke → QuantFactory) por degradación de tokenizer;
  fix de chat wrapper (ChatML → Alpaca) para ese mismo modelo; fix de contención de VRAM en
  `generateTitleFromText` con `deepseek` activo; validación de sintaxis post-apply
  (`vm.Script`) en `apply.service.js` que bloquea escritura si el patch generado queda
  sintácticamente inválido; zoom manual del chat con Ctrl+/Ctrl-/Ctrl+0 (`before-input-event`
  en `shell/main.js`, el accelerator nativo de Electron no disparaba confiable); fix del gate
  semántico de Patch Mode que forzaba edición ante preguntas puramente informativas
  (`mode.router.js` ahora excluye mensajes con trigger de explicación); logger de errores
  centralizado (`backend/utils/logger.js`) que persiste todo error/warning del backend a
  `errors-YYYY-MM-DD.jsonl` (antes solo iban a consola, invisibles en el `.exe` empaquetado),
  con botón "Abrir carpeta de logs" en Configuración → Preferencias gateado a usuarios con rol
  admin. Ver DECISIONS.md
- **Corrector ortográfico nativo en el input del chat (v2.19.1)** — `spellcheck: true` en Electron; subrayado rojo + sugerencias por click derecho, sin autocorrección forzada
- **Patch Mode inteligente + "modo Proyecto" (v2.19.0)** — Patch Mode se activa automáticamente
  por verbo + archivo mencionado, o por relevancia semántica del mensaje contra los embeddings
  del snapshot (sin necesitar verbo ni nombre de archivo), además de los triggers explícitos ya
  existentes; salvaguarda automática ante `InsufficientMemoryError` con reintento de contexto
  reducido; fix del botón "Aplicar" que no funcionaba en Electron; fix del chat placeholder
  `'default'` que nunca se promovía a un chat real dentro de un proyecto. Ver DECISIONS.md
- **Perfiles de búsqueda con aislamiento real de credenciales (v2.18.0)** — cada perfil (incluido Perfil Global) y cada usuario "sin perfil" tiene su propia config de providers/API keys, 100% independiente; crear/eliminar perfiles y reasignar usuarios desde Servicios; panel Servicios/Usuarios se refresca al entrar a la pestaña sin reiniciar la app. Ver DECISIONS.md
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
- **Preprocesado de imagen con jimp** — `preprocessor.js` como interfaz reemplazable (grayscale + normalize + upscaling), mejora de confianza OCR 77%→87% (v2.2.3; migrado de sharp a jimp en v2.18.1, sin dependencias nativas)
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
- **Diseño de tool use / function calling documentado (v2.17.1)** — evaluación y diseño acordado para snapshot/carpeta vinculada agénticos vía `node-llama-cpp` function calling; sin implementar todavía, ver DECISIONS.md y sección "🎯 v5.0" más abajo

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

## 🧩 v2.0.3–v2.0.11 — Modularización frontend ✅
- [x] Separar `contextFiles.js` — modal de context files + snapshot + toggle + browse (v2.0.3)
- [x] Separar `projectConfig.js` — modal de configuración del proyecto (v2.0.4)
- [x] Separar `transcription.js` — modal de transcripción (v2.0.5)
- [x] Separar `chat.js` — lógica de envío y creación de chats, extraído de `app.js` (v2.0.7)
- [x] Separar `streaming.js` — `createStreamingBubble`, `finalizeStreamingBubble`, extraído de `ui.js` (v2.0.7)
- [x] Separar `autoRename.js` — renombrado automático con IA, extraído de `app.js` (v2.0.8)
- [x] Separar `patchRenderer.js` — diff rojo/verde, botón aplicar, extraído de `ui.js` (v2.0.9)
- [x] Separar `codeRenderer.js` — bloques de código terminal, extraído de `ui.js` (v2.0.10)
- [x] Separar `messageRenderer.js` — mensajes, links, acciones, extraído de `ui.js` (v2.0.11)
- [x] CSS separado en archivos por responsabilidad: base, layout, chat, sidebar, modals, diff, components
- [x] `app.js` queda solo como orquestador
- [x] `ui.js` queda solo con funciones base de DOM

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

## 🖼️ v2.2.0–v2.2.3 — OCR con tesseract.js ✅
- [x] Imágenes sueltas (PNG, JPG, WEBP) → extraer texto impreso (v2.2.0)
- [x] PDFs escaneados → OCR página por página con Poppler (v2.2.1)
- [x] DOCX con imágenes embebidas → extraer texto de imágenes internas (v2.2.2)
- [x] Preprocesado con `sharp` — `preprocessor.js` como interfaz reemplazable (v2.2.3)

---

## 👁️ v2.3.0 — Análisis visual con modelo multimodal ✅
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

---

## 👁️ v2.4.0 — Perfil visual laptop con LLaVA ✅
- [x] `llava.yaml` carga correctamente en LocalAI laptop con `gpu-layers: 35` (RTX 4050, 6GB VRAM)
- [x] `capability.matrix.js` laptop → alias `visual` → `llava-1.6` funcionando
- [x] `vision.service.js` funciona igual con LLaVA que con Qwen2.5-VL (mismo contrato)
- [x] `max_tokens` calibrado para LLaVA en laptop — ajuste de `repeat_penalty`/`frequency_penalty` (LLaVA tiende a loops)
- [x] Análisis visual probado en laptop con imagen real
- [x] Pipeline OCR completo verificado en laptop — imágenes, PDF escaneado, DOCX con imágenes
- [x] `HARDWARE_PROFILE = 'laptop'` confirmado en `chat.controller.js` al usar la laptop
- [x] Diferencias de comportamiento LLaVA vs Qwen2.5-VL documentadas
- [x] Laptop profile mantenido ligero y estable — `qwen2.5-3b-q5`, `llama-3.2-3b-q4`, `qwen2.5-coder-3b-q8`
- [x] Routing inteligente evita modelos pesados en laptop
- [x] Patch Mode funcional en laptop con modelos 3B

---

## 🛠️ v2.4.3–v2.4.7 — Modo Desarrollador (Dev Panel) — base ✅
Panel de debug visible solo para perfil `admin`, transversal a todo Tempest.
- [x] Panel lateral con información de cada request: modelo usado, modo, variante, `truncated`, perfil hardware (v2.4.3)
- [x] Indicador de hardware profile activo (desktop/laptop) visible en el frontend (v2.4.3)
- [x] Control de acceso por rol admin/user (`ADMIN_MODE` en `.env`, contrato `GET /me`) (v2.4.3)
- [x] Duración real del stream por request en el panel (ms, rojo si >5000ms) (v2.4.5)
- [x] Tokens entrada estimados (prompt completo real / 4) y tokens salida (chars generados / 4) (v2.4.5)
- [x] `finish_reason` real del modelo (v2.4.5)
- [x] Toggle de modo debug desde el frontend sin reinicio — modal ⚙ en sidebar (v2.4.6)
- [x] Logs estructurados en backend por request — JSONL rotado por día en `backend/logs/requests-YYYY-MM-DD.jsonl` (v2.4.7)

---

## 🔐 v2.4.8–v2.4.11 — Autenticación real + gestión de usuarios ✅
- [x] **Login real admin/user (v2.4.8)** — JWT con sliding expiration (2h), bcrypt, pantalla de login
- [x] **Gestión de usuarios en UI (v2.4.9)** — listar, crear y eliminar usuarios desde el modal ⚙. Separación HTML en `settings.html`
- [x] **Cambiar contraseña y rol (v2.4.10)** — cada usuario cambia su propia contraseña; admin cambia contraseña y rol. Revocación de tokens al cambiar rol
- [x] **Indicador visual OCR (v2.4.11)** — badge ⚠ en chips de adjuntos OCR-risky, badge rojo en mensajes con error real
- [x] **Label de modelo con tipo (v2.4.11)** — el header muestra el tipo del modelo activo: `[general]`, `[visual]`, `[código]`, `[razonamiento]`, `[análisis]`
- [x] **Debug panel en modo visual (v2.4.11)** — métricas de requests visuales (LLaVA/Qwen-VL)

---

## 📊 v2.5.0 — Profiling GPU + métricas LocalAI ✅
- [x] Sección GPU en Dev Panel (temperatura, VRAM, utilización) con polling cada 5s
- [x] Tokens acumulados por modelo desde endpoint `/metrics` de LocalAI

---

## 🌐 v2.6.0–v2.7.0 — Búsqueda web con SearXNG + Tavily ✅
- [x] Contenedor SearXNG en Docker (puerto 8081)
- [x] `search.service.js` — interfaz reemplazable con providers
- [x] `searxng.provider.js` — activo, JSON API, timeout 8s, máx 5 resultados
- [x] `brave.provider.js` — stub
- [x] Botón 🌐 dinámico en toolbar
- [x] Settings admin — toggle global, URL, test de conexión
- [x] Settings usuario — selector de provider (visible si hay 2+ activos)
- [x] Anti prompt-injection — `sanitizeSnippet()`, 400 chars máx por snippet
- [x] Rate limiting — 3s por usuario
- [x] Query mínima 8 chars — evita búsquedas sin sentido
- [x] `maxTokens: 350` con búsqueda activa — evita loops
- [x] Queries registradas en logs JSONL
- [x] Fix prompt global — reordenado, regla "nunca firmar respuestas"
- [x] Pipeline visual + búsqueda (v2.7.0) — descripción de Qwen2.5-VL como query, segundo pase con modelo de texto, identificación de juegos/lugares/productos
- [x] Botón 🌐 sin recarga (v2.7.0) — `initWebSearch()` se re-ejecuta al guardar config
- [x] Tavily provider (v2.7.0) — `include_answer: true`, snippets 800 chars, 1,000/mes gratis

---

## 🖥️ v2.8.0–v2.8.1 — Electron Fase 1 (shell sobre Express) ✅
- [x] `shell/main.js` — lanza `backend/server.js` con `child_process.fork`, espera `GET /health` (polling 30×500ms), abre `BrowserWindow` en `http://localhost:3005`
- [x] `shell/preload.js` — `contextBridge` mínimo (`electronAPI.isElectron`)
- [x] `package.json` raíz — `main: shell/main.js`, scripts `start`/`dev`/`build`, `electron` + `electron-builder`
- [x] Endpoint `GET /health` en `server.js` — señal de arranque para el shell
- [x] Links externos se abren en el navegador del sistema (`setWindowOpenHandler` + `shell.openExternal`)
- [x] Botón detener respuesta — `AbortController` corta el fetch, texto parcial se conserva
- [x] Bloqueo de UI durante el stream — flag `_isSending` bloquea navegación mientras la IA responde
- [x] Fix historial del asistente — la respuesta se persiste en `chatHistory` al terminar el stream
- [x] Label de modelo unificado — trigger usa solo nomenclatura de `MODEL_PROFILES`
- [x] Selector nativo de carpetas (v2.8.1) — `dialog.showOpenDialog` via IPC, fallback a `/fs/browse` en navegador
- [x] Fix auth en modal de context files (v2.8.1) — fetch de snapshot ahora envían JWT via `authH()`
- [x] Fix duplicados en drag & drop (v2.8.1) — listeners limpiados con `cloneNode+replaceWith`

---

## 👥 v2.9.0 — Permisos de búsqueda por usuario/perfil ✅
- [x] Panel Settings rediseñado con navegación lateral
- [x] Campo `searchProviders: ['searxng', 'tavily']` en `users.json` por usuario
- [x] `/search/config` filtra providers según usuario autenticado
- [x] Toggles de providers en la fila de cada usuario (Settings admin)
- [x] Selector de provider en Settings usuario — solo muestra lo asignado, oculto si hay solo uno
- [x] Perfil Global para grupos de usuarios, `searchEnabled` por usuario
- [x] Regla global — si admin desactiva un provider, se deshabilita para todos independientemente de permisos individuales

---

## 🖥️ v2.10.0 — Migración a node-llama-cpp ✅
- [x] Motor de IA migrado de LocalAI+Docker a node-llama-cpp nativo — bindings C++/Node.js, GPU via CUDA, compatible con GGUF existentes
- [x] Streaming token a token real vía callback→AsyncGenerator
- [x] Cambio dinámico de modelos con `switchModel()`
- [x] `vision.service.js` migrado de LocalAI a Ollama — modelos registrados con Modelfiles, mmproj incluido para multimodal real
- [x] Bug de respuestas duplicadas resuelto — `memory.addChatHistoryMessage` centralizado en el controller, flags `streaming`/`reloading` en chatBox
- [x] Electron Builder portable — ejecutable `Tempest IA.exe` generado, binarios CUDA de node-llama-cpp incluidos manualmente, `MODELS_DIR` configurable vía env
- [x] Migrar SearXNG Docker a Tavily/Brave como providers principales — sin contenedor externo

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

### 💬 Acciones por mensaje

- [ ] Mostrar opciones de acción al seleccionar texto manualmente
- [ ] Activar edición de consultas del usuario
- [ ] Activar compartir respuestas
- [ ] Activar intentar nuevamente en respuestas de Tempest

### 🧭 Router de modos (`mode.router.js`)

- [x] **`CODER_STRICT_TRIGGERS` matchea por substring, sin límite de palabra —
  falso positivo confirmado en pruebas de v3.0.0.** El trigger `'crea'` está
  pensado para pescar pedidos de código ("crea un componente"), pero
  `text.includes('crea')` también matchea cualquier palabra que lo contenga
  como substring — `"crear"`, `"increíble"`, `"recrea"`, etc. Reproducido en
  vivo: el mensaje *"puedes crear un docuemnto en formato DOCX de la segunda
  gerra mundial"* (una pregunta de historia, sin nada de código) cayó en
  `mode: 'coder', variant: 'strict'` por la palabra "crear", cargó
  `qwen2.5-coder-3b-q8` (el modelo de código) y como era de esperar respondió
  mal — texto plano genérico en vez de código, y encima con errores
  históricos y cortado a mitad de palabra (síntoma aparte: un modelo de
  código sin bloques de código que generar simplemente completa lo que
  puede). Mismo riesgo aplica a varios triggers más de la lista sin espacio
  de borde (`'genera'`, `'agrega'`, `'añade'`, `'modifica'`, `'actualiza'`) —
  no se auditaron todos todavía. **No es una regresión de v3.0.0** —
  `mode.router.js` no se tocó en ninguno de los cambios de esta versión — pero
  quedó expuesto por casualidad probando otra cosa (generación de
  documentos). Fix probable: exigir límite de palabra (`\bcrea\b` o
  equivalente con regex) en vez de substring plano, mismo patrón que ya usan
  `'lee '`/`'ruta '`/`'archivo '` en la propia lista (espacio final a
  propósito) — pero ese patrón no cubre el caso de que la palabra matcheada
  sea la ÚLTIMA del mensaje. Requiere revisar toda la lista, no solo
  `'crea'`, y confirmar que el fix no rompe los casos que sí debe atrapar
  (`"crea un componente React"` tiene que seguir yendo a `coder`).
  **Arreglado — ver DECISIONS.md → "Router de modos: `CODER_STRICT_TRIGGERS`
  matcheaba por substring, sin límite de palabra".**

### 🌐 Búsqueda web

- [x] **Fallo de búsqueda web 100% silencioso — el usuario ve una respuesta
  desactualizada sin ningún aviso de que la búsqueda falló.** Reproducido en
  vivo: usuario con búsqueda web activa (provider SearXNG) preguntó "¿cuál es
  la versión más reciente de Node?" y Tempest respondió "Node.js 18"
  (desactualizada) sin decir en ningún momento que no pudo buscar. El log
  muestra la causa exacta: `[search] Error en provider "searxng": fetch
  failed` — casi seguro porque el contenedor Docker de SearXNG
  (`docker/docker-compose.yml`) no estaba corriendo en esa máquina. Confirmado
  que `shell/main.js` NUNCA levanta ese contenedor solo — es 100% manual
  (`docker compose up` aparte), y nada en la UI le avisa al usuario que hace
  falta.
  - **Dos problemas separados, cada uno con su propio fix:**
    1. **Infraestructura** — si la búsqueda web depende de un contenedor
       Docker que hay que arrancar a mano en una terminal aparte, en la
       práctica NUNCA va a estar disponible en una demo salvo que alguien se
       acuerde de levantarlo antes. Para un `.exe` "portable" pensado para
       instalarse y listo, esto es una dependencia externa invisible.
    2. **Software** — el bug real, independiente de si SearXNG está arriba o
       no: `search()` en `search.service.js` atrapa CUALQUIER error del
       provider (`catch (e) { console.error(...); return []; }`) y
       `formatResultsAsContext([])` devuelve `''`. El resultado:
       `webSearchContext` queda vacío y `chat.controller.js` arma
       `finalMessage = baseMessage` — el mensaje del usuario tal cual, SIN
       ninguna instrucción de que la búsqueda se intentó y falló. El modelo
       no tiene forma de saber que debería avisar "no pude verificar esto en
       tiempo real" — contesta con su conocimiento de entrenamiento como si
       nunca se le hubiera pedido buscar. Mismo patrón de "error real
       silenciado en vez de propagado" que ya se corrigió esta versión en
       transcripción (`processAudioTranscription`) y en el pipeline de
       imágenes — acá quedó pendiente.
  - **Punto 2 (software) arreglado — ver DECISIONS.md → "Búsqueda web: fallo
    del provider era indistinguible de 'búsqueda deshabilitada'".** `search()`
    ahora devuelve `{ results, error }` y `chat.controller.js` inyecta una nota
    corta cuando hubo error, avisándole al modelo que no pudo buscar.
  - **Punto 1 (infraestructura — auto-arrancar el contenedor Docker de
    SearXNG) sigue sin implementar, a propósito.** Alcance descartado
    explícitamente al aprobar el fix de arriba, por ser comparable en tamaño
    al proyecto completo de detección de visión — queda para una versión
    futura si se decide depender de SearXNG por default.

### 🧹 Log `[CONFIG]` con `hardwareProfile` inerte

- [ ] **`chat.controller.js` línea ~323 imprime `config.hardwareProfile`
  tomado de `req.body.config` (lo que manda el frontend en cada request), no
  de la fuente real (`readHardwareProfile()`, backend). En una prueba real se
  vio el log con `hardwareProfile: 'desktop'` en una laptop, mientras el
  resto del pipeline (MODEL ROUTER, modelo cargado) usó correctamente
  `laptop` — confirmado que ese campo del log NO se usa para enrutar nada,
  solo confunde al leer logs.** No es un bug funcional, es cosmético. Fix
  probable: sacar `hardwareProfile` del objeto que se loguea en `[CONFIG]` (ya
  se loguea el valor real más abajo, `hardware: hardwareProfile`, en
  `MODEL ROUTER DEBUG`) o renombrarlo para dejar claro que es el valor crudo
  del payload del frontend, no el efectivo. No implementado — solo
  documentado, mismo criterio que el resto de esta sección.
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
- [x] **Parche `maxFileSize` de Carpeta vinculada** — subido de 5MB a 100MB en `DEFAULTS` (`linked-folder.service.js`); el límite anterior excluía silenciosamente libros/PDFs reales de tamaño normal. Solución rápida intencional — la solución real (chunking + selección por relevancia) queda diseñada y pendiente bajo tool use (ver v5.0 más abajo y DECISIONS.md)
- [x] **Fix log de escaneo truncado engañoso** — `generateLinkedFolderIndex()` calculaba `truncated` como una sola condición combinada y el `console.warn` siempre culpaba a `maxFiles` sin importar la causa real; ahora se trackean `oversizedCount` y `truncatedByCount` por separado y se reporta la causa real (tamaño / cantidad / límite de recorrido) en el mensaje
- [x] **Diseño de tool use / function calling documentado (sin implementar)** — evaluación completa y diseño de UI acordado para hacer agénticos Context Snapshot y Carpeta vinculada vía `node-llama-cpp` function calling; registrado en DECISIONS.md y como pendientes de v5.0 (ver sección "🤖 Tool use / function calling" más abajo)

---

## 🎯 v2.18.0 — Instalador real listo para distribuir + perfiles de búsqueda independientes ✅

- [x] **Auto-actualizaciones con `electron-updater`** — revisión 100% manual desde botón
      "Revisar actualizaciones" en Configuración → Preferencias (spinner mientras consulta,
      modal con el resultado — actualizar a vX o "no hay actualizaciones"), lee `latest.yml`
      del repo público en GitHub Releases (sin token). Nada se descarga sin confirmación
      explícita del usuario en el modal; prompt "Reiniciar ahora / Más tarde" al terminar de
      bajarla. Solo funciona empaquetado. Pendiente: probar un release real de punta a punta
      (ver DECISIONS.md)
- [x] **Descarga automática de modelos al primer arranque** — `hermes-q4` + Whisper
      `large-v3` (los dos "requeridos") se descargan solos si faltan, con checksum sha256
      verificado, antes de cargar el modelo; el resto del catálogo se descarga a mano desde
      Configuración → Modelos. Ver DECISIONS.md para el detalle completo. **Pendiente:**
      smoke test end-to-end real (no se pudo ejecutar en el sandbox de desarrollo —
      dependencia nativa `sharp` incompatible) y completar `url`/`sha256` de los 13 modelos
      opcionales que quedaron sin fuente confirmada
- [x] **Perfil de hardware para el "requerido" del primer arranque** — `getRequiredModelIdsForProfile(profile)`
      en `models.catalog.js` resuelve el modelo vía `capability.matrix.resolve('general-fast', profile)`
      (`hermes-q4` en desktop, `qwen2.5-3b-q4` en laptop) en vez de bajar siempre el modelo
      pesado sin importar la VRAM disponible. Perfil elegido en Configuración → Preferencias
      o precargado por `build/installer.nsh` en el primer install; panel Configuración →
      Modelos filtra por perfil. Ver DECISIONS.md → "Perfil de hardware: laptop no debe bajar
      hermes-q4". **Pendiente:** `build/installer.nsh` no está compilado/probado en un build
      real de Windows
- [x] **Instalador con selector de carpeta + aviso de reinstalar/actualizar** — vuelta a
      `oneClick: false` (wizard con página de carpeta, `allowToChangeInstallationDirectory`)
      ahora que la migración a `app.getPath('userData')` eliminó el riesgo real de EPERM en
      Program Files; default sigue siendo instalación per-user sin admin
      (`selectPerMachineByDefault: false`). `build/installer.nsh` avisa antes de instalar si
      ya hay una versión previa: "reinstalar" (misma versión) o "actualizar" (versión más
      vieja). Pendiente: probar que compile en un `npm run build` real en Windows (ver
      DECISIONS.md)
- [x] **Instalador — opción de descargar e instalar CUDA Toolkit** — segunda página custom
      en `build/installer.nsh`, después de la de perfil de hardware; detecta `CUDA_PATH`
      (variable que setea el instalador de NVIDIA); si falta, ofrece abrir la página de
      descarga de NVIDIA en el navegador — la descarga/instalación automática se intentó
      primero (`NSISdl` + ejecutar el instalador oficial), pero se abandonó tras fallar en
      pruebas reales (se quedaba colgado en "Connecting..."), ver DECISIONS.md. Nunca bloquea
      ni condiciona la instalación de Tempest. **Pendiente:** sin compilar/probar en Windows
      real — la URL de descarga hay que revisarla antes de cada build, NVIDIA la rota con
      cada release
- [x] **Renombre de perfiles de hardware: Breeze (laptop) / Storm (desktop)** — reemplaza
      "Light"/"Max" en instalador, Configuración y toda la documentación; claves internas
      siguen siendo `'laptop'`/`'desktop'`, sin cambio de comportamiento
- [x] **Modelos de razonamiento/análisis para Breeze** — `phi-4-mini-reasoning` y `qwen3-8b`
      agregados al catálogo descargable de laptop, verificados vía API de Hugging Face
      (sha256/tamaño reales, no adivinados); `phi-3-mini-q4` (redundante, cubierto por
      opciones mejores ya en el router automático) eliminado del catálogo
- [x] **Fix: menú de modelos locales del chat mostraba siempre desktop** — `renderLocalModels()`
      se llamaba antes de que `initHardwareProfile()` resolviera el perfil real; ahora se
      refresca también al cambiar de perfil en Preferencias (evento `hardwareprofile-changed`)
- [x] **Se elimina el modo "todos los usuarios" del instalador** — bug real encontrado:
      `SetShellVarContext all` (modo per-machine) redirige `$APPDATA` a una ubicación que
      Electron nunca lee (`app.getPath('userData')` siempre resuelve per-user), perdiendo
      silenciosamente el perfil de hardware guardado. Resuelto forzando instalación per-user
      siempre (`customInstallMode`), en vez de arreglar el mismatch — ver DECISIONS.md para
      los pasos exactos si se necesita reintroducir per-machine en el futuro
- [x] **Perfiles de búsqueda con aislamiento real de credenciales** — cada perfil (incluido
      Perfil Global) y cada usuario "sin perfil" tiene su propia config de providers/API keys
      en `search-config.json` (`{ profiles, userConfigs }`), 100% independiente; crear/eliminar
      perfiles y reasignar usuarios desde Servicios (`GET/POST/DELETE /search/profiles`,
      `GET/PATCH /search/record`, `PATCH /search/user-profile`); "Probar conexión" prueba un
      registro puntual, nunca escala por usuarios vinculados a un perfil. De paso se corrigió
      un bug de fondo: la búsqueda web en tiempo real de chat ignoraba por completo el
      perfil/usuario que preguntaba y siempre usaba una config compartida. Ver DECISIONS.md
      para el detalle técnico completo
- [x] **Fix: panel Servicios/Usuarios no se refrescaba sin reiniciar la app** — la carga de
      datos (perfiles, usuarios) se separó del registro de listeners de los botones; ahora se
      refresca cada vez que se entra a esa pestaña del modal de Configuración, no solo una vez
      al arrancar la app

---

## 🎯 v2.18.1 — Migración de sharp a jimp ✅

- [x] **`preprocessor.js` migrado de sharp a jimp** — mismo pipeline (grayscale + normalize +
      upscaling), mismo contrato `preprocessImage(inputPath) → { outputPath, wasProcessed }`,
      sin cambio de comportamiento visible
- [x] **`vision.service.js` migrado de sharp a jimp** — resize shrink-only a 1024×1024 (guard
      manual porque jimp no tiene `withoutEnlargement` nativo) + export JPEG quality 70, mismo
      contrato `describeImage(filePath, hint) → { description, model }`
- [x] **`sharp` eliminado del proyecto** — quitado de `package.json`, `jimp@1.6.1` agregado,
      `package-lock.json` regenerado. Sin binarios nativos que dependan de `electron-rebuild` en
      el pipeline de OCR/visión. Ver DECISIONS.md para el detalle completo, alternativas
      evaluadas y pendiente de validar el benchmark de confianza OCR con la implementación nueva
- [x] **Probado con adjunto real** — imagen de baja resolución subida vía UI: OCR con confianza
      95% (`preprocessor.js`/jimp), sin warnings en consola
- [x] **Fix: `InsufficientMemoryError` cargando `llava-1.6` en modo visual (perfil laptop)** —
      encontrado durante las pruebas de arriba, no relacionado con la migración a jimp. Segundo
      camino de visión (mode.router → modelo GGUF vía node-llama-cpp, distinto del camino
      OCR-fallback → Ollama). `context_size` de `llava-1.6` bajado de 4096 a 2048 en
      `token.profiles.js`, mismo criterio que el fix ya aplicado a `deepseek-coder-6.7b-q6`.
      **Confirmado en la máquina real** — el usuario repitió la prueba y `llava-1.6` respondió
      bien, sin error. Ver DECISIONS.md
- [x] **Fix: `generateTitleFromText` no excluía modelos de visión de la contención de VRAM** —
      con `llava-1.6` activo, el intento de generar título en paralelo (contexto de 512 tokens)
      tiraba el mismo `InsufficientMemoryError`. `isHeavyModel` en `localai.service.js` ahora
      también excluye `llava`/`vl-7b`, mismo criterio preventivo que ya existía para modelos 14B.
      **Confirmado en la máquina real** — log limpio, sin el error. Ver DECISIONS.md
- [x] **Fix: título de chat ilegible cuando no hay texto de usuario** — al adjuntar solo una
      imagen (sin escribir nada), el fallback de título usaba el nombre de archivo crudo sin
      separar palabras: `"test_ocr_recibo.png"` → `"testocrrecibopng"`. `buildFallbackTitle` en
      `localai.service.js` ahora separa por `_`/`-`/`.`/extensión antes de limpiar, y capitaliza
      el resultado → `"Test ocr recibo"`. **Confirmado en la máquina real** — título final del
      chat: "Test ocr recibo". Ver DECISIONS.md → nota de diseño: usar la descripción visual real
      como fuente del título en vez del nombre de archivo sería la mejora de fondo, candidato
      para v3.0/v4.0
- [x] **Confirmado: `npm run build` (electron-builder) completa sin errores de binarios
      nativos** — la prueba que responde a la razón original de toda esta migración. Build real
      en Windows generó `Tempest IA Setup 2.18.0.exe`, firmado, sin un solo error de
      `electron-rebuild`. El pendiente original de v2.2.3 queda cerrado de raíz. (En el camino,
      un `EACCES` en `node_modules\.bin\mime` no relacionado con sharp/jimp — causado por correr
      `npm install`/`uninstall` desde el entorno de desarrollo Linux contra la carpeta montada en
      Windows; resuelto reinstalando `node_modules` directo desde PowerShell. Ver DECISIONS.md)

---

## 🎯 v2.19.0 — Patch Mode inteligente: detección automática + "modo Proyecto" ✅

Cierra los dos pendientes reales de v3.0 y da el primer paso hacia que Tempest asuma, dentro
de un proyecto, que los mensajes se refieren a ese proyecto. Ver DECISIONS.md para el detalle
completo de cada decisión, alternativas descartadas y datos de prueba.

- [x] **Detección automática de Patch Mode por verbo + archivo** — `mode.router.js` reconoce
      mensajes como "corrige el bug de restar en calculator.js" sin necesitar frase mágica,
      cuando el proyecto tiene Context Snapshot activo (`hasProjectContext`)
- [x] **Salvaguarda automática ante `InsufficientMemoryError`** — `chat.controller.js`
      reintenta una vez con la mitad del `contextSize` si el modelo se queda sin VRAM al crear
      el contexto, sin recargar el modelo. Validado en vivo con valores de VRAM inducidos
      (16384 ok, 24576→12288 recupera, 65536→32768 no alcanza) — ver DECISIONS.md
- [x] **Fix: botón "Aplicar" de Patch Mode nunca funcionaba en Electron** — `patchRenderer.js`
      armaba su propio `fetch` sin `BASE_URL` ni JWT, quedó afuera de las migraciones de
      v2.8.1/v2.11.0 que corrigieron el resto del frontend. La request nunca llegaba al backend
      — por eso no dejaba rastro en los logs
- [x] **Fix: chat "fantasma" del proyecto** — `chatId: 'default'` (el placeholder que crea
      `createProject()`) se trataba como un chat real ya existente; nunca se creaba un chat
      nuevo al escribir dentro de un proyecto, y seleccionar la carpeta mostraba el historial
      acumulado de ese chat placeholder en vez de una vista en blanco
- [x] **Resolución de archivo por búsqueda semántica en Patch Mode** — `buildPatchGrounding`
      ya no elige el primer archivo del snapshot a ciegas cuando no hay mención exacta del
      nombre; reusa los embeddings del proyecto (`vector.store.js` + `embed.provider.js`) para
      encontrar el archivo más relevante
- [x] **Arquitectura "modo Proyecto" — gate de intención semántica** — `intent.resolver.js`
      (nuevo, `backend/services/patch/`) consulta los embeddings del snapshot ANTES de decidir
      el modo de respuesta; si el mensaje se relaciona semánticamente con contenido real del
      proyecto por encima de un umbral, activa Patch Mode sin necesitar verbo ni nombre de
      archivo — ej. "quiero que el botón Copiar también copie el Markdown". Umbral (`0.5`)
      instrumentado con logging (`[PATCH INTENT]`), pendiente de calibrar con uso real

---

## 🔤 v2.19.1 — Corrector ortográfico nativo en el input del chat ✅

Cierra el único pendiente que quedaba de v3.0.

- [x] **`spellcheck: true`** en `webPreferences` de la ventana principal (`shell/main.js`) —
      activa el corrector ortográfico nativo de Chromium (Electron no requiere librería externa)
- [x] **`spellcheck="true"`** en el `<textarea id="userInput">` (`frontend/index.html`)
- [x] **Fix: click derecho no mostraba sugerencias** — Electron subraya en rojo pero, a
      diferencia de un navegador normal, no arma ningún menú contextual solo; hubo que
      capturar `webContents.on('context-menu', ...)` en `shell/main.js` y construir el menú
      a mano con `params.dictionarySuggestions` (click en una sugerencia llama a
      `webContents.replaceMisspelling()`) + opción "Agregar al diccionario" + cortar/copiar/pegar
- [x] Comportamiento final: subrayado rojo en palabras mal escritas + sugerencias en el menú
      contextual (click derecho); el usuario corrige manualmente eligiendo una sugerencia —
      sin autocorrección forzada mientras se escribe

---

## 🎯 v3.0.0 — Tempest como sistema operativo contextual de proyectos ✅

Cierra la versión mayor "v3.0" (funcionalidad implementada en v2.19.0/v2.19.1) con la ronda de
estabilización final antes de hacer esta versión pública — validación en vivo de los dos
pendientes "sin probar" de v2.19.0 (resolución semántica de archivo en Patch Mode, umbral del
gate de intención semántica), re-validación de lo ya implementado, y regresión completa del
resto de la app (chat general sin proyecto, contexto semántico en modos no-patch, UI). Durante
las pruebas surgió un requisito de producto nuevo (Ollama nunca debe ser requisito) y varios
bugs reales, todos resueltos en la misma sesión. Objetivo explícito de esta versión: cero
funciones rotas antes de publicarla. Ver DECISIONS.md para el detalle completo de cada
decisión, alternativas descartadas y datos de prueba.

- [x] **Validado: resolución de archivo por búsqueda semántica en Patch Mode** — confirmado con
      proyecto externo de prueba (`H:\Proyectos\Practicas`); encontrado y documentado un sesgo
      real hacia archivos grandes con vocabulario genérico por encima de archivos chicos y
      específicos — limitación inherente del modelo de embeddings, no un bug de
      `vector.store.js` (cosine similarity revisado y correcto)
- [x] **Validado: gate de intención semántica (umbral 0.5)** — confirmado funcionando; mismo
      hallazgo de sesgo que el punto anterior aplica acá también; sin fallback al segundo
      candidato cuando el primero no es el correcto — documentado como limitación conocida
- [x] **Embeddings migrados de Ollama a node-llama-cpp — Ollama deja de ser requisito** —
      `embed.provider.js` y `generate-embeddings.js` reescritos para cargar
      `nomic-embed-text-v1.5.Q4_K_M.gguf` (~80MB) directo vía `node-llama-cpp`
      (`createEmbeddingContext()`/`getEmbeddingFor()`), con carga perezosa e independiente del
      modelo de chat activo; validado corriendo junto al modelo de chat sin OOM (el crash de
      v2.14.0 estaba atado a un modelo pesado, no al enfoque en sí)
- [x] **Fix: GGUF de `deepseek-coder-6.7b-q6` con tokenizer degradado** — conversión de
      TheBloke (repo inactivo) generaba salidas de baja calidad en Patch Mode (diffs
      duplicados, contenido alucinado, renombres inventados); reemplazado por la misma
      cuantización re-convertida por QuantFactory
- [x] **Fix: chat wrapper incorrecto para `deepseek-coder-6.7b-q6`** — `llama.provider.js`
      forzaba `ChatMLChatWrapper` para cualquier modelo "deepseek", pero
      `deepseek-coder-6.7b-instruct` usa template estilo Alpaca, no ChatML; corregido a
      `AlpacaChatWrapper`
- [x] **Fix: `generateTitleFromText` sin excluir `deepseek` de la contención de VRAM** — mismo
      patrón de fix que `llava`/`vl-7b`/14B; `isHeavyModel` en `localai.service.js` ahora
      también excluye modelos con "deepseek" en el nombre
- [x] **Fix crítico: "Aplicar" corrompía archivos con sintaxis inválida sin avisar** — una
      respuesta de patch truncada (sin tokens suficientes) se aplicaba igual, mostrando
      "✓ Aplicado" en verde con el archivo real roto. `apply.service.js` ahora valida sintaxis
      con `vm.Script` (JS/CJS/MJS) ANTES de crear backup o escribir; si es inválida, bloquea
      todo y devuelve el error al frontend (que ya lo mostraba correctamente en rojo, sin
      cambios necesarios ahí)
- [x] **Re-validado: verbo + archivo, botón Aplicar, chat fantasma, spellcheck** — los 4
      features ya implementados en v2.19.0/v2.19.1 siguen funcionando correctamente
- [x] **Re-validado: chat general sin proyecto** — saludo/memoria instantáneos sin tocar el
      modelo (`getCurrentTimeAnswer`/`getControlledMemoryAnswer`/atajo "hola"), router a
      `explain`/`general` correcto, persistencia de historial, renombrado automático de título
- [x] **Fix: Ctrl+/Ctrl- no hacían zoom en la ventana** — causa raíz: nunca se llama
      `Menu.setApplicationMenu()` en `shell/main.js`, así que Electron arma su menú por
      defecto solo; ese menú en teoría ya trae `resetZoom`/`zoomIn`/`zoomOut` con
      acceleradores `CommandOrControl+Plus`/`CommandOrControl+-`/`CommandOrControl+0`, pero el
      token `Plus` del Accelerator no dispara de forma confiable según el layout de teclado
      (problema conocido de Electron/Chromium, no específico de Tempest). Fix: listener
      `before-input-event` sobre `mainWindow.webContents` que llama
      `webContents.setZoomLevel()` directamente; cubre `+`/`=`/`NumpadAdd`,
      `-`/`NumpadSubtract` y `0` (reset), todos con `Ctrl`; rango -6/+6 (~25%–400%)
- [x] **Fix: gate semántico de Patch Mode disparaba con preguntas informativas** — encontrado
      probando el pendiente "contexto semántico en modos no-patch": dentro de un proyecto con
      embeddings, "¿qué hace la función checkEdad?" activaba Patch Mode completo (diff
      SEARCH/REPLACE + botón "Aplicar") en vez de una explicación. Causa raíz:
      `resolvePatchIntent()` (`intent.resolver.js`) mide solo similitud semántica pura, sin
      distinguir "el mensaje está relacionado con este archivo" de "el usuario quiere editarlo"
      — una pregunta específica sobre código real del proyecto da score alto por el simple
      hecho de preguntar sobre él, subir el umbral no resuelve el problema de fondo. Fix:
      `mode.router.js` condición 1c ahora exige además `!hasExplainTrigger(text)` — si el
      mensaje matchea un trigger de explicación existente ("que hace", "como funciona", etc.),
      el gate semántico no fuerza Patch Mode y cae al flujo normal, que ya lo rutea a `explain`
- [x] **Confirmado en vivo** — "¿qué hace la función checkEdad?" ya no dispara Patch Mode
      (sin diff, sin botón "Aplicar"). Cae en `coder/hybrid` en vez de `explain` puro porque el
      mensaje contiene la palabra "función", que también está en `CODER_STRICT_TRIGGERS` — no
      es peligroso (hybrid no escribe archivos), pero es impreciso; anotado como pendiente
      menor más abajo (ver "🩹 Limpieza post-migración")
- [x] **Fix: contexto semántico podía quedar desactualizado sin aviso** — encontrado en la
      misma prueba de arriba: la respuesta mostró `checkEdad` sin el chequeo de edad negativa
      que el archivo real sí tiene. Causa raíz confirmada: todo el pipeline de contexto
      (carpeta vinculada, snapshot, embeddings) es 100% manual/pull-based — se regenera solo
      cuando el usuario aprieta "Actualizar carpeta vinculada"/"generar snapshot", sin ningún
      file watcher ni chequeo de hash/mtime contra el disco real al responder. El archivo se
      había editado un día después de la última generación del snapshot, y `embeddings.json`
      siguió sirviendo el texto viejo sin indicarlo. Fix mínimo: `snapshot.provider.js` ahora
      compara el `mtimeMs` real del archivo en disco contra el cacheado en el manifest antes de
      inyectar cada chunk semántico; si el archivo cambió después de la última generación,
      antepone un aviso explícito al bloque de contexto para que el modelo (y el usuario) sepan
      que puede estar desactualizado. No regenera nada automáticamente — eso sigue siendo
      responsabilidad del usuario, solo deja de fallar en silencio
- [x] **Validado: OCR de imagen suelta + fallback a visión** — imagen de videojuego con HUD
      superpuesto (confianza OCR 35%, por debajo del umbral 60%) activó correctamente el
      fallback a `qwen2.5-vl-7b-q4`; identificó el juego específico (Twilight Princess)
      correctamente. VRAM llegó a 96% (11818/12282 MB) — funcionó, pero queda muy al límite;
      riesgo real para usuarios con menos VRAM, anotado como dato a tener en cuenta antes de
      publicar
- [x] **Fix: prompt de visión nunca pedía transcribir texto en pantalla** — el modelo
      multimodal (`vision.service.js`) solo recibía la instrucción genérica "describe lo que
      ves", así que priorizaba narrar la escena y nunca transcribía texto de HUD/carteles/
      botones aunque fuera legible para él. Se agregó el pedido explícito de transcribir texto
      visible como instrucción adicional (no obligatoria — si no hay texto, no hay nada que
      listar), en ambas variantes del prompt (con y sin `hint`)
- [x] **Fix: imagen "visual" respondida sin ver la imagen — clasificación OCR binaria** —
      encontrado en la prueba de laptop (perfil Breeze, PRUEBA-LAPTOP.md punto 2): una captura
      de videojuego (FFXIV) con HUD sacó 61% de confianza OCR, apenas por encima del umbral
      (60%), y `image.extractor.js` la trató como "documento" — nunca llamó a `describeImage()`.
      `mode.router.js` igual marcó `mode=visual` y cargó `llava-1.6`, pero por el pipeline de
      texto normal (`llama.provider.js`, node-llama-cpp local), que no acepta imágenes: el
      modelo respondió puro texto usando solo el OCR garabateado como contexto, mezclando
      números reales con datos inventados y terminando en un bucle de repetición cortado por el
      límite de tokens — sin ningún aviso de que la imagen nunca se analizó. Mismo patrón ya
      documentado en esta sesión ("algo reportaba éxito/normalidad mientras hacía otra cosa").
      Fix: nuevo router de 3 categorías (`image.classifier.js`) — `document` (OCR solo, como
      antes), `visual` (sin cambios), y `hybrid` (nuevo: `describeImage()` con el texto OCR como
      *hint*, cierra el hueco donde el OCR "ganaba" con texto irrelevante). Ver DECISIONS.md
      para las 3 señales usadas, los umbrales (provisorios) y las alternativas descartadas
- [x] **Pipeline de imágenes separado en etapas, fusión OCR+visión sin LLM** — encontrado tras
      el fix anterior: con `llava-1.6` ya funcionando de verdad, la respuesta mezclaba datos
      reales ("Roy Venedic", "GEAR SET 5") con datos inventados ("Nivel 3" en vez de 83) porque
      la fusión de OCR+visión ocurría *dentro* del prompt del modelo (OCR pasado como `hint`),
      sin control. Se evaluó y descartó agregar un segundo LLM para reconciliar ambas fuentes
      (decisión explícita del usuario: no aporta información nueva, solo arbitra, y suma
      latencia/VRAM/otro punto de falla silenciosa). En su lugar: pipeline de 6 etapas con
      contratos propios (preprocesado → clasificación → OCR → visión → fusión → respuesta),
      nuevo módulo `image.fusion.js` con `fuseImageAnalysis({ category, ocr, vision })` —
      función pura, sin red ni modelos, que extrae "tokens factuales" del OCR por regex y los
      presenta junto a la descripción visual como la fuente más confiable para datos exactos.
      `image.extractor.js` pasa a ser solo el orquestador. Ver DECISIONS.md para el contrato
      completo (objetos completos entre etapas, no campos sueltos, para poder crecer sin romper
      firmas) y las alternativas descartadas
- [x] **Fix: `InsufficientMemoryError` real — el router de modelos cargaba LLaVA para imágenes
      "document"** — encontrado en la ronda de pruebas de laptop con `repeat_penalty` ajustado:
      una captura clasificada correctamente como "document" (88% confianza, solo texto de OCR,
      sin necesidad de visión) igual cargó `llava-1.6`, agotó la VRAM y falló incluso después del
      reintento automático con `contextSize` reducido. Causa: `chat.controller.js` llamaba a
      `detectBestModel()` con el `mode='visual'` que pone `mode.router.js` apenas detecta un
      adjunto de imagen — antes de saber la categoría real —, y nunca lo corregía después de que
      `isVisionResponse` confirmara si la respuesta usó visión de verdad o no. Fix: nuevo
      `modelRouterMode`, que cae a `'general'` cuando `mode==='visual'` pero `isVisionResponse` es
      falso, así el modelo automático es un modelo de texto liviano en vez de LLaVA para
      "document" y para los casos de visión no disponible/fallida (cierra también el pendiente de
      "placeholder de visión no disponible cae en pipeline ciego", ver abajo). Ver DECISIONS.md
- [x] **Confirmado con datos reales: fix de `InsufficientMemoryError` funcionó** — batch de 14
      imágenes repetido tras el fix, la imagen "document" resolvió a `qwen2.5-3b-q5` (cambio de
      quant del modelo de texto ya activo) en vez de `llava-1.6`, sin ningún
      `InsufficientMemoryError` en todo el batch. El rechazo sin sentido y un loop de repetición
      volvieron a aparecer en otras imágenes — confirma que son un problema aparte, no relacionado
      con VRAM. Ver DECISIONS.md
- [x] **Fix: `effectiveMode` — el prompt de sistema seguía diciendo "visual" a un modelo de
      texto** — el usuario detectó, revisando el log del fix anterior, que aunque el router de
      modelos ya recibía `mode='general'` para la imagen "document", `buildSystemPrompt` seguía
      imprimiendo `mode: visual` — el fix anterior (`modelRouterMode`) solo corregía la selección
      de modelo, no `streamOptions.mode` (lo que llega al prompt de sistema). Resultado real: un
      modelo de texto (`qwen2.5-3b-q5`) generaba la respuesta con el prompt de `visual.txt`
      ("sos un asistente especializado en análisis visual... el usuario te compartió una imagen")
      sin haber recibido ninguna imagen. Fix: se subió el cálculo a `effectiveMode`, calculado una
      sola vez junto a `isVisionResponse` y usado tanto en `detectBestModel()` como en
      `streamOptions.mode` — cubre además el caso de modelo manual (antes solo se corregía dentro
      del bloque de selección automática). Ver DECISIONS.md
- [x] **Descartado como bug: doble envío de imagen** — confirmado por el usuario: fue una acción
      manual (primer envío detenido con "stop" antes de terminar de procesar, reenviado después).
      Coincide con la evidencia de código: guard `_sending` de `chat.js` sólido, `sendChatMessage()`
      sin reintento ni segundo call site, sin lógica de reintento en el backend. No era un bug. Ver
      DECISIONS.md
- [ ] **El botón "Detener respuesta" no cancela nada en el backend — encontrado investigando el
      punto anterior** — `abortCurrentStream()` (frontend) solo aborta el `fetch()` del lado del
      cliente: deja de leer el stream SSE. No existe en todo `chat.controller.js` ni en el resto
      del backend ningún `req.on('close')` ni chequeo de cancelación — el pipeline completo (OCR,
      llamada a Ollama para visión, carga/cambio de modelo, generación) sigue corriendo hasta el
      final aunque el cliente ya se haya desconectado, escribiendo a una respuesta que nadie lee.
      Confirmado con el caso real del usuario: "stop" al primer envío + reenvío del segundo no
      canceló el primero — probablemente corrieron dos pipelines completos en paralelo, cada uno
      compitiendo por la misma GPU/VRAM. Plan de fix documentado en "⏹️ Cancelación real de
      generación" (v5.0) — implementado antes de lo previsto, ver siguiente entrada. Ver
      DECISIONS.md
- [x] **Fix: cancelación real del botón "Detener respuesta" (generación de texto)** — resuelto
      antes de lo previsto: `node-llama-cpp` ya trae `stopOnAbortSignal: true`, que corta la
      generación sin tirar error (devuelve el texto parcial como si hubiera terminado normal) —
      no hizo falta escribir el mecanismo de cancelación, solo conectarlo. Cadena completa:
      `chat.controller.js` crea un `AbortController` y escucha `req.on('close')`, el `signal` viaja
      por `streamOptions` hasta `localai.service.js` y de ahí a `llama.provider.js`, que se lo
      suma a `session.prompt()`. NO cubre todavía cancelar OCR/visión a mitad de camino — eso
      sigue pendiente en "⏹️ Cancelación real de generación" (v5.0). Sin confirmar todavía con una
      prueba real de Stop + pregunta siguiente — pendiente ver si esto también hace desaparecer el
      quirk "Soy Tempest." (sección "⏱️ Router de modos"). Ver DECISIONS.md
- [x] **Fix: bloque de tokens OCR (categoría "hybrid") ya no se muestra en el chat** — el usuario
      vio en una respuesta real un bloque tipo log ("Texto detectado en la imagen... el texto
      detectado es la fuente más confiable...") — nota que `image.fusion.js` había escrito pensando
      en un modelo, no en el usuario final, y que llegaba cruda porque ese `content` se transmite
      literal sin pasar por ningún LLM. A pedido del usuario, se sacó del `content` visible; los
      tokens OCR de categoría "hybrid" ahora solo quedan en `meta.ocrTokens`/`ocrTokensOmitted` y
      en el log de consola, no en la respuesta del chat. Ver DECISIONS.md
- [x] **Punto 1 del checklist probado — confirmado: solo se descarga el modelo de chat default +
      Whisper en el primer arranque** (decisión correcta del usuario, no un bug) — pero se
      encontró y arregló un bug real al pedir algo que necesita un modelo NO descargado
      automáticamente (código, explicación profunda, visión)
- [x] **Fix: error real silenciado por el frontend — burbuja vacía sin ningún aviso** — pidiendo
      código en una instalación recién hecha (antes de bajar el modelo de código desde
      Configuración → Modelos), el chat no mostró nada: ni respuesta, ni error. Causa: el modelo
      no estaba en disco (`ENOENT`, esperado), el backend lo atrapó y lo logueó bien
      (`ok:false`), pero como el stream SSE ya estaba abierto solo pudo mandar un evento
      `[ERROR]` — y `frontend/api.js` lo descartaba con un `console.error` + `continue` en vez de
      propagarlo como falla, así que `chat.js` cerraba una burbuja vacía como si todo hubiera
      salido bien. No es un bug específico de modelo faltante: CUALQUIER error después de que el
      stream arranca (crash de generación, VRAM agotada a mitad de respuesta, etc.) tenía el mismo
      síntoma silencioso. Fix: `[ERROR]` ahora lanza una excepción real; `chat.js` la muestra con
      un mensaje específico en vez de caer en el genérico (y en este caso falso) "Sin conexión con
      el backend". De paso, `chat.controller.js` arma un mensaje accionable para este caso puntual
      ("El modelo X todavía no está descargado. Andá a Configuración → Modelos") en vez del
      genérico "Error interno del servidor". Ver DECISIONS.md
- [x] **Punto 3 del checklist probado — cambio de modelo sin fuga de VRAM** — general → código →
      general de nuevo, en el mismo chat: los tres cambios cargaron bien (`Modelo listo ✅`), sin
      degradación ni error en la tercera respuesta. Sin problemas de VRAM
- [x] **Fix: ffmpeg/ffprobe empaquetados — la transcripción no funcionaba en ninguna instalación
      limpia** — probando el Punto 4 (Whisper con modelo de chat cargado), la transcripción falló
      antes de llegar a Whisper: `spawn ffprobe ENOENT`. Causa: `transcription.service.js` y
      `vad.detector.js` invocaban `ffmpeg`/`ffprobe` por nombre, asumiendo que ya estaban
      instalados en el sistema — nunca vinieron empaquetados con Tempest, a diferencia de Whisper.
      Ningún usuario de Windows normal tiene ffmpeg preinstalado — esto rompía la transcripción en
      cualquier instalación limpia, no solo en la laptop. Fix: binarios de
      `@ffmpeg-installer/win32-x64` y `@ffprobe-installer/win32-x64` (npm, LGPL-2.1) copiados a
      `ffmpeg-bin/` (nueva carpeta, hermana de `whisper-bin/`), código actualizado para usar esa
      ruta empaquetada en vez de depender del PATH del sistema. Se bundlea solo, sin tocar
      `package.json` (mismo patrón `files: ["**/*"]` que ya empaqueta `whisper-bin/`). Confirmado
      con prueba real: el corte en fragmentos ya no tira ningún error de ffprobe. Pendiente
      confirmar con un `npm run build` real que efectivamente queda incluido. Ver DECISIONS.md
- [x] **Fix: transcripción con todos los fragmentos fallidos ya no reporta "éxito" con archivo
      vacío** — encontrado confirmando el bug de `whisper-cli.exe` faltante (abajo): con los 5
      fragmentos fallando, el chat igual mostraba "✅ Transcripción finalizada" con un documento
      vacío — mismo patrón que el bug de streaming del chat (error real atrapado por fragmento y
      descartado en silencio, sin nunca propagarse). Se mantiene la tolerancia a que UN fragmento
      puntual falle sin frenar todo (un segmento corrupto no debería tirar la transcripción
      entera), pero si NINGÚN fragmento produjo texto, ahora se lanza un error real — que ya tenía
      manejo correcto aguas abajo (controller + frontend), solo nunca se disparaba. Confirmado con
      prueba real: mismo audio, misma falla de fondo, ahora sí se ve el aviso de error. Ver
      DECISIONS.md
- [x] **`whisper-bin/whisper-cli.exe` no existe en la copia de la laptop — sin mecanismo de
      distribución, bloqueaba el Punto 4 del checklist** — encontrado justo después del fix de
      ffmpeg: la carpeta `whisper-bin/` (binario de ~650MB, compilado a mano contra whisper.cpp +
      CUDA 12.4) está en `.gitignore` desde v2.15.0 y nunca tuvo ningún mecanismo de descarga ni
      de empaquetado — a diferencia de ffmpeg, no era un binario público bajable de un registro
      porque lo había compilado el propio proyecto. `MODELS.md` ya lo señalaba como deuda técnica
      pendiente ("descarga en primer arranque, igual que los GGUF de chat" era la opción
      recomendada, nunca implementada). Pasó desapercibido hasta ahora porque en la desktop
      alguien lo copió a mano alguna vez y nunca se probó clonar el proyecto en una máquina nueva.
      **Fix real:** en vez de seguir manteniendo un binario propio sin mecanismo de distribución,
      se cambió la fuente al build oficial y público de `ggml-org/whisper.cpp` (mismo whisper.cpp,
      mismo CUDA 12.4, publicado por el propio proyecto upstream) y se sumó `whisper-cli` al
      catálogo de descargas (`models.catalog.js`) como requerido, junto al modelo `.bin` — mismo
      mecanismo que ya existe para los GGUF de chat, pero con una diferencia: la fuente es un .zip
      (el .exe viene con sus .dll de CUDA al lado, no es un archivo suelto), así que se le agregó
      soporte a `model.downloader.service.js` para bajar, verificar checksum y extraer un .zip
      completo (tipo `'zip-bundle'`), no solo renombrar un archivo descargado. **Confirmado con
      prueba end-to-end real:** `npm run build` + instalador NSIS en la laptop del usuario, primer
      arranque con `whisper-bin/` vacío — la descarga de 640MB corrió sola, extrajo `whisper-cli.exe`
      junto a todas sus .dll de CUDA en `resources/app/whisper-bin/`, y la transcripción de audio
      funcionó después. Punto 4 del checklist cerrado. Ver DECISIONS.md
- [x] **Punto 5 del checklist probado — recorrido de usuario nuevo completo** — se desinstaló
      Tempest, se borró a mano `%APPDATA%\tempest` (la desinstalación NSIS por diseño no borra
      datos de usuario — ver DECISIONS.md, no es un bug) y se reinstaló. Confirmado: sin chats
      viejos al abrir (carpeta vacía desde el arranque), Whisper se descargó solo de nuevo, y
      `initDefaultAdmin()` creó el usuario `admin`/`admin` automáticamente sin pedir login previo
      — comportamiento intencional ya documentado. Hallazgo aparte (no bloqueante): nada obliga a
      cambiar esa contraseña por defecto — anotado en "🔐 Seguridad y autenticación" (v5.0)
- [x] **Patch Mode probado — protecciones contra doble-aplicación confirmadas, pero encontrado un
      problema real de precisión en el diff** — pedido de prueba en `logger.middleware.js`
      (agregar timestamp al log). Aplicar el mismo patch dos veces mostró primero la confirmación
      de "ya se aplicó" y, al forzarlo igual, la validación de sintaxis pre-escritura rechazó el
      cambio (`Identifier 'timestamp' has already been declared`) sin tocar el archivo — ambas
      protecciones (ya existentes) funcionaron perfecto. El problema real está en la PRIMERA
      aplicación: el `searchContent` que generó `qwen2.5-coder-3b-q8` (modelo de patch en laptop)
      solo cubrió la línea de la firma de la función, sin incluir el `console.log` original que
      debía reemplazarse — resultado: el archivo quedó con dos `console.log` en vez de uno,
      diff válido sintácticamente pero con alcance incompleto. Plan de mejora movido a la sección
      "🩹 Patch Mode — pendientes" de v5.0. Ver DECISIONS.md
- [x] **Fix: auto-updater 404 — causa raíz real era un mismatch de nombres, no el Release de
      GitHub** — el usuario ya había subido los 3 archivos del build v2.19.3 y el 404 seguía
      igual. Causa: `npm run build` genera el instalador real como `Tempest IA-Setup-2.19.3.exe`
      (CON espacio, por `artifactName: "${productName}-Setup-..."` + `productName: "Tempest IA"`),
      pero `dist/latest.yml` (lo que `electron-updater` lee para saber qué pedir) apuntaba a
      `Tempest-IA-Setup-2.19.3.exe` (SIN espacio) — electron-builder generó el instalador y su
      propio metadata de updater con nombres distintos entre sí, desde el build mismo, antes de
      que el usuario subiera nada. Fix: `artifactName` fijo a `"Tempest-IA-Setup-${version}.
      ${ext}"` (literal, sin depender de `${productName}`) — igual, carácter por carácter, a lo
      que `latest.yml` ya generaba. Pendiente: correr `npm run build` de nuevo y volver a subir
      los 3 archivos al Release (reemplazando los viejos, con nombre distinto, para no dejar
      ambos y generar confusión). **Confirmado con prueba real:** tras rebuildear y resubir, el
      updater arrancó a descargar la actualización sin 404. Ver DECISIONS.md
- [x] **Fix: auto-updater ahora muestra progreso real de la descarga** — con el 404 resuelto, la
      descarga (~880MB) resultó muy lenta en la conexión del usuario (0.5-0.7 Mbps medidos en el
      Administrador de tareas, probablemente SmartScreen frenando un ejecutable sin firma), pero
      el modal solo decía "Descargando…" fijo — indistinguible de una descarga colgada. Causa:
      `shell/main.js` nunca escuchaba `autoUpdater.on('download-progress', ...)`. Fix: se conecta
      ese evento (`main.js` → `preload.js` → `settings.js`), el modal ahora muestra
      "X MB / Y MB (Z%) · W MB/s" en vivo, reusando el mismo formateo que el panel de descarga de
      modelos. No acelera la descarga en sí (eso es de SmartScreen/red) — solo la hace visible.
- [x] **Fix: auto-updater — barra de progreso visual real + botón Cancelar que cancela de
      verdad** — pedido del usuario tras el fix de texto de arriba. Al confirmar "Actualizar
      ahora" ahora desaparecen los dos botones de la pregunta inicial y aparecen una barra de
      progreso (reusa `_renderProgressBar()`, la misma del panel de Modelos) y un botón Cancelar.
      La cancelación es real, no solo visual: `electron-updater` ya soporta pasar un
      `CancellationToken` a `downloadUpdate()`, así que no hubo que inventar el mecanismo, solo
      conectarlo (`shell/main.js` + nuevo IPC `cancel-download-update` + `preload.js`). Bug propio
      encontrado y corregido en el camino: el listener de Cancelar se ataba mal (dentro de la
      rama reintentable), lo que hubiera acumulado listeners duplicados en cada reintento — movido
      a atarse una sola vez. **Confirmado con prueba real:** rebuild + instalación + prueba del
      usuario, funcionó — barra de progreso visible, Cancelar operativo. Ver DECISIONS.md
- [x] **Validado: OCR de imagen embebida en DOCX** — `docx.ocr.extractor.js` detectó la imagen
      dentro del `.docx`, corrió OCR (87% confianza), combinó correctamente con el texto normal
      de mammoth (450 chars de contexto) — el pipeline de extracción funcionó perfecto
- [x] **Falsa alarma corregida — el modelo SÍ citaba el contenido real** — sospecha inicial:
      la respuesta a `test-docx-ocr.docx` hablaba de "el archivo fue procesado mediante OCR...
      el software parece ser Mammoth o Tesseract" y parecía describir el proceso en vez del
      contenido. Verificado corriendo Tesseract directo sobre `image1.png` (fuera de Tempest):
      el archivo de prueba es autoreferencial a propósito — el texto real, tanto el de mammoth
      como el de la imagen, habla literalmente de "OCR"/"Mammoth"/"Tesseract"/"imagen
      embebida". La respuesta del modelo era correcta, citaba fielmente ese contenido — no
      había bug de grounding. Se agregó de todas formas una instrucción explícita en
      `buildAttachmentContext()` (`attachment.service.js`) aclarando que las etiquetas
      estructurales del bloque de adjuntos no son contenido a comentar (mismo patrón
      defensivo que ya existe en búsqueda web) — salvaguarda razonable, pero sin evidencia de
      que corrigiera nada real en este caso. Para probar de verdad si el modelo tiende a
      comentar el mecanismo en vez del contenido hace falta un archivo con imagen de contenido
      neutro (que no hable de OCR), no uno autoreferencial como este
- [x] **Fix: errores solo se veían en consola, invisibles en la app empaquetada** — encontrado
      al preguntar dónde queda el registro de fallas para diagnosticar reportes de usuarios
      reales: `logRequest()` (`devMode.service.js`) solo persistía requests EXITOSOS
      (`requests-YYYY-MM-DD.jsonl`); cualquier error real solo iba a `console.error()`, visible
      en una terminal de desarrollo pero inexistente para quien corre el `.exe` empaquetado sin
      terminal abierta. Solución completa (pedida explícitamente por el usuario, "quiero que
      esté al 100%"): `backend/utils/logger.js` nuevo — parchea `console.error`/`console.warn`
      globalmente una sola vez (`initErrorLogging()`, llamado al inicio de `server.js` antes de
      cualquier otro require) para que todo lo que ya se loguea como error/warning en el
      backend (~20 archivos existentes) quede persistido en `errors-YYYY-MM-DD.jsonl` sin tocar
      ningún call site; agregado también `process.on('uncaughtException'/'unhandledRejection')`
      en `server.js` y un middleware catch-all de Express (`app.use((err, req, res, next) => ...)`)
      como redes de seguridad adicionales; `cleanupOldLogs(30)` reutiliza el mismo criterio de
      retención de 30 días que ya existía para `requests-*.jsonl`. `chat.controller.js` enriquece
      su catch principal con modo/modelo/proyecto para que el log sea diagnosticable, no solo el
      mensaje crudo del error. Renderer: `shell/main.js` ahora loguea crashes del proceso de
      renderizado (`render-process-gone`) al mismo logger, para que un crash de ventana también
      quede registrado. UI: botón "Abrir carpeta de logs" en Configuración → Preferencias,
      gateado a usuarios con `role === 'admin'` (mismo patrón que la sección de modo
      desarrollador) — requisito explícito del usuario, no basta con el flag `ADMIN_MODE` de
      entorno
- [x] **Trace de ejecución completo por request** — encontrado como gap adicional al logger de
      errores: el log de requests exitosos ya existente (`requests-YYYY-MM-DD.jsonl`) no traía
      `projectId`/`chatId`/`userId`, nombres de adjuntos, qué archivo del snapshot resolvió
      Patch Mode, ni detalle de la búsqueda web (provider/intentada/rate-limited/cantidad de
      resultados) — datos necesarios para reconstruir qué pasó ante un reporte de un usuario que
      no es un error técnico (el sistema no lo reconoce como tal), sobre todo si usa un modelo
      distinto al del desarrollador. Además, ese log solo se escribía si el request terminaba
      bien — un fallo a mitad de camino no dejaba ningún trace, solo el mensaje de error suelto.
      `chat.controller.js` ahora acumula un objeto `trace` mutable (hoisteado afuera del `try`,
      mismo motivo que las demás variables de arriba) con esos datos a medida que el request
      avanza, y lo persiste vía `logRequest()` en los TRES puntos de salida (visión, stream
      normal, y el `catch` de error) — así siempre queda un registro, exitoso o no.
      `buildAttachmentContext()` (`attachment.service.js`) y `buildPatchGrounding()` cambiaron su
      contrato de retorno (de string suelto a `{ context/text, meta/targetFile }`) para exponer
      datos que antes calculaban pero descartaban (confianza OCR, fallback a visión, archivo de
      snapshot resuelto) — único caller de cada uno, cambio contenido sin tocar los extractors
- [x] **Pregunta y respuesta en el trace — consentimiento POR USUARIO, no switch global** — al
      evaluar si el trace de arriba debía incluir el texto de la pregunta/respuesta (dato clave
      para diagnosticar comportamiento, no solo errores), se identificó un problema de
      privacidad real: `deleteChat()` borra el historial del chat, pero no tocaría el trace
      persistido — un usuario que borra una conversación por privacidad seguiría teniendo esa
      pregunta en `requests-*.jsonl` hasta 30 días después. Primera implementación: dos switches
      globales opt-in en Configuración → Preferencias (uno para pregunta, uno para respuesta,
      independientes). El usuario pidió corregirlo antes de dar el tema por cerrado: un switch
      global no permite elegir "esto sí para este usuario, esto no para aquel" en una instalación
      multi-usuario — se reemplazó por consentimiento individual. Ubicación y forma corregidas
      dos veces más después de la primera implementación: (1) de la pestaña Usuarios se movió a
      Servicios → Búsqueda web, como fila propia justo después de "Activar búsqueda web", atada
      al selector de usuario que ya tiene esa sección; (2) los dos campos separados
      (`allowQuestionLog`/`allowResponseLog`) se combinaron en un solo `allowPersonalDataLog` —
      un único toggle, con descripción de qué implica activarlo; (3) el guardado dejó de ser
      inmediato al tocar el toggle — ahora es diferido, se persiste recién al apretar "Guardar
      configuración" (mismo botón que ya guarda el resto de Búsqueda web), no en cada cambio.
      `users.json` suma `allowPersonalDataLog` por usuario (default `false`, mismo patrón que
      `searchEnabled`); `auth.service.js` suma `getUserLogConsent()`/`setUserLogConsent()`;
      endpoint `PATCH /auth/users/:username/log-consent` (admin only). Los switches globales en
      `settings.service.js` (`getLogQuestionText`/etc.) y sus endpoints
      `/settings/log-question-text`/`/settings/log-response-text` se eliminaron por completo, no
      quedaron como código muerto. La respuesta sigue incluyendo el caso PARCIAL cuando el
      request falla a mitad de la generación (`fullReply` hoisteado fuera del `try`, mismo
      motivo que `mode`/`variant`/etc. — ver primera entrada de esta serie)
- [x] **Captura de errores del frontend/renderer** — hasta ahora, los ~30 `console.error`/`warn`
      repartidos en 11 archivos del frontend (`chat.js`, `settings.js`, `autoRename.js`, etc.)
      solo se veían en DevTools; el logger de errores centralizado solo cubre el proceso de
      Node (backend), no el renderer de Electron, que es un proceso separado. Nuevo:
      `frontend/modules/rendererLogger.js` — módulo auto-inicializable (efecto secundario al
      importarlo, sin un `init()` que haya que acordarse de llamar) que parchea
      `console.error`/`console.warn` del renderer, y además escucha `window.onerror`/
      `unhandledrejection` (excepciones y promesas rechazadas que ni siquiera pasan por
      `console.error`) — todo se manda vía IPC (`ipcRenderer.send`, fire-and-forget, sin
      esperar respuesta) al proceso principal, que llama a `logError()` del mismo logger que ya
      usa el backend, cayendo en el mismo `errors-YYYY-MM-DD.jsonl`. Se importa PRIMERO en
      `app.js`, antes que cualquier otro módulo, para capturar también errores que ocurran
      durante la carga de los módulos siguientes
- [x] **Versión de la app en cada entrada del log** — antes de tener updates automáticos activos
      de verdad, un reporte de usuario no traía forma de saber si venía de la versión más
      nueva o de una vieja sin actualizar. `backend/utils/logger.js` y `devMode.service.js`
      leen `package.json`'s `version` una sola vez al cargar el módulo (no `app.getVersion()`
      de Electron, porque estos módulos también corren en modo desarrollo standalone fuera de
      Electron) y la estampan como `appVersion` en CADA entrada de `errors-*.jsonl` y
      `requests-*.jsonl` — un solo punto de cambio por archivo, sin tocar cada call site
- [x] **"Abrir carpeta de logs" y "Actualizaciones" — admin-only, de vuelta en Preferencias** —
      pasaron por Servicios y volvieron a Preferencias en la misma sesión: primero se movieron a
      Servicios (hipótesis: son controles de administración, no preferencias personales), pero
      el usuario reconsideró — conceptualmente son config general de la app, mismo tipo que
      "Modo desarrollador" (que siempre vivió en Preferencias), no algo específico de Servicios
      (perfiles/proveedores de búsqueda). Como la visibilidad depende del `id` del elemento +
      `_isAdmin`, no del `data-panel` que lo contiene, el traslado de vuelta no tocó nada en
      `settings.js`. En el camino se corrigió un hueco real: `settingsUpdatesSection` no tenía
      ningún admin-gating antes de esta sesión (visible para cualquier usuario); ahora tiene el
      mismo patrón `class="hidden"` + `if (_isAdmin) classList.remove('hidden')` que
      `settingsLogsSection`, y `_bindUpdateCheck()` se gatea por `_isAdmin` en vez de llamarse
      siempre. Estado final: ambas secciones en Preferencias; el consentimiento de log por
      usuario (`allowPersonalDataLog`) quedó en Servicios → Búsqueda web — son conceptos
      distintos (config de la instalación vs. consentimiento de una persona puntual)

- [x] **Exportar / importar chats — respaldo de conversaciones fuera de la app** — cada chat tiene
      ahora "📂 Abrir carpeta" y "📦 Exportar chat" en su menú "⋯", y se puede volver a cargar un
      chat exportado desde la sidebar o desde cualquier proyecto. Caso de uso: guardar una
      conversación puntual antes de formatear/reinstalar y recuperarla después como si nunca se
      hubiera ido.
      - **Exportar** (`exportChat()` en `chat.controller.js`, `POST /chat/export`): genera un
        `.md` legible con toda la conversación en
        `OUTPUTS_DIR/chat-exports/<chatId>/<título>_<timestamp>.md` — nombre con timestamp, así
        cada exportación es un snapshot nuevo y nunca pisa el anterior. Markdown y no ZIP a
        propósito: tiene que poder leerse directo desde el explorador de archivos sin extraer
        nada (ver DECISIONS.md). Al terminar abre la carpeta sola para que el archivo se vea de
        inmediato.
      - **"Abrir carpeta"** (`ipcMain.handle('open-chat-folder')` en `shell/main.js`): abre esa
        misma carpeta, creándola vacía si el chat nunca se exportó — así nunca falla con ENOENT.
        `OUTPUTS_DIR` se pide con `require()` diferido, igual que `open-logs-folder` (ver el bug
        de cacheo de `appPaths.js` documentado más arriba). Fuera de Electron el botón queda
        deshabilitado.
      - **Importar** (`importChat()` + `parseExportedMarkdown()`, `POST /chat/import`): el export
        ahora incluye al final un bloque `<!-- TEMPEST-CHAT-V1 {json} -->` — invisible al
        renderizar el `.md`, pero permite restaurar el chat exacto (roles y timestamps
        originales) en vez de adivinar parseando el texto. Si falta (export viejo o archivo
        editado a mano) cae a un parseo por encabezados y avisa que las fechas son las de la
        importación. Nunca pisa un chat existente: ante colisión de `chatId` crea uno nuevo con
        sufijo y marca el título como "(importado)".
      - **Dos puntos de entrada**: botón `#importChatBtn` en la sidebar (importa a `general`) e
        ítem "📥 Importar chat" dentro de cada proyecto (importa a ESE proyecto). Ambos arriba de
        su lista, no al final — es una acción, no un chat. Si el proyecto estaba colapsado, se
        despliega solo tras importar.
      - `express.json()` pasó a `limit: '25mb'` — el body de `/chat/import` es el `.md` completo
        y el default de 1mb lo rechazaría con 413 en cualquier chat largo
      - **Bug preexistente corregido de paso** (`sidebar.js`): el botón "Seleccionar chats" del
        menú de un proyecto llamaba a `deps.onLoadSidebar()`, pero `deps` no existe en el scope de
        `createActionsMenu()` (el segundo parámetro ya llega desestructurado) — tiraba
        `ReferenceError` y el botón no hacía nada. Corregido a `onLoadSidebar()`

- [x] **Exportar / importar proyectos completos** — mismo trío ("Abrir carpeta" / "Exportar" /
      "Importar") pero a nivel proyecto. Un proyecto es un árbol (`chats/`, `projectMemory.json`,
      `projectSettings.json`, `projectContext.json`, `context/` con índice, embeddings, archivos
      subidos y carpeta vinculada), así que no aplica el "un .md legible" del export de chats.
      - **Formato**: `project-exports/<projectId>/` con un
        `<projectId>_<timestamp>.tempestproj` (JSON con el árbol completo, importable) **más**
        `chats/<título>.md` — una copia legible de cada chat, en el mismo formato que el export
        individual, así que cada `.md` también se puede importar solo. Duplicación a propósito:
        el `.tempestproj` restaura todo tal cual (embeddings incluidos, que si no habría que
        regenerar con Ollama), los `.md` sirven para leer sin importar nada. `buildChatMarkdown()`
        se extrajo de `exportChat()` para que ambos caminos no se desincronicen. ZIP y gzip
        descartados (ver DECISIONS.md)
      - **Importar** (`POST /project/import`): valida el `.tempestproj`, rechaza respaldos de una
        versión de formato más nueva, **bloquea path traversal** (rutas tipo `../../users.json`
        se resuelven y se descartan si caen fuera de la carpeta del proyecto) y nunca pisa un
        proyecto existente — ante colisión crea `<projectId>-2`, `-3`… y el frontend avisa.
        Archivos binarios se detectan por byte nulo y viajan en base64. Verificado con round-trip
        byte a byte + intento de traversal bloqueado
      - **UI**: "📂 Abrir carpeta" y "📦 Exportar proyecto" en el menú "⋯" de cada proyecto;
        "📥 Importar proyecto" como botón de la sidebar junto a "+ Nuevo Proyecto". El proyecto
        importado queda desplegado; el botón de exportar se deshabilita mientras corre
      - `express.json()` subió a `100mb` (el árbol completo con embeddings puede pesar varios MB)
      - `memory.service.js` ahora exporta `getPaths` — único consumidor externo, lo necesitan
        `exportProject()`/`importProject()` para la ruta física de la carpeta del proyecto
      - **Íconos SVG en vez de emojis** — los emojis (📂/📦/📥) los dibuja la fuente del sistema:
        cambian de forma, color y tamaño según Windows/Linux y no heredan el color del texto.
        Reemplazados por SVG inline 16x16 con `fill="currentColor"`, mismo criterio que el
        engranaje de Configuración. El menú contextual pasó de 130px a 180px (cortaba "Exportar
        proyecto" y "Archivos de contexto") y ahora usa flex. Después se extendió al resto del
        menú — Renombrar (lápiz), Eliminar (tacho), Archivos de contexto (hoja), Configuración
        (deslizadores, distinto del engranaje global a propósito) y Seleccionar chats (casilla,
        que cambia a casilla vacía en modo "Cancelar selección"): con sólo algunos ítems con
        ícono las etiquetas quedaban desalineadas. "Eliminar" lleva el ícono en rojo suave y se
        tiñe entero al pasar el mouse, para distinguir la acción destructiva sin gritar

---

## 🎯 v4.0 — Perfiles de modelo flexibles + multi-motor + servidor/cliente

Alcance deliberadamente acotado a estas 3 implementaciones — grandes, secuencialmente
dependientes entre sí (orden decidido: perfiles → motores → servidor/cliente, ver
DECISIONS.md → "Modo Servidor/Cliente — decisión de diseño para v4.0"), y suficientes por
sí solas para ser una versión estable real. Todo lo demás que antes vivía bajo "v4.0" se
movió a v5.0 (más abajo) para no diluir el enfoque de esta versión. Único motor excluido
de acá: el de audio (faster-whisper) — también en v5.0, sin relación de dependencia con
las 3 implementaciones de esta versión.

Excepción explícita a esta regla: "🌍 Idioma de respuesta configurable" (al final de esta
sección) — decisión a propósito del usuario de dejarlo en v4.0 igual, pero como el último
pendiente a trabajar de toda la versión, después de las 3 implementaciones grandes, salvo que
surja algo que se considere más importante en el momento.

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
- [ ] **Motor Python de visión sin Ollama para Capability=Visión** — modelo multimodal chico
      (ej. Moondream, SmolVLM, Qwen2-VL) corriendo vía `execFile`/subprocess en Python, mismo
      patrón que `whisper-cli.exe` (transcripción) — proceso local propio, sin depender de un
      servidor HTTP externo tipo Ollama. Resuelve un gap real encontrado y confirmado en
      pruebas de v2.18.1 (ver DECISIONS.md → "Confirmado: modo visual sin Ollama no hace
      análisis visual real"): si el usuario no corre Ollama, el único camino de "visión"
      activo es `modo visual` → `llava-1.6`/`qwen2.5-vl-7b-q4` vía `node-llama-cpp`, que no
      soporta multimodal en la v3.18 usada hoy (ver `MODELS.md`) — para imágenes sin texto
      (diagramas, fotos, capturas) el modelo no ve nada, solo repite el prompt de
      instrucciones. Distinto de "Motor Transformers + TrOCR" de arriba (ese es solo texto) y
      del pendiente en 🔮 vX.x de esperar a que `node-llama-cpp` saque soporte multimodal
      nativo (sin fecha, fuera del control del proyecto) — este punto es una solución que se
      puede construir ya, sin depender de terceros
- [ ] Motor Ollama como alternativa de Capability=Chat
- [ ] **Motor LocalAI (binario standalone, SIN Docker) como alternativa de Capability=Chat** —
      decisión explícita del usuario: LocalAI vuelve como motor opcional, pero vía su binario Go
      standalone, no la imagen Docker que se abandonó en la migración a node-llama-cpp (v2.10.0,
      ver DECISIONS.md). Mismo patrón que ya usa Ollama hoy (proceso local con servidor HTTP en
      `localhost:PUERTO`, `vision.service.js`/`embed.provider.js` como referencia de cómo
      Tempest ya habla con un motor así) — no es un paradigma nuevo. Orden de trabajo decidido —
      ver DECISIONS.md → "Modo Servidor/Cliente — decisión de diseño para v4.0" para el porqué
      completo: (1) perfiles de modelos flexibles primero (más autocontenido, sin motor nuevo ni
      red), (2) este punto —LocalAI como segundo motor— después, (3) recién entonces
      Servidor/Cliente (sección nueva más abajo), porque cada uno depende del anterior.
      **Pendiente de empaquetado:** el binario de LocalAI con soporte GPU pesa bastante (bindings
      de llama.cpp+CUDA incluidos) — no se puede embeber en el instalador, hay que descargarlo
      aparte. Mismo problema sin resolver que "Instalador silencioso de Ollama para visión
      multimodal" (Empaquetado Electron) — evaluar resolver los dos motores con una sola solución
      de descarga/instalación en vez de dos separadas.
- [ ] Unificar con el pendiente existente de `capability.matrix.js` soportando providers
      remotos (`localai` | `groq` | `openai` | `claude`, sección "🤖 Integración IA")
      bajo el mismo concepto de Motor, en vez de dos sistemas separados
- [ ] Evaluar motores adicionales: vLLM, ONNX Runtime, TensorRT, PaddleOCR
- [ ] **Perfiles de instalación por especialización (idea, sin diseñar)** — cuando existan
      Capabilities/Motores especializados reales (ej. Python + NumPy + SciPy + Matplotlib
      para un perfil "matemático/científico"), el instalador de Electron podría ofrecer
      selección de componentes tipo "instalación típica vs personalizada" (mismo patrón que
      Anaconda/VS Code/Docker Desktop; `electron-builder` con NSIS lo soporta vía páginas de
      componentes). Explícitamente pospuesto: no bloquea el instalador simple de Windows que
      se construya ahora, y no tiene sentido diseñarlo hasta tener al menos una
      especialización real implementada para validar la forma que debe tomar
- [ ] **Pipeline de razonamiento → código en dos etapas (idea, sin diseñar)** — para Patch
      Mode: un modelo de razonamiento (candidatos evaluados: `DeepSeek-R1-Distill-Qwen-7B`,
      `Qwen3-8B` con modo thinking) resolvería primero la lógica del cambio, y recién después
      pasaría la tarea a un modelo de código (ej. `deepseek-coder-6.7b-q6`) para generar el
      diff final. Surge de un bug de calidad observado en pruebas de v3.0.0 (ver
      DECISIONS.md): el modelo de código, sin un paso de razonamiento previo, puede generar
      lógica con errores de orden (ej. una validación que queda inalcanzable por estar después
      de otra que ya cubre el caso). Encaja naturalmente con los perfiles de modelo de esta
      sección — la idea es exponer 3 perfiles de razonamiento seleccionables (general / código
      / matemática-ciencia) en vez de uno solo. Sin diseñar todavía — se retoma cuando se
      trabaje en los perfiles de modelo de v4.0

### 🖥️🖧 Modo Servidor/Cliente — despliegue multi-equipo
Un solo producto (no una versión "hogar" y otra "empresa" separadas) — el mismo perfil que ya
se va a rediseñar en "🔌 Separación Motor/Modelo" decide si esta máquina corre modelos ella
misma (hogar, como hoy) o se conecta a una máquina servidor (empresa). Depende de que existan
primero los perfiles flexibles y el motor LocalAI (orden completo y el porqué en DECISIONS.md →
"Modo Servidor/Cliente — decisión de diseño para v4.0"). Sin diseñar en detalle todavía — lista
de temas identificados, no implementación:
- [ ] Perfil "cliente remoto" — sin modelo local, solo dirección del servidor
- [ ] Exponer el backend en la LAN — `0.0.0.0` en vez de `localhost`, CORS, reglas de entrada en
      firewall de Windows (instalador)
- [ ] Control de concurrencia sobre una sola GPU compartida — cola de peticiones como mínimo
      viable; continuous batching (nativo en LocalAI/llama.cpp server) como solución completa
- [ ] Compatibilidad de versiones cliente/servidor — chequeo y aviso si no coinciden (semver)
- [ ] Rama nueva en el instalador — la pantalla de perfil de hardware/CUDA se salta por completo
      en el flujo de "cliente remoto", reemplazada por un campo de dirección del servidor
- [ ] Evaluar TLS/HTTPS si la red no es de confianza total (certificado autofirmado como mínimo)

### 🌍 Idioma de respuesta configurable
**Último pendiente a trabajar de v4.0** — después de perfiles de modelo, multi-motor y
servidor/cliente, salvo que surja algo más importante en el momento. Encontrado en pruebas de
v3.0.0 (ver DECISIONS.md): un proyecto con prompt personalizado pidiendo "responde solo en
inglés" siguió respondiendo en español. No es un bug de carga — `buildSystemPrompt` sí inyecta
el prompt del proyecto (confirmado en log: `project: SÍ`) — es un problema de precedencia:
`global.system.txt` hardcodea "Responde en español." como primera línea, sin indicar que las
instrucciones del proyecto puedan pisarla si hay conflicto. Caso de uso real identificado:
usuarios que prefieran inglés por trabajo, no solo un experimento de prompt.
- [ ] **Selector de idioma en Preferencias** — mismo patrón que otros asistentes (elegir
      idioma de respuesta desde Configuración → Preferencias, no solo vía prompt libre de
      proyecto); alcance: idioma de las respuestas de la IA, NO traducción de la interfaz de
      Tempest (eso sería un cambio mucho más grande, fuera de alcance acá)
- [ ] La instrucción de idioma pasa a ser dinámica (por preferencia de usuario y/o override por
      proyecto) en vez de la línea hardcodeada en `global.system.txt`
- [ ] Fix de precedencia en `prompt.builder.js`/capas del prompt — cuando el prompt de
      proyecto contradice una regla general (idioma u otra), el proyecto debería ganar; hoy no
      hay ninguna señal explícita de jerarquía entre capas cuando chocan

---

## 🎯 v5.0 — Features avanzados (resto, sin dependencia de v4.0)

Todo lo que antes vivía bajo "v4.0 — Features avanzados" y no forma parte de las 3
implementaciones grandes que quedaron ahí (perfiles de modelo, multi-motor, servidor/cliente).
Ninguno de estos ítems depende de que v4.0 esté terminado — pueden trabajarse en cualquier
orden entre sí, y hasta antes de v4.0 si surge la necesidad.

### 🔴 CRÍTICO — `switchModel()` deja la app entera sin modelo si la carga nueva falla

**No es una feature — es un bug de estabilidad grave, con diagnóstico ya completo.** Se
encontró investigando un error de generación de documento reportado por el usuario ("genera
un documento txt sobre el primer emperador chino" → error), usando los logs reales de la app
empaquetada (`errors-2026-08-10.jsonl`). El usuario confirmó el diagnóstico en vivo: tuvo que
reiniciar la app para que volviera a funcionar.

**Secuencia real, reconstruida del log:**
1. `21:44:08` — un chat normal enruta a `qwen2.5-3b-q5`. `switchModel()` intenta cargarlo y
   falla: `ENOENT ... qwen2.5-3b-instruct-q5_k_m.gguf` (ese `.gguf` no está en la carpeta de
   modelos de esa instalación). Se muestra bien el aviso de "modelo no descargado" al usuario
   — hasta acá, correcto.
2. `21:49:21` (5 minutos después, pedido sin relación) — "genera un documento txt sobre el
   primer emperador chino" falla con `Error: Modelo no disponible (error)`, lanzado desde
   `llama.provider.js:165` (`generate()`), vía `document.controller.js:57`.
3. Reiniciar la app lo arregla — confirma que el problema es estado en memoria del proceso,
   no algo en disco.

**Causa raíz:** `switchModel()` en `llama.provider.js` hace `dispose()` del modelo actual
ANTES de intentar cargar el nuevo (línea ~87-90: `if (_model) { await _model.dispose();
_model = null; }`, y recién después `_llama.loadModel(...)`). Si la carga del nuevo modelo
falla por cualquier motivo (archivo faltante, sin VRAM suficiente, etc.), el catch pone
`_status = 'error'` y relanza — pero el modelo viejo YA fue descartado. `_model` queda en
`null`, `_status` en `'error'`, de forma GLOBAL (variables a nivel de módulo, compartidas por
absolutamente todo lo que pase por `llama.provider.js`: chat, documentos, transcripción).
`generate()`/`stream()` chequean `if (_status !== 'ready') throw new Error('Modelo no
disponible (${_status})')` al principio — con `_status` atascado en `'error'`, CUALQUIER
pedido posterior falla con ese mismo mensaje genérico, sin importar cuál sea, hasta que algo
dispare un `switchModel()`/`init()` exitoso — que en la práctica, para el usuario, solo pasa
reiniciando la app entera.

**Gravedad:** alta. El disparador es trivial — alcanza con que el router elija un modelo que
el usuario no descargó todavía (puede pasar solo, sin que el usuario elija nada a mano, según
el perfil "balanceado" del model router) para que TODA la app quede inutilizable hasta
reiniciar, no solo la feature que lo disparó.

**Fix propuesto — cargar antes de descartar, no al revés, con fallback al modelo anterior:**
NO simplemente invertir el orden a "cargar el nuevo, después descartar el viejo" sin más —
esta app está pensada para hardware con poca VRAM (todo el proyecto de perfiles laptop/desktop
gira en torno a esto, y ya se vieron varios `InsufficientMemoryError` reales esta sesión);
tener dos modelos cargados a la vez, aunque sea brevemente, puede fallar por sí solo en la
laptop del usuario. Alternativa más segura: si la carga del modelo nuevo falla, on the catch,
**reintentar cargar el modelo anterior** (mismo `modelPath` que tenía antes) antes de
relanzar el error — mantiene un solo modelo en memoria en todo momento, y si el reintento
funciona, la app sigue operativa con el modelo de antes en vez de quedar completamente sin
ninguno. Si el reintento también falla (caso raro — el modelo que ya andaba bien deja de
andar), ahí sí `_status` queda en `'error'` de verdad, que es la única situación donde
corresponde.

**Estado: ARREGLADO en v3.0.0** — el usuario pidió tiempo estimado, aceptó el riesgo/alcance
acotado, y aprobó implementarlo en la misma sesión en vez de esperar a v4.0/v5.0. Ver
DECISIONS.md → "switchModel() ya no deja la app sin modelo si la carga nueva falla" para el
detalle de la implementación y su verificación.

### 🎙️ Motor de audio alternativo
- [ ] Motor faster-whisper para Capability=Audio — evaluar si reemplaza o complementa
      whisper.cpp standalone (v2.15.0). Sacado de "Separación Motor/Modelo" (v4.0) — sin
      relación de dependencia con perfiles/motores de chat/servidor-cliente

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

### 📝 Generación de documentos por chat — alucinaciones de hecho histórico sin grounding

**Distinto del ítem de arriba** ("Document Mode / Grounding real" es sobre resumir un archivo
YA ADJUNTADO). Esto es sobre la feature nueva de v3.0.0: pedirle a Tempest que genere un
documento desde cero sobre un tema ("crea un documento en pdf que resuma la revolución
francesa") — sin ningún archivo de referencia, el modelo local (qwen2.5-3b en perfil laptop)
escribe de memoria, sin grounding de ningún tipo.

- [ ] **Revisión de contenido real, tres documentos de prueba (Revolución Francesa, Revolución
  Mexicana, Conquista de México — v3.0.0), generados con qwen2.5-3b-q4/q5 (perfil laptop).**
  Estructura y redacción están bien (título/subtítulo/contenido, párrafos claros, sin
  divagar ni salirse del tema) — el problema no es coherencia, es exactitud factual:
  - Revolución Francesa: dice que el proceso *"culminó con la toma del poder por el régimen
    revolucionario de los Girondinos"* — equivocado; los girondinos fueron purgados y en su
    mayoría ejecutados durante el Terror (1793), nunca "culminaron" la Revolución tomando el
    poder. También aparece la frase incoherente *"guerras civiles internacionales"*
    (contradicción en los términos — probablemente una fusión alucinada de "guerra civil" y
    "guerra con países vecinos", dos cosas reales pero distintas del período).
  - Revolución Mexicana: llama a Francisco I. Madero *"general"* — no lo era, era un civil,
    político y escritor. También dice que la Revolución *"llevó al establecimiento de la
    República Mexicana"* — México ya era república desde 1824; lo que estableció la
    Revolución fue la Constitución de 1917, no la forma de gobierno.
  - Conquista de México: sin errores fácticos notorios, pero un typo real del modelo
    ("mulaes" en vez de "mulas").
  - **Causa raíz:** a diferencia del chat normal (que si tenés búsqueda web activa, inyecta
    resultados reales como contexto — ver `chat.controller.js`), `generateDocumentContent()`
    en `document.controller.js` nunca pasa por `search.service.js`. El modelo de 3B sin
    ningún contexto real termina rellenando huecos de memoria de entrenamiento con
    afirmaciones que suenan plausibles pero son incorrectas — comportamiento esperado de un
    modelo chico generando contenido de cultura general sin fuente.
  - **Fix probable:** reusar el mismo mecanismo de búsqueda web que ya existe en
    `chat.controller.js` (arreglado recién en esta versión, ver DECISIONS.md → "Búsqueda web:
    fallo del provider...") — antes de generar el documento, hacer una búsqueda con el
    `prompt` del usuario como query, e inyectar los resultados en `buildDocumentPrompt()`
    (`document.service.js`) igual que `formatResultsAsContext()` ya hace para el chat. No
    resuelve el 100% (un resumen de "la revolución francesa" sigue siendo un tema amplio para
    3-5 resultados de búsqueda) pero baja mucho el riesgo de alucinar fechas/roles/atribuciones
    específicas. Alternativa/complemento: instrucción explícita en el prompt pidiendo al
    modelo marcar con "(sin verificar)" cualquier dato específico (nombre, fecha, atribución)
    del que no esté seguro — más barato de implementar, no requiere tocar búsqueda web, pero
    depende de que el modelo chico sea bueno auto-evaluando su propia incertidumbre (dudoso en
    3B).
  - No implementado — no es una regresión de v3.0.0 (la feature es nueva de esta versión, el
    problema es inherente a cómo se diseñó, no algo que se rompió), pero vale la pena resolver
    antes de ofrecer esto como algo confiable para temas de cultura general/históricos. Para
    contenido que el usuario ya conoce y solo quiere formatear (una idea propia, notas
    personales), el riesgo de alucinación es mucho menor — el problema es específico de pedirle
    al modelo hechos que no puede verificar.

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

### 🧠 Arquitectura cognitiva — grafo estructural del proyecto
Nace de una conversación explícita con el usuario (v2.19.0, ver DECISIONS.md → "Arquitectura
'Modo Proyecto'") sobre qué tan lejos llega hoy el "entendimiento" de Tempest sobre su propio
proyecto — diagnóstico confirmado leyendo el código: el Context Snapshot solo guarda texto y
embeddings, ninguna relación estructural real (imports, exports, qué archivo llama a cuál).
Sin diseñar todavía — el usuario definió esto como la siguiente fase, a encarar por separado.
- [ ] Diseñar un análisis estático (no LLM) que extraiga imports/exports/relaciones reales
      entre archivos del snapshot — candidato: nuevo `structure.service.js` hermano de
      `chunk.service.js`, mismo disparador que la generación de embeddings
- [ ] Definir formato de artefacto persistido (ej. `projectGraph.json`, paralelo a
      `projectContext.json` y `embeddings.json`)
- [ ] Definir cómo se combina con la búsqueda semántica existente — ¿expande resultados por
      relación real en vez de solo por similitud de texto?
- [ ] Evaluar relación con el diseño de tool use / function calling de arriba — ¿el grafo es
      la base que un futuro agente usaría para explorar el proyecto sin fuerza bruta de
      llamadas al modelo?

### ⏱️ Router de modos — afinación de triggers
- [ ] "cuéntame sobre X" dispara `explain` innecesariamente — reservar para explicaciones técnicas profundas
- [ ] Ajustar triggers en `mode.router.js`
- [ ] Revisar sobre-ruteo a modelos pesados en preguntas casuales
- [ ] **El modelo a veces se re-presenta ("Soy Tempest...") en medio de una conversación ya
      iniciada** — visto DOS veces ahora, con hipótesis de causa distinta cada vez:
      1) pruebas de v3.0.0, Punto 3 del checklist de laptop: tras dos cambios de modelo en el
         mismo chat, una respuesta arrancó con "Soy Tempest. ¿Te apetece algo dulzón?..." en vez
         de responder directo. Hipótesis original: relacionado a cambio de modelo
      2) pruebas de v3.0.0, probando el botón "Detener respuesta" (#13, ver DECISIONS.md): el
         usuario mandó "cuanto mide la muralla china?", le dio Stop sin dejarla terminar, y
         volvió a mandar la MISMA pregunta (comportamiento del usuario, no un bug de duplicado —
         confirmado). Después preguntó "donde esta china" — la primera respuesta fue "Soy
         Tempest." (sin responder nada), la segunda vez (misma pregunta, reenviada a mano) sí
         respondió bien. Acá NO hubo cambio de modelo (`qwen2.5-3b-q5` ya estaba cargado en las
         cuatro requests del log) — lo que sí hubo fue una generación previa abandonada por Stop
         que, por el gap de `chat.controller.js` sin `req.on('close')`, pudo haber seguido
         corriendo de fondo sobre el mismo contexto del modelo cuando llegó la request de "donde
         esta china"
      **Hipótesis actualizada:** puede no ser específico de cambio de modelo — el factor común en
      ambos casos es tener DOS generaciones activas/solapadas sobre el mismo contexto cargado
      (una por cambio de modelo a mitad de respuesta, otra por Stop sin cancelación real).
      Revisar junto con el fix de #13 — si arreglar la cancelación real del backend hace
      desaparecer este quirk, confirmaría la causa

### ⏹️ Cancelación real de generación (botón "Detener respuesta")
La parte principal (generación de texto) ya se implementó en v3.0.0 — ver el historial de arriba
("Fix: cancelación real del botón...") y DECISIONS.md. Esto es lo que queda:

- [ ] **Extender la cancelación real a OCR y a la llamada de visión (Ollama)** — el fix de
      v3.0.0 cubre generación de texto (`llama.provider.js` → `session.prompt()`), pero no corta
      el pipeline de OCR ni una descripción de imagen en curso si el usuario aprieta Stop a mitad
      de esos pasos — siguen corriendo enteros igual. Mismo patrón que ya funcionó para texto
      (propagar el `AbortController.signal` de `chat.controller.js`), aplicado a
      `vision.service.js` y al resto del pipeline de adjuntos. Evaluar prioridad según qué tan
      seguido se cancela justo en esa etapa (texto es, por lejos, el caso más común)
- [ ] **Confirmar si el fix de texto también resolvió el quirk "Soy Tempest."** — ver sección
      "⏱️ Router de modos" arriba. Si una prueba real de Stop + pregunta siguiente ya no lo
      reproduce, se puede cerrar esa hipótesis como confirmada

### 🔐 Seguridad y autenticación
- [ ] **Forzar cambio de contraseña en el primer login del admin por defecto** — encontrado
      probando el recorrido de usuario nuevo (Punto 5, v3.0.0): `initDefaultAdmin()` crea
      `admin`/`admin` automáticamente (comportamiento intencional, ver DECISIONS.md), y el
      diseño asume que el usuario la cambia después — pero nada en la app lo obliga ni se lo
      recuerda. Bajo riesgo hoy (app local de un solo usuario, sin servidor expuesto), pero
      importa más si se implementa "🖥️🖧 Modo Servidor/Cliente" — ahí sí habría una cuenta con
      contraseña conocida potencialmente accesible en red. Evaluar: modal obligatorio de cambio
      de contraseña en el primer login, o al menos un aviso persistente hasta que se cambie
- [ ] **Tokens reales en streaming** — bug conocido de llama.cpp. Revisar cuando LocalAI ≥ v2.26.x
- [ ] **Expulsión en tiempo real con WebSockets** — notificación instantánea al cambiar rol
- [ ] **Multi-tenant B2B** — aislamiento de datos por organización
- [ ] **Revisar `npm audit` en `backend/`** — el `npm install` limpio de v2.18.1 (post-migración
      sharp→jimp) reportó 7 vulnerabilidades (1 low, 1 moderate, 4 high, 1 critical) sin
      investigar todavía — evaluar antes de un release público

### 🌐 Búsqueda web — pendientes
- [ ] Brave Search API — implementar `brave.provider.js` completo
- [ ] **Estado del botón 🌐 no se refresca sin reiniciar la app** — `frontend/modules/webSearch.js` calcula `_provider`/`_enabledProviders` una sola vez en `initWebSearch()` al cargar la app; si el admin cambia providers en Servicios (activar/desactivar, agregar API key) sin reiniciar, el botón del chat sigue con el estado viejo. Contradice la descripción existente ("botón 🌐 sin recarga al guardar config") — revisar si ese mecanismo de refresco existe y por qué no está disparando, o si nunca se implementó
- [ ] **Adaptar SearXNG para correr sin Docker** — el toggle sigue apuntando a `http://localhost:8081`, un contenedor Docker que ya no se usa desde que el proyecto migró a `node-llama-cpp` nativo. Evaluar correrlo standalone (instalación directa sin contenedor) o remover el provider si no vale la pena mantenerlo
- [ ] **Sin fallback entre providers + falla silenciosa** — encontrado en pruebas de v3.0.0 (ver DECISIONS.md): `search()` en `search.service.js` atrapa el error de un provider (ej. Tavily con API key inválida/expirada → 401), lo loguea, y devuelve `[]` sin intentar otro provider configurado ni avisar de ninguna forma al usuario/modelo; el modelo termina respondiendo desde su conocimiento de entrenamiento desactualizado como si la búsqueda nunca hubiera existido. Evaluar: fallback automático al siguiente provider habilitado, y/o señal explícita en el contexto inyectado cuando la búsqueda falló en vez de simplemente omitirse

### 🗂️ Sidebar
Bajado de "Prioridad alta" — decisión del usuario, no es urgente.
- [ ] Invertir orden del sidebar: proyectos arriba, chats independientes abajo
- [ ] Ordenar chats por fecha de último mensaje (más reciente arriba)
- [ ] Mover chat al tope de la lista al generar un nuevo mensaje
- [ ] Guardar estado de proyecto colapsado/expandido en localStorage

### 🗄️ Base de datos
- [ ] Migrar JSON a SQLite/PostgreSQL
- [ ] Búsqueda semántica con embeddings

### 🩹 Limpieza post-migración node-llama-cpp
- [ ] `/localai/metrics` muestra "No disponible" en Dev Panel — endpoint sigue parseando Prometheus de LocalAI, que ya no corre desde la migración a node-llama-cpp. Eliminar sección o reemplazar por métrica equivalente si `node-llama-cpp` expone alguna
- [ ] **Investigar por qué `qwen2.5-7b-q5` da respuestas pobres/desactualizadas con contexto de búsqueda web real disponible** — confirmado vía dev panel que el modelo SÍ recibe los resultados completos (finish_reason: stop, no truncado); el problema es de uso/calidad del modelo ante ese contexto, no de inyección. No depende de perfiles de modelo ni de multi-motor (v4.0) — es una prueba/ajuste puntual sobre lo que ya existe hoy. Plan concreto para cuando se retome: (1) bajar `temperature` solo cuando hay `webSearchContext` presente (hoy usa la misma 0.3 que chat normal); (2) probar otros modelos generales ya disponibles (`hermes-q5`, `llama-3.1-8b-q5`) como candidatos a un alias nuevo dedicado `search-grounded` en `capability.matrix.js`, en vez de dejarlo en manos de `general-standard` — no se trata de cambiar de categoría (sigue siendo un modelo de conversación general), sino de encontrar cuál de los generales ya descargados respeta mejor el contexto inyectado; (3) validación post-generación barata — si hubo `webSearchContext`, chequear que la respuesta mencione contenido real de los resultados, reintentar una vez con prompt más estricto si no
- [ ] **`CODER_STRICT_TRIGGERS` (`mode.router.js`) matchea palabras genéricas de vocabulario, no solo pedidos de código** — encontrado en pruebas de v3.0.0: "función"/"funcion", "archivo"/"archivos" y "clase" están en esa lista para detectar pedidos de código explícito, pero también aparecen en preguntas puramente informativas ("¿qué hace la función X?"), empujándolas a `coder/hybrid` en vez de `explain` puro. No es peligroso (hybrid no escribe archivos, solo muestra código de referencia) pero es impreciso. Evaluar sacar esas palabras sueltas de `CODER_STRICT_TRIGGERS` y depender de verbos más específicos (implementa, crea, genera, escribe, etc.) que ya están en la misma lista
- [ ] **Renombrado automático de chat falla en silencio en algunos casos** — encontrado en pruebas de v3.0.0: un chat nuevo quedó con el título placeholder "Nuevo chat" en vez de renombrarse solo, mientras otros chats de la misma sesión sí se renombraron bien. `[generateTitle]` sí se logueó (el intento arrancó), pero no se confirmó si terminó en error o simplemente no aplicó el rename — no se llegó a ver el log completo de esa request puntual. Sospecha sin confirmar: `generateTitleFromText` corre en paralelo al streaming de la respuesta principal, ambos sobre el mismo modelo cargado (arquitectura de un solo modelo en VRAM a la vez) — posible contención de recursos entre el `context` del streaming y el `context` nuevo que crea la generación de título (`_createSession()` en `llama.provider.js`, cada llamada crea su propio `LlamaContext`, ambos consumiendo VRAM simultáneamente). Cuando `tryAutoRename()` (frontend, `autoRename.js`) recibe `!titleData.ok`, aborta sin reintentar y sin avisar — el chat se queda con el nombre genérico para siempre, sin indicio visual de que algo falló. Pendiente: reproducir de nuevo capturando el log completo (`Error generando título:` / `Error en generateTitleFromText:`) para confirmar la causa antes de decidir el fix (candidatos: reintento automático, o esperar a que termine el stream principal antes de generar el título en vez de correrlos en paralelo)
- [ ] **`open-transcriptions-folder` usa una ruta hardcodeada, no `OUTPUTS_DIR`** — detectado incidentalmente en v3.0.0 al implementar el logger de errores (ver DECISIONS.md): el IPC handler en `shell/main.js` abre `path.join(__dirname, '..', 'backend', 'outputs', 'transcriptions')`, una ruta relativa a la carpeta de instalación, en vez de reusar `appPaths.js`'s `OUTPUTS_DIR` (que sí respeta `APP_DATA_DIR` en la app empaquetada). Mismo tipo de bug que ya se corrigió históricamente para `MODELS_DIR` — en una instalación empaquetada real, esta ruta puede no coincidir con dónde efectivamente se escriben las transcripciones. `open-models-folder` y el nuevo `open-logs-folder` sí usan el patrón correcto (variable de entorno/`appPaths.js`) — replicar ese mismo patrón acá

### 🖼️ Visión / Ollama — pendientes
- [ ] **Registro del modelo de visión en Ollama es 100% manual — contradice el objetivo de "solo
      instalar Ollama, sin pasos extra"** — encontrado en la validación de la laptop (perfil
      Breeze): hoy no existe ningún código en la app ni en el instalador que registre
      `llava-1.6`/`qwen2.5-vl-7b-q4` en Ollama. Todo el registro vive en `ollama/setup.ps1`, un
      script que corre el desarrollador a mano. Un usuario real que instale Tempest y quiera usar
      el modo Visión necesita, además de instalar Ollama (el requisito aceptado), abrir una
      terminal y correr comandos de PowerShell — paso extra explícitamente no deseado. Diseño
      acordado con el usuario para cuando se encare: en Configuración → Servicios, debajo del
      botón "Guardar configuración", un hipervínculo (texto resaltado en color, no un botón) que:
      (1) si Ollama no está instalado/detectado, lleva a la página oficial de descarga de Ollama;
      (2) una vez que la app detecta Ollama instalado, el texto cambia a una acción que dispara el
      registro automático del modelo de visión (a decidir en la implementación: llamar a la API
      HTTP de Ollama `POST /api/create` con el contenido del Modelfile — evita depender de invocar
      `ollama.exe`/PowerShell desde Node —, o ejecutar `setup.ps1`/un script equivalente vía
      `child_process`). Falta definir: cómo se detecta "Ollama instalado" (¿ping a
      `http://localhost:11434`? ¿buscar el ejecutable en la ruta de instalación típica?), qué pasa
      si el registro falla o tarda mucho (es una copia de varios GB), y si además hay que resolver
      primero de dónde salen los archivos GGUF+mmproj si el usuario no los tiene descargados
      todavía (relacionado con el pendiente de abajo)
- [ ] **Posible incompatibilidad de `ollama/llava.Modelfile` (y quizás el resto) con versiones
      recientes de Ollama** — al intentar registrar `llava-1.6` en la laptop con Ollama 0.32.5
      (recién instalado desde la página oficial), `ollama create` copió todos los blobs pero
      terminó en `Error: 400 Bad Request: unknown type`. Se descartó como causa un Modelfile mal
      armado (se corrigió la falta de la línea `FROM` del `mmproj`, ver DECISIONS.md, y el error
      persistió idéntico). Se resolvió para esta prueba puntual bajando el modelo empaquetado
      oficial (`ollama pull llava:7b` + `ollama cp llava:7b llava-1.6`), que sí funcionó — pero
      eso descarga ~4.7GB redundantes para cualquiera que ya tenga los `.gguf` locales, lo cual
      también contradice el objetivo de "sin pasos/descargas extra". No confirmado todavía si es
      una regresión de versión de Ollama (pendiente comparar contra la versión instalada en el
      desktop, donde el mismo tipo de Modelfile sí funciona) o una limitación más amplia de
      versiones nuevas de Ollama con Modelfiles de visión armados a mano (hay reportes similares
      en el repo de Ollama en GitHub, issues #14730 y #9967). Bloquea decidir el mecanismo del
      punto anterior: si el Modelfile local ya no es confiable, la automatización tendría que
      resolver el modelo de otra forma (¿pull directo siempre, aceptando la duplicación de
      espacio? ¿detectar la versión de Ollama y elegir método?)

- [ ] **v2 del fusionador: seleccionar bloques de OCR relevantes antes de extraer tokens** —
      encontrado probando con la captura real de FFXIV (UI densa: panel de stats + chat +
      misiones): `extractFactualTokens()` extrae de todo el texto OCR sin distinguir qué bloque de
      la imagen es el contenido relevante, generando 100+ tokens de los que la mayoría es ruido
      (nombres de misiones, chat lateral). El fix de v1 (tope de 20, números primero, mínimo de 3
      letras para nombres — ver DECISIONS.md) reduce el ruido pero no resuelve la causa. Se
      descartó explícitamente poner cupos fijos por tipo de token (ej. "12 números + 8 nombres")
      por no generalizar a otro tipo de imagen. Dirección correcta para cuando haya más casos
      reales con qué calibrar: usar la estructura jerárquica de Tesseract (`blocks`/`paragraphs`/
      `lines`, cada uno con su `bbox` y `confidence`) para priorizar el bloque relevante antes de
      extraer tokens. Preparación ya identificada: `ocr.service.js` debe pedir `{ blocks: true }`
      a `worker.recognize()` (no viene por defecto); `recognizeImage()` sigue devolviendo el
      objeto completo sin cambiar su contrato; `image.fusion.js` decide cuándo y cómo usar
      `ocr.blocks` cuando esté disponible, sin que el contrato entre módulos tenga que cambiar
- [x] **Placeholder de "visión no disponible" ya no carga LLaVA a ciegas** — resuelto como
      consecuencia del fix de `modelRouterMode` (ver entrada de `InsufficientMemoryError` arriba):
      al no haber marcador `Análisis visual:`, `isVisionResponse` da falso y ahora el router de
      modelos automático usa un modelo de texto normal, no LLaVA. Sigue sin definir la UX ideal
      del mensaje en sí (hoy el placeholder describe el problema en primera persona del sistema,
      ej. "no se detectó texto legible..." — podría redactarse mejor de cara al usuario), pero eso
      es un tema de copy, no de arquitectura ni de VRAM — bajado de prioridad

### 🩹 Patch Mode — pendientes
- [ ] **Afinar el prompt de Patch Mode para que el `search` cubra toda línea que cambia de
      comportamiento, no solo la línea ancla** — encontrado probando Patch Mode en laptop (v3.0.0,
      ver ROADMAP historial + DECISIONS.md): pedirle a `qwen2.5-coder-3b-q8` agregar un timestamp
      al log de `logger.middleware.js` generó un diff válido pero incompleto — el `console.log`
      original quedó duplicado en vez de reemplazado. Causa raíz identificada: el único ejemplo en
      `coder.patch.txt` muestra insertar una línea NUEVA después de un ancla (firma de función),
      nunca reemplazar una línea EXISTENTE — un modelo de 3B generaliza mal a partir de un solo
      ejemplo y copia ese patrón aunque el pedido real necesite tocar una línea que ya estaba ahí.
      Fix barato: agregar una regla explícita ("SEARCH debe incluir cualquier línea existente que
      cambie o deba eliminarse") + un segundo ejemplo que muestre ese caso. Probar con más casos
      antes de confirmar qué tan seguido pasa
- [ ] **Mejores modelos para patch mode en laptop** (movido desde "🤖 Modelos a investigar",
      candidato original: `deepseek-coder-6.7b-q4`) — probar PRIMERO el fix de prompt de arriba,
      que es mucho más barato: puede que el problema sea el ejemplo del prompt y no el tamaño del
      modelo. Si después de afinar el prompt el problema persiste con distintos tipos de cambio,
      recién ahí evaluar cambiar de modelo. Relacionado también con "Pipeline de razonamiento →
      código en dos etapas" (🔌 Separación Motor/Modelo, v4.0) — ese apunta a un problema distinto
      (errores de lógica/orden, no de alcance del diff) pero mismo síntoma general: modelo de
      código chico sin ayuda extra no es del todo confiable en Patch Mode
- [ ] **Los adjuntos se recortan a 800 caracteres en patch mode** — `attachmentContext.slice(0, 800)`
      en `chat.controller.js`, unas 25 líneas. Si la función que el usuario quiere modificar está
      más abajo, el modelo ve solo el principio del archivo y completa el resto inventando: la
      misma alucinación que se corrigió con la validación de grounding, pero por otra vía, y ésta
      **no** la detecta esa validación porque `effectiveContext` no está vacío. En las pruebas de
      v3.0.0 pasó desapercibido porque `auth.middleware.js` tiene 784 caracteres, justo debajo del
      corte. Evaluar: subir el límite en función del presupuesto real de contexto (ya se calcula en
      `[CONTEXT BUDGET]`) en vez de un número fijo, y/o centrar el recorte en la función mencionada
      como ya hace `buildPatchGrounding()` con el snapshot
- [ ] **El snapshot guarda rutas absolutas y se rompe si el proyecto cambia de ruta** — el
      `projectContext.json` guarda `absolutePath` por archivo. Si la carpeta se mueve de unidad
      (caso real: `H:` → `J:`), todas las rutas quedan colgadas y el proyecto sigue apareciendo
      como indexado. Desde v3.0.0 al menos se detecta y avisa al usuario que reindexe (ver
      `reason: 'unreadable'`), pero la causa sigue: evaluar guardar la ruta relativa al
      `snapshotRoot` y resolverla contra la raíz actual, o revalidar el snapshot al abrir el
      proyecto y marcarlo como obsoleto en la UI. Ojo: cambiar el formato de `projectContext.json`
      afecta a los snapshots ya generados — necesita migración o fallback al formato viejo

### 🧾 Logging y diagnóstico — pendientes
- [x] **App congelada tras cualquier error de chat** — reportado en las pruebas de regresión de
      v3.0.0. Tras el error "Patch Mode requiere un archivo de contexto" (y también sin conexión al
      backend, `data.ok === false`, o frenar una respuesta antes de que escribiera nada), clickear
      otro chat en la sidebar no cambiaba el contenido: se seguía viendo el chat del error. Causa:
      `createStreamingBubble()` marca `chatBox` con `data-streaming="true"` y ese flag se limpiaba
      en un único lugar — `finalizeStreamingBubble()` —, pero todas las ramas de error hacen
      `bubble.remove()` sin pasar por ahí, así que quedaba en `true` para siempre y
      `loadChatHistory()` (que arranca con `if (dataset.streaming === 'true') return`) dejaba de
      cargar nada. Corregido limpiando el atributo en el `finally` de `sendMessage()`, que cubre
      todas las salidas de una vez. Mismo problema y misma corrección para `data-reloading`, que
      quedaba pegado si `loadSidebar()` tiraba dentro del `.then()` del renombrado automático. Ver
      DECISIONS.md

- [x] **El aviso de "Patch Mode requiere un archivo de contexto" se persiste en el historial** — antes
      el aviso vivía solo en el DOM, pero el mensaje del usuario sí se guardaba (y antes de la
      validación), así que al reabrir el chat quedaba una pregunta huérfana sin ninguna respuesta.
      Ahora se guarda como mensaje normal de `assistant` desde el backend. Contrapartida asumida: el
      modelo lo recibe como contexto en los turnos siguientes y aparece en los `.md` exportados —
      la alternativa (rol `notice` filtrado del prompt) queda descrita en DECISIONS.md por si hace
      falta

- [x] **Patch Mode aborta en vez de alucinar cuando no puede ver el archivo** — encontrado en las
      pruebas de v3.0.0: la misma pregunta devolvió tres patches sobre funciones inexistentes
      (`createSnapshot`, `snapshotService(data)`, `snapshotService(config)`), cada una con firma
      distinta, y la UI ofrecía "⚡ Aplicar" sobre todas. `buildPatchGrounding()` devolvía texto
      vacío en seis salidas distintas y el flujo seguía igual, así que el modelo recibía "generá un
      SEARCH/REPLACE" sin código y lo inventaba. Ahora devuelve un `reason` y se corta con 400
      cuando **no hay ninguna** de las dos fuentes de código (`patchGrounding` del snapshot ni
      `effectiveContext` del adjunto) — con adjunto sigue funcionando aunque el snapshot esté roto.
      Mensaje distinto por causa: sin indexar / archivo no encontrado / **rutas del snapshot
      muertas porque la carpeta cambió de unidad** (con la ruta muerta en el trace) / error de
      lectura. Registrado en el log y persistido en el historial. Ver DECISIONS.md
- [x] **Rechazos de Patch Mode: se distinguen por código, no por texto del mensaje** — `chat.js`
      usaba `errMsg.includes('Patch Mode')`, así que cualquier mensaje nuevo con otra redacción
      caía en el `else` y mostraba "Sin conexión con el backend", un error falso. `api.js` ahora
      adjunta `err.code` y el frontend compara contra `PATCH_REJECTION_CODES`. De paso se corrigió
      el "⚠️ ⚠️" duplicado (`addErrorMessage` ya pone su propio ícono)
- [x] **Bloques de patch duplicados en un mismo mensaje** — el modelo emite el mismo bloque
      SEARCH/REPLACE más de una vez con frecuencia, y `messageRenderer.js` creaba una tarjeta por
      cada aparición: dos botones "Aplicar" idénticos apuntando al mismo cambio. El usuario apretó
      los dos y la línea quedó insertada dos veces. Ahora se deduplica por
      archivo+search+replace dentro del mensaje y se renderiza sólo la primera. Complementa al
      registro persistente: la deduplicación evita dos botones para el mismo cambio, el registro
      evita que un botón usado se rearme al recargar

- [x] **Estado "ya aplicado" persistente por proyecto** — aplicar el mismo patch dos veces duplicaba
      la línea en el archivo. El `disabled` del botón sólo vivía en memoria: al reabrir un chat la
      tarjeta se redibujaba rearmada. Ahora el backend registra los patches aplicados en
      `applied-patches.json` (por proyecto, no por chat — el archivo es del proyecto), expuesto en
      `GET /project/:id/patch/applied`, y el frontend lo pide antes de pintar el historial. El botón
      queda marcado "✓ Aplicado" con la fecha, pero **sigue siendo clickeable con confirmación**: el
      registro puede quedar desactualizado si el usuario revierte el archivo a mano. Se descartó
      detectar idempotencia en el backend (bloquea el caso legítimo). Ojo: `patchHash()` está
      duplicado en backend y frontend y deben coincidir — si divergen, el marcado falla en silencio.
      Ver DECISIONS.md

- [x] **PÉRDIDA DE DATOS en "Aplicar" — el span del SEARCH contaba una línea de más** — encontrado
      en la primera prueba end-to-end de "Aplicar", verificando el archivo en disco después de que
      la app dijera "✓ Aplicado". Pedir "agregá un console.log" **reemplazó** el `console.log` que el
      archivo ya tenía. Causa: el bloque SEARCH termina en salto de línea (formato normal de
      `<<<<<<< SEARCH`), y `"abc\n".split('\n')` deja un elemento vacío final, así que el span daba
      2 líneas para un fragmento de 1 y el reemplazo se comía la línea siguiente — sin mostrarla en
      el diff. Afectaba a **todos** los patches, no a este caso puntual. Corregido descartando los
      vacíos finales al calcular el rango (sin tocar el `indexOf` que ancla el match) y en la vista
      previa. El backup automático permitió restaurar el archivo. Ver DECISIONS.md

- [x] **Nombrar un archivo inexistente ya no cae al parecido semántico** — hueco encontrado al
      probar el fix anterior: pidiendo `snapshot.service.js` en un proyecto que no lo tiene, el
      resolvedor semántico devolvía `auth.middleware.js` (score 0.575) y le inyectaba ESE archivo al
      modelo. Como sí había código, la validación de grounding no saltaba y el modelo inventaba
      igual (`function getSnapshot(id)`) — la pregunta no era "¿hay código?" sino "¿es el archivo
      que pidió?". Ahora, si el mensaje nombra un archivo y ninguno del proyecto coincide, se corta
      sin fallback. El chequeo va **antes** de `preResolvedMatch` (si no, nunca se ejecuta) y usa
      una lista cerrada de extensiones: el patrón genérico matcheaba `console.log` y habría
      rechazado pedidos válidos. Ver DECISIONS.md

- [x] **El rechazo por archivo inexistente nombra el proyecto** — "No encontré ese archivo en el
      proyecto \"X\"", que es el dato que falta para entender el rechazo (la causa dominante es pedir
      un archivo de otro proyecto). Se evaluó listar además los archivos indexados y se descartó
      por ruidoso: en un proyecto real son decenas y el mensaje se vuelve un volcado del índice. El
      error de "Aplicar" también nombra las dos causas reales (adjunto de otra carpeta / snapshot
      desactualizado) en vez de "Archivo no encontrado: x"

- [x] **"Aplicar" fallaba en silencio + la ruta del archivo se inventaba con adjuntos** — apretar
      "⚡ Aplicar" sobre un patch correcto no hacía nada visible. Dos causas encadenadas: (a) con
      contexto que viene de un **adjunto** no hay bloque de grounding que le diga la ruta al modelo,
      así que la inventaba (`backend/middlewares/logger.middleware.js` en vez de
      `middlewares/logger.middleware.js`) y `applyPatch` no encontraba el archivo — resuelto con
      `resolveAttachmentRelPath()`, que busca el nombre del adjunto en el índice del proyecto y
      antepone `Archivo: <relPath>`; (b) el error se escribía dentro del botón y se auto-borraba a
      los 3 segundos, así que un patch fallido se veía igual que no haber hecho clic — ahora va a
      un toast legible, el botón queda en rojo sin limpiarse y el detalle completo en su `title`.
      El mismo silencio ocurría cuando el bloque SEARCH no matcheaba, que es el caso más probable
      con un modelo local. Ver DECISIONS.md

- [x] **La búsqueda web ya no corre en Patch Mode** — se mandaba a Tavily el pedido literal del
      usuario ("dame el diff para agregar un console.log a...") y los 6 resultados de tutoriales
      genéricos entraban al prompt, comiéndose el presupuesto de contexto que necesita el archivo.
      `coder/hybrid` la conserva (ahí consultar documentación sí aporta). El trace registra
      `webSearch.skippedForPatch` para que no parezca un error de configuración

- [x] **`patch_no_context` no dejaba línea en el log** — encontrado al probar el camino de error del
      logger en v3.0.0. La validación de contexto de patch mode hace `return res.status(400)` dentro
      del `try`: como no lanza excepción, el `catch` (donde vive el `logRequest` del camino de error)
      nunca corría, y el rechazo más común de patch mode quedaba fuera del diagnóstico. Corregido
      agregando el `logRequest` explícito antes del `return`, con la misma forma que el resto de las
      salidas (`ok:false` + `errorMessage` + trace completo + modelo ya resuelto). Ver DECISIONS.md

- [ ] **Un aborto del usuario es indistinguible de un final normal en el log** — encontrado en las pruebas de regresión de v3.0.0: al frenar una respuesta con el botón de stop, la entrada en `requests-*.jsonl` queda con `ok: true` y `finishReason: "stop"`, exactamente igual que una generación que terminó sola. El motivo es que `abortCurrentStream()` (`frontend/api.js`) aborta el `fetch` del lado del cliente, pero el backend ya escribió (o escribe igual) su `logRequest` del camino exitoso — nunca se entera de que el usuario cortó. Consecuencia práctica: si alguien reporta "se me cortó la respuesta a la mitad", el log no permite distinguir si lo cortó el usuario, si el modelo se detuvo solo, o si hubo un problema real. Fix propuesto: detectar el cierre prematuro de la conexión SSE en el backend (evento `close` del `res`) y marcar la entrada con `aborted: true`, dejando `finishReason` reservado para lo que efectivamente reporta el modelo. Ojo con el orden: hoy `logRequest` corre al terminar el stream, así que hay que decidir si se escribe la entrada igual y se marca, o si se espera al `close` — el segundo camino corre riesgo de perder entradas si el proceso muere antes

---

## 🔮 vX.x

### 📦 Empaquetado / distribución multiplataforma
Movidos desde "Pendiente real de v3.0" — no bloquean el instalador de Windows ya funcional,
sin fecha asignada hasta que haya necesidad real de distribuir a macOS/Linux o de firmar el
ejecutable.
- [ ] Electron Builder — `.dmg` (macOS), `.AppImage` (Linux)
- [ ] Firma de código para Windows/macOS

### 🖼️ OCR Pipeline — pendientes

- [ ] Divisor de páginas PDF como herramienta independiente
- [ ] Selector de idioma OCR por proyecto desde `projectSettings.json`
- [ ] TTL para cache OCR — limpieza automática por antigüedad

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
- [ ] ~~Mejores modelos para patch mode en laptop~~ — movido a "🩹 Patch Mode — pendientes" (v5.0)
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

### 👥 Perfiles de búsqueda — pendientes
Implementación base ya completada en v2.18.0 (ver bloque de historial arriba y DECISIONS.md →
"Hoja de ruta para el creador de perfiles"). Esto es lo que sigue pendiente:
- [ ] **Asignar perfil al crear usuario** — agregar selector de perfil en modal "Nuevo usuario" para vincular desde el momento de creación (hoy nace "sin perfil" y se reasigna después)
- [ ] **Editar nombre de un perfil ya creado** — hoy se puede crear/eliminar pero no renombrar desde la UI (sí desde `PATCH /search/record` a nivel API)

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
- [ ] Investigar compatibilidad de otros modelos con node-llama-cpp (`llava-1.6` ya confirmado, ver `capability.matrix.js`; `phi-3-mini-q4` se eliminó del catálogo, ver DECISIONS.md)
- [ ] **Bug: `deepseek-coder-6.7b-q6` (alias `coder-patch`) falla con `InsufficientMemoryError: A context size of 16384 is too large for the available VRAM`** al activarse Patch Mode — reproducible incluso en sesión recién abierta (RTX 4070). Mismo patrón ya resuelto antes en `hermes-q5` (8192→6000) y `qwen2.5-14b` (→6144): bajar `context_size` de `deepseek-coder-6.7b-q6` en `token.profiles.js` a un valor que entre en la VRAM disponible.
---

### 🎚️ Perfil de hardware + instalador + modelos Breeze — pendientes a confirmar en build real
Todo lo agregado/cambiado en esta sesión (perfiles Breeze/Storm, instalador NSIS, CUDA Toolkit,
modelos de razonamiento/análisis) — ver DECISIONS.md para el detalle de cada uno:

- [ ] **`phi-4-mini-reasoning` — probar apenas se descargue.** Riesgo de wrapper: `getChatWrapperName()`
      fuerza `ChatMLChatWrapper` para cualquier modelo "phi", pero su template real usa tags
      `<|system|>`/`<|user|>`/`<|assistant|>`, no ChatML — mismo síntoma que el bug histórico de
      `phi-3-mini-q4` (respuestas vacías/corruptas) si no tolera bien el wrapper incorrecto. Fix si
      falla: `JinjaTemplateChatWrapper` o `resolveChatWrapper()` de node-llama-cpp en vez del mapeo
      manual por nombre de archivo.
- [ ] Confirmar que `phi-4-mini-reasoning` y `qwen3-8b` aparecen en Configuración → Modelos y en el
      desplegable manual del chat, solo bajo perfil Breeze (no Storm).
- [ ] Confirmar que el desplegable de modelos del chat muestra la lista correcta desde el primer
      arranque (fix de orden `renderLocalModels`/`initHardwareProfile` en `app.js`) y que cambiar el
      perfil en Preferencias lo refresca en vivo sin reiniciar.
- [ ] Confirmar en build real que la página de perfil de hardware (Breeze/Storm) aparece en un
      install limpio, se saltea en una reinstalación/actualización, y que `app-settings.json` queda
      con el contenido exacto que espera `settings.service.js`.
- [ ] Confirmar que la página "¿para quién se instalará?" ya no aparece (modo per-user forzado vía
      `customInstallMode`) y que el resto del flujo (perfil, CUDA Toolkit, `customInstall`) sigue
      funcionando igual.
- [ ] Confirmar que un build completo (las dos pasadas de compilación: instalador + desinstalador
      embebido) termina sin más warnings de NSIS.
- [ ] Confirmar que `ExecShell "open"` abre correctamente el navegador en la página de CUDA Toolkit y
      que el resto de la instalación de Tempest sigue avanzando en paralelo sin bloquearse.
- [ ] Confirmar visualmente que los radio buttons Breeze/Storm de `installer.nsh` (sin emoji) se ven
      bien, y que el emoji (🌬️/⛈️) sí renderiza correctamente en el panel web de Configuración.
- [ ] Desinstalar a mano la instalación vieja per-machine de pruebas en `C:\Program Files\Tempest IA`
      — queda huérfana tras el cambio a instalación per-user forzada, el nuevo instalador no la
      detecta/reemplaza automáticamente.
- [ ] No investigado: si el instalador de CUDA Toolkit requiere privilegios de administrador —
      relevante solo si en algún momento se vuelve a intentar automatizar su instalación.
- [ ] Evaluar si la propia app (no el instalador) debería detectar `CUDA_PATH` ausente en su primer
      arranque y avisarlo en la UI — sería un lugar más confiable que el instalador, que ya no
      espera a que el usuario termine de instalar CUDA Toolkit.
- [ ] Si en el futuro se decide mover la instalación a `C:\Program Files` (modo per-machine): hay
      que revertir `customInstallMode`, setear `perMachine: true`, y sobre todo arreglar de verdad
      el bug de `$APPDATA`/`SetShellVarContext` (hoy solo evitado, no corregido) para que
      `app-settings.json` se guarde donde la app realmente lo busca. Ver DECISIONS.md para el
      detalle completo de los pasos.

---

### 🏷️ Renombrado automático — pulido (vX.x)

**Síntoma:** títulos con palabras basura ocasionales: fragmentos como "como", "se", o palabras cortadas ("hab" de "habla", "Matemáticas Suma hab").

**Estado:** mitigado pero no 100%. El prompt few-shot con patrón `→` hace ~90%; `cleanGeneratedTitle` (blacklist + detección de frases con verbos) limpia el resto.

**Tareas:**
- [ ] Limpiar fragmentos sueltos al final del título (palabras de ≤3 caracteres que no son palabras completas).
- [ ] Ajustar más el prompt. Preferencia: mejorar el prompt sobre ampliar la blacklist.

**Prioridad:** baja. Los títulos son funcionales y descriptivos en la mayoría de los casos.
