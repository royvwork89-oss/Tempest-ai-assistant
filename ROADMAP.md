# 🧩 Tempest - Roadmap

## 🚧 Estado actual

Versión actual: **v2.9.0**

Sistema funcional con:

- **Migración a node-llama-cpp (v3.0.0)** — motor de IA migrado de LocalAI+Docker a node-llama-cpp nativo; streaming token a token real via callback→AsyncGenerator; cambio dinámico de modelos con `switchModel()`; `gemma-2-9b-q4` temporalmente reemplazado por `llama-3.1-8b-q5` en alias `explain-deep` por incompatibilidad CUDA
- **Visión con Ollama (v3.0.0)** — `vision.service.js` migrado de LocalAI a Ollama; modelos registrados con Modelfiles; mmproj incluido en registro para soporte multimodal real
- **Bug duplicación resuelto (v3.0.0)** — respuestas duplicadas en JSON y UI eliminadas; `memory.addChatHistoryMessage` centralizado en controller; flags `streaming`/`reloading` en chatBox para bloquear `loadChatHistory`
- **Electron Builder portable (v3.0.0)** — ejecutable `Tempest IA.exe` generado; binarios CUDA de node-llama-cpp incluidos manualmente; `MODELS_DIR` configurable via env
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
- Transcripción de audio con exportación TXT/PDF/DOCX
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

### 📎 Adjuntos — pendiente

- [ ] Implementar LibreOffice headless para mejor calidad de extracción
- [ ] Añadir soporte visual para archivos adjuntos en el historial del chat
- [ ] Orden real de slides PPTX leyendo `ppt/presentation.xml`
- [ ] OCR con `tesseract.js` — extraer texto de imágenes dentro de PDF/DOCX escaneados
- [ ] Análisis visual real con modelo multimodal (LLaVA o Qwen2-VL vía LocalAI) — requiere modelo descargado

### 🧠 Memoria

- [ ] Mejorar detección de datos importantes
- [ ] Evitar duplicados en perfil/memoria
- [ ] Añadir resumen automático por chat
- [ ] Añadir resumen automático por proyecto
- [ ] Limpiar historial viejo sin perder resumen

### 🧾 UI/UX

- [ ] Añadir loader animado de respuesta
- [ ] Añadir confirmación visual al renombrar
- [ ] Mejorar diseño móvil

---

## ⚙️ Transcripción de audio

- [ ] Implementar corte por silencio real (VAD)
- [ ] Optimizar tiempo de procesamiento
- [ ] Permitir elegir idioma del audio
- [ ] Limpiar automáticamente uploads/audio y uploads/chunks
- [ ] Añadir análisis automático de transcripción
- [ ] Enviar transcripción al chat como contexto opcional

---

## 📄 Exportación

- [ ] Mejorar formato de PDF y DOCX
- [ ] Añadir descarga directa desde frontend
- [ ] Añadir nombres de archivo más descriptivos

---

## 🤖 Integración IA

### Modelos locales
- [ ] Configurar Qwen2.5-Coder-14B en desktop
- [ ] Implementar cambio real de modelo desde el menú
- [ ] Añadir selección automática de modelo según la consulta
- [ ] Añadir análisis de archivos con visión — modelo multimodal (LLaVA o Qwen2-VL)
- [ ] OCR como solución intermedia para documentos escaneados (`tesseract.js`)

### APIs externas
- [ ] Integrar Claude API como motor alternativo
- [ ] Integrar OpenAI API como motor alternativo
- [ ] Implementar modo híbrido: LocalAI para trabajo rutinario, API externa para problemas complejos
- [ ] Selección manual y automática de motor

---

## 🧑‍💻 Tempest como asistente de programación

### 🔀 Prioridad 1 — Enrutador de modelos y modos
- [x] Implementar router de modos: `coder` / `explain` / `general`
- [x] Heurística automática para detección de modo
- [ ] Cada modo carga su modelo automáticamente

### 🧱 Prioridad 2 — System prompt por capas por proyecto
- [x] Capa 1: prompt base global
- [x] Capa 2: prompt de modo (coder/explain/general)
- [x] Capa 3: prompt de proyecto (desde projectMemory)
- [x] Capa 4: context files del proyecto (desde context/index.json)
- [x] UI para editar el prompt de proyecto desde la pantalla de configuración

