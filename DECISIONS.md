# Decisiones de Diseño - Tempest

Este documento registra las decisiones técnicas principales tomadas durante el desarrollo.

---

## 🧠 Uso de LocalAI como motor principal

### Decisión
Usar LocalAI como motor principal de inferencia.

### Razón
Independencia de servicios externos, privacidad, ejecución local, sin costo por token, control sobre modelos GGUF.

### Impacto
Más control, mayor complejidad técnica, menor potencia que modelos comerciales grandes.

---

## ⚙️ Backend en Node.js + Express

### Decisión
Construir el backend con Node.js y Express.

### Razón
Simple de depurar, alineado con JavaScript del frontend, buena base para APIs REST, modularización clara.

### Impacto
Desarrollo rápido, fácil expansión, buen proyecto de portafolio backend.

---

## 🧩 Arquitectura modular

### Decisión
Separar el backend en routes / controllers / services / utils / config.

### Impacto
Código más profesional, cambios localizados, base preparada para crecer.

---

## 🧠 Memoria jerárquica

### Decisión
Separar memoria en tres niveles: Usuario → Proyecto → Chat.

### Razón
Evitar mezclar conversaciones, permitir proyectos con múltiples chats, aislar historiales individuales.

### Impacto
Mejor organización, experiencia parecida a ChatGPT, base para multiusuario real.

---

## 📁 Uso de JSON para persistencia inicial

### Decisión
Guardar memoria, proyectos y chats en archivos JSON.

### Razón
Fácil de inspeccionar, rápido de implementar, ideal para MVP local.

### Impacto
Depuración sencilla, futura migración necesaria a DB si crece.

---

## 💬 Chats independientes y chats por proyecto

### Decisión
Permitir dos tipos de conversación: chats sin proyecto en `general` y chats ligados a proyectos.

### Impacto
Mejor UX, mejor organización, más lógica en frontend y memoria.

---

## 🏷️ Renombrado automático con IA

### Decisión
Usar la primera consulta para generar título automático del chat.

### Impacto
Sidebar más útil, requiere endpoint `/title/generate`, depende de LocalAI.

---

## 🏷️ Generador de títulos optimizado

### Decisión
- Limpiar el bloque `--- ARCHIVOS ADJUNTOS ---` antes de enviarlo al modelo generador.
- Usar `max_tokens: 12` en lugar de 20.
- System prompt directo sin redundancia con el mensaje de usuario.
- Truncar texto a 300 caracteres.
- Si el mensaje está vacío pero hay archivos adjuntos, usar los nombres de los archivos como texto base.

### Razón
El bloque de adjuntos confundía al modelo. Reducir tokens fuerza títulos más cortos y precisos.

### Impacto
Títulos más relevantes y generación más rápida.

---

## 🧾 Modal propio para renombrar

### Decisión
Reemplazar `prompt()` nativo del navegador por un modal visual propio.

### Razón
El `prompt()` nativo es inconsistente entre navegadores, no se puede estilizar y rompe la experiencia visual.

### Impacto
UX más profesional y consistente. El modal soporta validación inline con mensaje de error en rojo.

---

## ✅ Validación de nombres

### Decisión
Validar nombres de chats y proyectos con estas reglas: no vacío, mínimo 2 caracteres, sin caracteres inválidos (`\ / : * ? " < > |`), no empieza con punto, máximo 60 caracteres.

### Razón
Evitar errores del sistema de archivos al crear carpetas y archivos JSON con nombres inválidos.

### Impacto
Mayor robustez. Los errores se muestran inline sin cerrar el modal.

---

## 🧾 Modal propio para confirmación

### Decisión
Usar un modal interno en lugar de `confirm()` del navegador.

### Impacto
Interfaz más profesional, más código frontend.

---

## 🎙️ Transcripción local

### Decisión
Implementar transcripción con ffmpeg + LocalAI Whisper.

### Impacto
Mayor privacidad, mayor carga técnica, requiere limpieza de temporales.

---

## 📎 Sistema de adjuntos con extracción de texto

### Decisión
Extraer texto de los archivos adjuntos en el backend e inyectarlo al prompt como contexto plano, en lugar de enviar el archivo directamente a LocalAI.

### Razón
LocalAI solo recibe texto. No puede procesar archivos binarios directamente.

### Impacto
LocalAI puede "leer" documentos sin soporte nativo de archivos. Diferencia entre calidad de extracción según tipo de archivo.

---

## 📎 Librerías de extracción por tipo de archivo

### Decisión
- **PDF**: `pdf2json` — descartados `pdf-parse` y `pdfjs-dist` por bugs.
- **DOCX**: `mammoth` — extracción limpia de texto plano.
- **XLSX**: `xlsx` — conversión por hoja a CSV etiquetado.
- **PPTX**: `unzipper` + parseo XML — extractor modular en `attachment/extractors/`.
- **Imágenes**: placeholder con metadata.

---

## 📎 Truncado inteligente diferenciado

### Decisión
- **Código**: 60% cabecera + 30% final, límite 7500 chars.
- **Documentos**: 65% inicio + 25% final, límite 7500 chars.

---

## 📎 Limpieza de temporales en doble capa

### Decisión
- **Capa A**: limpieza inmediata en bloque `finally` tras cada request.
- **Capa B**: job escoba con `setInterval` cada 6h.

---

## 📎 chatHistory vs workingMemory para adjuntos

### Decisión
- `chatHistory` guarda el mensaje completo incluyendo el bloque `--- ARCHIVOS ADJUNTOS ---`.
- `workingMemory` guarda el contexto extraído por separado.

### Razón
Permite preguntas de seguimiento con acceso al contenido del archivo.

---

## 📎 Extractor PPTX con arquitectura modular

### Decisión
Crear `backend/services/attachment/extractors/pptx.extractor.js` como módulo independiente.

### Razón
Separación de responsabilidades. `attachment.service.js` actúa como orquestador; cada formato complejo tiene su propio extractor.

### Contrato de salida
Todos los extractores devuelven `{ name, type, content, truncated, original, meta? }`.

### PPTX — implementación
- Valida magic bytes ZIP (`PK 0x50 0x4B`) antes de parsear.
- Extrae texto de `ppt/slides/slideN.xml` ordenado por número de slide.
- Extrae notas del presentador de `ppt/notesSlides/notesSlideN.xml` (default ON).
- Formatea tablas (`<a:tbl>`) con separadores `|`.
- Tolerancia a fallos por slide.
- Reutiliza `truncateDocument` de `attachment.service.js`.

---

## 🤖 Modelos Q4, Q5 y Q6

### Decisión
Soportar tres perfiles de calidad de modelo GGUF: Q4 (rápido), Q5 (equilibrado), Q6 (calidad).

---

## 🧠 Router de modos: coder / explain / general

### Decisión
Crear `services/mode.router.js` como módulo independiente que detecta el modo de respuesta por mensaje.

### Arquitectura
- `mode.router.js` — `detectMode({ rawMessage, files, configMode })` → `{ mode, variant, reason }`
- `chat.controller.js` — llama al router, aplica prefijo según `variant`, pasa `mode` a `streamOptions`
- `localai.service.js` — pasa `options.mode` a `buildSystemPrompt` y `getMaxTokens`
- `token.profiles.js` — `getMaxTokens` acepta `'coder'|'explain'|'general'|'continue'`

### Heurística (orden de prioridad)
1. Override manual del frontend (`config.mode`) → gana siempre
2. Sin texto + adjunto de código → `coder/strict`
3. Sin texto + adjunto no-código → `explain`
4. Adjunto + verbo técnico → `coder/strict`
5. Adjunto + verbo de lectura → `explain`
6. Trigger código explícito + trigger explicación → `coder/hybrid`
7. Trigger explicación + tecnología mencionada → `explain`
8. Solo trigger de código → `coder/strict`
9. Default → `general`

---

## 🧱 Sistema de prompts por capas (v1.3.0)

### Decisión
Crear `backend/config/buildSystemPrompt.js` como orquestador que ensambla el system prompt dinámicamente desde archivos de texto separados.

### Razón
Antes, el system prompt era una cadena hardcodeada en `localai.service.js` o en un archivo JS. Cualquier cambio de comportamiento requería editar código. Con el sistema por capas, el comportamiento del asistente se configura editando archivos `.txt` sin tocar código.

### Estructura
```text
backend/config/
├── buildSystemPrompt.js          ← exporta buildSystemPrompt({ fullMemory, mode, variant, userId, projectId })
└── prompts/
    ├── global.system.txt         ← Capa 1: siempre presente
    ├── modes/
    │   ├── general.txt
    │   ├── coder.strict.txt
    │   ├── coder.hybrid.txt
    │   └── explain.txt
    └── loaders/
        ├── global.loader.js
        ├── mode.loader.js
        ├── project.loader.js
        └── prompt.builder.js
```

### Capas
1. **global** — identidad, idioma, restricciones base. Siempre presente.
2. **mode** — instrucciones específicas del modo detectado.
3. **project** — memoria del proyecto activo (opcional).

### Impacto
- Cambios de comportamiento sin tocar código.
- Cada modo tiene su propio archivo, fácil de ajustar de forma independiente.
- Base preparada para que el usuario configure su propio prompt de proyecto desde la UI.

---

## 🌡️ Estabilización del modelo Hermes Q4 (v1.3.0)

### Decisión
Reemplazar `temperature: 0` por `temperature: 0.35` + `mirostat: 2` + `repeat_penalty: 1.18`.

### Razón
`temperature: 0` con modelos Q4 cuantizados produce token trapping — el modelo queda atrapado en la secuencia más probable y la repite infinitamente. Mirostat controla la entropía dinámicamente evitando tanto la degeneración como la incoherencia.

### Impacto
Respuestas estables sin loops. Ver `MODELS.md` para la lista completa de problemas resueltos.

---

## 📋 Template ChatML para Hermes-3 (v1.3.0)

### Decisión
Usar template ChatML con `{{if .System}}` para los modelos Hermes-3.

### Razón
Hermes-3-Llama-3.1-8B fue afinado usando formato ChatML aunque el modelo base sea Llama 3.1 Instruct. Se probó el template Llama 3 Instruct y produjo respuestas vacías, generación de solo 8 tokens, y el modelo generaba el nombre del archivo en lugar del contenido. ChatML produce código completo, respuestas en español y terminación correcta.

El `{{if .System}}` es necesario porque `generateTitleFromText` no manda system prompt — sin el condicional LocalAI lanza un error de template.

### Impacto
Generación de código funcional, respuestas completas en el idioma correcto, terminación limpia con `<|im_end|>`.

---

## 🛡️ Defensas activas contra comportamiento degenerativo (v1.3.0)

### Decisión
Implementar tres capas de defensa en `localai.service.js`:

1. **processedMessage** — contextualiza mensajes cortos ambiguos para que el modelo no entre en modo autocompletion.
2. **isUsefulMessage** — filtra mensajes genéricos del historial para reducir ruido en el contexto.
3. **Detector de loops en streaming** — corta el stream en tiempo real cuando detecta repetición de n-gramas.

### Razón
El modelo Q4 con poca información semántica tiende a generar respuestas degenerativas. Una palabra sola como `tepic` es ambigua — el modelo no sabe si debe completar texto, listar, o hablar del tema. El historial con mensajes genéricos (`hola`, `cómo estás`) consume tokens de contexto sin aportar información útil.

### Impacto
El modelo responde correctamente a palabras sueltas y frases cortas. Los loops se cortan antes de llegar al usuario.

---

## 💬 Íconos SVG en botones de acción

### Decisión
Reemplazar texto por íconos SVG inline en los botones de acción por mensaje y en el botón de copiar de bloques de código.

### Impacto
- Botones visibles solo al hacer hover (`opacity: 0` → `opacity: 1`).
- `user-select: none` evita que los botones se incluyan al seleccionar texto.
- Ícono cambia a checkmark al copiar y vuelve al original tras 1.5s.

---

## ⌨️ Rediseño del área de entrada

### Decisión
Cambiar el layout del input de grid a flexbox con dos secciones: textarea arriba, barra de herramientas abajo.

### Estructura
```
┌─────────────────────────────────┐
│  [adjuntos si los hay]          │
│  textarea (crece hacia arriba)  │
├─────────────────────────────────┤
│  [+]              [➤ enviar]    │
└─────────────────────────────────┘
```

---

## 🌊 Streaming de respuesta con SSE

### Decisión
Implementar streaming de respuesta usando Server-Sent Events (SSE) en el backend y `ReadableStream` en el frontend.

