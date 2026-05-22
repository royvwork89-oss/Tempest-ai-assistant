# 🧩 Tempest - Roadmap

## 🚧 Estado actual

Versión actual: **v2.0.2**

Sistema funcional con:

- Chat local con IA (modelos Q4, Q5, Q6 para desktop; Llama 3.2 3B / Qwen2.5 3B para laptop)
- **5 modelos nuevos desktop** — LLaMA 3.1 8B Q5, Qwen2.5 7B Q5, Gemma 2 9B Q4, DeepSeek Coder 6.7B Q6, Qwen Coder 14B Q4
- LocalAI v2.25 como motor principal con GPU activa (RTX 4070, `gpu-layers: 99`)
- **Router inteligente de modelos** — selección automática según tipo de tarea, perfil y hardware
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
- **Eliminación múltiple de chats por proyecto** — opción "Seleccionar chats" en menú ⋯ de cada proyecto, checkboxes aislados por proyecto
- **Configuración inicial al crear proyecto** — modal de configuración se abre automáticamente tras crear un proyecto
- **Configuración persistente por proyecto** — `preferences.defaultModel` y `preferences.defaultMode` en `projectSettings.json`, leídos como override suave en cada chat, reflejados visualmente en el selector del header
- **Router inteligente por tipo de contexto** — `contextFileTypes` pasa al router para distinguir proyectos de código vs documentos, evita elegir DeepSeek para proyectos con `.docx`/`.pdf`
- **Label de modelo automático en tiempo real** — evento SSE `[MODEL]` antes del stream, callback `onModel` en frontend, `primaryModel` sigue siendo `'auto'`
- **Toggle de Context Snapshot** — activar/desactivar snapshot sin borrarlo, rehabilitación automática al regenerar
- **Explorador de carpetas** — autocompletado via `GET /fs/browse`, navegación con subir/bajar directorios
- **Drag & drop en context files** — arrastrar archivos directamente al contenedor del modal
- **Fix patch mode pipeline** — `effectiveMode` en `model.router/index.js`, historial vacío en patch mode para evitar timeout de DeepSeek

---

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
- [ ] Separar `contextFiles.js` — modal de context files + snapshot + toggle + browse
- [ ] Separar `projectConfig.js` — modal de configuración del proyecto
- [ ] Separar `transcription.js` — modal de transcripción
- [ ] Separar `modals.js` — renombrar, confirmar, nuevo proyecto
- [ ] Separar `chat.js` — lógica de envío y creación de chats (de `app.js`)
- [ ] Separar `streaming.js` — createStreamingBubble, finalizeStreamingBubble (de `app.js`)
- [ ] Separar `autoRename.js` — renombrado automático con IA (de `app.js`)
- [ ] Separar `patchRenderer.js` — diff rojo/verde, botón aplicar (de `ui.js`)
- [ ] Separar `codeRenderer.js` — bloques de código terminal (de `ui.js`)
- [ ] Separar `messageRenderer.js` — mensajes, links, acciones (de `ui.js`)
- [ ] Separar CSS en archivos por responsabilidad: base, layout, chat, sidebar, modals, diff, components
- [ ] `app.js` queda solo como orquestador
- [ ] `ui.js` queda solo con funciones base de DOM

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

---

## 🔮 vX.x

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
- [ ] OCR con tesseract.js
- [ ] Análisis visual con modelo multimodal (LLaVA/Qwen2-VL)

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
- [ ] Análisis visual con modelo multimodal
- [ ] OCR con tesseract.js

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
- [ ] Mantener laptop profile ligero y estable — qwen2.5-3b-q5, llama-3.2-3b-q4, deepseek-coder-6.7b-q4
- [ ] Routing inteligente que evite modelos pesados en laptop
- [ ] Patch Mode funcional en laptop con modelos 3B
- [ ] Evitar que snapshots grandes destruyan rendimiento en laptop
- [ ] Degradación elegante: capability.matrix desktop no debe romper laptop profile

### 🤖 Modelos a investigar
- [ ] Mejores modelos para grounding documental
- [ ] Mejores modelos para patch mode en laptop (deepseek-coder-6.7b-q4)
- [ ] Modelos híbridos razonamiento + coding
- [ ] Mantener compatibilidad: ligeros laptop / coder / documentales / reasoning

### 📁 Context files
- [ ] Lectura de carpeta del disco por proyecto (Electron)

### 📬 Outlook
- [ ] OAuth 2.0 con Microsoft Graph API
- [ ] Leer, resumir y responder correos
- [ ] Organizar correos desde el chat

### 🖥️ App desktop y base de datos
- [ ] App desktop con Electron — incluye selector nativo de carpetas
- [ ] Migrar JSON a SQLite/PostgreSQL
- [ ] Sistema de login y múltiples usuarios
- [ ] Búsqueda semántica con embeddings