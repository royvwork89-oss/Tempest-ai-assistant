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

- LocalAI v2.25 ejecutando modelos GGUF para chat (Q4, Q5, Q6) con `stream: true`.
- `streamToLocalAI` — AsyncGenerator que hace `yield` de cada token recibido.
- Startup buffer — descarta tokens de basura al inicio de cada respuesta.
- Detector de loops en tiempo real — corta respuestas repetitivas con regex de n-gramas.
- Modelo Whisper vía LocalAI para transcripción de audio.
- Generación auxiliar de títulos cortos para chats (sin stream, `max_tokens: 12`).

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
const systemPrompt = await buildSystemPrompt({ fullMemory, mode, variant, userId, projectId, userMessage });
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

### Alias lógicos
| Alias | Descripción |
|-------|-------------|
| `general-fast` | Conversación rápida |
| `general-standard` | Conversación balanceada |
| `explain-deep` | Explicaciones y análisis |
| `coder-fast` | Código simple y snippets |
| `coder-heavy` | Código complejo y arquitectura |
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
| PDF | pdf2json | pdf-parse y pdfjs-dist descartados por bugs de exports |
| DOCX | mammoth | extracción de texto plano |
| XLSX | xlsx | conversión por hoja a CSV etiquetado |
| PPTX | unzipper + XML | extractor modular en `attachment/extractors/pptx.extractor.js` |
| TXT/código | fs.readFile | truncado inteligente preservando cabecera e imports |
| Imágenes | — | placeholder con metadata, sin análisis visual |

### Truncado inteligente

- **Código**: 60% cabecera + 30% final, límite 7500 chars
- **Documentos**: 65% inicio + 25% final, límite 7500 chars
- Aviso de truncado incluido en el texto enviado al modelo

### Limpieza de temporales

- **Capa A**: `finally` en el controller tras cada request
- **Capa B**: `setInterval` cada 6h en `server.js` borra archivos con más de 24h

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
│   │   │   └── extractors/
│   │   │       └── pptx.extractor.js
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