### Problema resuelto: tokens especiales de Hermes
LocalAI con modelos Hermes envía tokens especiales letra por letra. La solución fue limpiarlos en `finalizeStreamingBubble` sobre el `fullText` acumulado, usando `sanitize.js` como fuente de verdad.

---

## 🧹 sanitize.js — capa centralizada de post-procesado

### Decisión
Crear `backend/utils/sanitize.js` con `sanitizeModelOutput(text, options?)` como función pura sin dependencias externas.

### Arquitectura
- `sanitize.js`: fuente de verdad.
- `cleanReply.js`: wrapper legacy para compatibilidad.
- `ui.js`: airbag visual independiente.

### Opciones
```js
sanitizeModelOutput(text, {
  stripStopTokens: true,
  stripInternalInstructions: true,
  stripModelNoise: true,
  normalizeWhitespace: true
})
```

---

## 🔒 Separación mensaje al modelo vs mensaje al historial

### Decisión
En `chat.controller.js`, separar `finalMessage` (con prefijo, va al modelo) de `historialMessage` (sin prefijo, se guarda en memoria).

### Razón
El prefijo interno se guardaba en `chatHistory` y el modelo lo veía reciclado en cada turno siguiente, aprendiendo a repetirlo.

### Impacto
Historial limpio. `detectUserData` recibe solo el mensaje real del usuario.

---

## 📁 Context Files por proyecto (v1.4.0)

### Decisión
Implementar un sistema de archivos de contexto persistentes por proyecto, separado de los adjuntos por mensaje.

### Separación de responsabilidades
- `projectMemory.json` — memoria/resumen/decisiones del proyecto.
- `projectSettings.json` — configuración (prompts, reglas de contexto).
- `context/index.json` — inventario de archivos de contexto.
- `context/files/` — contenido extraído de los archivos subidos.

### Razón
Los adjuntos de mensaje son temporales y específicos de una consulta. Los context files son persistentes y aplicables a todos los chats del proyecto. Mezclarlos crearía confusión y complejidad innecesaria.

### Arquitectura: Providers + Assembler + Budgeter
- **Providers** devuelven bloques con contrato estándar: `{ id, name, relPath, alwaysInclude, includeWhenMentioned, priority, content }`
- **Assembler** junta providers y llama al budgeter.
- **Budgeter** aplica presupuesto de chars con orden de prioridad y truncado inteligente.

### Deduplicación por hash
Antes de guardar un archivo se calcula SHA-256 del contenido extraído. Si ya existe un item con el mismo hash, se descarta silenciosamente.

### `fs.provider.js` como stub
En v1 (web) solo existe `upload.provider.js`. `fs.provider.js` es un stub vacío que permite implementar lectura de disco en v2 (Electron) sin tocar ningún otro módulo.

### `buildSystemPrompt` pasa a async
Desde v1.4.0, `buildSystemPrompt` es `async` para poder `await` la Capa 4. Todos los lugares que lo llaman usan `await`.

### Script de migración
`backend/scripts/migrate-projects.js` inicializa `projectSettings.json` y `context/index.json` en proyectos existentes. Es idempotente — omite archivos que ya existen.

### Impacto
Tempest mantiene contexto persistente de proyectos sin que el usuario tenga que adjuntarlo en cada mensaje.

---

## 🔗 project.loader.js conectado a projectSettings.json (v1.4.1)

### Decisión
Reemplazar la lectura de `project.system.txt` por `projectSettings.json → prompts.projectPromptText` en `project.loader.js`.

### Razón
`project.system.txt` nunca existió en los proyectos reales — la Capa 3 del system prompt siempre retornaba vacío. `projectSettings.json` ya tenía el campo `prompts.projectPromptText` desde v1.4.0 pero no estaba conectado al loader.

### Impacto
- La Capa 3 del system prompt ahora funciona correctamente.
- El usuario puede editar el prompt de proyecto desde la UI sin tocar archivos.
- `projectId === 'general'` se excluye explícitamente — ese proyecto no tiene configuración de prompt.
- Base lista para agregar más campos editables desde UI (temperature, model, etc.) en el mismo modal.

---

## 🤖 Router inteligente de modelos (v1.5.0)

### Decisión
Crear `backend/services/model.router/` como módulo independiente con 5 submódulos que separan responsabilidades.

### Razón
El router de modos ya detecta qué tipo de respuesta dar. El siguiente paso natural es seleccionar el modelo óptimo para cada tarea. Separarlo en módulos permite modificar cada pieza sin tocar las demás.

### Arquitectura
- `capability.matrix.js` — fuente de verdad de qué modelos existen por hardware y qué alias lógico les corresponde.
- `task.detector.js` — heurísticas que mapean modo + mensaje + contextSize → taskProfile.
- `profile.mapper.js` — traduce taskProfile + autoProfile → alias lógico.
- `fallback.manager.js` — fallback absoluto ante errores técnicos.
- `index.js` — orquestador público con `_log()` estructurado.

### HARDWARE_PROFILE hardcodeado
Se decidió hardcodear `const HARDWARE_PROFILE = 'desktop'` en `chat.controller.js` en lugar de auto-detectarlo. La auto-detección agrega complejidad sin beneficio real — el desarrollador sabe en qué máquina está. Cambiar entre desktop y laptop es editar una línea.

### GPU count: 0 — falso negativo de LocalAI v2.25
LocalAI reporta `GPU count: 0` al inicio — es un falso negativo del arranque en Go. La GPU se activa cuando llama.cpp carga el primer modelo. La prueba real es `offloaded X/X layers to GPU` en los logs del proceso GRPC.

### Prerequisito WSL2 + Docker Desktop
`wsl --shutdown` antes de levantar LocalAI es obligatorio en Docker Desktop con WSL2. Sin este paso el nvidia-container-runtime falla con `exit status 2`. El montaje de `/usr/lib/wsl/lib` es necesario para que llama.cpp encuentre las librerías CUDA del stub de WSL2.

### Impacto
Tempest selecciona automáticamente el modelo más adecuado para cada consulta. El usuario puede elegir perfil de calidad (rápido/balanceado/calidad) o seleccionar modelo manualmente.

---

## 🩹 Patch Mode — formato Search/Replace y parser agnóstico (v1.6.0)

### Decisión
Implementar Patch Mode con formato Search/Replace (`<<<<<<< SEARCH / ======= / >>>>>>> REPLACE`) como formato principal, con parser agnóstico que acepta también unified diff y simplified diff.

### Razón
Los modelos locales 6-8B ignoran formatos personalizados por sesgo de entrenamiento. DeepSeek Coder tiene impronta fuerte hacia `---/+++` de git diff. En lugar de forzar obediencia al formato (imposible con modelos cuantizados), se acepta cualquier formato y se normaliza en el backend.

### Formato elegido vs alternativas
- **Unified diff estándar** — descartado: los modelos locales generan line numbers incorrectos (`@@ -X,Y +X,Y @@`), lo que hace los patches inaplicables.
- **JSON estructurado** — descartado para MVP: más complejo de implementar y los modelos no lo generan naturalmente.
- **Search/Replace blocks** — elegido: mismo formato que usa Aider en producción, más robusto para modelos locales porque busca por contenido exacto sin depender de line numbers.

### Parser agnóstico — tres formatos soportados
- `search_replace` — formato principal: `<<<<<<< SEARCH / ======= / >>>>>>> REPLACE`
- `unified_diff` — formato clásico con `---/+++` y `@@`
- `simplified_diff` — formato que generan los modelos locales: filepath + líneas `+/-` sin headers

### Limitación conocida
Patch Mode visual está completo. Patch Mode funcional (apply real al archivo) requiere Context Snapshot — el modelo necesita ver el contenido del archivo antes del request vía context files del proyecto. Con archivos adjuntos temporales, el modelo los repite en la respuesta en lugar de generar el diff.

### Impacto
- `patch.parser.js` — módulo independiente, contrato estándar `{ filepath, searchContent, replaceContent, format }`
- `ui.js` — renderizado visual rojo/verde con `renderPatchBlock`
- `mode.router.js` — nueva variant `patch` con triggers explícitos
- `capability.matrix.js` — alias `coder-patch` → DeepSeek 6.7B Q6
- `chat.controller.js` — validación de contexto + truncado a 800 chars en modo patch

---

## 🗂️ Context Snapshot (v1.7.0)

### Decisión
Crear `snapshot.service.js` como módulo independiente que genera `projectContext.json` con hash + mtime de cada archivo del repo.

### Razón
Patch Mode necesita que el modelo vea el contenido exacto del archivo antes de generar el diff. Con adjuntos temporales el modelo pierde el "ancla textual" — no sabe qué versión está modificando. El snapshot persiste ese ancla.

### Arquitectura
- `snapshot.service.js` — crawl, filtrado, hash+mtime, genera manifest
- `snapshot.provider.js` — tercer provider para el assembler, mismo contrato que upload.provider
- `projectContext.json` — manifest con snapshotRoot, totalFiles, archivos indexados
- Refresh manual desde UI — botón en modal de context files
- Límites: `maxFiles: 50`, `maxChars: 120000`, archivos >30KB excluidos, sin `.md`/`.txt`

### Impacto
El assembler recibe los archivos del snapshot igual que los uploads manuales. El budgeter los prioriza por `alwaysInclude` y `includeWhenMentioned` sin cambios.

---

## 🩹 Apply Patch real (v1.7.0)

### Decisión
Implementar `apply.service.js` con exact match normalizado, fallback por ancla de 5 líneas, y reemplazo completo cuando `searchContent` cubre >80% del archivo.

### Razón
Los modelos locales generan `searchContent` con pequeñas variaciones de espaciado o contenido ligeramente diferente al archivo real. El exact match puro falla en esos casos. El fallback de ancla resuelve el 90% de los casos sin fuzzy matching peligroso.

### Decisiones clave
- **Backup obligatorio** antes de cada apply — carpeta `projects/{projectId}/backups/` con timestamp
- **Nunca fuzzy automático** — si el ancla no matchea, error claro al usuario
- **Reemplazo completo** cuando searchContent >80% del archivo — cubre el caso frecuente donde el modelo regenera el archivo entero
- **Containment check** — la ruta resuelta debe estar dentro de `snapshotRoot`

### Impacto
Patch Mode pasa de visual a funcional. El usuario ve el diff, confirma y el archivo se modifica en disco con backup automático.

---

## 🗑️ Eliminación múltiple de chats por proyecto (v1.7.0)

### Decisión
Agregar "Seleccionar chats" al menú ⋯ de cada proyecto, con estado de selección aislado por proyecto (`projectSelectionMode`, `selectedProjectChats`).

### Razón
La selección múltiple existía solo para chats independientes. Los proyectos con muchos chats requerían eliminación uno por uno.

### Arquitectura
- `projectSelectionMode` — string con el projectId activo en modo selección, o null
- `selectedProjectChats` — Set de chatIds del proyecto activo
- Aislamiento total — activar selección en proyecto A no afecta proyecto B ni chats independientes
- Reutiliza el mismo `confirmDeleteBtn` y `pendingBulkDelete` de `app.js` vía `onSetPendingBulkDelete`

---
## ⚙️ Configuración persistente por proyecto (v2.0.0)

### Decisión
Agregar `preferences: { defaultModel, defaultMode }` a `projectSettings.json` y leerlos en `chat.controller.js` como override suave.

### Razón
El usuario necesita que cada proyecto recuerde su modelo y modo preferido sin tener que seleccionarlos manualmente en cada sesión.

### Arquitectura
- `getDefaultSettings()` incluye `preferences` con defaults `'auto'` — proyectos existentes no se rompen.
- Orden de prioridad en el controller: selección manual > preferencia del proyecto > `'auto'`.
- `effectiveConfigMode` se calcula antes de `detectMode` para que el router reciba el modo correcto.
- El frontend usa `sidebarDeps.onProjectModelChange` como callback — sin `window`, sin eventos globales, consistente con el patrón `deps` ya existente.

### Bug resuelto
`server.js` montaba `contextRoutes` en `/project`, duplicando el prefijo a `/project/project/:id/...`. Corregido a `app.use('/', contextRoutes)`.

### Impacto
Cada proyecto puede tener su modelo y modo configurados de forma independiente. El selector del header refleja visualmente el modelo del proyecto al entrar a un chat.

---

## 🤖 Router inteligente por tipo de contexto (v2.0.1)

### Decisión
Pasar `contextFileTypes` (array de extensiones de los context files del proyecto) al `detectBestModel` para que `task.detector.js` pueda distinguir proyectos de código vs proyectos documentales.

### Razón
`contextSize: 0` estaba hardcodeado en `chat.controller.js` — el router nunca sabía que había archivos de contexto. Un proyecto con puros `.docx` elegía DeepSeek Coder porque el mensaje sonaba a código.

