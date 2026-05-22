# Sistema de Memoria - Tempest

## 🧩 Visión general

Tempest implementa una memoria persistente basada en JSON organizada por usuario, proyecto y chat.

La memoria no se maneja como un único archivo global. El sistema separa la información para evitar mezclar conversaciones y permitir que cada contexto tenga su propio historial.

---

## 🧠 Modelo de memoria

```text
Usuario
├── profile.json
└── projects/
    ├── general/
    │   ├── projectMemory.json
    │   └── chats/
    │       └── chat.json
    └── proyecto-x/
        ├── projectMemory.json
        └── chats/
            └── chat.json
```

---

## 📌 Niveles de memoria

### 1. Memoria global de usuario

Archivo:
```text
backend/data/users/local-user/profile.json
```

Guarda información general del usuario: nombre, gustos, metas, preferencias, proyecto actual.

---

### 2. Memoria de proyecto

Archivo:
```text
backend/data/users/local-user/projects/{projectId}/projectMemory.json
```

Guarda información compartida por todos los chats de un proyecto: objetivo, decisiones técnicas, contexto común, resumen.

---

### 3. Memoria de chat

Archivo:
```text
backend/data/users/local-user/projects/{projectId}/chats/{chatId}.json
```

```json
{
  "chatId": "chat-name",
  "title": "Nombre visible",
  "chatHistory": [],
  "workingMemory": []
}
```

**Regla clave:** un chat solo puede leer su propio historial.

---

## 🔒 Reglas de aislamiento

### Chat sin proyecto

Pertenece al proyecto especial `general`. Puede acceder a memoria global + memoria de `general` + su propia memoria de chat.

### Chat dentro de proyecto

Puede acceder a memoria global + memoria del proyecto + su propia memoria de chat. No accede a historial de otros chats ni memoria de otros proyectos.

---

## 🔄 Flujo de memoria en conversación

1. Usuario envía mensaje.
2. Frontend manda `userId`, `projectId` y `chatId`.
3. Backend localiza los archivos JSON correctos.
4. El mensaje se guarda en `chatHistory`.
5. Se toma contexto relevante.
6. Se construye el prompt para LocalAI.
7. LocalAI responde.
8. La respuesta se limpia.
9. La respuesta se guarda en el mismo chat.
10. Frontend renderiza la conversación.

---

## 📎 Memoria y archivos adjuntos

Cuando el mensaje incluye archivos adjuntos:

- `chatHistory` guarda el mensaje completo incluyendo el bloque `--- ARCHIVOS ADJUNTOS ---` con el texto extraído.
- Esto permite que preguntas de seguimiento ("resume la sección 3") tengan acceso al contenido del archivo.
- `workingMemory` guarda el contexto extraído por separado para no inflar la memoria de trabajo.
- Los archivos temporales se eliminan tras cada request — el contenido persiste solo en `chatHistory`.

---

## 🧠 Memoria de trabajo

`workingMemory` representa contexto corto, útil para mantener continuidad reciente sin enviar conversaciones infinitas.

---

## 🧾 Historial visual

`chatHistory` conserva la conversación para que, al refrescar o seleccionar un chat, el frontend pueda recargar mensajes anteriores.

```json
[
  { "role": "user", "content": "Hola" },
  { "role": "assistant", "content": "Hola, ¿en qué puedo ayudarte?" }
]
```

LocalAI recibe los últimos 6 mensajes del historial (`.slice(-7, -1)`).

---

## 🏷️ Renombrado automático

1. Se crea chat temporal con ID tipo `chat-123`.
2. Se envía la primera consulta.
3. Backend llama a `/title/generate`.
4. El generador de títulos limpia el bloque de adjuntos del texto antes de enviarlo al modelo.
5. Si el mensaje estaba vacío pero había archivos adjuntos, usa los nombres de los archivos como texto base.
6. LocalAI genera un título corto (max_tokens: 12).
7. El archivo del chat se renombra.
8. El sidebar muestra el nuevo nombre.

---

## ⚠️ Consideraciones actuales

- JSON es suficiente para MVP y depuración.
- En producción conviene migrar a base de datos.
- Se debe evitar sobrescribir chats/proyectos con nombres repetidos.
- Se puede añadir resumen automático por chat y por proyecto.
- Pendiente: ordenar chats por fecha de último mensaje en lugar de alfabéticamente.

---

## ⚠️ Patch Mode y memoria de chat

En patch mode (`mode=coder, variant=patch`), `localai.service.js` no envía historial al modelo. Esto es intencional — los diffs anteriores en el historial inflaban el contexto y causaban timeout en DeepSeek 6.7B. Cada request de patch mode es independiente del historial previo.