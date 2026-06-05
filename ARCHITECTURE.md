# Arquitectura - Tempest

## 🧩 Visión general

Tempest es un asistente local de IA con arquitectura cliente-servidor, frontend web, backend Node.js/Express, motor LocalAI y persistencia basada en archivos JSON.

```text
Usuario → Frontend → Backend → Modo Router → Sistema de Prompts → Memoria/Contexto/Servicios → LocalAI → Backend (SSE) → Frontend
```

---

## 🔧 Componentes principales

### Frontend

- Interfaz de chat tipo ChatGPT.
- Sidebar con chats independientes y proyectos.
- Menú de modelos locales (Q4/Q5/Q6) y servicios externos.
- Menú de herramientas con transcripción y adjuntos.
- Chips visuales de archivos adjuntos con drag & drop.
- Modales para transcripción, eliminación, creación de proyectos y renombrado.
- Estado activo del chat mediante `chatState.js`.
- Comunicación HTTP con el backend mediante `fetch` / `FormData`.
- **Streaming de respuesta** — `createStreamingBubble` crea burbuja vacía, `finalizeStreamingBubble` renderiza el resultado final con limpieza de stop tokens y prefijos internos filtrados.
- Renderizado de respuestas con acciones por mensaje.
- **Botones de acción con íconos SVG** — visibles al hover, sin interferir con selección de texto.
- Separación automática de múltiples archivos en bloques individuales.
- Modo selección para eliminación múltiple de chats independientes.
- Input multilínea autoexpandible.
- **Área de entrada con flexbox** — textarea arriba, barra de herramientas fija abajo (+ izquierda, enviar derecha).
- **Botón enviar con ícono de avión de papel** dentro del área de entrada.
- Validación de nombres de chats y proyectos.
- **Airbag visual en `finalizeStreamingBubble`** — limpia stop tokens de Hermes y prefijos internos filtrados antes de renderizar.
- **Modal de context files** — subir archivos al proyecto, toggle activo/siempre, eliminar, drag & drop sobre el contenedor.
- **Label de modelo automático** — muestra el modelo elegido por el router en tiempo real al inicio del stream, sin cambiar `primaryModel`.
- **Toggle de Context Snapshot** — activar/desactivar snapshot por proyecto sin borrarlo.
- **Explorador de carpetas** — autocompletado de rutas via `GET /fs/browse`, navegación por directorios con botón subir y selección.

### Backend

- API REST con Express.
- Controladores para chat, transcripción y **context files**.
- **Streaming SSE** en `chat.controller.js` — usa `Content-Type: text/event-stream` y reenvía tokens con `res.write()`.
- **Router de modos** en `services/mode.router.js` — detecta `coder/strict`, `coder/hybrid`, `explain`, `general`.
- **Router inteligente de modelos** en `services/model.router/` — selecciona el modelo óptimo según tipo de tarea, perfil de calidad y hardware. Orquestador en `index.js`, registro de modelos en `capability.matrix.js`, detección de tarea en `task.detector.js`, mapeo en `profile.mapper.js`, fallback en `fallback.manager.js`.
- **Sistema de prompts por capas** en `config/buildSystemPrompt.js` — ensambla system prompt dinámicamente desde archivos de texto. Es `async` desde v1.4.0 para incluir la Capa 4.
- **Separación mensaje al modelo vs historial** — `finalMessage` con prefijo va al modelo; `historialMessage` sin prefijo se guarda en memoria.
- Servicios separados para LocalAI, memoria, transcripción, adjuntos y **context files**.
- Persistencia por archivos JSON.
- Endpoints para crear, listar, renombrar y eliminar chats/proyectos.
- Endpoint para generación automática de títulos.
- multer para recepción de archivos (hasta 8, máx 10MB cada uno para adjuntos; hasta 20 para context files).
- Job escoba para limpieza de temporales cada 6h.

### Motor IA

- LocalAI `master-gpu-nvidia-cuda-12` ejecutando modelos GGUF para chat (Q4, Q5, Q6) con `stream: true`.
- `streamToLocalAI` — AsyncGenerator que hace `yield` de cada token recibido.
- Startup buffer — descarta tokens de basura al inicio de cada respuesta.
- Detector de loops en tiempo real — corta respuestas repetitivas con regex de n-gramas.
- Modelo Whisper vía LocalAI para transcripción de audio.
- Generación auxiliar de títulos cortos para chats (sin stream, `max_tokens: 12`).
- **Modelo Qwen2.5-VL-7B** vía LocalAI para análisis visual — `vision.service.js` como cliente con interfaz reemplazable.

---

## 🧱 Sistema de prompts por capas (v1.4.0)

El system prompt se construye dinámicamente antes de cada llamada a LocalAI, ensamblando cuatro capas independientes.

### Orquestador

```text
backend/config/buildSystemPrompt.js
```