### Contrato crítico
- `task.detector.js` recibe `contextFileTypes: string[]` — extensiones sin punto, ej. `['js','ts','md']`
- Si `docCount > codeCount` → `isDocumentContext = true` → nunca cae en perfil coder
- `contextSize` se calcula leyendo `context/index.json` del proyecto — **nunca hardcodear 0**

### Bug resuelto
`contextSize: 0` hardcodeado hacía que proyectos con documentos Word eligieran DeepSeek automáticamente y fallaran al responder.

---

## 🔗 Contrato mode.router ↔ task.detector ↔ model.router (v2.0.1)

### Decisión
`model.router/index.js` construye `effectiveMode` combinando `mode` y `variant` antes de llamar a `task.detector`.

### Contrato explícito
mode.router.js     → devuelve { mode: 'coder', variant: 'patch' }
model.router/index.js → effectiveMode = (mode==='coder' && variant==='patch') ? 'coder/patch' : mode
task.detector.js   → espera mode === 'coder/patch' para retornar profile: 'coder-patch'
capability.matrix  → 'coder-patch' → deepseek-coder-6.7b-q6

### Impacto
Si se rompe esta cadena en cualquier punto, patch mode cae en perfil `general` y elige `qwen2.5-7b-q5` en lugar de DeepSeek. El síntoma es que el modelo genera texto explicativo en lugar de un diff.

---

## 🏷️ Label de modelo automático en tiempo real (v2.0.1)

### Decisión
Backend manda evento SSE `[MODEL]` antes de empezar el stream con el modelo elegido. Frontend lo captura via callback `onModel` en `sendChatMessage` y actualiza el label inmediatamente.

### Arquitectura

chat.controller.js → res.write('[MODEL] {"model": selectedModel}')
api.js → detecta [MODEL] → llama onModel(usedModel)
app.js → onModel callback → updateMenuTriggerLabel(menuTrigger, 'auto', assistantsState, model)
models.js → label: "modelo: Automático local · [label del modelo]"

### Regla crítica
`primaryModel` sigue siendo `'auto'` — el label es solo visual. No cambia el modelo del siguiente request. Si se modifica `primaryModel` en el callback, el frontend empezará a mandar el modelo resuelto como override manual.

---

## 🩹 Patch Mode — historial vacío para evitar timeout (v2.0.1)

### Decisión
En patch mode, `localai.service.js` no manda historial de chat al modelo.

### Razón
DeepSeek 6.7B con contexto >4000 chars hace prefill muy lento. Si el chat anterior tiene diffs largos, el historial infla el contexto y causa timeout (>5 minutos). Patch mode no necesita historial — cada request es independiente.

### Implementación
```js
const chatHistory = (options.mode === 'coder' && options.variant === 'patch')
  ? []
  : memory.getChatHistory(options)...
```

---

## 🗂️ Context Snapshot — toggle activo/inactivo (v2.0.2)

### Decisión
Agregar toggle checkbox en el modal de context files para activar/desactivar el snapshot sin borrarlo.

### Arquitectura
- `POST /project/:projectId/context/snapshot/toggle` — pone `enabled` en todos los items snapshot del index
- Frontend: `snapshotToggle` en el modal, usa `cloneNode+replaceWith` para limpiar listeners al abrir cada proyecto
- Estado inicial: se lee de `context/index.json` — si todos los items snapshot tienen `enabled: false` → toggle desmarcado
- Si no hay items snapshot → toggle deshabilitado con tooltip explicativo
- Al generar nuevo snapshot: rehabilita automáticamente todos los items existentes a `enabled: true`

### Bug conocido
`snapshotToggle.disabled = true` en un proyecto sin snapshot queda en el DOM cuando se abre el siguiente proyecto. Solución: resetear `checked=true` y `disabled=false` al inicio de `openContextFilesModal`, antes de leer el estado real.

---

## 📁 Explorador de carpetas para snapshot root (v2.0.2)

### Decisión
Implementar autocompletado de rutas via endpoint `GET /fs/browse?path=X` en lugar de selector nativo del SO.

### Razón
El navegador no puede exponer rutas absolutas del sistema de archivos por seguridad. `showDirectoryPicker()` y `webkitdirectory` solo dan el nombre de la carpeta, no la ruta completa. La solución correcta para obtener rutas absolutas es Electron (`dialog.showOpenDialog`) — pendiente para cuando se migre.

### Implementación actual
- `GET /fs/browse?path=` → devuelve unidades disponibles (C:/, D:/, H:/, etc.)
- `GET /fs/browse?path=H:/Proyectos` → devuelve subcarpetas
- Frontend: dropdown con navegación, botón "↑ Subir" para directorio padre, botón "✓ Usar esta carpeta"
- El input también tiene autocompletado al escribir

### Limitación
Solo indexa extensiones de código — no `.docx` ni `.pdf`. Para proyectos documentales usar **+ Subir archivos** con drag & drop.

---

## 🖱️ Drag & drop en context files (v2.0.2)

### Decisión
Agregar drag & drop directamente sobre el contenedor de archivos del modal de context files.

### Implementación
- Evento `drop` en `#contextFilesList`
- Verifica límite de 20 archivos antes de subir
- Muestra mensaje si se alcanza el límite
- Clase CSS `drag-over` para feedback visual
- Reutiliza `uploadContextFiles` de `api.js`

---

## 📄 Context Grounding — problema conocido (v3.0 pendiente)

### Problema
Los archivos DOCX entran correctamente al contexto (`chars: 17215`) pero modelos como `qwen2.5-7b-q5` priorizan "completion behavior" sobre "document grounding". El modelo inventa lore genérico en lugar de usar el contenido real.

### Síntoma
Usuario pregunta sobre contenido específico de documentos del proyecto → modelo responde con información inventada genérica en lugar de citar el contexto.

### Causa raíz
Los prompts actuales de modo `general` no instruyen explícitamente al modelo a priorizar el contexto sobre su conocimiento preentrenado. Los modelos 7B tienden a completar universos ficticios por inercia de entrenamiento.

### Solución propuesta (pendiente v3.0)
Agregar bloque de reglas de contexto en `global.system.txt` o en un nuevo modo `document`:

REGLAS DE CONTEXTO:

Si existen archivos de contexto del proyecto, prioriza EXCLUSIVAMENTE esa información.
No inventes lore, reglas o detalles no presentes en el contexto.
Si la información no existe en el contexto, dilo explícitamente.
Nunca completes universos ficticios por tu cuenta.


### Alternativas a investigar
- Few-shot grounding en el system prompt
- Modo especial `document` como quinta capa o variante de `explain`
- Forcing citations — el modelo debe citar el chunk del que extrajo la información
- Respuestas tipo RAG basadas únicamente en fragmentos encontrados

---

## 🧹 Stop tokens — problema conocido (pendiente)

### Problema
Algunos modelos terminan respuestas con `<|endoftext|>`, `Human:` o `Assistant:`, simulando continuación de conversación.

### Solución propuesta
**A) Stopwords en YAMLs:**
```yaml
stopwords:
  - "Human:"
  - "Assistant:"
  - "<|endoftext|>"
```

**B) Limpieza en `sanitize.js`:**
```js
.replace(/<\|endoftext\|>/gi, '')
.replace(/^Human:.*$/gim, '')
.replace(/^Assistant:.*$/gim, '')
.trim()
```

### Modelos afectados
Verificar en todos los modelos desktop — especialmente `qwen2.5-7b-q5` y modelos con template ChatML.

---

## 🧩 Modularización frontend — pendiente (v3.0)

### Principio
Nunca tener un archivo que mezcle responsabilidades. Cada módulo tiene una sola razón para cambiar. Más carpetas es mejor que un fideo de código.

### Problema actual
- `sidebar.js` mezcla lógica del sidebar con 6 modales diferentes
- `app.js` mezcla envío de mensajes, streaming, renombrado automático y orquestación
- `ui.js` mezcla renderizado de diff, código y mensajes
- `styles.css` mezcla base, sidebar, modales y diff en un solo archivo

### Estructura propuesta

```
frontend/
├── app.js                      ← solo orquestador
├── api.js                      ← todas las llamadas HTTP
├── chatState.js                ← estado global
├── ui.js                       ← solo funciones base de DOM
├── index.html
├── modules/
│   ├── sidebar.js              ← solo sidebar y lista proyectos/chats
│   ├── attachments.js          ← chips y drag & drop del input
│   ├── models.js               ← menú de modelos y label automático
│   ├── contextFiles.js         ← modal context files + snapshot + toggle + browse
│   ├── projectConfig.js        ← modal configuración del proyecto
│   ├── transcription.js        ← modal transcripción de audio
│   └── modals.js               ← renombrar, confirmar, nuevo proyecto
├── chat/
│   ├── chat.js                 ← lógica de envío y creación de chats
│   ├── streaming.js            ← createStreamingBubble, finalizeStreamingBubble
│   └── autoRename.js           ← renombrado automático con IA
├── renderers/
│   ├── patchRenderer.js        ← diff rojo/verde, botón aplicar
│   ├── codeRenderer.js         ← bloques de código terminal
│   └── messageRenderer.js      ← mensajes, links, acciones
└── styles/
    ├── base.css                ← reset, variables, tipografía
    ├── layout.css              ← estructura app, sidebar, chat
    ├── chat.css                ← burbujas, mensajes, input
    ├── sidebar.css             ← sidebar, proyectos, chats
    ├── modals.css              ← todos los modales
    ├── diff.css                ← renderizado diff rojo/verde
    └── components.css          ← botones, chips, tooltips, badges
```

### Reglas de coherencia
- Un módulo no importa directamente a otro — se comunican via callbacks o eventos
- `app.js` es el único orquestador
- `api.js` es la única fuente de llamadas HTTP
- `chatState.js` es la única fuente de verdad del estado
- Los renderers son funciones puras — reciben datos y devuelven DOM, sin efectos secundarios

### Impacto esperado
- Cada modal es independiente y modificable sin riesgo de romper otros
- Menor superficie de bugs al registrar listeners
- Base limpia para Document Mode, Git Integration y VS Code Integration

---

## 🩹 Patch Mode grounding — fix (v2.1.1)

### Problema resuelto
El modelo generaba diffs incorrectos cuando el contexto del archivo llegaba únicamente via system prompt (Capa 4 — context files del proyecto). DeepSeek 6.7B no ancla el SEARCH block al contenido cuando está en el system prompt — lo trata como "contexto de fondo" e inventa el diff.

### Síntoma original
- `effectiveContext.length=0` — adjunto temporal vacío
- `contextFiles: 12208 chars` — contexto llegaba al system prompt pero el modelo lo ignoraba
- Output: unified diff inventado, código repetido, formato incorrecto

### Solución implementada

**1. `buildPatchGrounding` en `chat.controller.js`**
Función nueva que selecciona el archivo más relevante del snapshot y lo inyecta directamente en el mensaje del usuario (no en el system prompt):
- Busca por nombre mencionado en el mensaje del usuario
- Fallback al primer archivo disponible del snapshot
- Truncado por zonas: cabecera (800 chars) + cola (400 chars), límite total 2500 chars
- Lee desde `projectContext.json` → `absolutePath` — mismo mecanismo que `snapshot.provider.js`
- Formato: `<<<FILE_BEGIN: relPath\n{contenido}\nFILE_END>>>`

**2. `skipContextFiles` en `streamOptions`**
Flag que omite la Capa 4 del system prompt en patch mode. Con grounding en el mensaje, los 12K chars del context files son ruido puro que satura el prefill de DeepSeek y degrada la calidad del diff.

**3. `buildSystemPrompt.js` acepta `skipContextFiles`**
Si `skipContextFiles: true`, `getProjectContext` no se ejecuta y `contextBlock` queda vacío.

**4. `patch.parser.js` — soporte para formato `SEARCH:/REPLACE:`**
DeepSeek a veces genera `SEARCH:\n\`\`\`...\`\`\`\nREPLACE:\n\`\`\`...\`\`\`` en lugar de `<<<<<<< SEARCH`. Se agregó detección en `detectFormat` y parser en `parseSearchReplace`.

**5. `messageRenderer.js` — `patchLabelRegex`**
Regex adicional que detecta y renderiza el formato `SEARCH:/REPLACE:` en rojo/verde. Solo se activa si `patchBlockRegex` no encontró nada.

**6. `streaming.js` — `stripLeakedInstructions` reforzado**
- Revisa todo el texto (no solo el último 20%) — el system prompt puede filtrarse en cualquier posición
- Patrones adicionales: `Eres un experto en...`, `MODO PATCH. Tu tarea...`, bloques `<<<FILE_BEGIN`