### 📸 Prioridad 3 — Context Snapshot del repo
- [x] Generar `projectContext.json` con estructura, archivos relevantes, hash y mtime
- [x] Filtrar por extensión y archivos clave
- [x] Usar hash/mtime para refrescar solo archivos que cambiaron
- [ ] Subir al contexto archivos mencionados explícitamente por el usuario

### 🩹 Prioridad 4 — Patch Mode
- [x] Patch Mode visual completo (v1.6.0)
- [x] Patch Mode funcional completo — Context Snapshot + apply real (v1.7.0)
- [x] Apply patch sobre archivos reales

### 🤖 Modelos recomendados para programación
- [ ] DeepSeek-Coder 6.7B — modelo default para código diario
- [ ] Qwen2.5-Coder 14B — modo calidad/arquitectura
- [ ] CodeLlama 13B — backup/comparación

---

## 📁 Context files por proyecto

- [x] Subida manual de archivos asociados a un proyecto
- [ ] Lectura de carpeta del disco configurada por proyecto (Electron/v2)
- [x] Pantalla de configuración inicial al crear proyecto (v2.0.0)

---

## 📬 Integración de correo (Outlook)

- [ ] OAuth 2.0 con Microsoft Graph API
- [ ] Leer, resumir y responder correos desde el chat
- [ ] Organizar correos desde el chat

---

## 🧪 Testing

- [ ] Probar todos los endpoints
- [ ] Probar adjuntos: PDF, DOCX, XLSX, PPTX, TXT, código, imágenes
- [ ] Probar router de modos: explain / coder strict / coder hybrid / general
- [ ] Probar sanitize.js con distintos tipos de basura del modelo
- [ ] Pruebas de humo de LocalAI después de cambios en YAML (ver MODELS.md)

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

## 🎯 v3.0 — Tempest como sistema operativo contextual de proyectos

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

**Fase 2 — Eliminar Docker (pendiente)**
- [ ] Reemplazar LocalAI (Go/Docker) por `node-llama-cpp` — bindings nativos C++/Node.js, GPU via CUDA/Metal, compatible con archivos GGUF existentes
- [ ] Empaquetar backend Node.js como proceso principal de Electron (`main process`)
- [ ] Empaquetar frontend como renderer de Electron (sin servidor Express externo)
- [ ] Reemplazar `localai.service.js` — nuevo contrato para `node-llama-cpp`
- [ ] Reemplazar `pdf.rasterizer.js` (Poppler) por `pdfjs-dist` + `canvas` — sin dependencias del SO
- [ ] Reemplazar `preprocessor.js` (sharp) por `jimp` si sharp da problemas con `electron-rebuild`
- [x] Selector nativo de carpetas via `dialog.showOpenDialog` — implementado en v2.8.1 (botón 📁 con fallback a `/fs/browse` en navegador)
- [x] Drag & drop de archivos — funciona en Electron sin cambios de código (el bug era del entorno navegador); duplicados corregidos en v2.8.1
- [ ] Lectura de carpeta del disco por proyecto sin servidor HTTP separado
- [ ] Migrar SearXNG Docker a Tavily/Brave como providers principales — sin contenedor externo

### 📦 Instalador
- [ ] Electron Builder — generar `.exe` (Windows), `.dmg` (macOS), `.AppImage` (Linux)
- [ ] Auto-actualizaciones con `electron-updater`
- [ ] Instalador que incluye modelos GGUF o los descarga en primer arranque
- [ ] Splash screen de carga de modelos
- [ ] Firma de código para Windows/macOS

### 👥 Permisos por usuario
- [x] Permisos de búsqueda web por usuario — admin asigna desde el modal de usuarios qué providers puede usar cada quien (v2.9.0)
  - **Parte 1 — Backend**: agregar campo `searchProviders: ['searxng', 'tavily']` en `users.json` por usuario; `/search/config` filtra providers según usuario autenticado
  - **Parte 2 — Settings admin**: en la fila de cada usuario agregar toggles de providers disponibles (junto a Rol y contraseña)
  - **Parte 3 — Settings usuario**: selector solo muestra providers que el admin le asignó; si solo hay uno, no muestra selector
  - **Regla global**: si admin desactiva un provider globalmente, se deshabilita para todos independientemente de permisos individuales

