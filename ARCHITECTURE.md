# Arquitectura - Tempest

## 🧩 Visión general

Tempest es un asistente local de IA con arquitectura cliente-servidor, frontend web, backend Node.js/Express, motor LocalAI y persistencia basada en archivos JSON.

```text
Usuario → Frontend → Backend → Memoria/Servicios → LocalAI → Backend → Frontend
```

El sistema ya no funciona como un chat único. Ahora maneja conversaciones organizadas por usuario, proyectos y chats independientes.

---

## 🔧 Componentes principales

### Frontend

- Interfaz de chat tipo ChatGPT.
- Sidebar con chats independientes y proyectos.
- Menú de modelos locales y servicios externos.
- Menú de herramientas con transcripción de audio.
- Modales para transcripción, eliminación y creación de proyectos.
- Estado activo del chat mediante `chatState.js`.
- Comunicación HTTP con el backend mediante `fetch`.
- Renderizado de respuestas con acciones por mensaje.
- Botones de copiar para consultas y respuestas.
- Modo selección para eliminación múltiple de chats independientes.
- Input multilínea autoexpandible preparado para adjuntos.

### Backend

- API REST con Express.
- Controladores para chat y transcripción.
- Servicios separados para LocalAI, memoria y transcripción.
- Persistencia por archivos JSON.
- Endpoints para crear, listar, renombrar y eliminar chats/proyectos.
- Endpoint para generación automática de títulos.

### Motor IA

- LocalAI ejecutando modelos GGUF para chat.
- Modelo Whisper vía LocalAI para transcripción de audio.
- Generación auxiliar de títulos cortos para chats.

---

## 🧠 Sistema multi-contexto

Tempest organiza la información en tres niveles:

```text
Usuario
└── Proyecto
    └── Chat
```

### Reglas principales

- Cada usuario tiene su propia memoria global.
- Cada proyecto tiene su propia memoria de proyecto.
- Cada chat tiene su propio historial y memoria de trabajo.
- Un chat no puede leer el historial de otro chat.
- Un chat dentro de proyecto puede acceder a:
  - su propia memoria de chat
  - la memoria del proyecto
  - la memoria global del usuario
- Un chat sin proyecto pertenece al proyecto especial `general`.

---

## 📦 Estructura real del proyecto

```text
Tempest/
├── backend/
│   ├── config/
│   │   └── systemPrompt.js
│   ├── controllers/
│   │   ├── chat.controller.js
│   │   └── transcription.controller.js
│   ├── data/
│   │   └── users/
│   │       └── local-user/
│   │           ├── profile.json
│   │           └── projects/
│   │               ├── general/
│   │               │   ├── projectMemory.json
│   │               │   └── chats/
│   │               │       └── chat-name.json
│   │               └── project-name/
│   │                   ├── projectMemory.json
│   │                   └── chats/
│   │                       └── chat-name.json
│   ├── outputs/
│   │   └── transcriptions/
│   ├── routes/
│   │   ├── chat.routes.js
│   │   └── transcription.routes.js
│   ├── services/
│   │   ├── localai.service.js
│   │   ├── memory.service.js
│   │   └── transcription.service.js
│   ├── uploads/
│   │   ├── audio/
│   │   └── chunks/
│   ├── utils/
│   │   └── cleanReply.js
│   └── server.js
│
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── api.js
│   ├── chatState.js
│   ├── ui.js
│   └── styles.css
│
└── docker/
```

---

## 🔄 Flujo interno de chat

```text
frontend/app.js
↓
api.js → POST /chat
↓
routes/chat.routes.js
↓
controllers/chat.controller.js
↓
services/localai.service.js
↓
services/memory.service.js
↓
LocalAI
↓
Respuesta guardada en memoria
↓
Frontend renderiza mensaje
```

---

## 🧭 Sidebar y organización visual

La UI permite trabajar con:

```text
+ Nuevo Chat
chat independiente
chat independiente

+ Nuevo Proyecto
▸ proyecto cerrado
▾ proyecto abierto
   + Nuevo chat
   chat del proyecto
```

### Comportamiento

- Los proyectos inician colapsados al refrescar.
- Al expandir un proyecto se muestran sus chats.
- Al seleccionar un chat se marca visualmente como activo.
- Si el proyecto está colapsado, se marca el proyecto activo.
- Cada chat/proyecto tiene menú de tres puntos:
  - Renombrar
  - Eliminar

---

## 🧠 Creación inteligente de chats

### Nuevo chat sin proyecto

1. Usuario presiona `+ Nuevo Chat`.
2. Se muestra pantalla inicial: “¿En qué puedo ayudarte?”
3. No se crea archivo todavía.
4. Al enviar el primer mensaje:
   - se crea chat en `general`
   - se envía el mensaje a la IA
   - la IA genera un título corto
   - el chat se renombra automáticamente

### Nuevo chat dentro de proyecto

1. Usuario expande un proyecto.
2. Presiona `+ Nuevo chat`.
3. Se muestra pantalla inicial.
4. Al enviar el primer mensaje:
   - se crea chat dentro del proyecto
   - la IA genera un nombre basado en la consulta
   - el chat se renombra automáticamente

### Nuevo proyecto

1. Usuario presiona `+ Nuevo Proyecto`.
2. Se abre modal para escribir el nombre del proyecto.
3. Al aceptar, se crea el proyecto.
4. Se muestra pantalla inicial.
5. El primer mensaje crea y renombra el primer chat dentro de ese proyecto.

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

## 🎙️ Sistema de transcripción de audio

### Componentes

- `routes/transcription.routes.js`
- `controllers/transcription.controller.js`
- `services/transcription.service.js`
- `uploads/audio/`
- `uploads/chunks/`
- `outputs/transcriptions/`

### Funcionalidad

- Carga de audio desde frontend.
- División del audio en fragmentos con ffmpeg.
- Transcripción con Whisper vía LocalAI.
- Generación de archivos:
  - TXT
  - PDF
  - DOCX
- Limpieza automática esperada de archivos temporales.

---

## ⚙️ Principios arquitectónicos

- Separación de responsabilidades.
- Backend modular.
- Frontend organizado por módulos.
- Persistencia simple y depurable.
- Preparado para migrar a base de datos.
- Preparado para sistema multiusuario real.