**7. Ruido post-REPLACE ignorado**
`messageRenderer.js` hace `return` inmediato tras renderizar el primer bloque patch válido. El modelo a veces vuelca fragmentos del archivo después del REPLACE — ahora se ignoran.

### Contrato nuevo
chat.controller.js
buildPatchGrounding(userMessage, projectId)
→ lee context/index.json → filtra source='snapshot' && enabled
→ carga manifest (projectContext.json) → absolutePath
→ readFileContent(absolutePath)
→ truncado por zonas (HEAD=800, TAIL=400, MAX=2500)
→ devuelve string <<<FILE_BEGIN:...FILE_END>>>
streamOptions.skipContextFiles = true  →  buildSystemPrompt omite Capa 4

### Limitación conocida
Si el proyecto no tiene snapshot generado, `buildPatchGrounding` devuelve string vacío silenciosamente y el flujo continúa sin grounding. En ese caso el modelo puede seguir generando diffs incorrectos. Workaround: generar snapshot antes de usar patch mode.

---

## 🩹 Patch Mode grounding + Apply fix — decisiones técnicas (v2.1.1)

### Problema
Dos bugs relacionados que impedían el flujo completo de patch mode:
1. El modelo generaba diffs inventados cuando el archivo llegaba solo via system prompt
2. El botón ⚡ Aplicar fallaba con "Sin ruta de archivo" o "No se encontró el fragmento"

---

### Decisión 1: Dónde inyectar el archivo de contexto

**Elegido:** inyectar en el mensaje del usuario via `buildPatchGrounding` en `chat.controller.js`

**Alternativas descartadas:**
- **System prompt (Capa 4)** — DeepSeek 6.7B lo trata como "contexto de fondo". El modelo genera el SEARCH sin anclar al contenido real, produciendo diffs inventados. Confirmado en v2.0.2+.
- **`localai.service.js`** — no tiene acceso a projectId ni a context files. Moverlo ahí rompería la separación de responsabilidades del sistema.
- **Módulo nuevo `patch.context.js`** — propuesto por otra IA durante la evaluación. Descartado por overhead sin ganancia real para un fix puntual. La lógica vive naturalmente en el controller.

---

### Decisión 2: Delimitadores del grounding

**Elegido:** `Archivo: relPath` + `<<<FILE_BEGIN: relPath ... FILE_END>>>`

**Alternativas descartadas:**
- **`<<<FILE_BEGIN:` solo** — el modelo lo imitaba como formato de salida, generando loops donde repetía el bloque completo en lugar de generar el diff.
- **`### CONTENIDO ACTUAL DEL ARCHIVO ### ... ### FIN DEL ARCHIVO ###`** — mismo problema. El modelo usaba los marcadores como plantilla y los reproducía en la respuesta.
- **Sin delimitadores** — el modelo no distinguía entre el contenido del archivo y las instrucciones, mezclando ambos en la respuesta.

**Por qué funciona la combinación actual:** la línea `Archivo:` es reconocida por el parser del renderer como filepath. El bloque `FILE_BEGIN/FILE_END` es limpiado por `stripLeakedInstructions` antes de renderizar. El filepath se extrae antes de la limpieza y se guarda en `dataset.groundingFilepath`.

---

### Decisión 3: Truncado del grounding

**Elegido:** centrado en la función mencionada sin marcadores de truncado

**Alternativas descartadas:**
- **Cabecera + cola fija (800 + 400 chars)** — no capturaba la función si estaba en el medio del archivo. El modelo generaba SEARCH con una firma diferente a la real.
- **Truncado con marcadores `[... inicio omitido ...]`** — el modelo los imitaba como parte del diff, generando bloques con esos marcadores como contenido del SEARCH.
- **Archivo completo sin truncar** — 2500+ chars satura el prefill de DeepSeek 6.7B y degrada la calidad del output, llegando a timeouts.

**Límite elegido:** MAX_TOTAL=2000 chars centrados desde 200 chars antes de `function nombre`. Sin marcadores visibles.

---

### Decisión 4: Fuzzy match en apply.service.js

**Problema:** el modelo genera el SEARCH sin valores por defecto en firmas de función:
`function detectMode({ rawMessage, files, configMode }) {`
Pero el archivo real tiene:
`function detectMode({ rawMessage = '', files = [], configMode = null } = {}) {`

**Elegido:** `normalizeFunctionSignature(text)` — función pura inline que elimina valores por defecto antes de comparar

**Alternativas descartadas:**
- **Librerías externas (fuse.js, diff-match-patch, fastest-levenshtein)** — dependencia nueva para un caso muy específico. Riesgo de comportamiento impredecible en otros tipos de SEARCH.
- **Forzar al modelo via prompt** — no confiable con modelos 6-8B cuantizados. El modelo ignora instrucciones de formato con frecuencia.
- **Normalizar el archivo antes de guardarlo en snapshot** — perdería el formato original, rompiendo el exact match para todos los demás casos.
- **Levenshtein distance / similitud semántica** — demasiado permisivo. Podría aplicar patches en el lugar equivocado si hay funciones con firmas similares.

**Contrato del fuzzy match:**


normalizeFunctionSignature elimina: = 'str', = "str", = [], = {}, = null, = false, = true, = número
normalizeFunctionSignature normaliza: espacios antes de , } )
Solo se usa para buscar — nunca se escribe el texto normalizado al disco

---

### Decisión 5: Filepath para el botón ⚡ Aplicar

**Problema:** cuando el modelo usa formato `<<<<<<< SEARCH` sin repetir la línea `Archivo:`, el grupo 1 de `patchBlockRegex` queda vacío y el botón muestra "Sin ruta de archivo".

**Elegido:** extraer filepath en `finalizeStreamingBubble` antes de `stripLeakedInstructions` y guardarlo en `content.dataset.groundingFilepath`. El renderer lo lee como fallback.

**Alternativas descartadas:**
- **Leer `Archivo:` después de `stripLeakedInstructions`** — ya fue eliminado por los patrones de limpieza.
- **No limpiar el grounding en frontend** — mostraría el contenido completo del archivo al usuario en la burbuja de respuesta.
- **Pasar el filepath como parámetro a `renderMixedContent`** — requería cambiar la firma de la función y todos sus call sites. Overhead desproporcionado.
- **Hardcodear el filepath en el prompt** — el modelo lo ignoraría o lo incluiría en lugares incorrectos del diff.

---

## 🔮 Decisiones futuras

- Implementar `fs.provider.js` completo para Electron/v2 con containment check y realpath.
- UI para editar el prompt de proyecto desde `projectSettings.json`.
- Implementar LibreOffice headless para mejor calidad de extracción.
- Orden real de slides PPTX leyendo `ppt/presentation.xml`.
- Modo híbrido de modelos: LocalAI para código rutinario, API externa para arquitectura compleja.
- Migrar memoria JSON a base de datos.
- Añadir login real.
- Añadir resumen automático por chat/proyecto.
- Añadir embeddings para búsqueda semántica.

---

## 🧩 Modularización frontend — patrón de separación (v2.0.3–v2.0.6)

### Decisión
Separar funciones de `sidebar.js` y `app.js` en módulos independientes bajo `frontend/modules/`.

### Patrón aplicado
- Módulos sin estado propio exportan una función principal (`openContextFilesModal`, `openProjectConfigModal`, `openRenameModal`)
- Módulos con listeners exportan una función `init*(deps)` que recibe todas las dependencias como objeto
- Las dependencias se pasan como callbacks y getters — nunca referencias directas a variables de `app.js`
- `getSidebarDeps: () => sidebarDeps` — getter en lugar de referencia directa, evita problemas de closure

### Módulos creados
- `contextFiles.js` — `openContextFilesModal(projectId)` — sin deps externas, usa `api.js` directamente
- `projectConfig.js` — `openProjectConfigModal(projectId)` — sin deps externas, usa `api.js` directamente
- `transcription.js` — `initTranscription(deps)` — deps: chatBox, typing, sendBtn, userInput, loadSidebar, getSidebarDeps, ensureGeneralChatExists, makeUniqueChatTitle, getPendingAutoRename, setPendingAutoRename
- `modals.js` — `initModals(deps)` + `openRenameModal({...})` — deps: deleteConfirmModal, newProjectModal, cancelDeleteBtn, confirmDeleteBtn, confirmNewProjectBtn, loadSidebar, getSidebarDeps, initAttachments, renderWelcomeScreen, setPendingAutoRename

### Imports en sidebar.js
`sidebar.js` importa `openRenameModal` de `modals.js` — la función se llama desde `createActionsMenu` al hacer clic en Renombrar. `renameChat` y `renameProject` los importa `modals.js` directamente de `api.js`.

### Bug resuelto durante modularización
`openRenameModal` en `modals.js` inicialmente recibía `renameChat` y `renameProject` como parámetros — se corrigió importándolos directamente de `api.js` para simplificar la firma.

### Módulos separados en v2.0.7–v2.0.11

- `chat.js` — `sendMessage`, `ensureGeneralChatExists`, `autoResizeUserInput`, listeners de `userInput` y `sendBtn`. Recibe todas las dependencias via `initChat(deps)`.
- `streaming.js` — `createStreamingBubble`, `finalizeStreamingBubble`, airbag visual (`VISUAL_STOP_TOKENS`, `VISUAL_INSTRUCTION_PATTERNS`, `stripLeakedInstructions`). Importa `renderMixedContent` y `renderMessageActions` de `messageRenderer.js`.
- `autoRename.js` — `tryAutoRename` (función pura que reemplaza el bloque de renombrado duplicado en `sendMessage`) y `makeUniqueChatTitle`. Importa `renameChat` directamente de `api.js` — no pasa por `chatDeps`.
- `patchRenderer.js` — `renderPatchBlock`, `showApplyResult`. Importa `getChatState` de `chatState.js` para obtener `projectId` al aplicar patch.
- `codeRenderer.js` — `renderCodeBlock`. Módulo sin dependencias externas.
- `messageRenderer.js` — `renderMixedContent`, `renderMessageActions`, `renderText`, `ICONS`, `makeActionBtn`. Importa `renderCodeBlock` de `codeRenderer.js` y `renderPatchBlock` de `patchRenderer.js`.

### Estado final de ui.js tras modularización
`ui.js` quedó con solo 4 funciones exportadas: `addMessage`, `addDocumentCard`, `addErrorMessage`, `showErrorToast`. Importa `renderMixedContent` y `renderMessageActions` de `messageRenderer.js`.

### Bug resuelto: Patch Mode via system prompt (v2.1.1)
El modelo generaba diffs incorrectos cuando el contexto llegaba solo via system prompt. Resuelto en v2.1.1 con `buildPatchGrounding` en `chat.controller.js` — ver sección "Patch Mode grounding — fix (v2.1.1)".

### 🐛 Context Snapshot: toggle "Activo" aparece deshabilitado en carpetas documentales

**Síntoma**
- En el modal de “Archivos de contexto”, el checkbox **Activo** del bloque **CONTEXT SNAPSHOT** aparece en color gris (disabled) y no permite activar/desactivar.

**Cuándo pasa**
- Cuando `snapshotRoot` apunta a una carpeta que contiene principalmente **documentos** (ej. `.docx`, `.pdf`) y no archivos de **código**.
- El toggle vuelve a funcionar solo después de:
  1) Cambiar la ruta a una carpeta con archivos de código, y
  2) Presionar **Generar snapshot**.

**Causa raíz**
- El Snapshot actual solo indexa extensiones de **código**. Si al generar snapshot el filtro produce **0 archivos**, la UI deshabilita el toggle porque no existen items snapshot que activar/desactivar.
as
**Workaround**
- Para contenido documental usar **+ Subir archivos** (context files).
- Para snapshot usar una carpeta con código y generar snapshot al menos una vez.

**Mejora UX sugerida**
- En vez de dejar el checkbox en gris “silenciosamente”, mostrar tooltip:
  “Snapshot solo para carpetas de código. Para documentos, usa Subir archivos.”
- Opcional: permitir snapshot documental agregando extensiones `.md/.txt/.docx/.pdf` (con límites y extracción).

---

## 🖼️ OCR de adjuntos — Fase 1 completa (v2.2.0–v2.2.3)

### Decisión general
Implementar OCR como pipeline modular de 4 capas independientes en lugar de un módulo monolítico, priorizando extensibilidad y capacidad de migración a Electron.

---

### v2.2.0 — OCR imágenes sueltas

**Decisión:** `tesseract.js` como motor OCR con worker singleton y cache por hash SHA-1.

**Alternativas evaluadas:**