Importado en `localai.service.js` como:
```js
const { buildSystemPrompt } = require('../config/buildSystemPrompt');
// llamada con await — es async desde v1.4.0
const systemPrompt = await buildSystemPrompt({ fullMemory, mode, variant, userId, projectId, userMessage, skipContextFiles });
```

### Estructura de archivos

```text
backend/config/
├── buildSystemPrompt.js          ← orquestador público
└── prompts/
    ├── global.system.txt         ← Capa 1: identidad, idioma, restricciones base
    ├── modes/
    │   ├── general.txt           ← instrucciones para conversación general
    │   ├── coder.strict.txt      ← instrucciones para modo código estricto
    │   ├── coder.hybrid.txt      ← instrucciones para modo código híbrido
    │   └── explain.txt           ← instrucciones para modo explicación
    └── loaders/
        ├── global.loader.js      ← lee global.system.txt
        ├── mode.loader.js        ← lee el archivo de modo correcto
        ├── project.loader.js     ← lee memoria del proyecto si existe
        └── prompt.builder.js     ← ensambla las capas en orden
```

### Capas en orden de ensamblado

```text
Capa 1 — global.system.txt
  Identidad del asistente, idioma, restricciones base.
  Se aplica siempre, en todos los modos y proyectos.

Capa 2 — modes/{mode}.txt
  Instrucciones específicas del modo detectado por mode.router.js.
  Cambia en cada request según el tipo de consulta.

Capa 3 — projectPrompt (opcional)
  Prompt personalizado del proyecto, leído de projectSettings.json → prompts.projectPromptText.
  Editable desde la UI: menú ⋯ del proyecto → Configuración.
  Solo se agrega si el campo no está vacío. Excluido para projectId === 'general'.

Capa 4 — context files (opcional)
  Archivos subidos al proyecto, ensamblados por context.service.js.
  Delimitados con ### CONTEXT: PROJECT FILES ### ... ### CONTEXT: END ###
  Solo se agrega si el proyecto tiene archivos de contexto habilitados.
  Omitida cuando skipContextFiles=true (patch mode) — el archivo relevante
  se inyecta directamente en el mensaje del usuario via buildPatchGrounding.
```

### Cómo modificar el comportamiento del asistente

Para cambiar cómo responde Tempest, editar los archivos `.txt` directamente — no tocar código:

- Cambiar idioma o tono → `global.system.txt`
- Cambiar cómo genera código → `modes/coder.strict.txt` o `modes/coder.hybrid.txt`
- Cambiar cómo explica conceptos → `modes/explain.txt`
- Cambiar el comportamiento general de conversación → `modes/general.txt`

---

## 📁 Sistema de Context Files (v1.4.0)

### Arquitectura

```text
backend/services/context/
├── context.service.js        ← orquestador público
├── assembler.js              ← junta providers, llama budgeter
├── budgeter.js               ← presupuesto + truncado inteligente
└── providers/
    ├── upload.provider.js    ← lee files/ del disco (v1)
    ├── snapshot.provider.js  ← lee archivos del Context Snapshot (v1.7)
    └── fs.provider.js        ← stub seguro para lectura de disco (v2/Electron)
```

### Storage por proyecto

```text
backend/data/users/local-user/projects/{projectId}/
├── projectMemory.json        ← memoria/resumen (existente)
├── projectSettings.json      ← NUEVO: settings (prompts, reglas de contexto)
└── context/
    ├── index.json            ← inventario de items
    └── files/
        ├── f_001.txt         ← contenido extraído
        └── f_001.meta.json   ← metadata del archivo original
```

### Contrato de Provider

Todos los providers devuelven:
```js
{ id, name, relPath, alwaysInclude, includeWhenMentioned, priority, content }
```

### Budgeter — orden de prioridad

```text
1. alwaysInclude: true
2. includeWhenMentioned: true  (y el nombre aparece en userMessage)
3. resto (si hay espacio)
```

Límites: `maxFilesPerRequest` y `maxCharsTotal` desde `projectSettings.json`.

### Endpoints REST

```text
GET    /project/:projectId/context/items
POST   /project/:projectId/context/upload
PATCH  /project/:projectId/context/item/:id
DELETE /project/:projectId/context/item/:id
GET    /project/:projectId/settings
PATCH  /project/:projectId/settings
POST   /project/:projectId/context/snapshot
GET    /project/:projectId/context/snapshot/status
POST   /project/:projectId/context/snapshot/toggle
POST   /project/:projectId/patch/apply
GET    /fs/browse
```

---

## 🧹 Capa de sanitización

```text
backend/utils/sanitize.js       ← fuente de verdad (función pura)
backend/utils/cleanReply.js     ← wrapper legacy → llama sanitizeModelOutput()
frontend/ui.js                  ← airbag visual independiente en finalizeStreamingBubble
```

