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

## 🏷️ Renombrado automático (paralelo — v2.4.3)

1. Se crea chat temporal con ID tipo `chat-123`.
2. Se envía la primera consulta.
3. **El renombrado se lanza EN PARALELO al stream principal** (`titlePromise` sin `await` en `chat.js`), no después. Mientras el modelo de chat responde, el modelo de títulos genera el nombre simultáneamente.
4. El generador de títulos (`generateTitleFromText`) limpia el bloque de adjuntos del texto antes de enviarlo al modelo.
5. Si el mensaje estaba vacío pero había archivos adjuntos, usa los nombres de los archivos como texto base.
6. El modelo de títulos genera un título corto (`max_tokens: 8`). Modelo: `hermes-q4` en desktop, `llama-3.2-3b-q4` en laptop.
7. `cleanGeneratedTitle` limpia el resultado (tokens de control, frases con verbos, blacklist de palabras basura) y recorta a 4 palabras. Si falla, `buildFallbackTitle` usa las primeras palabras del mensaje original.
8. Al terminar el stream: `await titlePromise` (normalmente ya resuelto) + un único `loadSidebar`.
9. El archivo del chat se renombra y el sidebar muestra el nuevo nombre — en el instante que termina la respuesta.

**Paralelismo real:** habilitado con `PARALLEL_REQUEST=true` + `LLAMACPP_PARALLEL=2` en `docker-compose.yml`. Sin esto, LocalAI serializa los dos modelos y el título esperaría a que termine el chat. El modelo de títulos se precarga (`PRELOAD_MODELS`) para que esté en VRAM desde el arranque.

**Sin timeout:** el renombrado no usa `AbortController`. Como corre en paralelo y no bloquea al usuario, espera lo necesario a que LocalAI lo procese.

**Protección contra chat huérfano:** `autoRename.js` verifica que el chat activo siga siendo el que se está renombrando (`getChatState().chatId === renameTarget.chatId`) antes de actualizar el estado. Si el usuario cambió de chat durante la generación del título, se omite el cambio de chat activo (pero sí se actualiza el sidebar).

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