| Opción | Evaluación | Decisión |
|--------|-----------|---------|
| Worker por request (propuesta Gemini) | Paga costo de init (~2-4s) en cada imagen. No escalable. | ❌ Descartada |
| Worker singleton con cache (elegida) | Init una vez, cache evita re-OCR. Eficiente. | ✅ Elegida |
| API OCR externa (Google Vision, AWS Textract) | Dependencia externa, costo por uso, sin privacidad. Rompe el principio local-first de Tempest. | ❌ Descartada |

**Contrato:**
```js
recognizeImage(filePath: string) → Promise
terminateWorker() → Promise
MIN_CONFIDENCE: number
```

**Cache:** `backend/data/ocr-cache/{sha1}.json` — permanente hasta limpieza manual. No tiene TTL. Fallo de escritura es silencioso.

---

### v2.2.1 — OCR PDF escaneado

**Decisión:** Poppler (`pdftoppm`) como rasterizador, envuelto en `pdf.rasterizer.js` como interfaz reemplazable.

**Alternativas evaluadas:**

| Opción | Evaluación | Decisión |
|--------|-----------|---------|
| Poppler CLI (`pdftoppm`) — Opción A | Estable, rápido, probado. Requiere instalación en sistema. Deuda técnica para Electron — necesita empaquetado externo o electron-rebuild. | ✅ Elegida para corto plazo |
| `pdfjs-dist` + `canvas` — Opción B | Puro Node, empaquetable en Electron sin dependencias del SO. `canvas` en Windows requiere Visual C++ Build Tools — difícil de instalar hoy. | ⏳ Pendiente para migración a Electron |
| `pdf2pic` | Wrapper sobre ImageMagick. Misma deuda técnica que Poppler pero menos estable. | ❌ Descartada |

**Nota de migración futura:** cuando se migre a Electron, reemplazar la implementación de `pdf.rasterizer.js` por `pdfjs-dist` + `canvas`. El contrato `rasterizePdf(pdfPath, outDir) → string[]` no cambia — ningún otro módulo necesita modificarse.

**Detección de PDF escaneado:** umbral de 50 chars extraídos por `pdf2json`. Ajustable en `pdf.rasterizer.js`.

**Límite de páginas:** 5 páginas por PDF escaneado. Ajustable en `pdf.rasterizer.js → MAX_PAGES`.

**PATH de Poppler en Windows:** Node hereda el PATH del proceso padre. Solución aplicada en `server.js`: recarga el PATH del sistema al arrancar via `[System.Environment]::GetEnvironmentVariable`.

---

### v2.2.2 — OCR DOCX con imágenes embebidas

**Decisión:** JSZip para extraer `word/media/*`, Tesseract para OCR por imagen, combinación con texto mammoth.

**Alternativas evaluadas:**

| Opción | Evaluación | Decisión |
|--------|-----------|---------|
| JSZip (elegida) | Ya instalado en el proyecto. DOCX es ZIP — acceso directo sin dependencias extra. | ✅ Elegida |
| LibreOffice headless | Extracción de mayor calidad pero requiere instalación del SO. Misma deuda técnica que Poppler. | ⏳ Pendiente — ya en roadmap |
| `mammoth` con imágenes | mammoth solo extrae texto, no imágenes. No viable. | ❌ No aplica |

**Comportamiento cuando no hay imágenes:** `extractDocxImagesOCR` devuelve `null` — `attachment.service.js` cae en el flujo normal de mammoth sin overhead.

**Archivos temporales:** cada imagen se extrae a un temp file para pasarla a `ocr.service.js`. El bloque `finally` garantiza limpieza siempre.

**Límite de imágenes:** 15 imágenes por DOCX. Ajustable en `docx.ocr.extractor.js → MAX_IMAGES`.

---

### v2.2.3 — Preprocesado de imagen con sharp

**Decisión:** `preprocessor.js` como interfaz reemplazable que envuelve `sharp`. `ocr.service.js` no sabe qué implementación hay adentro.

**Alternativas evaluadas:**

| Opción | Evaluación | Decisión |
|--------|-----------|---------|
| sharp integrado directamente en ocr.service.js | Simple pero mezcla responsabilidades. Difícil de swappear en Electron. | ❌ Descartada |
| preprocessor.js como interfaz (elegida) | Separación de responsabilidades. sharp es reemplazable sin tocar ocr.service.js. | ✅ Elegida |
| jimp (puro JS) | Sin binarios nativos — ideal para Electron. Más lento que sharp. | ⏳ Candidato para reemplazar sharp en Electron |
| Sin preprocesado | Más simple pero confianza OCR más baja en imágenes de baja calidad. | ❌ Descartada — mejora medible (77%→87%) |

**Nota de migración futura:** `sharp` tiene binarios nativos que necesitan `electron-rebuild`. Si da problemas en Electron, reemplazar la implementación de `preprocessor.js` por `jimp`. El contrato `preprocessImage(inputPath) → { outputPath, wasProcessed }` no cambia.

**Pipeline de preprocesado:**
1. Escala de grises — reduce ruido de color
2. Normalización de contraste — mejora texto claro sobre fondo claro
3. Upscaling a 1000px mínimo si la imagen es pequeña
4. Export PNG sin compresión para máxima calidad OCR

**Resultado medido:** confianza OCR mejoró de 77% a 87% en imagen de prueba.

**`PREPROCESSING_ENABLED`:** flag global en `preprocessor.js` para desactivar todo el preprocesado. En el futuro puede venir de `projectSettings.json`.

---

### Arquitectura final del pipeline OCR
attachment.service.js (orquestador)
├── image.extractor.js          ← imágenes sueltas
├── pdf.ocr.extractor.js        ← PDF escaneado
└── docx.ocr.extractor.js       ← DOCX con imágenes
↓ todos llaman a:
ocr.service.js              ← motor OCR central
├── preprocessor.js         ← preprocesado (sharp → jimp en Electron)
└── rasterizers/
└── pdf.rasterizer.js   ← rasterización (Poppler → pdfjs en Electron)

**Principio de diseño:** cada capa es reemplazable independientemente. La migración a Electron solo requiere reemplazar `pdf.rasterizer.js` y posiblemente `preprocessor.js` — sin tocar extractores ni `attachment.service.js`.

---

### v2.3.0 — Análisis visual con modelo multimodal

**Decisión:** `vision.service.js` como servicio independiente y reemplazable. `image.extractor.js` lo llama como fallback cuando OCR da confianza < 60%. El contrato es `describeImage(filePath) → { description, model, truncated }`.

**Alternativas evaluadas:**

| Opción | Evaluación | Decisión |
|--------|-----------|---------|
| LLaVA 1.6 (desktop) | Genera loops de texto repetido, respuestas cortadas. | ❌ Solo laptop |
| Qwen2.5-VL-7B-Q4 (elegida desktop) | Mayor calidad, respuestas completas en español. Requiere mmproj separado. | ✅ Elegida desktop |
| MiniCPM-V 4.5 | No funcionó correctamente con la versión de LocalAI disponible. | ❌ Descartada |

**Parámetros vision.service.js:**
- `max_tokens: 1024` — suficiente para descripción detallada sin truncado
- `temperature: 0.1` — respuestas deterministas para análisis visual
- `repeat_penalty: 1.8` — agresivo para evitar loops en modelo visual
- `frequency_penalty: 1.2` — penalización de repetición complementaria
- `removeLoops()` — limpieza post-respuesta de párrafos y frases duplicadas
- Límite en `removeLoops()`: 2000 chars — no corta respuestas normales

**Imagen redimensionada antes de enviar:** sharp a 1024px max, JPEG quality 70. Evita superar el límite gRPC de 4MB de LocalAI.

**`truncated` real propagado:** `vision.service.js` detecta `finish_reason === 'length'` y lo retorna. `image.extractor.js` usa ese valor en lugar del hardcodeado `false`.

---

### v2.3.0 — Migración Docker a imagen no-AIO

**Decisión:** Cambiar de `master-aio-gpu-nvidia-cuda-12` a `master-gpu-nvidia-cuda-12` con volumen persistente para backends.

**Problema con imagen AIO:** descarga automática de `jina-reranker`, `granite-embedding`, `voice-en-us-amy-low.tar.gz` en cada arranque. Archivos incompatibles causaban `panic while parsing gguf file` y loop de reinicios. Variables `PRELOAD_MODELS`, `GALLERIES=[]`, `LOCALAI_DISABLE_PRELOAD_MODELS` ignoradas por el entrypoint AIO.

**Solución:**
- Imagen `master-gpu-nvidia-cuda-12` sin AIO — sin descargas automáticas
- Volumen `localai-backends:/var/lib/local-ai/backends` — backend `llama-cpp` persiste entre reinicios
- `LOCALAI_BACKENDS_PATH=/var/lib/local-ai/backends` — apunta al volumen persistente

**Impacto:** primera carga descarga `llama-cpp` (~2.2 GB). Reinicios posteriores usan el volumen — sin descarga.

---

### v2.4.0 — Perfil laptop con LLaVA y Qwen2.5-Coder-3B

**Decisión:** `getVisionModel()` en lugar de constante `VISION_MODEL` — lee `process.env.HARDWARE_PROFILE` en tiempo de ejecución para seleccionar el modelo visual correcto sin cambiar código entre máquinas.

**Por qué `process.env` en lugar de parámetro:** `vision.service.js` se carga antes de que `chat.controller.js` ejecute. La solución fue convertir la constante en una función que lee el env en el momento de cada llamada, y propagar `process.env.HARDWARE_PROFILE = HARDWARE_PROFILE` al arrancar el controller.

**Qwen2.5-Coder-3B-Q8 para laptop:** Q8 elegido sobre Q5 porque cabe en 6GB VRAM y da mejor calidad de código. Los 3.5GB del Q8 dejan margen suficiente en la RTX 4050. Usarlo para `coder-fast`, `coder-heavy` y `coder-patch` — modelo especializado en código es mejor que modelo general 3B para patch mode.

**Backend llama-cpp en laptop:** la imagen no-AIO no descarga el backend automáticamente cuando el volumen está vacío. Solución: usar imagen AIO temporalmente para forzar la descarga, luego volver a no-AIO. El backend persiste en el volumen.

### v2.4.0 — Errores encontrados y soluciones

**Error: `GPU count count=0` en LocalAI laptop**
LocalAI reportaba `GPU count=0` al arrancar aunque `nvidia-smi` mostraba la RTX 4050 correctamente. El problema era un timing issue con WSL2 — las librerías CUDA en `/usr/lib/wsl/lib` estaban montadas pero LocalAI las leía antes de que estuvieran disponibles. Como consecuencia, el volumen `localai-backends` quedaba vacío porque LocalAI no detectaba que necesitaba el backend CUDA.

Solución: usar la imagen AIO (`master-aio-gpu-nvidia-cuda-12`) temporalmente para forzar la descarga del backend `cuda12-llama-cpp` al volumen persistente. Una vez descargado, volver a la imagen no-AIO. En reinicios posteriores el volumen ya tiene el backend y funciona correctamente.

**Decisión descartada: descargar backend manualmente vía curl**
Se intentó descargar el backend directamente con `curl` desde GitHub releases. El URL devolvía 9 bytes en lugar del archivo real — GitHub redirige descargas grandes y curl sin `-L` no sigue redirects correctamente. Incluso con `-L` el archivo llegaba corrupto. Descartado.

**Decisión descartada: instalar backend vía API de galería**
Se intentó `POST /backend/install` y `POST /models/apply` con el ID del backend. El primer endpoint devolvió 404 — no existe en esta versión de LocalAI. El segundo cerró la conexión sin responder. Descartado.

**Decisión descartada: `LOCALAI_EXTERNAL_BACKENDS`**
Se agregó la variable con la URI del backend en quay.io. LocalAI la ignoró y siguió reportando `All backends up to date` sin descargar nada. La variable requiere que LocalAI detecte GPU correctamente para activarse. Descartado.

**Error: `VISION_MODEL` constante leída antes de `process.env`**
`vision.service.js` definía `VISION_MODEL` como constante al cargarse el módulo. Como Node.js carga los módulos una sola vez, el valor quedaba fijo en `'qwen2.5-vl-7b-q4'` aunque `chat.controller.js` después asignara `process.env.HARDWARE_PROFILE = 'laptop'`.

Solución: convertir `VISION_MODEL` en función `getVisionModel()` que lee `process.env.HARDWARE_PROFILE` en cada llamada. Esto garantiza que el valor se evalúa en tiempo de ejecución, no al cargar el módulo.

