# 🚀 Tempest AI Assistant

Tempest es un asistente local de IA construido con Node.js, Express, LocalAI y frontend web. Permite conversar con modelos locales, organizar chats por proyectos, mantener memoria persistente y transcribir audio a texto con exportación a TXT, PDF y DOCX.

---

## 🧠 Características principales

### 💬 Chat con IA local

- Comunicación con modelos vía LocalAI.
- Interfaz tipo ChatGPT.
- Chats independientes.
- Chats agrupados por proyecto.
- Historial persistente por chat.

### 🧠 Sistema de memoria

- Memoria global de usuario.
- Memoria por proyecto.
- Memoria individual por chat.
- Separación de contexto para evitar mezcla de conversaciones.
- Persistencia en archivos JSON.

### 📁 Organización por proyectos

Tempest permite organizar conversaciones en:

```text
+ Nuevo Chat
chat independiente

+ Nuevo Proyecto
proyecto
└── chat del proyecto
```

Cada proyecto funciona como un espacio de trabajo con sus propios chats.

### 🏷️ Renombrado inteligente

- Los chats nuevos se crean desde pantalla inicial.
- La primera consulta genera automáticamente el nombre del chat usando IA.
- Los proyectos se nombran manualmente al crearlos.
- Cada chat/proyecto puede renombrarse desde el menú lateral.

### 🗑️ Eliminación segura

- Cada chat/proyecto tiene menú de tres puntos.
- Incluye opciones:
  - Renombrar
  - Eliminar
- La eliminación usa modal de confirmación propio.

### 🎙️ Transcripción de audio

- Procesamiento con ffmpeg + Whisper vía LocalAI.
- División automática en fragmentos.
- Exportación a:
  - TXT
  - PDF
  - DOCX

---

## 🏗️ Arquitectura

```text
backend/
├── config/
│   └── systemPrompt.js
├── controllers/
│   ├── chat.controller.js
│   └── transcription.controller.js
├── data/
│   └── users/
│       └── local-user/
│           ├── profile.json
│           └── projects/
│               └── project-name/
│                   ├── projectMemory.json
│                   └── chats/
├── outputs/
│   └── transcriptions/
├── routes/
│   ├── chat.routes.js
│   └── transcription.routes.js
├── services/
│   ├── localai.service.js
│   ├── memory.service.js
│   └── transcription.service.js
├── uploads/
│   ├── audio/
│   └── chunks/
├── utils/
│   └── cleanReply.js
└── server.js

frontend/
├── index.html
├── app.js
├── api.js
├── chatState.js
├── ui.js
└── styles.css
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
```

---

## ⚙️ Tecnologías utilizadas

- Node.js
- Express
- LocalAI
- GGUF models
- Whisper
- ffmpeg
- JavaScript
- PDFKit
- docx
- HTML/CSS

---

## 🚀 Cómo ejecutar el proyecto

### 1. Instalar dependencias

```bash
cd backend
npm install
```

### 2. Ejecutar LocalAI

LocalAI debe estar disponible en:

```text
http://localhost:8080
```

### 3. Ejecutar backend

```bash
node server.js
```

### 4. Abrir frontend

```text
http://localhost:3005
```

---

## ⚠️ Requisitos

- Node.js
- ffmpeg instalado y en PATH
- Docker/LocalAI funcionando
- Modelo de chat configurado
- Modelo Whisper configurado para transcripción

---

## 🧠 Estado del proyecto

Versión actual: **v0.3.2**

Tempest ya cuenta con:

- chat local funcional
- memoria por usuario/proyecto/chat
- sidebar con proyectos y chats
- renombrar/eliminar chats y proyectos
- generación automática de títulos de chat
- transcripción de audio
- exportación de transcripciones
- renderizado de bloques de código estilo terminal
- botón para copiar código generado dentro de bloques
- input multilínea con `Shift + Enter`
- textarea autoexpandible con límite de altura
- estructura visual preparada para adjuntar archivos/imágenes en el futuro
- modo selección para eliminar múltiples chats independientes
- botones de acción por mensaje:
  - copiar consulta
  - copiar respuesta completa
  - editar preparado para futuro
  - compartir preparado para futuro
  - intentar nuevamente preparado para futuro

---

## 🔮 Próximos pasos

- Seguir refinando nombres generados por IA.
- Implementar subida y vista previa de archivos/imágenes.
- Mejorar formato obligatorio de respuestas con código.
- Añadir resaltado de sintaxis para bloques de código.
- Añadir validación avanzada de nombres.
- Añadir resumen automático por chat/proyecto.
- Añadir búsqueda en historial.
- Migrar persistencia a base de datos.
- Añadir login real.
- Convertir en app desktop con Electron.
- Implementar cambio real de modelo desde el menú.
- Implementar selección automática de modelo según la consulta.
- Mejorar la separación de múltiples bloques de código generados por IA.
- Mostrar estados visibles de inicio y fin de transcripción en el chat.
- Ordenar visualmente los chats por actividad reciente.

---

## 👨‍💻 Autor

**Rogelio Peña López**

Backend Developer enfocado en Node.js, IA local, automatización y sistemas conversacionales.

---

## ⭐ Nota

Este proyecto forma parte de mi portafolio como desarrollador backend y demuestra integración de IA local, arquitectura modular, memoria persistente y organización multi-contexto.