- `sanitizeModelOutput(text, options?)` — elimina stop tokens, prefijos internos filtrados, ruido del modelo, normaliza whitespace.
- Frontend mantiene su propio airbag porque renderiza durante el stream, antes de que backend guarde en historial.

---

## 🎯 Router de modos

```text
chat.controller.js
↓ detectMode({ rawMessage, files, configMode })
↓
services/mode.router.js
↓ { mode, variant, reason }
↓
chat.controller.js
↓ buildPrefixedMessage(rawMessage, mode, variant) → finalMessage (al modelo)
↓ rawTrimmed + attachmentContext → historialMessage (a memoria)
↓ streamOptions.mode = mode
↓
localai.service.js
↓ buildSystemPrompt({ fullMemory, mode, variant, userId, projectId })
↓ getMaxTokens(model, message, options.mode, hardwareProfile)
```

### Modos
| Modo | Variant | Comportamiento |
|------|---------|----------------|
| `coder` | `strict` | Solo código, tokens máximos |
| `coder` | `hybrid` | Explicación breve + código |
| `explain` | `null` | Solo texto, tokens normales |
| `general` | `null` | Sin modificación |
| `visual`  | `null` | Análisis de imagen con modelo multimodal |

---

## 🤖 Router inteligente de modelos (v1.5.0)

chat.controller.js
↓ selectModel({ mode, variant, messageText, contextSize, configModel, autoProfile, hardwareProfile })
↓
services/model.router/index.js
↓ task.detector.js → taskProfile (general-fast, coder-heavy, explain-deep, etc.)
↓ profile.mapper.js → alias lógico según autoProfile (rapido/balanceado/calidad)
↓ capability.matrix.js → modelo real según hardwareProfile
↓ fallback.manager.js → modelo de emergencia si falla
↓ { model, reason, alias, taskProfile }
↓
chat.controller.js → pasa model a streamToLocalAI

| Alias | Descripción |
|-------|-------------|
| `general-fast` | Conversación rápida |
| `general-standard` | Conversación balanceada |
| `explain-deep` | Explicaciones y análisis |
| `coder-fast` | Código simple y snippets |
| `coder-heavy` | Código complejo y arquitectura |
| `coder-patch` | Diff/patch quirúrgico (DeepSeek) |
| `visual` | Análisis de imagen multimodal (Qwen2.5-VL desktop, LLaVA laptop) |
| `fallback` | Emergencia ante error técnico |

### Perfiles de calidad
| Perfil | Comportamiento |
|--------|---------------|
| `rapido` | Modelos más ligeros, respuesta inmediata |
| `balanceado` | Equilibrio calidad/velocidad (default) |
| `calidad` | Modelos más capaces, más lentos |

### HARDWARE_PROFILE
Hardcodeado en `chat.controller.js` como `const HARDWARE_PROFILE = 'desktop'`. Para cambiar entre desktop y laptop, editar esta constante.

---

## 🛡️ Defensas del modelo en `localai.service.js`

### processedMessage
Contextualiza mensajes cortos (≤50 chars) sin palabras de pregunta para evitar ambigüedad:
- `tepic` → `Háblame brevemente sobre: tepic.`
- `que sabes de zelda` → va directo (tiene palabra de pregunta)
- Mensajes de 1-2 chars → `Necesito más contexto para responderte.`

### isUsefulMessage
Filtra mensajes genéricos del historial antes de enviarlo al modelo. Evita que saludos y frases vacías consuman tokens de contexto.