**Error: `VISION_MODEL is not defined` al exportar**
Al convertir la constante en función, el `module.exports` seguía referenciando `VISION_MODEL`. Node lanzó `ReferenceError` al cargar el módulo. Solución: reemplazar `VISION_MODEL` por `getVisionModel` en el export y en `image.extractor.js`.

**Error: rama `dev` no encontrada localmente**
`git checkout dev` fallaba con `pathspec 'dev' did not match any file(s) known to git`. La rama existía en remoto pero no había sido rastreada localmente. Solución: `git checkout -b dev origin/dev` para crearla localmente con tracking del remoto.

**Decisión descartada: Qwen2.5-Coder-3B-Q5 para laptop**
Inicialmente se descargaron tanto Q5 como Q8. Se eligió Q8 porque cabe completo en los 6GB VRAM de la RTX 4050 y da mejor calidad de código. El Q5 no tiene ventaja real cuando la VRAM es suficiente.

---

### v2.4.1 — Endpoint `/hardware-profile` para sincronización automática frontend

**Decisión:** exponer `GET /hardware-profile` desde `chat.controller.js` para que el frontend lea el perfil activo al arrancar. `models.js` inicializa `HARDWARE_PROFILE = 'desktop'` como valor temporal y lo sobreescribe con `initHardwareProfile()` al cargar `app.js`.

**Problema que resuelve:** antes había que cambiar `HARDWARE_PROFILE` en dos archivos (`chat.controller.js` y `models.js`) al cambiar de máquina. Ahora solo se toca `chat.controller.js`.

**Opción descartada: variable `.env` compartida para frontend y backend** — el frontend (JS vanilla en browser) no puede leer archivos `.env` directamente. Requeriría un bundler (Vite, Webpack) o un paso de build. Descartado por complejidad innecesaria.

**Opción descartada: `config.js` en frontend** — crear un archivo `frontend/config.js` con `export const HARDWARE_PROFILE = 'laptop'` e importarlo en `models.js`. Reducía a un archivo pero seguía siendo manual. Descartado — el endpoint es más robusto y no requiere ningún cambio al cambiar de máquina.

---

### v2.4.1 — Renombrado asíncrono con timeout de 30 segundos

**Decisión:** `tryAutoRename` se llama sin `await` en `chat.js` para no bloquear la UI. El backend usa `AbortController` con timeout de 30s en `generateTitleFromText`.

**Problema:** LocalAI procesa una petición a la vez. Cuando LLaVA termina de describir una imagen, el modelo de títulos (`llama-3.2-3b-q4`) tiene que esperar en cola. Sin timeout, el renombrado bloqueaba indefinidamente.

**Error encontrado: `ERR_CONNECTION_REFUSED` en autoRename** — al quitar el `await`, `tryAutoRename` corría en segundo plano pero el servidor Node se cerraba antes de que terminara. Solución: agregar `.catch()` para capturar errores silenciosos y verificar en DevTools Network que el fetch a `/title/generate` llegara.

**Error encontrado: logs de `autoRename` no visibles en servidor** — los `console.log` de `autoRename.js` son del frontend (browser), no del servidor Node. Solo visibles en DevTools F12 → Console.

**Modelo para títulos en laptop:** `llama-3.2-3b-q4` en lugar de `hermes-q4` (desktop). Más rápido en hardware de 6GB VRAM. El cambio se lee de `process.env.HARDWARE_PROFILE` en `generateTitleFromText`.

---

### v2.4.1 — `getVisionParams()` separado por perfil

**Decisión:** crear `getVisionParams()` en `vision.service.js` que devuelve parámetros según `HARDWARE_PROFILE`. Laptop: `max_tokens:512, repeat_penalty:2.0, frequency_penalty:1.5, presence_penalty:1.0`. Desktop: `max_tokens:1024, repeat_penalty:1.8, frequency_penalty:1.2`.

**Razón:** LLaVA en laptop tiende a generar loops de texto repetido. Parámetros más agresivos reducen repetición. Qwen2.5-VL en desktop necesita más tokens para descripciones completas.

**Opción descartada: hardcodear por nombre de modelo** — `if (model === 'llava-1.6')`. Descartado porque si se cambia LLaVA por otro modelo en laptop, habría que actualizar `vision.service.js`. El perfil es más estable que el nombre del modelo.

**Error: LLaVA repite el prompt del sistema como respuesta** — LLaVA repetía las instrucciones del `visual.txt` en su respuesta. El regex de limpieza en `chat.controller.js` (`/^(Si es [^.]+\.\s*)+/gi`) no era suficiente porque cada línea comenzaba con "Si es". Solución final: simplificar el prompt en `vision.service.js` a `'Describe brevemente lo que ves en esta imagen en español.'` para evitar que LLaVA repita instrucciones complejas.

**Error: `skipContextFiles` faltante en modo visual** — la primera prueba de LLaVA con un proyecto que tenía context files fallaba con `SocketError: other side closed` porque se enviaban 8956 chars de context files + la imagen en base64. LocalAI cerraba la conexión por payload demasiado grande. Solución: agregar `mode === 'visual'` a la condición `skipContextFiles` en `chat.controller.js`.

---

### v2.4.1 — Limpieza de modelos en laptop

**Decisión:** eliminar físicamente GGUFs y YAMLs de desktop de la carpeta `models-localai/` en laptop. Agregar YAMLs de desktop al `.gitignore` para evitar que se propaguen entre máquinas.

**Problema:** LocalAI lee todos los archivos de `models-localai/` al arrancar aunque no tengan YAML asociado. Con los GGUFs de desktop presentes, el tiempo de arranque era ~20 minutos. Sin ellos: ~8 minutos.

**Error: `git revert` restauró archivos eliminados** — al intentar revertir un commit que eliminaba YAMLs de desktop para evitar que se propagaran al desktop, el `git revert` también restauró los cambios de código (`vision.service.js`, `docker-compose.yml`). Solución: después del revert, volver a aplicar solo los cambios de código con `git add` selectivo.

**Error: `LOCALAI_EXTERNAL_BACKENDS` restaurada por revert** — la variable `LOCALAI_EXTERNAL_BACKENDS=quay.io/...` en `docker-compose.yml` fue restaurada por el revert. LocalAI la ignoraba pero generaba error `specifying a name is required for OCI images` en cada arranque. Eliminada definitivamente.

**Decisión: `git update-index --skip-worktree` para YAMLs de desktop en laptop** — protege los YAMLs de desktop en el desktop de ser eliminados cuando el laptop haga push sin ellos. Ejecutado una sola vez en laptop para los 9 YAMLs de desktop.

**Decisión: `.gitignore` con YAMLs específicos de desktop** — `hermes-q4.yaml`, `hermes-q5.yaml`, `hermes-q6.yaml`, `gemma-2-9b-q4.yaml`, `deepseek-coder-6.7b-q6.yaml`, `qwen2.5-7b-q5.yaml`, `qwen-coder-14b-q4.yaml`, `llama-3.1-8b-q5.yaml`, `qwen2_5-vl-7b-q4.yaml`. No se ignoraron todos los YAMLs para que los de laptop sigan sincronizándose.

---

### v2.4.2 — Streaming visual y timeout de renombrado por perfil

**Streaming visual:** el bloque de modo visual en `chat.controller.js` ahora divide la descripción en palabras y las envía con un delay de 20ms cada una, simulando el efecto de escritura. Antes enviaba todo el texto de golpe en un solo `res.write`.

**Timeout de renombrado por perfil:** `generateTitleFromText` en `localai.service.js` usa 30s en laptop y 60s en desktop. En desktop `hermes-q4` es más rápido pero Qwen2.5-VL-7B tarda más en liberar LocalAI, por lo que necesita más margen.

**Opción descartada: quitar el timeout** — sin timeout el renombrado esperaría indefinidamente hasta que LocalAI quede libre. Descartado — el timeout falla rápido y libera el hilo.

---

## v2.4.3 — Modo Desarrollador (Dev Panel) + Renombrado paralelo + Modelo de títulos

### 🛠️ Modo Desarrollador con control por rol admin/user

**Decisión:** implementar un Dev Panel transversal visible solo para perfil `admin`, controlado por la variable `ADMIN_MODE` en `.env`, con un contrato `GET /me → { role }`.

**Razón:** Tempest planea evolucionar a producto B2B con sistema de usuarios. El Dev Panel expone telemetría interna (modelo usado, modo, tokens, truncado) que un usuario final no debe ver.

**Opciones evaluadas:**
- **Opción A — Control por perfil (admin/user):** el panel solo existe para admins. Elegida.
- **Opción B — Toggle en configuración (cualquier usuario lo activa):** descartada. No escala para venta empresarial — el cliente no querría que sus empleados vean qué modelos corre, latencias o consumo de tokens.
- **Tercera vía adoptada:** `ADMIN_MODE=true` en `.env` ahora → roles reales con login después. El contrato `GET /me → { role }` es exactamente el que se usará con usuarios reales, así que no se tira código al migrar.

**Impacto futuro:** cuando se implemente login real, solo cambia lo que devuelve `/me` — el frontend (`devPanel.js`) no cambia. No complica migración a Electron (el `devMode.service.js` es un singleton reemplazable).

**Lo que NO hace esta implementación:**
- No persiste logs en disco (hook listo en `devMode.service.js`).
- No hace profiling de GPU (requiere NVML).
- No muestra OCR debug todavía (Fase OCR 2).

### 🏷️ Modelo dedicado para generación de títulos

**Decisión:** usar un modelo ligero distinto al de chat para generar títulos. Evolución de la decisión:
1. Primero se intentó usar el mismo modelo activo (ya en VRAM, sin swap).
2. Se descartó porque modelos coder y de razonamiento pesado son lentos para una tarea de 4-8 tokens. Se creó la lista `TITLE_FALLBACK_MODELS` con los modelos no aptos que hacen fallback al modelo de títulos.
3. Se probó `phi-3-mini-q4` (3.8B) — **descartado**: devolvía contenido vacío (`"\n"`). El template de Phi-3 (`<|user|>`/`<|assistant|>`) no era compatible con el render de LocalAI; `message` llegaba vacío aunque `completion_tokens` fuera > 0.
4. Se probó `llama-3.2-3b-q4` — **descartado para desktop**: alucinaba títulos (ej. "Torre Eiffel" → "Torre Hanoi", asociando "torre" con el algoritmo de programación).
5. **Decisión final:** `hermes-q4` (8B) para títulos en desktop, `llama-3.2-3b-q4` en laptop. `hermes-q4` es confiable y preciso; el costo de tamaño se mitiga con preload.

### ⚡ Renombrado paralelo a la respuesta

**Decisión:** lanzar `tryAutoRename` en paralelo al stream principal (no después), usando una `Promise` sin `await` que se resuelve al final del stream.

**Razón:** antes el renombrado era secuencial — el usuario esperaba stream (30-60s) + título (8-20s). En paralelo, el título se genera mientras el modelo principal responde.

**Errores encontrados y soluciones:**
- **Respuesta duplicada:** el `tryAutoRename` paralelo llamaba a `loadSidebar` internamente, que recargaba el historial y re-renderizaba los mensajes. Solución: pasar `loadSidebar: null` durante el paralelo y llamar `loadSidebar` una sola vez al final del stream.
- **Chat huérfano al cambiar de sidebar:** si el usuario cambiaba de chat mientras se generaba el título, el `setActiveChat` del renombrado sobreescribía la selección, creando un chat con ID temporal `chat-XXXX` con la respuesta dentro. Solución: en `autoRename.js`, verificar `getChatState().chatId === renameTarget.chatId` antes de llamar `setActiveChat`.
- **`loadSidebar` null lanzaba excepción:** al pasar `loadSidebar: null`, la llamada `await loadSidebar()` fallaba en el catch. Solución: `if (loadSidebar) await loadSidebar(getSidebarDeps())`.
- **Doble request al backend (chat huérfano):** `sendMessage` se ejecutaba dos veces cuando Enter y el click del `sendBtn` se disparaban simultáneamente, generando dos chats. Solución: flag `_sending` en `chat.js` que bloquea ejecuciones concurrentes + `event.preventDefault()` en ambos listeners.
- **`pendingAutoRename` no se limpiaba al fallar el título:** si `generateTitle` devolvía `ok: false` o título vacío, `setPendingAutoRename(null)` nunca se ejecutaba y el siguiente chat heredaba el estado sucio del anterior, causando renombrados cruzados. Solución: limpiar `pendingAutoRename` al inicio del bloque de fallo antes de hacer `return`.


### 🔀 Requests paralelos en LocalAI (sin segunda instancia)

**Decisión:** habilitar `PARALLEL_REQUEST=true` + `LLAMACPP_PARALLEL=2` en `docker-compose.yml` en lugar de levantar una segunda instancia de LocalAI.

