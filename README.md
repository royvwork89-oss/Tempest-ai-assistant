# 🚀 Tempest AI Assistant

Tempest es un asistente local de IA construido con Node.js, Express, node-llama-cpp y frontend web. Desde v2.10.0 no requiere Docker — el motor de IA corre directamente en Node.js. Permite conversar con modelos locales, organizar chats por proyectos, mantener memoria persistente, transcribir audio a texto y analizar archivos adjuntos.

---

## 📚 Documentación del proyecto

| Archivo | Contenido |
|---------|-----------|
| `README.md` | Este archivo — visión general, características, cómo ejecutar |
| `ARCHITECTURE.md` | Componentes, estructura de carpetas, flujos internos |
| `DECISIONS.md` | Decisiones técnicas y su justificación |
| `FLOW.md` | Flujos detallados de cada función del sistema |
| `MEMORY.md` | Sistema de memoria jerárquica |
| `MODELS.md` | ⚠️ **Lectura obligatoria antes de tocar LocalAI** — configuración de modelos GGUF, problemas conocidos, qué NO cambiar |
| `ROADMAP.md` | Estado del proyecto, versiones completadas, pendientes |

---

## 🧠 Características principales

### 💬 Chat con IA local

- Comunicación con modelos vía `node-llama-cpp` — llama.cpp embebido en Node.js, sin Docker, sin proceso externo.
- Cambio dinámico de modelos — el router elige el modelo óptimo para cada tarea y lo carga automáticamente en VRAM.
- Indicador visual "Cambiando a {modelo}..." cuando el router selecciona un modelo diferente al activo.
- Interfaz tipo ChatGPT.
- **Streaming de respuesta** — el texto aparece palabra por palabra mientras el modelo genera.
- Chats independientes y agrupados por proyecto.
- Historial persistente por chat.
- **Router de modos automático** — detecta si el mensaje es `coder`, `explain` o `general` y ajusta instrucciones y tokens.

### 🤖 Router de modos

- `coder/strict` — código puro: implementaciones, endpoints, archivos.
- `coder/hybrid` — explicación breve + código.
- `coder/patch` — diff quirúrgico aplicable directo sobre el archivo real (con backup automático).
  Se activa por trigger explícito, por verbo + archivo mencionado, o (v2.19.0, "modo Proyecto")
  por relevancia semántica del mensaje contra el Context Snapshot, sin necesitar nombrar el
  archivo — ver DECISIONS.md y ARCHITECTURE.md para el detalle de las 4 vías de detección.
- `explain` — texto explicativo sin código.
- `general` — conversación normal.
- Detección automática por heurística (triggers + tipo de adjunto) y por búsqueda semántica.
- Override manual desde el frontend via `config.mode`.
- `visual` — análisis de imagen con modelo multimodal (Qwen2.5-VL desktop, LLaVA laptop).

### 🧱 Sistema de prompts por capas (v1.4.0)

El system prompt se construye dinámicamente en `backend/config/buildSystemPrompt.js` ensamblando cuatro capas:

```text
backend/config/prompts/
├── global.system.txt        ← identidad, idioma, restricciones base
├── modes/
│   ├── general.txt          ← instrucciones para conversación general
│   ├── coder.strict.txt     ← instrucciones para modo código estricto
│   ├── coder.hybrid.txt     ← instrucciones para modo código híbrido
│   └── explain.txt          ← instrucciones para modo explicación
│   ├── coder.patch.txt      ← instrucciones para modo patch
│   └── visual.txt           ← instrucciones para análisis visual
│   ├── coder.patch.txt      ← instrucciones para modo patch
│   └── visual.txt           ← instrucciones para análisis visual
└── loaders/
    ├── global.loader.js
    ├── mode.loader.js
    ├── project.loader.js
    └── prompt.builder.js
```

Cada capa se puede modificar de forma independiente sin tocar el código. Ver `ARCHITECTURE.md` para el flujo completo.

### 📎 Archivos adjuntos

- Soporte para múltiples archivos por mensaje (hasta 8, máx 10MB cada uno).
- Drag & drop sobre el chat o el área de input.
- Tipos soportados: TXT, MD, HTML, CSS, JS, TS, JSX, TSX, JSON, YAML, XML, CSV, PY, JAVA, C, CPP, H, CS, PHP, RB, GO, RS, SH, BASH, ENV, INI, TOML, SQL, PDF, DOCX, XLSX, PPTX, imágenes.
- Truncado inteligente diferenciado por tipo.
- Limpieza automática de temporales en doble capa.
- **Análisis visual con modelo multimodal** — cuando OCR da confianza < 60%, la imagen se envía automáticamente a Qwen2.5-VL (desktop) o LLaVA (laptop) para descripción detallada.