- [x] Permisos de búsqueda web por usuario — admin asigna desde el modal de usuarios qué providers puede usar cada quien (v2.9.0)
  - **Parte 1 — Backend**: agregar campo `searchProviders: ['searxng', 'tavily']` en `users.json` por usuario; `/search/config` filtra providers según usuario autenticado
  - **Parte 2 — Settings admin**: en la fila de cada usuario agregar toggles de providers disponibles (junto a Rol y contraseña)
  - **Parte 3 — Settings usuario**: selector solo muestra providers que el admin le asignó; si solo hay uno, no muestra selector
  - **Regla global**: si admin desactiva un provider globalmente, se deshabilita para todos independientemente de permisos individuales

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
- [x] Permisos de búsqueda por usuario — admin asigna qué providers puede usar cada quien (v2.9.0)

### 🗄️ Base de datos
- [ ] Migrar JSON a SQLite/PostgreSQL
- [ ] Búsqueda semántica con embeddings

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

### 💬 Acciones por mensaje
- [ ] Mostrar opciones al seleccionar texto
- [ ] Edición de consultas del usuario
- [ ] Compartir respuestas
- [ ] Intentar nuevamente en respuestas de Tempest

### 📎 Adjuntos
- [ ] LibreOffice headless para mejor extracción
- [ ] Soporte visual de adjuntos en historial del chat
- [ ] Orden real de slides PPTX

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

### ⚙️ Transcripción
- [ ] Corte por silencio real (VAD)
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

### 🧹 Stop tokens y limpieza
- [ ] Agregar `Human:` y `Assistant:` a stopwords en YAMLs relevantes
- [ ] Limpieza post-response en `sanitize.js` para autocompletado basura
- [ ] Verificar `<|endoftext|>` en todos los modelos desktop

### 💻 Hardware profiles
- [x] Mantener laptop profile ligero y estable — qwen2.5-3b-q5, llama-3.2-3b-q4, qwen2.5-coder-3b-q8
- [x] Routing inteligente que evite modelos pesados en laptop
- [x] Patch Mode funcional en laptop con modelos 3B
- [ ] Evitar que snapshots grandes destruyan rendimiento en laptop
- [ ] Degradación elegante: capability.matrix desktop no debe romper laptop profile

### 🤖 Modelos a investigar
- [ ] Mejores modelos para grounding documental
- [ ] Mejores modelos para patch mode en laptop (deepseek-coder-6.7b-q4)
- [ ] Modelos híbridos razonamiento + coding
- [ ] Mantener compatibilidad: ligeros laptop / coder / documentales / reasoning

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

### 🏗️ Empaquetado Electron — pendientes
- [ ] Automatizar inclusión de `backend/node_modules/` en electron-builder
- [ ] Incluir binarios `@node-llama-cpp/win-x64-cuda` automáticamente en el build
- [ ] `MODELS_DIR` configurable desde UI de primer arranque
- [ ] Instalador silencioso de Ollama para visión multimodal
- [ ] Desinstalar Docker completamente del flujo de desarrollo

### 🤖 Compatibilidad de modelos con node-llama-cpp
- [ ] Reactivar `gemma-2-9b-q4` en `capability.matrix.js` cuando node-llama-cpp corrija CUDA error con arquitectura Gemma 2
- [ ] Investigar compatibilidad de otros modelos (phi-3, llava) con node-llama-cpp
---

### 🏷️ Renombrado automático — pulido (vX.x)

**Síntoma:** títulos con palabras basura ocasionales: fragmentos como "como", "se", o palabras cortadas ("hab" de "habla", "Matemáticas Suma hab").

**Estado:** mitigado pero no 100%. El prompt few-shot con patrón `→` hace ~90%; `cleanGeneratedTitle` (blacklist + detección de frases con verbos) limpia el resto.

**Tareas:**
- [ ] Limpiar fragmentos sueltos al final del título (palabras de ≤3 caracteres que no son palabras completas).
- [ ] Ajustar más el prompt. Preferencia: mejorar el prompt sobre ampliar la blacklist.

**Prioridad:** baja. Los títulos son funcionales y descriptivos en la mayoría de los casos.
