# 🚀 Tempest AI Assistant

Tempest es un asistente local de IA construido con Node.js, Express, LocalAI y frontend web. Permite conversar con modelos locales, organizar chats por proyectos, mantener memoria persistente, transcribir audio a texto y analizar archivos adjuntos.

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

- Comunicación con modelos vía LocalAI.
- Interfaz tipo ChatGPT.
- **Streaming de respuesta** — el texto aparece palabra por palabra mientras el modelo genera.
- Chats independientes y agrupados por proyecto.
- Historial persistente por chat.
- **Router de modos automático** — detecta si el mensaje es `coder`, `explain` o `general` y ajusta instrucciones y tokens.

### 🤖 Router de modos

- `coder/strict` — código puro: implementaciones, endpoints, archivos.
- `coder/hybrid` — explicación breve + código.
- `explain` — texto explicativo sin código.
- `general` — conversación normal.
- Detección automática por heurística (triggers + tipo de adjunto).
- Override manual desde el frontend via `config.mode`.

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

### 🧹 Sanitización de salidas del modelo

- `sanitize.js` — función pura centralizada, fuente de verdad para toda la limpieza.
- `cleanReply.js` actúa como wrapper legacy para compatibilidad.
- Airbag visual en `finalizeStreamingBubble` — capa independiente en frontend.

### 🧠 Sistema de memoria

- Memoria global de usuario (`profile.json`).
- Memoria por proyecto (`projectMemory.json`).
- Memoria individual por chat (`chatId.json`).
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

```text
backend/
├── config/
│   ├── buildSystemPrompt.js       ← orquestador del sistema de prompts por capas
│   └── prompts/
│       ├── global.system.txt      ← prompt base global
│       ├── modes/                 ← prompts por modo
│       └── loaders/               ← cargadores de cada capa
├── controllers/
│   ├── chat.controller.js
│   ├── context.controller.js
│   └── transcription.controller.js
├── routes/
│   ├── chat.routes.js
│   ├── context.routes.js
│   └── transcription.routes.js
├── services/
│   ├── attachment.service.js
│   ├── attachment/extractors/pptx.extractor.js
│   ├── context/
│   │   ├── context.service.js
│   │   ├── assembler.js
│   │   ├── budgeter.js
│   │   ├── snapshot.service.js
│   │   └── providers/
│   │       ├── upload.provider.js
│   │       ├── snapshot.provider.js
│   │       └── fs.provider.js
│   ├── patch/
│   │   └── apply.service.js
│   ├── localai.service.js
│   ├── localai/
│   │   ├── memory.answers.js
│   │   ├── response.validator.js
│   │   └── token.profiles.js
│   ├── memory.service.js
│   ├── mode.router.js
│   └── transcription.service.js
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
│   └── messageRenderer.js
├── app.js
├── api.js
├── chatState.js
├── ui.js
├── index.html
└── styles.css

models-localai/
├── hermes-q4.yaml    ← desktop, modelo principal
├── hermes-q5.yaml    ← desktop, equilibrado
├── hermes-q6.yaml    ← desktop, calidad
├── llama-3.2-3b-q4.yaml  ← laptop
├── qwen2.5-3b-q4.yaml    ← laptop
└── qwen2.5-3b-q5.yaml    ← laptop
```

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
```

---

## ⚙️ Tecnologías utilizadas

- Node.js + Express
- LocalAI v2.25 + modelos GGUF (Hermes-3 Q4/Q5/Q6 para desktop, LLaMA 3.1 8B Q5, Qwen2.5 7B Q5, Gemma 2 9B Q4, DeepSeek Coder 6.7B Q6, Qwen Coder 14B Q4 para desktop, Llama 3.2 3B / Qwen2.5 3B para laptop)
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

```
http://localhost:3005
```

---

## ⚠️ Requisitos

- Node.js v18+
- Docker Desktop con WSL2
- ffmpeg instalado y en PATH
- GPU NVIDIA con drivers actualizados (para desktop)
- Modelos GGUF descargados en `models-localai/`

---

## ⚠️ Antes de modificar LocalAI

Leer `MODELS.md` primero. Contiene los problemas conocidos con Hermes-3 Q4 y lo que NO se debe cambiar. Ignorar este documento causará regresiones que tomaron muchas horas resolver.

---

## 🧠 Estado del proyecto

Versión actual: **v2.1.1**

Tempest cuenta con:

- ✅ Chat local funcional con memoria por usuario/proyecto/chat
- ✅ **Streaming de respuesta** — texto aparece palabra por palabra
- ✅ **Router de modos automático** — `coder/strict`, `coder/hybrid`, `explain`, `general`
- ✅ **Sistema de prompts por capas** — global + modo + proyecto, modificables sin tocar código
- ✅ **GPU activa** — RTX 4070 con `gpu-layers: 99`, respuestas en < 1 segundo
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
---

## 👨‍💻 Autor

**Rogelio Peña López**

Backend Developer enfocado en Node.js, IA local, automatización y sistemas conversacionales.