**Razón:** LocalAI con backend llama.cpp soporta requests paralelos nativamente vía CUDA streams. Esto permite que el modelo de chat y el de títulos procesen simultáneamente sin duplicar la infraestructura ni el consumo base de VRAM. Confirmado en docs oficiales de LocalAI.

**Opción descartada — segunda instancia de LocalAI:** doblaría el consumo de VRAM base y complicaría la arquitectura (dos puertos, dos contenedores). El paralelismo nativo logra el mismo objetivo con una variable de entorno.

**Resultado:** el renombrado ahora ocurre verdaderamente al mismo tiempo que la respuesta — el título aparece en el instante que termina el stream.

### 📌 Preload de modelo de títulos

**Decisión:** precargar el modelo de títulos en VRAM al arrancar (`PRELOAD_MODELS=hermes-q4` + `LOCALAI_DISABLE_PRELOAD_MODELS=false`).

**Razón:** sin preload, la primera consulta tras reiniciar tardaba 20s+ porque `hermes-q4` se cargaba desde disco. El renombrado en paralelo solo funciona si el modelo de títulos ya está en VRAM.

**Conflicto encontrado:** `PRELOAD_MODELS=hermes-q4` no tenía efecto porque `LOCALAI_DISABLE_PRELOAD_MODELS=true` lo cancelaba. Solución: cambiar a `false`.

**Costo de VRAM:** `hermes-q4` ocupa ~5GB permanentes de los 12GB. Cabe junto con cualquier modelo de chat excepto `qwen-coder-14b-q4` (~8GB) — en ese caso LocalAI descarga `hermes-q4` y lo recarga al terminar (swap de ~2-3s, solo para ese modelo).

### 🧹 Limpieza de títulos generados (cleanGeneratedTitle)

**Decisión:** combinar prompt few-shot mejorado + función de limpieza agresiva (basado en propuestas comparativas de ChatGPT, Gemini y Grok).

**Defensas implementadas:**
- Prompt few-shot con patrón `"texto" → palabras clave` en lugar de etiquetas `Usuario:/Título:` (que el modelo repetía como parte de la respuesta).
- `max_tokens: 8` (bajado de 12) — el modelo no quiere creatividad, quiere palabras clave.
- Detección de frases completas con verbos (` es `, ` son `, ` fue `, ` tiene `, etc.) → si el título es una oración, usa `buildFallbackTitle(sourceText)`.
- Blacklist de palabras basura: descripcion, titulo, tema, chat, conversacion, resumen, corto, usuario, como, se.
- `buildFallbackTitle` — red de seguridad que extrae las primeras palabras significativas del mensaje original cuando el modelo falla.

**Error de diseño corregido:** un ejemplo del few-shot usaba "Muralla China" — si el usuario preguntaba justo sobre eso, el modelo copiaba el ejemplo en vez de razonarlo. Los ejemplos del few-shot deben ser de temas que el usuario probablemente NO pregunte.

**Limitación conocida:** con modelos locales pequeños, palabras basura ocasionales ("como", "se", fragmentos cortados como "hab") siguen colándose. El prompt hace ~90% del trabajo; `cleanGeneratedTitle` limpia el 10% restante. Son dos capas complementarias, no redundantes.

### 🐳 Imagen de LocalAI fijada por digest

**Decisión:** fijar la imagen Docker por digest SHA256 en lugar del tag mutable `master-gpu-nvidia-cuda-12`.

image: localai/localai:master-gpu-nvidia-cuda-12@sha256:d905217442fd00843b2043a41f279efb24fb7cfb3fa662dae453b7758e7fac8f

**Problema raíz:** el tag `master` se actualiza solo. Durante un `down`+`up`, Docker descargó una versión nueva con un bug en el parser GGUF (`panic while parsing gguf file`) que alargó el arranque a 15-20+ minutos.

**Error: confusión con `v2.20.0`** — se intentó fijar a `v2.20.0` pero esa imagen nunca se había usado (no estaba en caché local) e intentó descargar 18GB. La solución correcta fue fijar el digest exacto de la imagen `master` que ya estaba en caché y funcionaba.

**Nota:** un ChatGPT externo había modificado el `docker-compose.yml` durante una sesión paralela. Lección: cambios de infraestructura deben revisarse contra git antes de aplicar.

### 🗑️ Limpieza de modelos basura en models-localai/

**Decisión:** mover a `models-localai/_unused/` los archivos que LocalAI intentaba parsear como GGUF y que causaban panic o alargaban el arranque.

**Movidos a `_unused/`:**
- `hermes-q6` (GGUF + YAML) — causaba `panic while parsing gguf file`. Superado por `qwen2.5-7b-q5`.
- Archivos de embeddings/TTS/rerankers agregados por un ChatGPT externo: `._gallery_*.yaml`, `jina-reranker-*`, `text-embedding-ada-002.yaml`, `tts-1.yaml`, `voice-en-us-amy-low.tar.gz`, `granite-embedding-107m-multilingual-f16.gguf`.
`hermes-q6` también fue eliminado del selector manual de modelos en `frontend/modules/models.js` — si el usuario lo seleccionaba, las requests fallaban silenciosamente porque el modelo no cargaba en LocalAI.


**Nota sobre `GPU count = 0`:** los logs de LocalAI muestran `GPU count count=0` — es un **falso negativo conocido**. Los modelos sí corren en GPU (confirmado por `gpu-layers: 99` funcionando). Es un bug de detección de LocalAI en Docker+WSL2.

**Error: `empty-preload.yaml` corrupto** — contenía `[]` que LocalAI no podía interpretar, generando `cannot unmarshal !!seq into config.BCAlias` en cada arranque. Eliminado. `LOCALAI_PRELOAD_MODELS_CONFIG` se dejó vacía.

### 📦 dotenv para variables de entorno

**Decisión:** el `.env` vive en la raíz del proyecto, no dentro de `backend/`.

**Razón:** `HARDWARE_PROFILE` y `ADMIN_MODE` deben ser editables sin tocar código. Cambiar de perfil desktop/laptop ahora es editar el `.env` y reiniciar.

**Nota:** `server.js` carga dotenv con ruta explícita `path: '../.env'` porque está en `backend/` y el `.env` está un nivel arriba.

---

## v2.4.5 — Dev Panel métricas completas

### 📊 Tokens estimados en Dev Panel

**Problema:** LocalAI no devuelve `usage` (prompt_tokens, completion_tokens) en modo stream con backend llama.cpp — es un bug conocido documentado en GitHub issues desde v2.11.0. Los campos siempre llegan en 0 o ausentes.

**Opciones evaluadas:**
- **`Extra-Usage: true` header** — activa timings internos (`timing_prompt_processing`, `timing_token_generation`) pero NO los conteos de tokens. Implementado y disponible cuando LocalAI lo soporte.
- **Estimación desde `finalMessage.length`** — descartada: `finalMessage` solo contiene el mensaje del usuario (17 chars para "capital de brazil"), no incluye el system prompt ni el historial.
- **Estimación desde el prompt completo real (Opción B, elegida)** — calcula la longitud total de todos los mensajes ensamblados dentro de `streamToLocalAI` (system prompt + historial + mensaje del usuario) antes de enviarlo a LocalAI. Divide entre 4 (heurística estándar: 1 token ≈ 4 caracteres).

**Decisión final:** estimar tokens de entrada sumando `messages.reduce((sum, m) => sum + m.content.length, 0) / 4` dentro del generator, propagando el valor via objeto `meta` por referencia. Tokens de salida: acumulador `replyLength` en el controller que suma la longitud de cada token generado.

**Error encontrado:** el `finally` de `streamToLocalAI` sobreescribía `meta.promptTokens` con `streamMeta.promptTokens` (que vale 0 cuando LocalAI no devuelve usage), borrando la estimación calculada. Solución: `meta.promptTokens = streamMeta.promptTokens || meta.promptTokens` — preserva la estimación si LocalAI no devuelve valor real.

**Error encontrado:** `buildSystemPrompt` era `async` y se llamaba inline dentro del array `messages`. Al agregar código que usaba `messages` inmediatamente después, el `await` no había resuelto en algunos casos, causando que el servidor quedara colgado sin responder. Solución: extraer `buildSystemPrompt` a una variable separada con `await` antes de construir el array.

**Contrato implícito (`streamToLocalAI` ↔ `chat.controller`):** `streamToLocalAI` recibe un tercer parámetro `meta = {}` por referencia. El generator escribe en `meta.promptTokens` antes del stream y en `meta.finishReason`, `meta.timingPrompt`, `meta.timingGeneration` en el `finally`. El controller lee estos valores después del `for await` para construir el `debugPayload`.

**Limitación documentada:** los tokens son estimaciones, no valores exactos. La heurística de /4 puede variar en texto técnico o con muchos caracteres especiales. Si LocalAI eventualmente devuelve tokens reales en `usage`, el `||` los priorizará automáticamente sobre la estimación.

### ⏱️ Duración real del stream

**Decisión:** medir `durationMs = Date.now() - streamStart` en el controller, donde `streamStart` se registra justo antes del `for await`. Esto mide el tiempo total del stream de inicio a fin, incluyendo el tiempo de espera en cola de LocalAI.

**Por qué es útil:** la duración expone directamente el problema del modo `explain` que tarda 2:30+ — en el Dev Panel se muestra en rojo cuando supera 5000ms (`dev-value--warn`).

---

## v2.4.6 — Modal de Configuración + Toggle de Debug

### ⚙️ Modal de configuración global (Settings)

**Decisión:** agregar un botón de engrane (⚙) en la parte inferior del sidebar que abre un modal de configuración general. Por ahora solo contiene el toggle de Debug Mode, pero está diseñado para crecer con más opciones en el futuro.

**Razón:** el toggle de debug necesitaba un punto de acceso en la UI sin reiniciar el servidor. El modal de configuración es el lugar natural para opciones globales de la aplicación.

**Módulos nuevos:**
- `frontend/modules/settings.js` — lógica del modal, toggle de debug, visibilidad del Dev Panel
- `frontend/styles/settings.css` — estilos del botón engrane y modal

**Contrato implícito (`devPanel.js` ↔ `settings.js`):** `initDevPanel()` retorna `isAdmin` (bool). `app.js` lo pasa a `initSettings(isAdmin)` para que el modal muestre la sección de debug solo para admins. Si `initDevPanel()` no retorna el valor correctamente, `settings.js` no muestra la sección de debug.

**Error encontrado:** `return isAdmin` estaba colocado ANTES de `_injectHTML()` y `_bindEvents()` en `initDevPanel()` — todo el código después del `return` nunca se ejecutaba. El panel nunca se inyectaba en el DOM aunque `isAdmin` fuera `true`. Solución: mover el `return isAdmin` al final de la función.

**Error encontrado:** al aplicar el fix anterior, quedó un bloque `const wasOpen = ...` duplicado después del `return`. Causaba `SyntaxError: Identifier 'wasOpen' has already been declared`. Solución: eliminar el bloque duplicado.

### 🔦 Toggle de debug sin reinicio

**Decisión:** el toggle en el modal llama a `POST /debug/toggle` para activar/desactivar `devModeEnabled` en el singleton `devMode.service.js` sin reiniciar el servidor. El Dev Panel (incluyendo la flecha) se oculta o muestra inmediatamente con `wrapper.style.display`.

**Comportamiento por defecto:** `devModeEnabled = false` al arrancar — el panel está oculto hasta que el admin lo activa desde configuración. Al recargar la página, el estado se lee de `/debug/status` y se aplica la visibilidad inicial.

**Limitación conocida:** `devModeEnabled` es una variable en memoria — se resetea a `false` al reiniciar el servidor Node. El admin debe reactivar el debug después de cada reinicio.

**Nota sobre respuestas hardcodeadas:** mensajes como "hola", "buenas" o "hey" tienen un atajo en `streamToLocalAI` que responde directamente sin llamar a LocalAI. El Dev Panel muestra `—` para tokens y 2ms de duración en esos casos — es correcto y esperado, no es un bug.
---

## v2.4.7 — Logs estructurados JSONL

### 📋 Sistema de logging por request

**Decisión:** guardar cada request en `backend/logs/requests-YYYY-MM-DD.jsonl` — siempre, independientemente de si el Dev Panel está activo o no.

**Razón:** el Dev Panel es visualización en tiempo real. Los logs son historial persistente — permiten analizar patrones, diagnosticar problemas pasados y preparar el sistema para monitoreo futuro (Elasticsearch, Grafana, etc.).

