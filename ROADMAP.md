# 🧩 Tempest - Roadmap

## 🚧 Estado actual

Versión actual: **v1.6.0**

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
- **Patch Mode visual** — detección automática, parser agnóstico (Search/Replace + unified diff + simplified diff), renderizado diff rojo/verde, validación de contexto

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
- [ ] ⚠️ Patch Mode funcional completo — pendiente Context Snapshot (el modelo necesita el archivo en context files del proyecto, no como adjunto temporal)
- [ ] Apply patch sobre archivos reales (requiere Context Snapshot + `fs.provider.js`)

---

## 🔥 Prioridad alta

### 🗂️ Sidebar

- [ ] Invertir orden del sidebar: proyectos arriba, chats independientes abajo
- [ ] Ordenar chats por fecha de último mensaje (más reciente arriba)
- [ ] Mover chat al tope de la lista al generar un nuevo mensaje
- [ ] Guardar estado de proyecto colapsado/expandido en localStorage
- [ ] Extender eliminación múltiple a chats dentro de proyectos

### 💬 Acciones por mensaje

- [ ] Mostrar opciones de acción al seleccionar texto manualmente
- [ ] Activar edición de consultas del usuario
- [ ] Activar compartir respuestas
- [ ] Activar intentar nuevamente en respuestas de Tempest

### 📎 Adjuntos — pendiente

- [ ] Implementar LibreOffice headless para mejor calidad de extracción
- [ ] Añadir soporte visual para archivos adjuntos en el historial del chat
- [ ] Orden real de slides PPTX leyendo `ppt/presentation.xml`

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
- [ ] Añadir análisis de archivos con visión (imágenes reales)

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
- [ ] Generar `projectContext.json` con estructura, archivos relevantes, hash y mtime
- [ ] Filtrar por extensión y archivos clave
- [ ] Usar hash/mtime para refrescar solo archivos que cambiaron
- [ ] Subir al contexto archivos mencionados explícitamente por el usuario

### 🩹 Prioridad 4 — Patch Mode
- [x] Patch Mode visual completo (v1.6.0)
- [ ] ⚠️ Patch Mode funcional completo — pendiente Context Snapshot
- [ ] Apply patch sobre archivos reales

### 🤖 Modelos recomendados para programación
- [ ] DeepSeek-Coder 6.7B — modelo default para código diario
- [ ] Qwen2.5-Coder 14B — modo calidad/arquitectura
- [ ] CodeLlama 13B — backup/comparación

---

## 📁 Context files por proyecto

- [x] Subida manual de archivos asociados a un proyecto
- [ ] Lectura de carpeta del disco configurada por proyecto (Electron/v2)
- [ ] Pantalla de configuración inicial al crear proyecto

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

## 🎯 v2.0 — Tempest como asistente de programación contextual

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
- [ ] Patch Mode funcional completo — requiere Context Snapshot
- [ ] Apply patch sobre archivos reales

### ⚙️ Experiencia de proyecto
- [ ] Pantalla de configuración inicial al crear proyecto
- [ ] Configuración persistente por proyecto (modelo, modo, prompts, contexto)

---

## 🔮 vX.x

- [ ] Respaldo/exportación de memoria
- [ ] LibreOffice headless para extracción de alta fidelidad
- [ ] Función de voz al chat: hablar → texto → consulta
- [ ] Stream de audio en vivo con Faster-Whisper
- [ ] Migrar JSON a SQLite/PostgreSQL
- [ ] Sistema de login y múltiples usuarios
- [ ] Búsqueda semántica con embeddings
- [ ] App desktop con Electron
- [ ] Context files por proyecto — lectura de carpetas del disco (Electron/v2)
- [ ] Integración de correo Outlook