### Startup buffer
Descarta tokens de basura al inicio del stream (`://`, `\`, `:`) sin eliminar saltos de línea legítimos.

### Detector de loops
Detecta en tiempo real repetición de frases de 15-80 caracteres y corta el stream antes de que el loop se muestre al usuario.

---

## 🧠 Sistema multi-contexto

```text
Usuario
└── Proyecto
    └── Chat
```

- Cada chat tiene su propio historial y memoria de trabajo.
- Un chat no puede leer el historial de otro chat.
- Un chat dentro de proyecto accede a memoria + memoria del proyecto + perfil global + **context files del proyecto**.
- Un chat sin proyecto pertenece al proyecto especial `general`.
- El modelo recibe los últimos 2 mensajes del historial filtrados por `isUsefulMessage`.

---

## 📎 Sistema de adjuntos

### Flujo

```text
frontend/modules/attachments.js  ← chips visuales, drag & drop
↓
frontend/api.js  ← FormData cuando hay archivos, JSON cuando no
↓
backend/routes/chat.routes.js  ← multer recibe hasta 8 archivos en uploads/attachments/
↓
backend/controllers/chat.controller.js  ← detectMode, buildAttachmentContext
↓
backend/services/attachment.service.js  ← orquestador, delega a extractores
↓
backend/services/attachment/extractors/  ← un extractor por formato
↓
prompt inyectado a LocalAI como bloque --- ARCHIVOS ADJUNTOS ---
```

### Extracción por tipo

| Tipo | Librería | Observaciones |
|------|----------|---------------|
| PDF texto | pdf2json | pdf-parse y pdfjs-dist descartados por bugs de exports |
| PDF escaneado | Poppler + Tesseract.js | detección automática por umbral de texto (<50 chars) |
| DOCX texto | mammoth | extracción de texto plano |
| DOCX imágenes | JSZip + Tesseract.js | extrae word/media/*, combina con texto mammoth |
| XLSX | xlsx | conversión por hoja a CSV etiquetado |
| PPTX | unzipper + XML | extractor modular en `attachment/extractors/pptx.extractor.js` |
| TXT/código | fs.readFile | truncado inteligente preservando cabecera e imports |
| Imágenes (texto) | Tesseract.js | OCR con preprocesado sharp, cache SHA-1 |
| Imágenes (visual) | Qwen2.5-VL vía LocalAI | fallback cuando OCR < 60% confianza, `vision.service.js` |

### Truncado inteligente

- **Código**: 60% cabecera + 30% final, límite 7500 chars
- **Documentos**: 65% inicio + 25% final, límite 7500 chars
- Aviso de truncado incluido en el texto enviado al modelo

### Limpieza de temporales

- **Capa A**: `finally` en el controller tras cada request
- **Capa B**: `setInterval` cada 6h en `server.js` borra archivos con más de 24h

### Pipeline visual (v2.3.0)

Cuando OCR da confianza < 60% o texto vacío, `image.extractor.js` llama a `vision.service.js`:

```text
image.extractor.js
↓ recognizeImage → { text, confidence }
↓ si confidence < MIN_CONFIDENCE (60%)
↓ isVisionAvailable() → consulta /v1/models
↓ describeImage(filePath) → { description, model, truncated }
    ↓ sharp → redimensiona a 1024px, JPEG quality 70
    ↓ toBase64DataURL → base64 para envío a LocalAI
    ↓ POST /v1/chat/completions con image_url + text prompt
    ↓ removeLoops() → elimina párrafos/frases duplicadas
    ↓ retorna { description, model: 'qwen2.5-vl-7b-q4', truncated }
↓ content: "[Imagen adjunta | Análisis visual: qwen2.5-vl-7b-q4]\n\n{description}"
```

**Contrato de `vision.service.js`:** `describeImage(filePath, hint?) → Promise<{ description, model, truncated }>`. Interfaz reemplazable — en Electron puede apuntar a API externa sin cambiar `image.extractor.js`.

---

## 🌊 Sistema de streaming

### Flujo completo

```text
frontend/app.js
↓ createStreamingBubble(chatBox) → { bubble, rawEl }
↓
api.js → fetch POST /chat
↓ ReadableStream reader
↓ onToken(token) → rawEl.textContent += token
↓
backend/controllers/chat.controller.js
↓ detectMode → { mode, variant, reason }
↓ buildPrefixedMessage → finalMessage (con prefijo, va al modelo)
↓ rawTrimmed + attachmentContext → historialMessage (sin prefijo, a memoria)
↓ res.setHeader('Content-Type', 'text/event-stream')
↓ for await (token of streamToLocalAI(finalMessage, ...))
↓ res.write(`data: ${JSON.stringify(token)}\n\n`)
↓
services/localai.service.js → streamToLocalAI (async generator)
↓ buildSystemPrompt({ fullMemory, mode, variant, userId, projectId })
↓ processedMessage → contextualiza mensajes cortos si aplica
↓ isUsefulMessage → filtra historial genérico
↓ fetch LocalAI con stream: true
↓ startup buffer → descarta tokens basura al inicio
↓ detector de loops → corta repeticiones en tiempo real
↓ getMaxTokens(model, message, options.mode, hardwareProfile)
↓ ReadableStream → yield token
↓
LocalAI genera tokens individuales
↓
res.write('data: [DONE] {...}\n\n') → res.end()
↓
frontend: finalizeStreamingBubble(bubble, rawEl, fullText)
↓ limpia stop tokens (VISUAL_STOP_TOKENS)
↓ stripLeakedInstructions (airbag visual)
↓ renderMixedContent → bloques de código, links, acciones
```

---

## 📦 Estructura real del proyecto

```text
Tempest/
├── backend/
│   ├── config/
│   │   ├── buildSystemPrompt.js          ← orquestador del sistema de prompts
│   │   └── prompts/
│   │       ├── global.system.txt         ← prompt base global
│   │       ├── modes/
│   │   │   ├── general.txt
│   │   │   ├── coder.strict.txt
│   │   │   ├── coder.hybrid.txt
│   │   │   ├── coder.patch.txt
│   │   │   └── explain.txt
│   │       └── loaders/
│   │           ├── global.loader.js
│   │           ├── mode.loader.js
│   │           ├── project.loader.js
│   │           └── prompt.builder.js
│   ├── controllers/
│   │   ├── chat.controller.js
│   │   ├── context.controller.js         
│   │   └── transcription.controller.js
│   ├── data/
│   │   └── users/
│   │       └── local-user/
│   │           ├── profile.json
│   │           └── projects/
│   │               ├── general/
│   │               │   ├── projectMemory.json
│   │               │   └── chats/
│   │               └── project-name/
│   │               ├── projectMemory.json
│   │                ├── projectSettings.json  
│   │                ├── chats/
│   │                └── context/              
│   │                    ├── index.json
│   │                    └── files/
│   ├── outputs/
│   │   └── transcriptions/
│   ├── routes/
│   │   ├── chat.routes.js
│   │   ├── context.routes.js             
│   │   └── transcription.routes.js
│   ├── services/
│   │   ├── attachment.service.js
│   │   ├── attachment/
│   │   │   ├── extractors/
│   │   │   │   ├── pptx.extractor.js
│   │   │   │   ├── image.extractor.js       ← OCR imágenes sueltas (v2.2.0)
│   │   │   │   ├── pdf.ocr.extractor.js     ← OCR PDF escaneado (v2.2.1)
│   │   │   │   └── docx.ocr.extractor.js    ← OCR DOCX imágenes embebidas (v2.2.2)
│   │   │   └── ocr/
│   │   │       ├── ocr.service.js           ← motor OCR central, worker singleton, cache
│   │   │       ├── preprocessor.js          ← preprocesado sharp, interfaz reemplazable (v2.2.3)
│   │   │       └── rasterizers/
│   │   │           └── pdf.rasterizer.js    ← rasterización Poppler, interfaz reemplazable
│   │   ├── context/
│   │   ├── context.service.js
│   │   ├── assembler.js
│   │   ├── budgeter.js
│   │   ├── snapshot.service.js       ← NUEVO v1.7
│   │   └── providers/
│   │       ├── upload.provider.js
│   │       ├── snapshot.provider.js  ← NUEVO v1.7
│   │       └── fs.provider.js
│   │   ├── localai.service.js
│   │   ├── localai/
│   │   │   ├── memory.answers.js
│   │   │   ├── response.validator.js
│   │   │   └── token.profiles.js
│   │   ├── model.router/
│   │   │   ├── index.js
│   │   │   ├── capability.matrix.js
│   │   │   ├── task.detector.js
│   │   │   ├── profile.mapper.js
│   │   │   └── fallback.manager.js
│   │   ├── memory.service.js
│   │   ├── mode.router.js
│   │   ├── patch.parser.js
│   │   ├── patch/
│   │   └── apply.service.js          ← NUEVO v1.7
│   │   └── transcription.service.js
│   ├── scripts/
│   │   └── migrate-projects.js           ← NUEVO
│   ├── uploads/
│   │   ├── attachments/
│   │   ├── audio/
│   │   ├── chunks/
│   │   └── context-tmp/                  ← NUEVO
│   ├── utils/
│   │   ├── cleanReply.js
│   │   └── sanitize.js
│   └── server.js
│
frontend/
├── modules/
│   ├── models.js
│   ├── sidebar.js
│   ├── attachments.js
│   ├── contextFiles.js
│   ├── projectConfig.js
│   ├── transcription.js
│   ├── modals.js
│   ├── chat.js             ← envío, creación de chats, ensureGeneralChatExists
│   ├── streaming.js        ← createStreamingBubble, finalizeStreamingBubble, airbag visual
│   ├── autoRename.js       ← tryAutoRename, makeUniqueChatTitle
│   ├── patchRenderer.js    ← renderPatchBlock, showApplyResult, botón ⚡ Aplicar
│   ├── codeRenderer.js     ← renderCodeBlock, bloques terminal
│   └── messageRenderer.js  ← renderMixedContent, renderMessageActions, renderText
├── app.js                  ← solo orquestador
├── api.js
├── chatState.js
├── ui.js                   ← addMessage, addDocumentCard, addErrorMessage, showErrorToast
├── index.html
└── styles.css
│
├── docker/
│   └── docker-compose.yml
│
└── models-localai/
    ├── hermes-q4.yaml         ← desktop, modelo principal
    ├── hermes-q5.yaml         ← desktop, equilibrado
    ├── hermes-q6.yaml         ← desktop, calidad
    ├── llama-3.2-3b-q4.yaml  ← laptop
    ├── qwen2.5-3b-q4.yaml    ← laptop
    └── qwen2.5-3b-q5.yaml    ← laptop
```

---

## 🤖 Modelos GGUF soportados

| Perfil | Modelo | Hardware | Uso |
|--------|--------|----------|-----|
| hermes-q4 | Hermes-3-Llama-3.1-8B Q4 | Desktop | Rápido, uso diario, general |
| hermes-q5 | Hermes-3-Llama-3.1-8B Q5 | Desktop | Equilibrado |
| hermes-q6 | Hermes-3-Llama-3.1-8B Q6 | Desktop | Mayor calidad |
| llama-3.1-8b-q5 | LLaMA 3.1 8B Q5 | Desktop | General estándar |
| qwen2.5-7b-q5 | Qwen2.5 7B Q5 | Desktop | General estándar |
| gemma-2-9b-q4 | Gemma 2 9B Q4 | Desktop | Explicaciones profundas |
| deepseek-coder-6.7b-q6 | DeepSeek Coder 6.7B Q6 | Desktop | Código diario, patch mode |
| qwen-coder-14b-q4 | Qwen2.5-Coder 14B Q4 | Desktop | Código complejo, arquitectura |
| llama-3.2-3b-q4 | Hermes-3-Llama-3.2-3B Q4 | Laptop | Rápido, bajo consumo |
| qwen2.5-3b-q4 | Qwen2.5-3B Instruct Q4 | Laptop | Equilibrado |
| qwen2.5-3b-q5 | Qwen2.5-3B Instruct Q5 | Laptop | Mayor calidad |

Ver `MODELS.md` para la configuración completa de cada modelo.

---

## 🧾 Endpoints principales

```text
POST /chat
GET  /chat/history
GET  /chats
POST /chat/create
POST /chat/delete
POST /chat/rename
GET  /projects
POST /project/create
POST /project/delete
POST /project/rename
POST /title/generate
POST /transcribe
GET    /project/:projectId/context/items
POST   /project/:projectId/context/upload
PATCH  /project/:projectId/context/item/:id
DELETE /project/:projectId/context/item/:id
GET    /project/:projectId/settings
PATCH  /project/:projectId/settings
```

---

## 🔗 Contratos internos críticos (v2.0.x)

### model.router pipeline
```text
mode.router.js     → { mode: 'coder', variant: 'patch' }
model.router/index.js → effectiveMode = (mode==='coder' && variant==='patch') ? 'coder/patch' : mode
task.detector.js   → recibe effectiveMode, retorna profile: 'coder-patch'
capability.matrix  → 'coder-patch' → deepseek-coder-6.7b-q6 (desktop)
```
Si se rompe esta cadena, patch mode cae en `general` y elige `qwen2.5-7b-q5`.

### contextSize y contextFileTypes
`chat.controller.js` calcula ambos leyendo `context/index.json` antes de llamar a `detectBestModel`. Nunca hardcodear `contextSize: 0` — el router no podrá distinguir proyectos de código vs documentos.

### label de modelo automático
Backend manda `[MODEL]` SSE antes del stream → `api.js` llama `onModel` callback → `app.js` actualiza label. `primaryModel` nunca cambia — el label es solo visual.

### DOM compartido en modales
`snapshotToggle`, `snapshotBtn`, `closeBtn` son elementos compartidos entre proyectos. Siempre `cloneNode+replaceWith` antes de registrar listeners al abrir cada modal.

### patch mode e historial
`localai.service.js` manda historial vacío cuando `options.variant === 'patch'`. DeepSeek con historial largo de diffs causa timeout por prefill excesivo.

### patch mode grounding (v2.1.1)
`chat.controller.js` llama `buildPatchGrounding(userMessage, projectId)` cuando `variant === 'patch'`:
- Lee `context/index.json` → filtra `source='snapshot'` && `enabled !== false`
- Carga `projectContext.json` (manifest) → obtiene `absolutePath` por `relPath`
- Lee contenido real del archivo con `readFileContent(absolutePath)`
- Truncado por zonas: HEAD=800 chars + TAIL=400 chars, MAX_TOTAL=2500 chars
- Devuelve bloque `<<<FILE_BEGIN: relPath\n{contenido}\nFILE_END>>>`
- El bloque se inyecta al inicio de `finalMessage` (mensaje del usuario), no en el system prompt
- `streamOptions.skipContextFiles = true` — omite Capa 4 para no saturar prefill de DeepSeek
- Si no hay snapshot, devuelve string vacío silenciosamente — flujo continúa sin grounding

---

## ⚙️ Principios arquitectónicos

- Separación de responsabilidades.
- Backend modular — cada servicio tiene una sola responsabilidad.
- Sistema de prompts por capas — comportamiento configurable sin tocar código.
- Frontend organizado por módulos.
- Persistencia simple y depurable — JSON inspeccionable directamente.
- Streaming nativo con SSE sin dependencias externas.
- Capa de sanitización centralizada y reutilizable.
- Extractores por formato con contrato estándar.
- Defensas activas contra comportamiento degenerativo del modelo (loops, tokens basura).
- Preparado para migrar a base de datos.
- Preparado para sistema multiusuario real.
- Preparado para `source="fs"` (Electron/v2) sin tocar módulos existentes.
- Parser agnóstico de patches — acepta múltiples formatos de salida del modelo.

---

## 🛠️ Modo Desarrollador (Dev Panel) — v2.4.3

Sistema transversal de observabilidad visible solo para perfil `admin`.

### Backend

**`backend/services/devMode.service.js`** (NUEVO)
- Singleton en memoria. Lee `ADMIN_MODE` de `.env`.
- `isAdmin()` — devuelve true si `ADMIN_MODE=true`.
- `isDevModeEnabled()` / `toggleDevMode(value)` — estado del panel en memoria.
- Interfaz reemplazable: al implementar login real, solo cambia qué devuelve `isAdmin()`.

**`backend/routes/dev.routes.js`** (NUEVO)
- `GET /me` → `{ role: 'admin' | 'user' }` — contrato de roles.
- `POST /debug/toggle` — activa/desactiva el panel (solo admin).
- `GET /debug/status` — estado actual (solo admin).

**`chat.controller.js`** — emite evento SSE `[DEBUG]` al final del stream (flujo normal) con `{ mode, variant, model, hardwareProfile, contextSize, truncated }`. Viaja por el mismo stream que `[MODEL]` y `[DONE]`.

### Frontend

**`frontend/modules/devPanel.js`** (NUEVO)
- `initDevPanel()` — consulta `/me` al arrancar; si no es admin, no inyecta nada en el DOM.
- `handleDebugEvent(payload)` — recibe el evento `[DEBUG]` y renderiza el panel.
- Panel colapsable con flecha `‹`/`›` en el borde derecho. Estado recordado en `localStorage`.
- Se inyecta como hermano de `.chat-app` dentro de `.app` (no dentro de `.chat-app`).

**`frontend/styles/devpanel.css`** (NUEVO) — estilos del panel con colores hardcodeados del tema oscuro (no usa variables CSS, que no existen en Tempest).

**Contrato del flujo:** `api.js` (`sendChatMessage` acepta callback `onDebug`) → `chat.js` (pasa `_deps.onDebug`) → `app.js` (`onDebug: handleDebugEvent` en `chatDeps`). Si Dev Mode está off o el rol es user, el evento `[DEBUG]` se descarta silenciosamente sin overhead.

---

## 🏷️ Generación de títulos y renombrado paralelo — v2.4.3

**`generateTitleFromText` (`localai.service.js`):**
- Modelo de títulos: `hermes-q4` (desktop) / `llama-3.2-3b-q4` (laptop), vía `fallbackModel`.
- `TITLE_FALLBACK_MODELS` — lista de modelos no aptos (coders + razonamiento pesado) que hacen fallback al modelo de títulos.
- Prompt few-shot con patrón `"texto" → palabras clave`, `max_tokens: 8`, `temperature: 0.3`.
- Sin timeout — el renombrado es paralelo y no bloquea al usuario; espera lo necesario a que LocalAI procese.

**`cleanGeneratedTitle` + `buildFallbackTitle` (`localai.service.js`):**
- `buildFallbackTitle(text)` — extrae primeras palabras significativas del mensaje original cuando el modelo falla.
- `cleanGeneratedTitle` — limpia tokens de control, detecta frases con verbos (las descarta), aplica blacklist de palabras basura, recorta a 4 palabras, capitaliza.

**Flujo de renombrado paralelo (`chat.js` + `autoRename.js`):**
- `chat.js` lanza `tryAutoRename` como `titlePromise` (sin `await`) en paralelo al stream, con `loadSidebar: null`.
- Al terminar el stream: `await titlePromise` (ya resuelto) + un único `loadSidebar(getSidebarDeps())`.
- `autoRename.js` verifica `getChatState().chatId === renameTarget.chatId` antes de `setActiveChat` — evita el chat huérfano si el usuario cambió de chat durante la generación.

**Contrato implícito (chat.js ↔ autoRename.js):** `tryAutoRename` recibe `loadSidebar` que puede ser `null` durante el paralelo; debe verificarlo antes de invocarlo (`if (loadSidebar)`).

---

## 📊 Dev Panel — métricas de request (v2.4.5)

### Flujo de datos

**`streamToLocalAI` (`localai.service.js`):**
- Recibe tercer parámetro `meta = {}` por referencia.
- Antes del stream: calcula `meta.promptTokens` sumando la longitud de todos los mensajes ensamblados (`system prompt + historial + mensaje usuario`) dividido entre 4.
- En `finally`: propaga `meta.finishReason`, `meta.timingPrompt`, `meta.timingGeneration` desde el `streamMeta` interno. Preserva `meta.promptTokens` si LocalAI no devuelve valor real (`streamMeta.promptTokens || meta.promptTokens`).

**`chat.controller.js`:**
- `streamStart = Date.now()` antes del `for await`.
- `replyLength` acumula la longitud de cada token generado durante el stream.
- Al terminar: construye `debugPayload` con `durationMs`, `tokensIn`, `tokensOut`, `finishReason`, `truncated`, `timingPrompt`, `timingGeneration`.
- Emite evento SSE `[DEBUG]` antes de `[DONE]`.

**`devPanel.js`:**
- `handleDebugEvent(payload)` recibe el payload y llama `_renderPanel`.
- Muestra: modelo, modo, duración (rojo si >5000ms), tokens entrada/salida, finish reason, truncado, timings internos (si LocalAI los devuelve), historial de últimos 10 requests.

### Limitaciones conocidas
- LocalAI con backend llama.cpp no devuelve `usage` en modo stream — tokens son estimaciones (longitud / 4).
- `Extra-Usage: true` activa timings internos cuando LocalAI los soporte; actualmente no llegan con la versión en uso.

---

## ⚙️ Modal de Configuración (Settings) — v2.4.6

### Módulos

**`frontend/modules/settings.js`** (NUEVO)
- `initSettings(isAdmin)` — inicializa el modal de configuración.
- Si `isAdmin = true`, muestra la sección de Debug Mode.
- Consulta `/debug/status` al arrancar para sincronizar el estado del toggle.
- `_updatePanelVisibility(enabled)` — muestra u oculta el `devPanelWrapper` completo según el estado del toggle.
- El toggle llama a `POST /debug/toggle` al cambiar — activa/desactiva sin reiniciar el servidor.

**`frontend/styles/settings.css`** (NUEVO)
- Estilos del botón ⚙ en el sidebar footer.
- Estilos del modal de configuración — secciones, toggle switch, hints.

### Flujo

```text
app.js: const isAdmin = await initDevPanel()
app.js: await initSettings(isAdmin)
    ↓
settings.js: consulta /debug/status → aplica visibilidad inicial del Dev Panel
    ↓
usuario abre modal ⚙ → activa toggle
    ↓
POST /debug/toggle → devMode.service.js: devModeEnabled = true
    ↓
_updatePanelVisibility(true) → devPanelWrapper visible
    ↓
próxima consulta → chat.controller.js: isDevModeEnabled() === true → emite [DEBUG]
    ↓
devPanel.js: handleDebugEvent(payload) → renderiza métricas
```

### Contrato implícito

`initDevPanel()` debe retornar `isAdmin` al final (después de `_injectHTML` y `_bindEvents`). Si el `return` se coloca antes de esas llamadas, el panel nunca se inyecta en el DOM y `settings.js` no puede controlar su visibilidad.

---

## 🔐 Sistema de Autenticación JWT — v2.4.8

### Backend

**`backend/services/auth.service.js`** (NUEVO)
- `initDefaultAdmin()` — crea usuario `admin/admin` al arrancar si no hay usuarios en `users.json`.
- `login(username, password)` — valida credenciales, devuelve JWT firmado con `JWT_SECRET`.
- `verifyToken(token)` — verifica y decodifica el JWT.
- `renewToken(payload)` — genera nuevo token con 2h de expiración (sliding expiration).
- `createUser(username, password, role)` — crea usuario con contraseña hasheada (bcrypt).
- `deleteUser(username)` — elimina usuario; protege contra eliminar el último admin.
- `listUsers()` — devuelve usuarios sin `passwordHash`.

**`backend/middleware/auth.middleware.js`** (NUEVO)
- `authMiddleware` — verifica token en header `Authorization: Bearer <token>`. Si válido, renueva el token en header `X-Renewed-Token` y agrega `req.user` con el payload.
- `adminMiddleware` — verifica que `req.user.role === 'admin'`. Debe usarse después de `authMiddleware`.

**`backend/routes/auth.routes.js`** (NUEVO)
- `POST /auth/login` — login público (sin auth)
- `POST /auth/logout` — requiere auth
- `GET /auth/users` — requiere auth + admin
- `POST /auth/users` — requiere auth + admin
- `DELETE /auth/users/:username` — requiere auth + admin

**`backend/data/users.json`** (NUEVO, generado automáticamente)
- Persiste usuarios con `passwordHash` (bcrypt). Nunca contiene contraseñas en texto plano.

### Frontend

**`frontend/modules/login.js`** (NUEVO)
- `initLogin()` — si no hay token, muestra pantalla de login y espera autenticación.
- `getToken()` / `saveSession()` / `clearSession()` — gestión del token en `localStorage`.
- `fetchWithAuth(url, options)` — helper que inyecta `Authorization: Bearer <token>` automáticamente.
- `logout()` — llama a `POST /auth/logout`, limpia sesión y recarga la página.

**`frontend/styles/login.css`** (NUEVO) — estilos de la pantalla de login.

**`frontend/api.js`** — `authHeaders()` inyecta el token en todos los fetch. `handleUnauthorized()` intercepta 401 y redirige al login.

**`frontend/modules/devPanel.js`** y **`frontend/modules/settings.js`** — usan `fetchWithAuth` para consultas internas autenticadas.

### Contrato implícito

- `authMiddleware` debe ir ANTES de `adminMiddleware` en todas las rutas.
- `/hardware-profile` y `/auth/login`