**Formato elegido: JSONL (JSON Lines)**
- Una línea JSON por request
- Estándar en producción — compatible con AWS CloudWatch, Datadog, Splunk
- Fácil de parsear con scripts o herramientas
- Descartado formato texto legible — no escala, difícil de parsear automáticamente

**Rotación por día:** el nombre del archivo incluye la fecha (`new Date().toISOString().slice(0, 10)`). Cada día genera automáticamente un archivo nuevo sin proceso especial de rotación. Estándar en Nginx, Apache y la mayoría de sistemas de producción.

**Campos por entrada:**
```json
{
  "timestamp": "2026-06-05T20:40:03.627Z",
  "mode": "general",
  "variant": null,
  "model": "qwen2.5-7b-q5",
  "hardwareProfile": "desktop",
  "contextSize": 0,
  "truncated": false,
  "finishReason": "stop",
  "tokensIn": 227,
  "tokensOut": 85,
  "durationMs": 143795,
  "timingPrompt": null,
  "timingGeneration": null
}
```

**`backend/logs/` en `.gitignore`:** los logs no se suben a GitHub — son datos de runtime específicos de cada instalación.

**Nota:** `fs.appendFileSync` es síncrono y atómico — no hay riesgo de corrupción con requests concurrentes. Si el disco está lleno o hay permisos insuficientes, el error se atrapa con un warning en consola sin interrumpir el stream del usuario.


---

## v2.4.8 — Autenticación JWT + Login real

### 🔐 Sistema de autenticación JWT con sliding expiration

**Decisión:** implementar autenticación con JSON Web Tokens (JWT) con expiración por inactividad (sliding expiration de 2 horas).

**Razón:** `ADMIN_MODE=true` en `.env` no es suficiente para un producto B2B — cualquiera con acceso a la máquina podría usar Tempest sin restricciones. JWT es el estándar de la industria para autenticación stateless.

**Arquitectura:**
- `backend/services/auth.service.js` — lógica de autenticación: login, verificación, renovación de token, CRUD de usuarios, hash de contraseñas con bcrypt
- `backend/middleware/auth.middleware.js` — `authMiddleware` verifica el token en cada request; `adminMiddleware` verifica el rol admin. El token se renueva en cada request exitoso via header `X-Renewed-Token`.
- `backend/routes/auth.routes.js` — endpoints: `POST /auth/login`, `POST /auth/logout`, `GET /auth/users`, `POST /auth/users`, `DELETE /auth/users/:username`
- `frontend/modules/login.js` — pantalla de login, `saveSession/clearSession`, `fetchWithAuth` helper para requests autenticados
- `frontend/styles/login.css` — estilos de la pantalla de login

**Sliding expiration:** el token dura 2 horas desde el último uso. Cada request exitoso devuelve un token renovado en el header `X-Renewed-Token`. Sin actividad por 2 horas → token expira → redirige al login automáticamente.

**Usuario por defecto:** al arrancar por primera vez, `initDefaultAdmin()` crea el usuario `admin` con contraseña `admin` si no existe ningún usuario en `backend/data/users.json`. La contraseña debe cambiarse tras el primer login.

**Contraseñas:** hasheadas con bcrypt (salt rounds: 10). Nunca se guarda la contraseña en texto plano.

**Token en localStorage:** guardado como `tempest_token`. Al reiniciar el servidor el token sigue válido hasta que expire — comportamiento intencional para uso local personal. Para invalidar tokens al reiniciar se requeriría un secret rotante o lista negra (v3.0+).

**Rutas protegidas:** todas las rutas excepto `/auth/login`, `/hardware-profile` y los archivos estáticos requieren token válido.

**`fetchWithAuth`:** helper en `login.js` que inyecta el token automáticamente en cualquier fetch. Usado por `devPanel.js` y `settings.js` para consultas internas (`/me`, `/debug/status`, `/debug/toggle`).

**Interceptor 401:** `handleUnauthorized` en `api.js` detecta respuestas 401 en `sendChatMessage`, limpia la sesión y recarga la página mostrando el login.

### 🔒 Control de acceso por rol en modal de configuración

**Decisión:** el modal ⚙ siempre visible para todos los usuarios, pero el contenido se adapta al rol:
- **Todos los roles:** preferencias personales (futuro: modelo de audio, idioma, tema)
- **Solo admin:** sección "Modo Desarrollador" (toggle debug), sección "Usuarios" (gestión)

**Razón:** es el patrón estándar en apps empresariales (Slack, Notion, Linear) — el engrane siempre accesible, el contenido controlado por rol.

### 🚪 Cierre de sesión con confirmación

**Decisión:** botón "Cerrar sesión" en el modal de configuración con modal de confirmación separado antes de ejecutar el logout.

**Razón:** evitar cierres de sesión accidentales — práctica estándar en aplicaciones empresariales. Al confirmar, llama a `POST /auth/logout` y limpia `localStorage`, luego recarga la página.

**Dependencias nuevas:** `jsonwebtoken`, `bcrypt` (npm).

---

## v2.4.9 — Gestión de usuarios UI + Separación settings.html

### 🐛 Errores encontrados y resueltos

**`settings.html` borrado accidentalmente:** el archivo se eliminó durante ediciones de `index.html`, causando que `_loadHTML()` fallara silenciosamente y todos los elementos del modal devolvieran `null`. Solución: recrear el archivo con los tres modales completos (configuración, confirmar logout, crear usuario).

**`let _isAdmin = false` eliminado:** la variable global se perdió durante ediciones del archivo, causando `ReferenceError: _isAdmin is not defined`. Solución: restaurar la declaración antes de `_loadHTML()`.

**`_loadHTML()` eliminado:** la función que carga dinámicamente `settings.html` se perdió, causando que los elementos se buscaran antes de existir en el DOM. Solución: restaurar la función antes de `initSettings`.

**Estilos de lista de usuarios perdidos:** los estilos de `.settings-user-row`, `.settings-user-role`, `.role-admin`, `.role-user`, `.settings-user-delete` se perdieron de `settings.css`. El botón ✕ mostraba `display: inline-block` en lugar de `flex`. Solución: restaurar todos los estilos y agregar `!important` en las propiedades críticas del botón de eliminar para evitar conflictos de especificidad con estilos base.

**Lección:** los archivos separados (`settings.html`, `settings.css`) son más frágiles ante ediciones accidentales que el HTML inline en `index.html`. En v3.0 la migración a Web Components resolverá esto con encapsulamiento real.

---

## v2.4.10 — Cambiar contraseña, cambiar rol, revocación de tokens, botón ⚙ reposicionado

### 🔑 Cambiar contraseña

**Decisión:** cada usuario puede cambiar su propia contraseña desde el modal de configuración ⚙ (sección "CUENTA"). El admin puede cambiar la contraseña de cualquier usuario desde la lista de usuarios.

**Backend:** `PATCH /auth/users/:username/password` — valida que solo el propio usuario o un admin pueda cambiar contraseñas. Contraseña hasheada con bcrypt antes de guardar.

**Frontend:** modal `changePasswordModal` con doble campo (nueva contraseña + confirmar). Usa `cloneNode+replaceWith` para evitar acumulación de listeners.

### 🔄 Cambiar rol

**Decisión:** el admin puede cambiar el rol de cualquier usuario (excepto `admin` principal) entre `admin` y `user` desde la lista de usuarios con el botón "Rol ▼".

**Backend:** `PATCH /auth/users/:username/role` — protegido con `adminMiddleware`. Rechaza cambio de rol para el usuario `admin` principal.

### 🚫 Revocación de tokens al cambiar rol

**Decisión:** al cambiar el rol de un usuario, su token actual se agrega a `revokedTokens` (Set en memoria). En el siguiente request, `authMiddleware` detecta el token revocado y devuelve 401, forzando el logout.

**Razón:** sin revocación, el usuario con rol cambiado seguiría viendo opciones de admin hasta que su token expirara (hasta 2 horas).

**Limitación conocida:** `revokedTokens` es en memoria — se limpia al reiniciar el servidor. Tokens revocados vuelven a ser válidos después de un reinicio. Solución futura: persistir en disco o Redis.

**Pendiente v3.0:** implementar expulsión en tiempo real con WebSockets — cuando el admin cambia el rol, el usuario afectado es notificado instantáneamente sin necesidad de hacer un request.

### ⚙️ Botón de configuración reposicionado

**Decisión:** el botón ⚙ se movió a la esquina inferior derecha del sidebar. Se agregó `display: flex; flex-direction: column` al `.sidebar` y `justify-content: flex-end` al `.sidebar-footer` para posicionarlo correctamente.

---

## v2.4.11 — Indicador OCR, label de modelo con tipo, debug visual

### ⚠️ Indicador visual de OCR

**Decisión:** agregar indicadores visuales en dos puntos:
1. **Chip de adjunto (preventivo):** badge ⚠ amarillo en archivos que requieren OCR (PDF, imágenes, DOCX). Se muestra al adjuntar, antes de enviar.
2. **Mensaje en chat (reactivo):** badge rojo cuando el backend reporta un error real de extracción OCR.

**Patrones de error detectados:**
- `[PDF escaneado: ...]` — PDF sin texto extraíble y Poppler no disponible
- `[Error al extraer texto del DOCX: ...]`
- `[Error al extraer texto del Excel: ...]`
- `[Error al leer el archivo: ...]`
- `[Archivo no soportado: ...]`

**Módulos modificados:** `frontend/modules/attachments.js`, `frontend/modules/messageRenderer.js`, `frontend/styles/components.css`.

**Error encontrado:** `tempText` se usaba antes de ser declarado en `renderMixedContent`. Solución: mover el bloque de detección OCR después de la declaración de `tempText`.

### 🏷️ Label de modelo con tipo

**Decisión:** agregar `[tipo]` al label del modelo en el header — `[general]`, `[visual]`, `[código]`, `[razonamiento]`, `[análisis]`.

**Implementación:** `MODEL_TYPES` map en `models.js` con todos los modelos conocidos. `getLabel(model, includeType)` acepta segundo parámetro. `updateMenuTriggerLabel` pasa `includeType = true`.

**Módulo modificado:** `frontend/modules/models.js`.

### 🐛 Debug panel no marcaba modo visual

**Causa:** el path de `isVisionResponse = true` hacía `return` antes de emitir `[DEBUG]` y llamar `logRequest`.

**Solución:** declarar `streamStart` antes del bloque `isVisionResponse` y agregar `logRequest` + emisión de `[DEBUG]` en el path visual, antes del `return`.

**Limitación:** `tokensIn` es `null` para respuestas visuales directas — LLaVA no expone tokens de entrada en el flujo directo. Es esperado y documentado.

---

## v2.4.12 — Profiling GPU + Métricas LocalAI

### 🖥️ Profiling de GPU en Dev Panel

**Decisión:** agregar sección de GPU en el Dev Panel con polling cada 5 segundos.

**Implementación:**
- `backend/routes/gpu.routes.js` (NUEVO) — endpoint `GET /gpu/stats` que ejecuta `nvidia-smi` via `child_process` y devuelve nombre, temperatura, utilización y VRAM.
- `backend/routes/metrics.routes.js` (NUEVO) — endpoint `GET /localai/metrics` que parsea el endpoint Prometheus de LocalAI y devuelve tokens acumulados por modelo.
- `devPanel.js` — secciones GPU y LocalAI con polling cada 5 segundos via `fetchWithAuth`.

**Umbrales visuales:** temperatura >80°C y VRAM >70% se muestran en naranja.

### 📊 Tokens reales de LocalAI — investigación y decisión

**Problema investigado:** `localai_tokens_total` en `/metrics` reporta 0 para modelos en modo streaming (`qwen2.5-7b-q5`). Solo reporta correctamente para `hermes-q4` que usa modo no-streaming.

**Causa confirmada:** bug conocido de llama.cpp/LocalAI — en modo streaming SSE, el hook que actualiza métricas Prometheus no se dispara correctamente.

**Intentos:**
- `Extra-Usage: true` header — ya estaba implementado, no resuelve tokens en streaming
- `stream_options: { include_usage: true }` — agregado al request, LocalAI v2.25.0 no lo implementa para todos los modelos
- `/tokenize` endpoint — descartado por agregar latencia extra en cada request

**Decisión:** mantener estimación actual (`chars / 4`) documentada como limitación conocida. Revisar cuando se actualice LocalAI a versión ≥ v2.26.x donde está planificado el fix de streaming tokens.

**Riesgo de actualizar LocalAI:** la imagen está fijada por digest por incompatibilidad anterior con modelos GGUF. Actualizar requiere pruebas en rama separada antes de mergear.

**Pendiente post-v3.0:** revisar tokens reales cuando se estabilice LocalAI con fix de streaming.