### 🧹 Sanitización de salidas del modelo

- `sanitize.js` — función pura centralizada, fuente de verdad para toda la limpieza.
- `cleanReply.js` actúa como wrapper legacy para compatibilidad.
- Airbag visual en `finalizeStreamingBubble` — capa independiente en frontend.

### 🧠 Sistema de memoria

- Memoria global de usuario (`profile.json`).
- Memoria por proyecto (`projectMemory.json`).
- Memoria individual por chat (`chatId.json` — `chatId` inmutable desde v2.11.0; `title` es el nombre visible y mutable).
- Historial limpio — los prefijos internos del modo no se guardan en `chatHistory`.
- El modelo recibe los últimos 2 mensajes del historial filtrados por `isUsefulMessage`.

### 🎙️ Transcripción de audio

- Procesamiento con ffmpeg + Whisper vía LocalAI.
- División automática en fragmentos.
- Exportación a TXT, PDF y DOCX.

### 📁 Context files por proyecto

- Subida manual de archivos (PDF, DOCX, XLSX, PPTX, TXT, código) a un proyecto.
- Los archivos se guardan de forma persistente y Tempest los usa como contexto en todos los chats del proyecto.
- Toggle por archivo: **activo** (habilitado/deshabilitado) y **siempre** (incluir en cada mensaje sin importar lo que se pregunte).
- Deduplicación automática por hash SHA-256.
- Gestión desde el menú `⋯` del proyecto → "Archivos de contexto".
- Separado de los adjuntos por mensaje — los context files persisten, los adjuntos son temporales.

### 🖥️ Renderizado de código

- Bloques de código estilo terminal con etiqueta de lenguaje y botón de copiar.
- Separación automática de múltiples archivos en bloques individuales.

---

## 🏗️ Arquitectura

