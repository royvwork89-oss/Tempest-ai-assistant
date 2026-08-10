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
backend/data/users/{userId}/profile.json
```

Guarda información general del usuario: nombre, gustos, metas, preferencias, proyecto actual.

---

### 2. Memoria de proyecto

Archivo:
```text
backend/data/users/{userId}/projects/{projectId}/projectMemory.json
```

Guarda información compartida por todos los chats de un proyecto: objetivo, decisiones técnicas, contexto común, resumen.

---

### 3. Memoria de chat

Archivo:
```text
backend/data/users/{userId}/projects/{projectId}/chats/{chatId}.json
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

**Contrato de identidad (v2.11.0):** `chatId` es inmutable — se fija al crear el chat y nunca vuelve a cambiar; es también el nombre del archivo `.json` para siempre. `title` es el único campo mutable, editado por el renombrado automático (IA) o manual (usuario). Ningún módulo del frontend o backend debe asumir que `chatId` cambia tras un renombrado.

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
7. LocalAI responde (streaming token a token).
8. La respuesta se limpia.
9. La respuesta completa se guarda en `chatHistory` al terminar el stream (`fullReply` acumulado en `chat.controller.js`, persistido tras `res.end()` — fix v2.8.0; antes solo se guardaba en el flujo visual y la respuesta del flujo normal se perdía al cambiar de chat).
10. Frontend renderiza la conversación.

**Nota (v2.8.0):** si el usuario aborta el stream con el botón ⏹, el texto parcial se renderiza en el frontend pero la persistencia depende de que el backend haya llegado a `res.end()`. Para proteger la integridad del historial, la navegación entre chats está bloqueada mientras hay un stream activo.

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
9. **Desde v2.11.0:** se actualiza el campo `title` dentro del JSON del chat (el archivo nunca cambia de nombre — `chatId` es inmutable). El sidebar muestra el nuevo `title` — en el instante que termina la respuesta.

**Paralelismo con node-llama-cpp (v2.10.0):** node-llama-cpp es single-threaded — solo puede correr un modelo a la vez. El título y el stream compiten por el mismo modelo. Solución: `generateTitleFromText` espera un delay fijo de 5s antes de intentar generar el título, dando tiempo a que `switchModel` termine. Si el modelo sigue cargando, espera hasta 30s adicionales con polling de 500ms.

**Sin timeout:** el renombrado no usa `AbortController`. Como corre en paralelo y no bloquea al usuario, espera lo necesario a que LocalAI lo procese.

**Identidad de chat estable (v2.11.0):** `chatId` es inmutable desde su creación — nunca cambia, ni siquiera al renombrar. `autoRename.js` ya no necesita verificar si el chat activo cambió durante la generación del título, porque no hay ningún valor de identidad que pueda colisionar con otro mensaje enviado en paralelo. El renombrado solo toca el campo `title`, que es puramente de presentación. Ver DECISIONS.md — "Bug recurrente resuelto: respuesta/pregunta se va a otro chat (v2.11.0)" — para la causa raíz original que motivó este cambio.

**No bloquea la UI (v2.8.0):** al llegar `[DONE]` del stream principal, `chat.js` libera inmediatamente el flag `_sending`/`setSendingState(false)` sin hacer `await titlePromise`. El renombrado continúa como operación de fondo y `titlePromise.then(() => loadSidebar())` actualiza el sidebar cuando el título está listo. Antes de este cambio, el botón ⏹ y el sidebar quedaban bloqueados hasta que el modelo de títulos terminara — podía tardar si LocalAI estaba ocupado. Si el usuario aborta el stream, `titlePromise` no se cancela: el título se genera del mensaje del usuario (no de la respuesta) y sigue siendo válido.

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