​```text
backend/
├── config/
│   ├── buildSystemPrompt.js       ← orquestador del sistema de prompts por capas
│   ├── systemPrompt.js
│   └── prompts/
│       ├── global.system.txt      ← prompt base global
│       ├── modes/                 ← prompts por modo
│       └── loaders/               ← cargadores de cada capa
├── controllers/
│   ├── chat.controller.js
│   ├── context.controller.js
│   ├── document.controller.js
│   ├── search.controller.js
│   └── transcription.controller.js
├── routes/
│   ├── chat.routes.js
│   ├── context.routes.js
│   ├── transcription.routes.js
│   ├── auth.routes.js
│   ├── dev.routes.js
│   ├── document.routes.js
│   ├── gpu.routes.js
│   ├── metrics.routes.js
│   └── search.routes.js
├── middleware/
│   └── auth.middleware.js
├── scripts/
│   ├── migrate-projects.js        ← migración de proyectos existentes al sistema de context files
│   └── generate-embeddings.js     ← proceso standalone aislado, sin imports de Tempest, lanzado como child process al regenerar snapshot (v2.14.0)
├── services/
│   ├── attachment.service.js
│   ├── document.service.js
│   ├── patch.parser.js            ← parser agnóstico de patches: Search/Replace, unified diff, simplified diff, merge conflict
│   ├── attachment/
│   │   ├── vision.service.js      ← cliente multimodal Ollama (LLaVA / Qwen2.5-VL), interfaz reemplazable
│   │   ├── extractors/
│   │   │   ├── docx.ocr.extractor.js
│   │   │   ├── image.extractor.js
│   │   │   ├── pdf.ocr.extractor.js
│   │   │   └── pptx.extractor.js
│   │   └── ocr/
│   │       ├── ocr.service.js
│   │       ├── preprocessor.js        ← interfaz reemplazable (jimp: grayscale + normalize + upscaling)
│   │       └── rasterizers/
│   │           └── pdf.rasterizer.js  ← pdfjs-dist + @napi-rs/canvas, sin dependencias del SO (v2.11.1)
│   ├── context/
│   │   ├── context.service.js
│   │   ├── assembler.js
│   │   ├── budgeter.js
│   │   ├── snapshot.service.js
│   │   ├── linked-folder.service.js   ← NUEVO v2.17.0 — escaneo bajo demanda de carpeta vinculada por proyecto, independiente de Context Snapshot
│   │   ├── chunk.service.js           ← chunking para embeddings (v2.14.0)
│   │   ├── embed.provider.js          ← búsqueda semántica vía Ollama nomic-embed-text (v2.14.0)
│   │   ├── vector.store.js            ← almacén de vectores (v2.14.0)
│   │   └── providers/
│   │       ├── upload.provider.js
│   │       ├── snapshot.provider.js
│   │       ├── linked-folder.provider.js  ← NUEVO v2.17.0
│   │       └── fs.provider.js
│   ├── localai/
│   │   ├── llama.provider.js      ← motor node-llama-cpp: init, switchModel, generate, stream (v2.10.0)
│   │   ├── models.inventory.js    ← NUEVO v2.17.0 — verifica que los .gguf conocidos existan en disco
│   │   ├── memory.answers.js
│   │   ├── response.validator.js
│   │   └── token.profiles.js
│   ├── model.router/
│   │   ├── index.js
│   │   ├── capability.matrix.js
│   │   ├── task.detector.js
│   │   ├── profile.mapper.js
│   │   └── fallback.manager.js
│   ├── patch/
│   │   ├── apply.service.js
│   │   └── intent.resolver.js     ← NUEVO v2.19.0 — gate semántico "modo Proyecto" antes de detectMode()
│   ├── transcription/
│   │   └── vad.detector.js        ← VAD real con ffmpeg silencedetect, interfaz reemplazable (v2.15.0)
│   ├── auth.service.js
│   ├── devMode.service.js
│   ├── localai.service.js         ← MODEL_FILES (mapeo modelId→archivo) + resolveModelPath, reutilizado por models.inventory.js
│   ├── memory.service.js
│   ├── mode.router.js
│   ├── transcription.service.js
│   └── search/
│       ├── search.service.js
│       └── providers/
│           ├── searxng.provider.js
│           ├── tavily.provider.js
│           └── brave.provider.js
├── utils/
│   ├── cleanReply.js
│   └── sanitize.js
└── server.js

frontend/
├── modules/
│   ├── models.js
│   ├── sidebar.js
│   ├── attachments.js
│   ├── contextFiles.js
│   ├── projectConfig.js
│   ├── transcription.js
│   ├── modals.js
│   ├── chat.js
│   ├── streaming.js
│   ├── autoRename.js
│   ├── patchRenderer.js
│   ├── codeRenderer.js
│   ├── messageRenderer.js
│   ├── devPanel.js
│   ├── settings.js
│   ├── login.js
│   └── webSearch.js
├── styles/
│   ├── base.css
│   ├── layout.css
│   ├── sidebar.css
│   ├── chat.css
│   ├── modals.css
│   ├── components.css
│   ├── diff.css
│   ├── devpanel.css
│   ├── settings.css
│   └── login.css
├── app.js
├── api.js
├── chatState.js
├── ui.js
├── settings.html
└── index.html

shell/                              ← Electron (v2.8.0 → v2.17.0)
├── main.js                         ← require() directo del backend, createSplashWindow +
│                                      waitForModelReady + BrowserWindow principal
├── preload.js                      ← contextBridge mínimo
└── splash.html                     ← NUEVO v2.17.0 — ventana de carga con progreso real

models-localai/
├── hermes-q4.yaml         ← desktop, modelo rápido
├── hermes-q5.yaml         ← desktop, equilibrado
├── phi-3-mini-q4.yaml     ← desktop, descartado para títulos (template incompatible)
├── llama-3.1-8b-q5.yaml   ← desktop, general
├── qwen2.5-7b-q5.yaml     ← desktop, razonamiento
├── gemma-2-9b-q4.yaml     ← desktop, análisis
├── deepseek-coder-6.7b-q6.yaml ← desktop, código rápido
├── qwen-coder-14b-q4.yaml ← desktop, código complejo
├── qwen2_5-vl-7b-q4.yaml  ← desktop, modelo visual
├── llama-3.2-3b-q4.yaml   ← laptop, rápido (título)
├── llama-3.2-3b-q8.yaml   ← laptop, inteligente
├── qwen2.5-3b-q4.yaml     ← laptop, rápido
├── qwen2.5-3b-q5.yaml     ← laptop, moderado
├── qwen2.5-coder-3b-q8.yaml ← laptop, código y patch
└── llava.yaml             ← laptop, modelo visual
​```

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
POST   /project/:projectId/context/snapshot
GET    /project/:projectId/context/snapshot/status
POST   /project/:projectId/patch/apply
GET  /hardware-profile
GET  /gpu/stats
GET  /localai/metrics
GET    /search/config
PATCH  /search/config
POST   /search/test
```

---

## ⚙️ Tecnologías utilizadas

- Node.js + Express
- LocalAI `master-gpu-nvidia-cuda-12` + modelos GGUF (Hermes-3 Q4/Q5/Q6, LLaMA 3.1 8B Q5, Qwen2.5 7B Q5, Gemma 2 9B Q4, DeepSeek Coder 6.7B Q6, Qwen Coder 14B Q4, Qwen2.5-VL-7B-Q4 para desktop, Llama 3.2 3B / Qwen2.5 3B / LLaVA 1.6 para laptop)
- Docker + docker-compose para LocalAI
- GPU: RTX 4070 (desktop) con `gpu-layers: 99`
- Whisper vía LocalAI para transcripción
- ffmpeg para procesamiento de audio
- JavaScript vanilla en frontend
- pdf2json, mammoth, xlsx, unzipper para extracción de documentos
- PDFKit, docx para exportación
- SSE (Server-Sent Events) para streaming

---

## 🚀 Cómo ejecutar el proyecto

### 1. Instalar dependencias

```bash
cd backend
npm install
```

### 2. Ejecutar LocalAI

```bash
cd docker
docker-compose up
```

Esperar a ver `INF LocalAI API is listening!` antes de continuar.

### 3. Ejecutar backend

```bash
cd backend
node server.js
```

### 4. Abrir frontend
http://localhost:3005

### Alternativa: modo escritorio (Electron, v2.11.0 → v2.17.0)

En lugar de los pasos 1-4 (ya no requiere correr el backend ni Docker/LocalAI por separado):

​```bash
cd <raíz del proyecto>
npm install   # solo la primera vez — instala electron y electron-builder
npm start     # carga el backend en el mismo proceso y abre la ventana de Tempest
​```

Desde v2.11.0, `server.js` corre dentro del propio proceso de Electron (sin `spawn`/proceso hijo) y el frontend se carga directo del disco (`loadFile`), sin depender de que Express esté levantado para mostrar la interfaz. Desde v2.17.0, al arrancar se muestra primero una ventana de splash con el progreso real de carga del modelo en VRAM — la ventana principal recién se abre cuando el modelo está listo. Desde v2.18.0, si falta el modelo de chat default o Whisper `large-v3`, el splash también los descarga automáticamente antes de continuar (ver MODELS.md); el resto de los modelos se descarga a mano desde Configuración → Modelos.

---

## ⚠️ Requisitos

- Node.js v18+
- Docker Desktop con WSL2
- ffmpeg instalado y en PATH
- GPU NVIDIA con drivers actualizados (para desktop)
- Modelos GGUF en `models-localai/` — el modelo de chat default y Whisper `large-v3` se descargan solos en el primer arranque si faltan (v2.18.0); el resto se baja desde Configuración → Modelos

---

## ⚠️ Antes de modificar LocalAI

Leer `MODELS.md` primero. Contiene los problemas conocidos con Hermes-3 Q4 y lo que NO se debe cambiar. Ignorar este documento causará regresiones que tomaron muchas horas resolver.

---

## 🧠 Estado del proyecto

Versión actual: **v2.19.0**

Tempest cuenta con:

- ✅ **Patch Mode inteligente + "modo Proyecto" (v2.19.0)** — Patch Mode se activa
  automáticamente sin frase mágica: por verbo de modificación + archivo mencionado
  (`corrige`, `arregla`, `modifica`...), o por relevancia semántica del mensaje contra los
  embeddings del snapshot ("modo Proyecto" — ni siquiera hace falta nombrar el archivo);
  salvaguarda automática ante `InsufficientMemoryError` con reintento de contexto reducido sin
  recargar el modelo; resolución de archivo por búsqueda semántica en vez de fallback ciego al
  primer archivo del snapshot; fix del botón "Aplicar" que nunca funcionaba en Electron (sin
  `BASE_URL` ni JWT); fix del chat placeholder `'default'` que nunca se promovía a un chat real
  dentro de un proyecto. Ver DECISIONS.md para el detalle completo
- ✅ **Instalador real + descarga de modelos + auto-actualizaciones (v2.18.0)** — instalador NSIS (`oneClick`, per-user, sin admin) listo para distribuir al público general; el modelo de chat default (`hermes-q4`) y Whisper `large-v3` se descargan solos en el primer arranque si faltan (checksum sha256 verificado), con splash mostrando progreso real; panel Configuración → Modelos para bajar el resto del catálogo a mano (barra de progreso, cola con máx. 2 descargas simultáneas, "Descargar todos", "Abrir carpeta"); todos los datos escribibles (uploads, data, outputs, logs, modelos) viven en `app.getPath('userData')` — la app funciona sin importar dónde se instale; revisión de actualizaciones 100% manual desde Configuración → Preferencias (`electron-updater` contra GitHub Releases, sin token — repo público), con spinner y modal de confirmación antes de descargar nada. Ver DECISIONS.md para el detalle completo
- ✅ **Perfiles de búsqueda con aislamiento real de credenciales (v2.18.0)** — cada perfil (incluido Perfil Global) y cada usuario "sin perfil" tiene su propia configuración de providers/API keys, 100% independiente; panel Servicios permite crear/eliminar perfiles y reasignar usuarios; un usuario con perfil asignado solo ve una referencia de solo lectura; "Probar conexión" nunca escala por cantidad de usuarios vinculados a un perfil; panel Servicios/Usuarios se refresca al entrar a la pestaña, sin necesitar reiniciar la app. Ver DECISIONS.md para el detalle completo
- ✅ **App de escritorio (Electron Fase 1)** — shell nativo con `shell/main.js`, backend como proceso hijo, Docker/LocalAI sin cambios
- ✅ **App de escritorio real (Electron, v2.11.0)** — backend corre en el main process de Electron (sin proceso hijo), frontend cargado via `loadFile` (sin depender de Express); `BASE_URL` en 7 módulos frontend para que las llamadas API sigan resolviendo correctamente
- ✅ **Splash screen de carga de modelos + chequeo de inventario (v2.17.0)** — ventana de carga con progreso real de VRAM (`onLoadProgress` de node-llama-cpp), diálogo nativo de error si el modelo falla en vez de colgarse, y verificación no bloqueante de que los `.gguf` conocidos existan en disco (`/health.modelsInventory`)
- ✅ **Carpeta vinculada por proyecto (v2.17.0)** — escaneo bajo demanda de una carpeta arbitraria del disco por proyecto (`linked-folder.service.js`), independiente de Context Snapshot (que sigue atado a Patch Mode); indexa PDF/DOCX/PPTX/imágenes además de texto/código reusando el pipeline de extracción y OCR de adjuntos; manifest + contenido cacheado por archivo con diffing por `mtimeMs`/`sizeBytes`; badge "carpeta" propio en Lista de archivos
- ✅ **Fixes de Carpeta del proyecto (v2.17.1)** — el input de ruta ya no comparte valor entre proyectos distintos (se limpiaba al abrir el modal), el selector nativo de carpetas ahora abre en la última ruta de ese campo (`defaultPath`) en vez de recordar una ruta global entre proyectos, `maxFileSize` de la carpeta vinculada subido de 5MB a 100MB para no excluir libros/PDFs grandes, y el log de escaneo truncado ahora reporta la causa real (tamaño / cantidad / límite de recorrido)
- ✅ **Botón detener respuesta** — aborta el stream conservando el texto parcial; UI bloqueada durante la generación para proteger el historial
- ✅ **Historial completo por chat** — la respuesta del asistente se persiste al terminar el stream; cambiar de chat ya no la pierde
- ✅ **Modo Desarrollador (Dev Panel)** — telemetría interna (modelo, modo, tokens estimados, duración, finish reason) visible solo para perfil admin
- ✅ **Renombrado paralelo de chats** — el título se genera al mismo tiempo que la respuesta, no después
- ✅ **Modal de configuración (⚙)** — toggle de debug sin reiniciar el servidor, extensible para futuras opciones
- ✅ **Autenticación JWT** — login real con usuario/contraseña, bcrypt, sliding expiration de 2h
- ✅ **Gestión de usuarios** — crear, listar y eliminar usuarios desde el modal de configuración ⚙, solo visible para admins. Separación HTML en `settings.html`
- ✅ **Cambiar contraseña y rol** — cada usuario cambia su propia contraseña; admin cambia contraseña y rol de cualquier usuario. Revocación inmediata de tokens al cambiar rol
- ✅ **Indicador visual OCR** — badge ⚠ preventivo en adjuntos que requieren OCR, badge rojo en mensajes con error de extracción real
- ✅ **Label de modelo con tipo** — el header muestra el tipo del modelo activo: `[general]`, `[visual]`, `[código]`, `[razonamiento]`, `[análisis]`
- ✅ **Profiling GPU** — sección GPU en Dev Panel con temperatura, VRAM y utilización en tiempo real (polling cada 5s via nvidia-smi)
- ✅ **Métricas LocalAI** — tokens acumulados por modelo desde endpoint Prometheus de LocalAI
- ✅ Chat local funcional con memoria por usuario/proyecto/chat
- ✅ **Streaming de respuesta** — texto aparece palabra por palabra
- ✅ **Router de modos automático** — `coder/strict`, `coder/hybrid`, `explain`, `general`
- ✅ **Sistema de prompts por capas** — global + modo + proyecto, modificables sin tocar código
- ✅ **GPU activa** — RTX 4070 con `gpu-layers: 99`
- ✅ **Estabilización del modelo** — mirostat, temperature correcta, detector de loops, startup buffer
- ✅ **Adjuntos PPTX** — extractor modular con notas del presentador, tablas y tolerancia a fallos
- ✅ **sanitize.js** — capa centralizada de post-procesado de salidas del modelo
- ✅ **Historial limpio** — prefijos internos no se guardan en memoria
- ✅ **Airbag visual** en frontend — capa independiente de limpieza antes de renderizar
- ✅ Sidebar con proyectos y chats
- ✅ Modal propio para renombrar con validación inline
- ✅ Eliminar chats y proyectos con modal de confirmación
- ✅ Generación automática de títulos de chat
- ✅ Transcripción de audio con exportación TXT/PDF/DOCX
- ✅ Renderizado de bloques de código estilo terminal
- ✅ Separación automática de múltiples archivos en bloques individuales
- ✅ Botones de acción por mensaje con íconos SVG
- ✅ Adjuntos funcionales: PDF, DOCX, XLSX, PPTX, TXT, código, imágenes
- ✅ Manejo de errores visual — toast de sistema + burbuja de error en chat
- ✅ **Context files por proyecto** — subida manual, gestión UI, inyección automática en prompt
- ✅ **projectSettings.json** — configuración por proyecto (reglas de contexto, prompts)
- ✅ **Migración automática** de proyectos existentes al nuevo sistema de context files
- ✅ **Router inteligente de modelos** — selección automática por tarea, perfil y hardware
- ✅ **Patch Mode visual** — detección automática, parser agnóstico (Search/Replace + unified diff + merge conflict), renderizado diff rojo/verde
- ✅ **Context Snapshot** — índice incremental del repo por proyecto, hash+mtime, refresh desde UI
- ✅ **Patch Mode funcional** — apply real sobre archivos con backup automático y confirmación visual
- ✅ **Eliminación múltiple de chats por proyecto** — selección aislada por proyecto desde menú ⋯
- ✅ **Configuración inicial al crear proyecto** — modal se abre automáticamente con selectores de modelo y modo
- ✅ **Configuración persistente por proyecto** — `defaultModel` y `defaultMode` por proyecto, override suave en el controller, reflejo visual en el header
- ✅ **Router inteligente por tipo de contexto** — distingue proyectos de código vs documentos, evita elegir modelos de código para proyectos con .docx/.pdf
- ✅ **Label de modelo automático en tiempo real** — muestra el modelo elegido por el router al inicio del stream
- ✅ **Toggle de Context Snapshot** — activar/desactivar sin borrar el snapshot
- ✅ **Explorador de carpetas para snapshot root** — autocompletado via backend, navegación por directorios
- ✅ **Drag & drop en context files** — arrastrar archivos directamente al modal del proyecto
- ✅ **Modularización frontend** — `contextFiles.js`, `projectConfig.js`, `transcription.js`, `modals.js`, `chat.js`, `streaming.js`, `autoRename.js`, `patchRenderer.js`, `codeRenderer.js`, `messageRenderer.js` separados como módulos independientes
- ✅ **Patch Mode grounding fix** — archivo relevante del snapshot inyectado en el mensaje del usuario, context files omitidos en patch mode, parser y renderer extendidos para formato `SEARCH:/REPLACE:`
- ✅ **OCR de imágenes** — extracción de texto con Tesseract.js, preprocesado con jimp, cache SHA-1
- ✅ **OCR PDF escaneado** — rasterización con `pdfjs-dist` + `@napi-rs/canvas` (sin dependencias del SO, v2.11.x), OCR página por página
- ✅ **OCR DOCX con imágenes embebidas** — extracción de word/media/*, combinación con mammoth
- ✅ **Análisis visual con Qwen2.5-VL-7B** — fallback automático cuando OCR es insuficiente, `vision.service.js` como interfaz reemplazable
- ✅ **Docker `master-gpu-nvidia-cuda-12`** — volumen persistente para backends, sin re-descargas en reinicio
- ✅ **Perfil laptop con LLaVA** — análisis visual con LLaVA 1.6 en RTX 4050, `qwen2.5-coder-3b-q8` para código, `HARDWARE_PROFILE` propagado via `process.env`
- ✅ **`getVisionModel()`** — selección dinámica de modelo visual según `HARDWARE_PROFILE`, sin hardcodear por máquina
- ✅ **`/hardware-profile` endpoint** — el frontend detecta automáticamente el perfil de hardware al arrancar, sin necesidad de cambiar `models.js`
- ✅ **`initHardwareProfile()`** — `models.js` inicializa `HARDWARE_PROFILE` consultando el backend, solo se toca `chat.controller.js` al cambiar de máquina
- ✅ **Renombrado asíncrono con timeout** — `tryAutoRename` corre en segundo plano con timeout de 30s, el usuario puede seguir usando Tempest mientras se renombra
- ✅ **`getVisionParams()`** — parámetros de visión separados por perfil: laptop usa `max_tokens:512, repeat_penalty:2.0`; desktop usa `max_tokens:1024, repeat_penalty:1.8`
- ✅ **`skipContextFiles` en modo visual** — context files omitidos en modo visual para evitar saturar LocalAI con payload demasiado grande
- ✅ **Limpieza de modelos laptop** — eliminados GGUFs y YAMLs de desktop de la laptop, tiempo de arranque Docker reducido de ~20min a ~8min
- ✅ **Endpoint `/hardware-profile`** — sincronización automática de perfil entre backend y frontend
- ✅ **`initHardwareProfile()`** — `models.js` detecta perfil al arrancar sin tocar código
- ✅ **Renombrado asíncrono con timeout 30s** — UI no bloqueada durante generación de título
- ✅ **`getVisionParams()` por perfil** — laptop usa parámetros anti-loop, desktop usa tokens extendidos
- ✅ **`skipContextFiles` en modo visual** — evita saturar LocalAI con context files + imagen
- ✅ **Limpieza de modelos laptop** — GGUFs y YAMLs de desktop eliminados, arranque ~8min
- ✅ **`.gitignore` con YAMLs de desktop** — no se propagan eliminaciones entre máquinas
- ✅ **Streaming visual** — descripción de imagen aparece palabra por palabra en lugar de todo de golpe
- ✅ **Timeout de renombrado por perfil** — 30s en laptop, 60s en desktop
- ✅ **Búsqueda web con SearXNG + Tavily** — botón 🌐 en el chat, SearXNG (local/Docker, sin límites) + Tavily (IA-optimized, 1,000/mes gratis), configuración por roles (admin configura URL/keys, usuario elige provider), anti prompt-injection, rate limiting
- ✅ **Permisos de búsqueda por usuario/perfil (v2.9.0)** — panel Settings rediseñado (navegación lateral), permisos individuales por usuario, Perfil Global para grupos, `searchEnabled` por usuario, selector de provider solo visible con múltiples opciones disponibles
- ✅ **Pipeline visual + búsqueda web** — cuando hay imagen + 🌐 activo, la descripción del modelo visual se usa como query de búsqueda; segundo pase con modelo de texto identifica juegos, lugares y productos
- ✅ **Privacidad por usuario** — cada usuario tiene sus propios chats, proyectos, context files y memoria. `data/users/{userId}/` aislado por JWT. Un usuario nunca ve datos de otro
---

## 👨‍💻 Autor

**Rogelio Peña López**

Backend Developer enfocado en Node.js, IA local, automatización y sistemas conversacionales.