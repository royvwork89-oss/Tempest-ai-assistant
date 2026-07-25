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

> **✅ Cumplida en v2.11.x** — implementada con `pdfjs-dist` + `@napi-rs/canvas` (no `canvas`, ver razón técnica en la sección "Reemplazar Poppler por pdfjs-dist en pdf.rasterizer.js" al final de este documento).

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
| jimp (puro JS) | Sin binarios nativos — ideal para Electron. Más lento que sharp. | ✅ Reemplazó a sharp en v2.18.1 — ver esa entrada al final del documento |
| Sin preprocesado | Más simple pero confianza OCR más baja en imágenes de baja calidad. | ❌ Descartada — mejora medible (77%→87%) |

**Nota de migración futura (resuelta en v2.18.1):** `sharp` tiene binarios nativos que necesitan `electron-rebuild`. Se reemplazó la implementación de `preprocessor.js` por `jimp` — y de paso también `vision.service.js`, que tenía el mismo problema. El contrato `preprocessImage(inputPath) → { outputPath, wasProcessed }` no cambió. Ver entrada "v2.18.1 — Migración de sharp a jimp" al final del documento para el detalle completo.

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
├── preprocessor.js         ← preprocesado (jimp desde v2.18.1, antes sharp)
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

---

## 🌐 Búsqueda web con SearXNG (v2.6.0)

### Opciones evaluadas
| Opción | Gratis | Límite | Privado |
|---|---|---|---|
| **SearXNG** (elegida) | ✅ | Sin límite | ✅ |
| Google Custom Search | ✅ | 100/día | ❌ |
| Brave Search API | ✅ | 2,000/mes | ✅ |
| Tavily | ✅ | 1,000/mes | ❌ |

SearXNG es el único gratuito sin límites, privado y autoalojado. Usa Google/Bing/DDG como fuentes internas. Brave queda como stub (`brave.provider.js`) para v2.7.x.

### Arquitectura
`search.service.js` = interfaz reemplazable (patrón `preprocessor.js`). Config en `backend/data/search-config.json`. El controller no sabe qué provider está activo. Flujo: botón 🌐 → `config.webSearch` → controller llama `search()` → `formatResultsAsContext()` → inyectado al final de `finalMessage`. Compatible con Electron y con migración futura a WebSockets (desacoplado del transporte).

### Control de acceso
Admin configura URLs/keys y habilita providers; usuario elige entre los habilitados (selector solo visible con 2+ activos). `globalEnabled: false` por defecto. Endpoint `/search/config` devuelve config completa a admin, solo lista de habilitados a usuarios.

### Seguridad
- `sanitizeSnippet()`: filtra patrones de prompt injection, 400 chars máx por snippet
- Rate limiting 3s por userId (en memoria, se resetea al reiniciar — intencional)
- SSRF protegido por diseño: solo admin cambia URLs
- Queries registradas en logs JSONL (`searchQuery` en debugPayload)

### Errores encontrados durante la implementación
1. **`searxng` fuera de `services:`** en docker-compose → `additional properties not allowed`. Error de indentación YAML.
2. **`authenticate` vs `authMiddleware`** → `argument handler must be a function` al arrancar. El middleware exporta `authMiddleware`.
3. **`data.globalEnabled` vs `data.config.globalEnabled`** → el botón 🌐 nunca aparecía para admins (el backend anida la config para ellos). Fix con fallback `??` y extracción de providers desde `data.config`.
4. **`streamOptions.maxTokens` asignado antes de la declaración `const`** → ReferenceError latente que crasheaba cualquier request con búsqueda activa. Movido a la construcción del objeto.
5. **`streamToLocalAI` ignoraba `options.maxTokens`** → la propiedad no existía en el contrato. Extendido: `options.maxTokens || getMaxTokens(...)`.
6. **Query sin texto** ("Analiza los archivos adjuntos." con solo imagen) → búsquedas inútiles. Fix: mínimo 8 chars en `rawTrimmed`.
7. **Loop con contexto de búsqueda** (qwen2.5-7b-q5, 94s, preguntas repetidas) → `maxTokens: 350` con búsqueda + detector de n-gramas ampliado de `(.{15,80})\1{2,}` a `(.{15,140})\1{1,}` (frases de hasta 140 chars, corta a la primera repetición).
8. **"Soy Tempest." como firma en cada respuesta** → causa raíz: la frase literal era la última línea de `global.system.txt` (posición de máxima atención del modelo). Fix: reordenado el prompt + regla final "Nunca firmes tus respuestas ni menciones tu nombre si no te lo preguntan". Los stop words multi-token no eran confiables en streaming de LocalAI.

### Contratos nuevos
- `streamOptions.maxTokens` (number|null) → override de `getMaxTokens()` en `localai.service.js`. `null` = comportamiento normal sin cambios.
- `formatResultsAsContext()` incluye instrucciones de uso al modelo (ignorar resultados irrelevantes, respuesta breve, sin preguntas de seguimiento).
- Frontend: `getWebSearchConfig()` devuelve `{}` o `{ webSearch: true, searchProvider }` — se hace spread en el config del chat.
- `GET /search/config`: respuesta distinta según rol — `{ config }` completo para admin, `{ enabledProviders, globalEnabled }` para usuario.

### Limitaciones conocidas
- ~~**Visual + búsqueda**~~ — resuelto en v2.7.0 con pipeline de segundo pase.
- **Queries de seguimiento ambiguas**: SearXNG/Tavily no ven el historial del chat; queries cortas sin contexto producen resultados irrelevantes. El modelo ignora resultados no pertinentes por instrucción explícita.
- **qwen2.5-7b-q5 cierra con preguntas** pese a la regla del prompt global — cosmético, no perseguido.
- **Prompt del nombre con menos peso**: tras el reorden, "¿Cómo te llamas?" responde "Soy Tempest." correcto pero agrega texto de cortesía después. Trade-off aceptado.
- **Deuda Electron**: SearXNG es contenedor externo. Ruta de migración v3.0: migrar a Tavily/Brave API como providers principales sin Docker.
- **Identificación de imágenes genéricas**: el pipeline visual+búsqueda falla con arte promocional sin elementos únicos (logos, UI, texto). Funciona bien con screenshots que tienen HUD/interfaz visible.

---

## 🌐 Tavily + Pipeline visual + búsqueda (v2.7.0)

### Tavily agregado como tercer provider
SearXNG y Brave devolvían snippets desactualizados o genéricos con `qwen2.5-7b-q5`. Tavily usa `include_answer: true` que devuelve una respuesta sintetizada directa, mejorando significativamente la precisión. API key en `.env` como `TAVILY_API_KEY` con fallback desde `search-config.json`. Tier gratuito: 1,000 queries/mes sin tarjeta. Snippets limitados a 800 chars vs 400 de SearXNG para aprovechar el contenido completo.

### Pipeline visual + búsqueda
**Problema:** el fast-path `isVisionResponse` transmitía la descripción visual directamente sin pasar por ningún modelo de texto, ignorando cualquier contexto de búsqueda web.

**Solución:** cuando hay imagen + 🌐 activo, se salta el fast-path y se ejecuta un segundo pase:
1. `visionDescription` extraída del `attachmentContext` via regex
2. Query de búsqueda = `userMessage + visionDescription.slice(0, 200)` — más específica que el mensaje solo
3. `streamOptions.primaryModel` se sobreride a `qwen2.5-7b-q5` (texto), `mode` a `'general'`
4. `finalMessage` se reconstruye como `[DESCRIPCIÓN] + [BÚSQUEDA WEB] + instrucción + pregunta` — evita que el modelo repita el contexto crudo
5. `maxTokens` sube a 450 para el segundo pase

**Limitación:** funciona bien con imágenes que tienen elementos únicos identificables (UI, texto, logos). Con arte promocional genérico la descripción no es suficientemente específica para guiar la búsqueda.

### Contratos nuevos (v2.7.0)
- `visionDescription` (string) — extraída en `chat.controller.js` cuando `isVisionResponse`, usada como parte de la query de búsqueda
- `streamOptions.maxTokens = 450` cuando `isVisionResponse && webSearchContext`
- `debugPayload.model = streamOptions.primaryModel || selectedModel` — refleja el modelo real del segundo pase

---

## 🔐 Privacidad por usuario — separación de datos (v2.7.0)

### Problema
`buildMemoryOptions` usaba `req.body?.userId || 'local-user'` — todos los usuarios compartían la misma carpeta de datos independientemente de quién estuviera autenticado.

### Decisión
Usar `req.user?.id` (del JWT) como `userId` en `buildMemoryOptions`. El cliente no puede influir en qué carpeta se accede.

### Cambios aplicados
- `chat.controller.js`: `buildMemoryOptions` → `userId: req.user?.id || memory.DEFAULT_USER_ID`
- `chat.controller.js`: 3 rutas hardcodeadas a `local-user` → `memoryOptions.userId`
- `context.service.js`: `DATA_ROOT` hardcodeado eliminado → `getProjectDataPath(projectId, userId = 'local-user')` con default para compatibilidad
- `context.controller.js`: todas las funciones extraen `const userId = req.user?.id || 'local-user'` y lo pasan al service
- `buildSystemPrompt.js`: `getProjectContext` ahora recibe `userId` y lo propaga

### Estructura resultante

backend/data/users/
├── {userId}/
│   ├── profile.json
│   └── projects/
│       └── {projectId}/
│           ├── projectSettings.json
│           ├── projectMemory.json
│           ├── context/
│           └── chats/

### Migración
Los datos previos en `local-user/` quedaron inaccesibles al cambiar el sistema. Se eliminaron limpiamente — no eran datos de producción, solo pruebas de desarrollo.

### Deuda técnica
El default `'local-user'` en `context.service.js` existe para compatibilidad con callers que no pasan userId. Estos callers deben auditarse antes de v3.0 para garantizar que ninguna ruta pueda acceder datos sin autenticación.

---

## 🖥️ Electron Fase 1 — Shell sobre Express (v2.8.0)

### Decisión: orden de migración Electron-primero, Docker-después

**Opciones evaluadas:**
1. **Eliminar Docker primero, Electron después** — descartada: requería reescribir todo el pipeline de inferencia (`localai.service.js`, streaming, YAML configs) antes de tener una ventana nativa; si algo fallaba, imposible distinguir si el error era de Electron, node-llama-cpp o lógica propia; se perdía la versión funcional de referencia.
2. **Electron primero, Docker sigue igual (elegida)** — la app funciona en Fase 1 exactamente igual que hoy, solo empaquetada; base estable para después reemplazar la capa de inferencia; entregable usable antes de completar la Fase 2.

**Arquitectura Fase 1:**
```text
Electron shell (shell/main.js)
  └── fork → backend/server.js (Express, sin cambios)
        └── HTTP → LocalAI en Docker (sin cambios)
  └── BrowserWindow → http://localhost:3005 (frontend sin cambios)
```

### Nomenclatura: carpeta `shell/` en lugar de `electron/`
Se evaluaron `app/`, `desktop/` y `shell/`. Se eligió `shell/` porque describe la responsabilidad exacta del módulo (el contenedor nativo que envuelve backend y frontend), distingue de `app/` (confundible con el frontend) y de `desktop/` (genérico).

### Contratos nuevos
- `GET /health` → `200 {status:'ok'}` — `shell/main.js` hace polling (30 intentos × 500ms) y solo abre la ventana cuando Express responde. Si se elimina este endpoint, la app de escritorio no arranca.
- `IS_ELECTRON=true` — variable de entorno inyectada por el shell al proceso hijo, disponible para lógica condicional futura.
- `window.electronAPI.isElectron` — expuesto por `preload.js` via `contextBridge`, permite al frontend detectar si corre en Electron.

### Errores encontrados durante la implementación
- **Firewall de Windows**: al primer arranque Windows pide permiso de red para Electron. Es necesario para localhost ↔ backend. Si se cancela por error no afecta (localhost no pasa por firewall), y puede re-activarse en Panel de control → Firewall → Permitir una aplicación.
- **`npm init -y` en raíz**: el `package.json` generado apunta a `index.js`; debe corregirse a `shell/main.js` o Electron no encuentra el entry point.

---

## ⏹️ Botón detener respuesta + bloqueo de UI durante stream (v2.8.0)

### Problema 1: la respuesta del asistente no se persistía
`chat.controller.js` guardaba el mensaje del usuario en `chatHistory` antes del stream, pero la respuesta del asistente nunca se guardaba en el flujo normal (solo en el flujo visual). Al cambiar de chat y volver, la respuesta desaparecía.

**Fix:** acumular tokens en `fullReply` durante el `for await` y persistir con `memory.addChatHistoryMessage('assistant', fullReply, memoryOptions)` después de `res.end()`.

**Limitación documentada:** si el usuario cambiaba de chat *durante* el stream, la respuesta aún no estaba guardada. Guardar token a token se descartó por costo de I/O (500 tokens = 500 `writeFileSync` al mismo JSON). Se eligió bloquear la navegación durante el stream (ver abajo).

### Problema 2: navegar durante el stream corrompía la vista
**Opciones evaluadas:**
- A) Guardar al terminar el stream — implementada, pero deja ventana de riesgo durante el stream
- B) Guardar token a token — descartada por I/O intensivo
- C) Estado optimista en frontend — pospuesta como mejora de UX futura
- D) Bloquear navegación durante el stream (elegida) — flag compartido, 0 costo

**Implementación del bloqueo:** flag `_isSending` en `sidebar.js` con `setSendingState()`/`getSendingState()` exportados. `chat.js` lo activa al enviar y lo libera en `finally`. Puntos bloqueados: clic en chats (general y proyecto), títulos de proyecto, menú contextual ⋯ (`dots.onclick` — un solo guard cubre todos los items), `+ Nuevo chat` general (`app.js`), `+ Nuevo chat` de proyecto (`loadProjectChats`), `+ Nuevo Proyecto` (`modals.js`).

### Botón detener (stop)
- `api.js`: `AbortController` module-level + `abortCurrentStream()` exportado; `signal` pasado a ambos fetch (JSON y FormData); `AbortError` capturado en el loop del reader → retorna `{ ok: 'aborted' }`.
- `chat.js`: el listener del botón alterna — si `_sending` → `abortCurrentStream()`, si no → `sendMessage()`. Íconos SVG inline (`ICON_SEND`/`ICON_STOP`) intercambiados via `innerHTML`. El botón NO se deshabilita durante el stream (debe ser clickeable para abortar); `userInput` sí se deshabilita.
- Al abortar con texto parcial recibido: `finalizeStreamingBubble` renderiza lo que llegó (no se pierde). Sin texto: la burbuja se elimina.
- CSS: `.send-btn.stop-mode` en `styles/chat.css` (fondo rojo `#dc2626`).

### Errores encontrados durante la implementación
- **`sendBtn` usado antes del destructuring**: el primer intento ponía `sendBtn.classList.add(...)` antes de `const { sendBtn } = _deps` → ReferenceError. Movido después del destructuring.
- **`return` prematuro escapaba al `finally`**: el guard `if (!message && files.length === 0) return;` está *antes* del `try`, por lo que `_sending` quedaba en `true` para siempre y el sidebar quedaba congelado. Fix: cleanup manual en ese return. Los `return` *dentro* del `try` sí ejecutan el `finally` — no necesitan cleanup.
- **Sidebar congelado tras stream exitoso**: `await titlePromise` (renombrado automático) mantenía `_sending=true` hasta que el modelo de títulos terminara — podía tardar si LocalAI estaba ocupado. Fix: liberar `_sending`/`setSendingState(false)` inmediatamente al llegar `[DONE]` y encadenar `titlePromise.then(() => loadSidebar(...))` como operación de fondo. Alternativa descartada: restaurar solo el ícono del botón pero mantener el sidebar bloqueado hasta que el título terminara — descartada porque el título es operación de fondo y no debe bloquear ninguna parte de la UI.
- **Abort "no funciona" tras cierto tiempo**: percepción correcta — si el stream ya terminó, `_abortController` es null y no hay nada que abortar; el botón seguía rojo por el problema del título (arriba). Resuelto con el mismo fix.

### Limitación conocida
El abort corta el fetch del lado cliente; LocalAI sigue generando tokens del lado servidor unos segundos hasta detectar la conexión cerrada. No hay forma de detener LocalAI instantáneamente desde el cliente. Los tokens generados tras el abort nunca llegan al frontend.

---

## 🏷️ Label de modelo unificado (v2.8.0)

### Problema
El trigger mostraba el tipo duplicado: `Qwen 2.5 7B Q5 - Razonamiento [razonamiento]` — el label de `MODEL_PROFILES` ya incluía `- Razonamiento` y `getLabel(model, true)` agregaba `[tipo]` desde `MODEL_TYPES`.

### Opciones evaluadas
1. **Quitar `- Razonamiento` de `MODEL_PROFILES` y conservar `[razonamiento]` de `MODEL_TYPES`** — descartada: el usuario quería conservar la nomenclatura `- Tipo` que ya usaba en el menú de selección, no la de corchetes.
2. **Conservar los labels de `MODEL_PROFILES` y eliminar `MODEL_TYPES` (elegida)** — una sola fuente de verdad para los nombres, mismo texto en el menú y en el trigger.

### Decisión
Conservar una sola fuente de nomenclatura: los labels de `MODEL_PROFILES` (formato `Familia Tamaño Cuant - Tipo`). Eliminados `MODEL_TYPES`, `getModelType()` y el parámetro `includeType` de `getLabel()` — código muerto tras el cambio.

---

## 📁 Selector nativo de carpetas + fixes del modal de context files (v2.8.1)

### Selector nativo (primera feature IPC real)
Patrón implementado: frontend → `window.electronAPI.selectFolder()` (preload, `contextBridge`) → `ipcRenderer.invoke('select-folder')` → `ipcMain.handle` en `shell/main.js` → `dialog.showOpenDialog`. La ruta devuelta se normaliza con `replace(/\\/g, '/')` porque Windows devuelve backslashes y el snapshot service espera forward slashes.

**Principio rector aplicado:** el frontend no sabe de Electron — verifica `window.electronAPI?.selectFolder` con optional chaining; si no existe (navegador), cae al flujo `/fs/browse` original. Interfaz reemplazable, cero ruptura en navegador.

### Bug: "Error: No autenticado" en snapshot
Los fetch directos de `contextFiles.js` (toggle, status, generate, items dentro del status, `/fs/browse`) no enviaban el header `Authorization` — quedaron desactualizados cuando se implementó JWT (v2.4.x). Las funciones de `api.js` sí lo enviaban, pero estos 5 fetch eran crudos. Fix: helper local `authH()` replicando el patrón de `api.js`.

**Lección:** al introducir auth global, auditar TODOS los fetch del frontend, no solo los centralizados en `api.js`. Los fetch inline en módulos son fáciles de omitir.

### Bug: duplicados al arrastrar archivos (pre-existente a Electron)
Los listeners `dragover/dragleave/drop` de la lista se registraban con `addEventListener` en cada apertura del modal sin limpieza — N aperturas = N listeners = un drop subía el archivo N veces. Es exactamente el contrato documentado de DOM compartido en modales (aplicado al toggle y botones, pero omitido en la lista).

Fix: `cloneNode(false) + replaceWith` de la lista **al inicio de `openContextFilesModal`**, antes de registrar cualquier listener y antes de `renderItems()`.

### Error introducido durante la implementación (regresión temporal)
El primer intento colocó un segundo `cloneNode+replaceWith` DESPUÉS de `renderItems()` — el clone vacío reemplazaba la lista ya renderizada (lista en blanco) y dejaba los listeners en el nodo desconectado. Al borrarlo parcialmente quedó `const listEl = newList;` huérfano → `ReferenceError` que detenía la ejecución de la función a la mitad: sin listeners de drop, sin `fileInput.onchange`, sin `closeBtn.onclick` (el modal no cerraba). 

**Lección:** un `ReferenceError` a mitad de una función de inicialización rompe TODO lo registrado después de esa línea, manifestándose como múltiples bugs aparentemente independientes (no sube, no arrastra, no cierra). Ante varios síntomas simultáneos en un mismo módulo, buscar primero un error de ejecución temprano en la consola. Regla derivada: el patrón cloneNode va UNA sola vez, al inicio del modal, antes de cualquier registro.

---

## ⚙️ Panel Settings rediseñado — navegación lateral (v2.9.0)

### Decisión
Rediseñar el modal de configuración con navegación lateral tipo ChatGPT/Discord: Usuarios | Servicios | Preferencias.

### Opciones evaluadas
1. **Tabs horizontales** — descartadas: poco espacio, difíciles de escalar al agregar más secciones.
2. **Navegación lateral (elegida)** — escala bien, visual limpio, patrón familiar.

### Resultado
`settings.html` con layout de dos columnas (nav 220px + contenido flex:1). `settings.css` con `.settings-nav`, `.settings-content`, `.settings-panel`, `.settings-nav-footer`.

---

## 🔐 Permisos de búsqueda web por usuario/perfil (v2.9.0)

### Terminología oficial
- **Proveedores**: sección donde el admin activa/desactiva servicios globalmente y configura credenciales. Config global.
- **Perfiles**: grupos de config compartida. Por ahora solo existe "Global". En vX.x se agregarán más.
- **Selector de perfil**: dropdown en la fila de cada usuario (panel Usuarios) que vincula ese usuario a un perfil.
- **Buscador**: el selector 🌐 del chat donde el usuario elige cuál provider usar.

### Modelo de datos
```json
// users.json (por usuario)
{
  "searchProviders": ["searxng","tavily"],  // null=todos; []=ninguno; array=lista
  "useGlobalConfig": false,
  "profileId": "none",                      // "none"=sin perfil; "global"=hereda Perfil Global
  "searchEnabled": true                     // interruptor individual de búsqueda
}

// search-config.json (config global)
{
  "globalEnabled": true,
  "providers": {
    "searxng": { "enabled": true, "url": "http://localhost:8081" },
    "brave":   { "enabled": false, "apiKey": "" },
    "tavily":  { "enabled": true, "apiKey": "..." }
  }
}
```

### Decisión 1 — Toggle "Activar búsqueda web": ¿campo separado o provider dentro del array?
- **Evaluado:** (a) meterlo en `searchProviders` como provider especial; (b) campo separado `searchEnabled`.
- **Elegido:** campo separado `searchEnabled`.
- **Descartado:** mezclar el interruptor maestro con el array de providers confundía "provider permitido" con "servicio activado".
- **Nota:** conceptualmente "el toggle ES un provider más" — la arquitectura real y escalable es `services:{}` (ver decisión de deuda técnica abajo). `searchEnabled` es el parche pragmático mientras tanto.

### Decisión 2 — Gestión de permisos: ¿botón 🌐 por fila o dropdown en Servicios?
- **Evaluado:** (a) botón 🌐 en cada fila del panel Usuarios con checkboxes; (b) dropdown selector de usuario en Servicios.
- **Elegido:** dropdown en Servicios.
- **Descartado:** el botón 🌐 por fila se confundía con el 🌐 del chat y era redundante.

### Decisión 3 — Permisos del usuario: ¿checkboxes o reutilizar toggles?
- **Elegido:** reutilizar los mismos toggles de la sección Búsqueda web.
- **Descartado:** checkboxes separados duplicaban exactamente lo mismo.

### Decisión 4 — Arquitectura de servicios: ¿migrar ya a `services:{}` o parchear?
- **Evaluado:** (a) rediseñar a `services:{ search:{}, ai:{}, audio:{}, video:{} }`; (b) parchear y migrar después.
- **Elegido:** parchear ahora, migrar en vX.x.
- **Por qué:** el bug activo tenía prioridad. Un refactor a medias encima de un bug es peor que un parche limpio.
- **Schema objetivo para vX.x:**
```json
"services": {
  "search": { "enabled": true, "providers": ["searxng","tavily"] },
  "ai":     { "enabled": true, "providers": ["openai","google"] },
  "audio":  { "enabled": false, "providers": [] }
}
```

### Decisión 5 — Selector de perfil del usuario: ¿en Servicios o en Usuarios?
- **Elegido:** en la fila de cada usuario (panel Usuarios).
- **Por qué:** Usuarios es donde vive la gestión de cada persona. Deja Servicios más limpio.

### Decisión 6 — Selector de perfil: ¿checkbox booleano o lista desplegable?
- **Evaluado:** (a) checkbox "Usar configuración global"; (b) lista "Sin perfil / Global".
- **Elegido:** lista desplegable.
- **Por qué:** el checkbox solo sirve para un perfil. La lista escala a múltiples perfiles en vX.x.

### Decisión 7 — "Sin selección" en dropdown de Servicios
- **Elegido:** sin selección = Perfil Global (el dropdown arranca ahí por defecto).
- **Por qué:** evita modificar a todos por accidente. Siempre hay un objetivo concreto.

### Decisión 8 — Orden del dropdown de Servicios
Perfil Global (primero) → admins (admin principal siempre primero, resto alfabético) → usuarios no-admin (alfabético).

### Decisión 9 — Selector de usuario: input filtrable vs `<select>` nativo
- **Estado actual:** `<select>` nativo (cambió durante sesión con otra IA).
- **Pendiente:** decidir si se recupera el buscador filtrable cuando haya muchos usuarios. Anotar decisión final cuando se implemente.

### Decisión 10 — Convención `searchProviders: null`
`null` = sin restricción (todos los providers); `[]` = búsqueda deshabilitada; array = lista permitida.
Retrocompatible: usuarios sin el campo arrancan como `null` sin migración de datos.

### Decisión 11 — Usuarios "Sin perfil" son independientes del Perfil Global
Los usuarios con `profileId: "none"` tienen config completamente individual. El estado de `globalEnabled` y de los providers del Perfil Global NO les afecta — pueden tener búsqueda activa aunque el Perfil Global esté desactivado. El Perfil Global solo afecta a usuarios con `profileId: "global"`.

**Implementación:** `getConfig` en `search.controller.js` bifurca antes de aplicar `globalEnabled`:
- `profileId === 'global'` → aplica filtro `globalEnabled` + `getEnabledProviders(config)`
- `profileId === 'none'` → usa `Object.keys(config.providers)` directamente, sin filtro global

### Bugs encontrados y resueltos durante la implementación

**Bug 1 — Timing `_initSearchSettings` vs `loadSelectedPerms`:**
`_initSearchSettings()` corría con `_selectedTarget === '__global__'` y escribía valores globales en los toggles. Después `loadSelectedPerms(usuario)` los corregía, pero un bloque duplicado de 4 líneas fuera del `if/else` (referencias a `cfg` fuera de su scope) sobreescribía los toggles y además lanzaba `ReferenceError` que rompía el registro del listener del botón Guardar.
- **Causa:** residuos de edición quirúrgica — bloque `if/else` incompleto + líneas duplicadas fuera del bloque.
- **Solución:** eliminar completamente el bloque de escritura de toggles de `_initSearchSettings`. Responsabilidad única: `loadSelectedPerms` pone valores, `_initSearchSettings` solo registra listeners.

**Bug 2 — Listener del botón Guardar sobre nodo huérfano:**
`cloneNode+replaceWith` creaba `newSave` con el listener, pero `saveResult` en el closure apuntaba al nodo original (antes del clone). Al intentar mostrar "✓ Guardado", `classList.remove('hidden')` corría en un nodo fuera del DOM — silencioso.
- **Solución:** mover `const saveResult = document.getElementById(...)` al interior del listener (captura en tiempo de click, no de registro).

**Bug 3 — `cloneNode+replaceWith` del botón Guardar destruía el listener:**
`loadSelectedPerms` recargaba y tocaba el botón Guardar después de que `_initSearchSettings` había registrado el listener en el clon. Al no usar cloneNode en el flujo de Servicios, el nodo original quedaba con el listener pero podía ser reemplazado por algún path posterior.
- **Solución:** eliminar `cloneNode+replaceWith` del botón Guardar. En su lugar, flag `_saveListenerAttached` para evitar registro duplicado si `_initSearchSettings` se llama más de una vez.

**Bug 4 — Admins reciben config global sin filtrar por su `searchEnabled`:**
`getConfig` devolvía `{ config }` plano para admins sin calcular `enabledProviders`. `initWebSearch` en frontend leía `globalEnabled` del config global e ignoraba el `searchEnabled` del admin.
- **Solución:** para admins, calcular `enabledProviders` según su `profileId` y `searchEnabled` antes de devolver. Frontend prioriza `data.enabledProviders` sobre `data.config.providers`.

**Bug 5 — `globalEnabled: false` bloqueaba usuarios "Sin perfil":**
El primer `if (!config.globalEnabled) return []` en `getConfig` para usuarios normales cortaba antes de llegar al filtrado individual.
- **Solución:** mover el chequeo de `globalEnabled` dentro del bloque `profileId === 'global'` únicamente.

**Lección de proceso recurrente:** tras cada borrado en una función de init, verificar balance de llaves y referencias a elementos del DOM que ya no existen. Un `ReferenceError` temprano en una función de inicialización rompe TODO lo registrado después — se manifiesta como múltiples bugs aparentemente independientes.

---

## 🔄 Selector de provider en Preferencias — refresco automático (v2.9.0)

### Problema
El selector de provider en Preferencias no se actualizaba al guardar cambios en Servicios — requería Ctrl+R.

### Decisión
Extraer la lógica del selector en `_refreshProviderSelector()` como función independiente con su propia llamada a `/search/config`. Se llama al init y después de cada Guardar exitoso.

### Regla: selector solo visible con más de un provider disponible
Si el usuario solo tiene un provider disponible, el selector de Preferencias se oculta — no hay nada que elegir.

### Modelo conceptual — Perfiles y Providers

#### ¿Qué es un perfil?
Un perfil es una configuración de búsqueda compartida que puede asignarse a múltiples usuarios. En lugar de configurar providers uno por uno para cada usuario, el admin crea un perfil con su config y asigna usuarios a ese perfil. Todos los usuarios del perfil heredan su configuración automáticamente.

Actualmente existe un solo perfil: **Global**. En vX.x se agregarán más (ej. "Desarrolladores", "Marketing", "Solo lectura").

#### ¿Qué es un usuario "Sin perfil"?
Un usuario con `profileId: "none"` tiene una configuración completamente individual — no comparte nada con otros usuarios ni con ningún perfil. Su config de providers es única y exclusiva de ese usuario.

**Importante:** dos usuarios "Sin perfil" NO comparten config entre sí. Cada uno tiene la suya propia.

#### ¿Qué son los providers?
Los providers son los motores de búsqueda disponibles: SearXNG (local), Brave, Tavily. Cada provider tiene su propia configuración (URL, API key) guardada en `search-config.json`. El admin activa/desactiva providers globalmente desde el Perfil Global.

#### ¿Cómo interactúan perfiles y providers?
Perfil Global (search-config.json)

├── globalEnabled: true/false     ← solo afecta a usuarios con profileId: "global"

├── searxng.enabled: true/false

├── tavily.enabled: true/false

└── brave.enabled: false
Usuario con profileId: "global"

└── Hereda TODO del Perfil Global — sus toggles se deshabilitan en la UI
Usuario con profileId: "none"

└── Config propia (users.json)

├── searchEnabled: true/false   ← su interruptor personal

└── searchProviders: null / ["searxng"] / ["tavily"] / ["searxng","tavily"]

null = todos los providers disponibles en el sistema

#### Flujo de decisión en el backend (getConfig)
¿El usuario tiene searchEnabled: false?

→ SÍ → enabledProviders: [] (sin búsqueda, sin importar nada más)

→ NO → ¿profileId === "global"?

→ SÍ → ¿globalEnabled: false? → enabledProviders: []

→ NO → filtrar por providers activos en search-config.json

→ NO (profileId === "none") → usar searchProviders del usuario

null   → todos los providers del sistema (Object.keys)

array  → solo los providers en el array

#### Hoja de ruta para el creador de perfiles (vX.x)

**Actualizado — visión completa del usuario, más amplia que el borrador original de abajo.**

##### Reglas de negocio (confirmadas con el usuario)
1. **Cada perfil es una config compartida por todos los usuarios asignados a él.** Un usuario solo
   puede tener UN perfil a la vez.
2. **Un usuario "sin perfil" tiene su propia config, completamente independiente — de otros
   usuarios sin perfil TAMBIÉN, no solo de los perfiles.** Hoy (`profileId: "none"`) el usuario
   sin perfil solo elige CUÁLES de los providers del `search-config.json` global puede usar
   (`searchProviders` como allow-list) — pero la API key en sí sigue siendo la ÚNICA global. La
   visión del usuario requiere que cada usuario sin perfil tenga su PROPIA API key guardada,
   no solo un allow-list sobre una key compartida. Esto es un cambio de esquema, no solo de UI.
3. **"Perfil Global" pasa a ser un perfil más dentro del mapa `profiles`** (ya no un caso especial
   hardcodeado en `search.controller.js`), con su propia config de providers/apiKeys — mismo
   tratamiento que cualquier perfil nuevo que se cree.
4. **Guardar la config de un perfil o de un usuario sin perfil solo afecta a ese registro
   puntual.** Cambiar de selección en el modal y volver debe mostrar exactamente lo que se guardó
   ahí — nunca lo que se guardó en otro perfil/usuario, aunque se haya guardado más recientemente.
5. **Panel Servicios — visibilidad condicional:**
   - Si se selecciona un **usuario sin perfil** o un **perfil** (incluido Perfil Global): se
     puede editar su config de providers/apiKeys directamente ahí.
   - Si se selecciona un **usuario CON perfil asignado**: Servicios solo muestra qué perfil tiene
     asignado (referencia de solo lectura) — no tiene sentido configurarlo por separado si
     comparte la config de su perfil.
   - Desde esa misma ventana, el admin puede reasignar el perfil del usuario o dejarlo "sin
     perfil" para habilitarle config independiente.
6. **Sin inferencia por coincidencia de valores.** Si un perfil y un usuario sin perfil (u otro
   perfil) terminan con la misma API key porque el admin la tipeó igual en los dos, siguen siendo
   registros 100% independientes — la app nunca los "vincula" ni asume que son la misma cuenta.
   Cada request usa exclusivamente la key guardada en el registro (perfil o usuario sin perfil)
   que corresponda a quien está haciendo la búsqueda, sin importar superposición de valores.
7. **"Probar conexión" no debe escalar con la cantidad de usuarios de un perfil.** Probar la
   config de un perfil es UNA sola llamada de test, sin importar si ese perfil tiene 1 o 500
   usuarios asignados — importa por costo real de la API en cuentas de pago (Tavily/Brave), un
   diseño que repitiera la prueba por usuario sería inaceptable en una instalación grande.

##### Cambios técnicos necesarios (extiende el borrador original)
1. **Backend — `search-config.json`**: agregar sección `profiles: { [profileId]: { name, providers: {...} } }`
   — cada perfil con su propia copia de `providers` (mismo shape que hoy tiene el nivel raíz).
   `search-config.json` raíz deja de ser "la" config y pasa a ser, como mucho, un default/fallback.
2. **Backend — usuarios "sin perfil" necesitan su PROPIO registro de providers/apiKeys**, no solo
   un `searchProviders` allow-list. Evaluar dónde vive: ¿objeto embebido en `users.json` por
   usuario, o una entrada más en el mismo mapa `profiles` usando el `username` como key en vez de
   un `profileId` compartido? La segunda opción reutiliza toda la lógica de "perfil" para
   usuarios sin perfil (una config = un registro, sea perfil o usuario), evita tener dos sistemas
   de storage paralelos.
3. **Backend — `auth.service.js`**: `profileId` sigue como string libre, validado contra la lista
   de perfiles existentes (igual que el borrador original).
4. **Backend — `search.controller.js`**: `getConfig`/`updateConfig` dejan de tratar `'global'`
   como caso especial hardcodeado — se resuelve como cualquier otro perfil del mapa. La
   resolución de qué config usar en una búsqueda real (`search.service.js` → `search()`) tiene
   que recibir el `profileId` (o `username` si es "sin perfil") de quien pregunta, no leer
   siempre `search-config.json` a secas como hoy.
5. **Backend — `testProvider`**: sigue siendo una prueba puntual sobre la config de UN perfil/
   usuario a la vez (ya cumple la regla 7 tal cual está hoy — no hay riesgo de que escale con
   usuarios porque nunca itera por usuario; solo hay que asegurarse de que la futura UI que la
   invoque tampoco la dispare en loop por usuario).
6. **Frontend — `settings.html`**: `<select>` de "Perfil asignado" dinámico desde el backend en
   vez de hardcodear `none`/`global` (igual que el borrador original).
7. **Frontend — panel Servicios**: implementar la regla de visibilidad condicional (punto 5 de
   arriba) — hoy el panel no distingue si el usuario seleccionado tiene perfil asignado o no para
   decidir si mostrar los controles de edición o solo la referencia de solo lectura.
8. **UI nueva**: pantalla de creación/edición de perfiles (nombre, providers, apiKeys, usuarios
   asignados) — igual que el borrador original, ahora con la certeza de que cada perfil (y cada
   usuario sin perfil) necesita su propia sección de apiKeys, no solo un toggle de habilitado.

**Sin cambios necesarios en:** `webSearch.js` (sigue consumiendo `enabledProviders` ya resuelto
por el backend), lógica de chat (no sabe de perfiles, solo recibe el resultado de la búsqueda).

##### Por qué el comportamiento reportado "parecía" un bug pero no lo era
El usuario reportó que guardar una API key en un usuario y después en otro hacía que el primero
mostrara la del segundo al volver. Investigado: era el comportamiento esperado del esquema VIEJO
(una sola API key global compartida por toda la instalación, `search-config.json` sin `profiles`)
— no había pérdida de datos ni bug de concurrencia, simplemente no existía el concepto de "API
key por perfil/usuario" todavía. Implementado más abajo.

---

#### ✅ Implementado — aislamiento real de credenciales por perfil/usuario (v2.18.0, 2026-07-24)

Se implementó la especificación completa de arriba. Resumen técnico:

**`backend/services/search/search.service.js` — reescrito.** `search-config.json` pasa de
`{ globalEnabled, providers }` a `{ profiles: { [id]: {name, globalEnabled, providers} },
userConfigs: { [username]: {globalEnabled, providers} } }`. Migración automática al primer
`loadFullConfig()` tras actualizar: detecta el esquema viejo (`providers` en la raíz sin
`profiles`), mueve esa config a `profiles.global`, y para cada usuario que ya estaba "sin
perfil" crea su propio `userConfigs[username]` sembrado con los mismos valores que tenía la
config global, filtrados por su `searchProviders` allow-list de antes — de ahí en adelante son
registros 100% independientes. `getEffectiveRecord(username)` es la función central: resuelve el
registro real de quien pregunta (perfil asignado, o su propio registro si está "sin perfil"), sin
loops ni fallback silencioso a otro perfil.

**`backend/services/auth.service.js`** — se agregó `setUserProfile(username, profileId)` y
`reassignProfileUsers(oldProfileId, newProfileId)` (usada al eliminar un perfil, para que los
usuarios que lo tenían asignado queden "sin perfil" en vez de heredar silenciosamente otro).

**`backend/controllers/search.controller.js` — reescrito, endpoints nuevos:**
- `GET /search/config` — se mantiene igual para el botón de búsqueda del chat (todos los roles),
  pero ahora resuelve `getEffectiveRecord(req.user.username)` en vez de leer una config global.
- `GET /search/profiles` / `POST /search/profiles` / `DELETE /search/profiles/:id` — admin,
  listar/crear/eliminar perfiles.
- `GET /search/record?type=profile|user&id=...` / `PATCH /search/record` — admin, leer/guardar
  el registro puntual de un perfil o de un usuario "sin perfil".
- `POST /search/test` — ahora prueba el registro puntual (`type`+`id`) en vez de la config
  global — sigue siendo UNA sola llamada real, nunca escala con la cantidad de usuarios de un
  perfil.
- `PATCH /search/user-profile` — reemplaza a `/search/user-providers`. Ya solo reasigna
  `profileId`; ya no maneja `searchProviders`/`useGlobalConfig`/`searchEnabled` (esos campos del
  usuario quedan vestigiales, migrados una sola vez y sin uso desde entonces).
- **Breaking change interno**: `PATCH /search/config` y `PATCH /search/user-providers` ya NO
  existen — cualquier cliente viejo que los llame recibirá 404. Solo el frontend de este mismo
  repo los consumía, ya actualizado.

**`backend/controllers/chat.controller.js`** — el bug real de fondo: en tiempo de ejecución (el
momento en que el chat realmente dispara la búsqueda web), el código SIEMPRE leía
`search-config.json` a secas, ignorando por completo qué perfil o usuario estaba preguntando —
aunque el panel Servicios ya filtrara providers por usuario, la búsqueda real nunca respetó esa
separación. Corregido: ahora resuelve `getEffectiveSearchRecord(req.user.username)` y pasa
`{ username }` a `webSearch()`, así cada perfil/usuario dispara la búsqueda con SU PROPIA
API key en runtime, no la de otro.

**Frontend (`settings.js` + `settings.html`)** — panel Servicios reescrito: el selector
principal ahora lista perfiles (dinámico desde `/search/profiles`) + admins + usuarios, con
formato de valor `profile:<id>` / `user:<username>`. Un usuario CON perfil asignado solo muestra
una referencia de solo lectura ("usa el perfil X") — la sección de providers se oculta por
completo, no se puede editar por ahí. Un usuario "sin perfil" o un perfil sí muestran el
formulario editable, cargado desde `GET /search/record`. Se agregaron controles "+ Nuevo perfil"
y "Eliminar perfil" (deshabilitado sobre Perfil Global). El panel Usuarios también puebla su
`<select>` de "Perfil asignado" por fila dinámicamente en vez de hardcodear `none`/`global`.

**Verificación realizada** (sandbox con `APP_DATA_DIR` apuntando a un `search-config.json` +
`users.json` de prueba, corriendo el código real, no mocks):
1. Migración del esquema viejo → nuevo: confirmado que `profiles.global` conserva la config
   vieja y que un usuario que ya estaba "sin perfil" recibe su propio `userConfigs` sembrado.
2. Guardar una key distinta en un usuario sin perfil, en un perfil nuevo, y en Perfil Global:
   las tres quedaron completamente independientes — `getEffectiveRecord()` devolvió cada key
   exacta según a quién se le preguntara.
3. Eliminar un perfil con un usuario asignado: el usuario volvió a `profileId: 'none'`
   automáticamente y recuperó su propio registro anterior (nunca heredó otro perfil).
4. Endpoints probados a nivel controller (req/res simulados, sin mocks de la lógica real):
   `GET /search/config` resuelve por usuario real, `GET/POST/DELETE /search/profiles` con
   gating de admin (403 si no-admin), `GET /search/record`, `PATCH /search/user-profile`,
   `POST /search/test` — todos devolvieron las formas de respuesta esperadas.

**Pendiente (anotado en ROADMAP.md, no bloqueante):** asignar perfil desde el modal "Nuevo
usuario" (hoy nace "sin perfil" y se reasigna después), y renombrar un perfil ya creado desde la
UI (la API `PATCH /search/record` ya lo soporta, falta el control visual).

---

## 🔄 Migración de motor de IA: LocalAI+Docker → node-llama-cpp (v2.10.0)

### Opciones evaluadas

| Opción | Descripción |
|---|---|
| **LocalAI binario nativo** | Cero cambios en código, mismos YAMLs, misma URL. Pero poca madurez en Windows, sin soporte oficial para instalador silencioso en Electron. |
| **Ollama completo** | Instalador `.exe` maduro, API OpenAI compatible, fácil de automatizar en Electron. Pero requiere proceso externo siempre activo. |
| **node-llama-cpp** | Embebe llama.cpp dentro de Node.js — sin proceso externo, sin Docker, sin instalar nada. Integración perfecta con Electron. **Elegida.** |

### Decisión
Migrar el motor de inferencia de LocalAI+Docker a `node-llama-cpp` para chat/código/títulos. Usar Ollama solo para visión multimodal (temporal, hasta que node-llama-cpp soporte multimodal).

### Razón
- Eliminar Docker como dependencia del usuario final
- Preparar arquitectura para instalador Electron sin dependencias externas
- node-llama-cpp corre directamente en Node.js — el mismo proceso de Electron
- Mismos modelos GGUF, sin conversión, sin migración de archivos
- GPU CUDA nativa en Windows sin WSL2

### Implementación
- `llama.provider.js` — provider central con `init()`, `switchModel()`, `generate()`, `stream()`, `getStatus()`, `getActiveModel()`
- `localai.service.js` — todas las llamadas `fetch()` a LocalAI reemplazadas por `llamaProvider.generate()` y `llamaProvider.stream()`
- `server.js` — carga el modelo en segundo plano al arrancar; `/health` expone `ai: loading|ready|error`
- Cambio dinámico de modelos — `switchModel()` descarga el modelo activo y carga el nuevo; cola de tokens via callback→AsyncGenerator para streaming real
- `shell/main.js` — migrado de `fork()` a `spawn()` con `ELECTRON_RUN_AS_NODE=1` para usar el Node.js de Electron

### Descartado
- **LocalAI binario nativo** — descartado por poca madurez en Windows y falta de documentación para Electron
- **Ollama completo** — descartado como motor principal porque requiere proceso externo; mantenido solo para visión

### Errores durante implementación
- `ERR_REQUIRE_ASYNC_MODULE` — node-llama-cpp es ESM puro; resuelto con `import()` dinámico en módulo CommonJS
- CUDA Toolkit no encontrado al instalar — resuelto instalando CUDA Toolkit 13.3 para Windows
- `Object is disposed` en títulos — race condition entre `generateTitleFromText` y `switchModel`; resuelto con delay fijo de 5s antes de generar título
- `Context size too large` con modelo visual cargado — resuelto reduciendo `contextSize: 512` para generación de títulos
- `gemma-2-9b-q4` causa `CUDA error: invalid argument` que mata el backend — resuelto reemplazando por `llama-3.1-8b-q5` en `capability.matrix.js`; pendiente de resolución en futuras versiones de node-llama-cpp

---

## 🎯 Visión multimodal: Ollama como solución temporal (v2.10.0)

### Opciones evaluadas
- **node-llama-cpp multimodal** — no disponible en v3.18; la API para imágenes no existe todavía
- **llama.cpp binario standalone como proceso hijo** — posible pero complejo; binario no incluido en node-llama-cpp
- **Ollama para visión** — API OpenAI compatible, soporte multimodal nativo con mmproj, instalación simple. **Elegida temporalmente.**

### Decisión
`vision.service.js` apunta a `http://localhost:11434/v1` (Ollama) en lugar de LocalAI. El contrato de `describeImage()` no cambia — interfaz reemplazable lista para cuando node-llama-cpp soporte multimodal.

### Razón
- Única opción que funciona hoy sin instalar CUDA Toolkit extra
- Modelos GGUF existentes (`qwen2.5-vl-7b-q4` + mmproj) registrados en Ollama con `ollama create`
- El instalador comercial puede automatizar la instalación de Ollama silenciosamente

### Pendiente
Cuando node-llama-cpp v4.x soporte multimodal, migrar `vision.service.js` a `llamaProvider.describeImage()` — cambio de un solo archivo.

---

## 🐛 Bug: respuesta duplicada en chatHistory (v2.10.0)

### Causa
Con LocalAI, el service guardaba la respuesta en `chatHistory` Y el controller también. Con node-llama-cpp, ambos seguían guardando — duplicación en el JSON.

### Solución
Eliminados todos los `memory.addChatHistoryMessage('assistant', ...)` dentro de los shortcuts de `streamToLocalAI` (`timeAnswer`, `controlledAnswer`, saludo). El controller es el único responsable de persistir la respuesta final.

### Excepción
`sendToLocalAI` (flujo no-streaming) sí puede guardar porque el controller no lo hace para ese path.

---

## 🐛 Bug: duplicación visual de respuestas (v2.10.0)

### Causa
`loadChatHistory` se llamaba automáticamente desde `sidebar.js` al reconstruir el sidebar después del renombrado — mientras la burbuja del stream ya estaba en el DOM.

### Solución
- `streaming.js` — `createStreamingBubble` pone `chatBox.dataset.streaming = 'true'`; `finalizeStreamingBubble` lo quita
- `chat.js` — `titlePromise.then()` pone `chatBox.dataset.reloading = 'true'` antes de `loadSidebar` y lo quita después
- `app.js` — `loadChatHistory` sale inmediatamente si `streaming` o `reloading` están activos
- `sidebar.js` — `onLoadChatHistory` solo se llama si el chat realmente cambió (comparando `prevState.chatId`)

---

## 🏗️ Empaquetado con Electron Builder (v2.10.0)

### Decisión
Usar `electron-builder` con target `portable` para generar ejecutable Windows sin instalación.

### Problema encontrado
Las dependencias están en `backend/node_modules/` pero electron-builder busca en el `package.json` raíz que no tiene `dependencies`. Resuelto con `asar: false` y copiando manualmente `node_modules` y binarios de `@node-llama-cpp/win-x64-cuda`.

### Pendiente
Automatizar el proceso de build para incluir correctamente:
- `backend/node_modules/`
- `@node-llama-cpp/win-x64-cuda/bins/win-x64-cuda/` (DLLs + addon.node)
- `MODELS_DIR` configurable via `.env` para que el ejecutable encuentre los modelos

**Actualización (v2.16.1):** `backend/node_modules/` (incluyendo los binarios CUDA de `@node-llama-cpp`, que viven dentro de esa carpeta) quedó resuelto — ver sección `v2.16.1 — Fix empaquetado Electron` al final del documento para la causa raíz real y la solución. `MODELS_DIR` configurable via UI de primer arranque sigue pendiente (hoy se resuelve solo via `.env` con ruta absoluta, no portable a otra máquina todavía).

### Rutas de modelos
`localai.service.js` usa `process.env.MODELS_DIR || path.join(__dirname, '../../models-localai')` — resuelto en `resolveModelPath()` para ser lazy (evaluado en tiempo de ejecución, no al cargar el módulo).

---

## 🖥️ Backend como main process + frontend como renderer (v2.11.0)
Decisión
Eliminar el spawn/child_process que lanzaba backend/server.js como proceso hijo desde shell/main.js. En su lugar, server.js se carga con require() directo dentro del propio proceso de Electron (main process). El frontend pasa de loadURL('http://localhost:3005') a loadFile(), cargando el HTML directamente del disco.
Razón
Con spawn, Electron y el backend eran dos procesos del sistema operativo separados — esto requería que el binario de Node.js viajara aparte del runtime que Electron ya trae embebido, complicando el instalador único. Con require(), Express corre usando el mismo Node.js que Electron ya incluye, sin dependencias externas para empaquetar. loadFile además permite que la ventana abra sin esperar a que Express termine de levantar, mejorando el tiempo de arranque percibido.
Opciones evaluadas

Mantener loadURL + Express sirviendo el frontend — descartada como solución final, aunque es la más simple. Mantiene una dependencia innecesaria del servidor HTTP para mostrar algo en pantalla, y complica el futuro splash screen de carga de modelos (habría que tapar la espera de Express en vez de mostrar la UI de inmediato).
loadFile + prefijar todas las rutas del frontend con BASE_URL — elegida. Costo de implementación más alto (tocar ~7 módulos), pero es el patrón correcto a largo plazo y el que usan apps de escritorio reales (VS Code, Slack).

Implementación

frontend/config.js (NUEVO) — export const BASE_URL vale 'http://localhost:3005' si window.location.protocol === 'file:', vacío en caso contrario. Permite que el mismo código fuente funcione en Electron y en navegador sin ramas condicionales repetidas.
BASE_URL prefijado en los fetch de: api.js (19 ocurrencias), login.js, models.js, contextFiles.js, settings.js (18 ocurrencias), webSearch.js, devPanel.js.

Errores encontrados durante la implementación

Ruta models-localai duplicada — primer intento de resolver MODELS_DIR en main.js concatenaba models-localai dos veces porque base ya incluía esa carpeta. Corregido construyendo la ruta completa en una sola expresión condicional según app.isPackaged.
require('electron') eliminado por accidente — al quitar la línea de spawn del bloque de imports de main.js, se borró también const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron') por estar en la misma línea de edición. Causó que toda la app fallara silenciosamente porque app, BrowserWindow, etc. quedaban undefined.
Referencias a backendProcess huérfanas — app.on('window-all-closed') seguía intentando backendProcess.kill() después de eliminar el proceso hijo. Variable inexistente, eliminado el bloque completo.
Rastreo incompleto de fetches sin BASE_URL — el primer pase cubrió api.js, login.js, models.js, contextFiles.js, settings.js. Quedaron sin cubrir webSearch.js (/search/config) y devPanel.js (/me, /gpu/stats, /localai/metrics), descubiertos solo al reproducir síntomas específicos (panel de Servicios vacío, búsqueda web no aparecía en Configuración). Lección: al hacer un cambio de este tipo, un grep -rn "fetch(" frontend/ completo al inicio habría evitado dos rondas de debugging reactivo.

Bug encontrado: panel "Servicios" no se renderizaba
Síntoma: en Configuración solo aparecían "Usuarios" y "Preferencias" — la pestaña "Servicios" (configuración de proveedores de búsqueda web a nivel admin) no existía en el DOM.
Causa raíz: devPanel.js → initDevPanel() hacía fetchWithAuth('/me') con ruta relativa. Desde file://, esa ruta resolvía a file:///H:/me (ruta de disco inválida) en lugar de http://localhost:3005/me. El fetch fallaba, el catch ponía isAdmin = false, y como el botón de "Servicios" solo se muestra si isAdmin === true, nunca se renderizaba — sin ningún error visible para el usuario, solo un fetch fallido silencioso.
Solución: agregar BASE_URL a los 3 fetch de devPanel.js.

🐛 Fix: etiqueta finish_reason invertida en Dev Panel (v2.11.0)
Síntoma
El Dev Panel reportaba finish_reason: length y Truncado: truncado en respuestas con búsqueda web activa, incluso con solo 41-51 tokens de salida — muy lejos del límite de maxTokens configurado (650). El equipo investigó durante un buen tramo asumiendo que el modelo se estaba quedando sin espacio para generar.
Investigación
Se agregó un log diagnóstico temporal ([DIAGNOSTICO maxTokens]) en localai.service.js que confirmó que maxTokens=650 llegaba intacto hasta llamaProvider.stream(). Esto descartó la hipótesis de límite de tokens de salida. Se descartó también la hipótesis de contextSize/n_ctx insuficiente — el total (entrada + salida) nunca se acercó al límite de 4096.
Causa raíz real
jsmeta.finishReason = stopped ? 'stop' : 'length';
La variable stopped se vuelve true cuando el detector de loops/repeticiones del propio código corta la generación a propósito (break dentro del for await). Cuando el modelo termina de forma natural (node-llama-cpp deja de emitir tokens por su cuenta, EOS normal), stopped nunca se toca y queda en false — y la línea original etiquetaba ese caso como 'length', sugiriendo falsamente un truncamiento por límite de tokens.
Solución
jsmeta.finishReason = stopped ? 'loop_detected' : 'stop';
Etiqueta corregida para reflejar la causa real de cada caso.
Impacto en el diagnóstico previo
Esto invalida la hipótesis de "Bug 1" (respuestas truncadas con búsqueda web) tal como se planteó originalmente — nunca hubo un problema de truncamiento. Lo que se observó como "respuestas cortas/pobres con búsqueda web" es un problema distinto y no resuelto: el modelo (qwen2.5-7b-q5) decide terminar su respuesta en pocos tokens y a veces ignora o usa mal el contexto de búsqueda inyectado, pese a recibirlo completo. Documentado como pendiente en ROADMAP v4.0 — es comportamiento de modelo, no bug de código.
Decisión que no se tomó
Se consideró subir maxTokens de 350 a 650 como intento de solución antes de encontrar la causa real. Se aplicó como prueba diagnóstica, pero no resolvió el síntoma (el truncamiento "reportado" persistió igual con 51 tokens de salida) — la prueba en sí fue la pista que llevó a sospechar que el límite de tokens no era la causa real. Se mantiene el valor de 650 porque no hace daño tenerlo más alto, pero no fue la solución del problema original.

🐛 Bug recurrente resuelto: respuesta/pregunta se va a otro chat (v2.11.0)
Síntoma
De forma intermitente — "cuando menos lo esperas", según se reportó — el mensaje del usuario o la respuesta del modelo aparecían en un chat distinto al que se había enviado, dejando el chat original vacío o incompleto (a veces solo con la pregunta, a veces solo con la respuesta). Ya se habían aplicado fixes parciales en versiones anteriores (protección en autoRename.js verificando chatId activo) que reducían la frecuencia pero no eliminaban el bug.
Investigación
Se revisó el log de backend de varias sesiones de prueba, comparando los chatId reales de cada request. La pista decisiva: algunos chatId en el log no eran identificadores tipo chat-1234567, sino el nombre visible del chat ya renombrado (ej. chatId: "Río de Janeiro Locación", chatId: "Imagen"). Esto reveló que chatId no era un valor estable durante la vida de un chat.
Causa raíz real
chatId se usaba con doble propósito: era simultáneamente el nombre del archivo en disco ({chatId}.json) y el identificador en memoria del frontend (chatState.chatId). Al renombrar un chat, renameChat() en memory.service.js ejecutaba fs.renameSync(oldPaths.chatFile, newPaths.chatFile) y actualizaba chatState.chatId al mismo valor nuevo (el título). Como el renombrado automático (autoRename.js) corre en paralelo al envío del siguiente mensaje (decisión de diseño de v2.4.3, ver sección "Renombrado paralelo a la respuesta"), existía una ventana de tiempo en la que el renombrado de un chat anterior terminaba y cambiaba chatState.chatId justo mientras el usuario estaba escribiendo o enviando el siguiente mensaje — haciendo que ese nuevo mensaje "heredara" la identidad del chat recién renombrado en lugar de crear o usar el chat correcto.
El bug era más frecuente con adjuntos de imagen porque el flujo visual (OCR + Tesseract + fallback a modelo VL + segundo pase de búsqueda web) tarda considerablemente más que un mensaje de texto simple, ampliando la ventana de colisión.
Opciones evaluadas
Opción B — Bloquear el cambio de chatId mientras hay un envío en curso. Parche quirúrgico: agregar !getSendingState() al guard existente en autoRename.js antes de llamar setActiveChat. Aplicada primero como mitigación rápida. Resultado: redujo la frecuencia pero no eliminó el bug — la ventana de colisión seguía existiendo en otros momentos no cubiertos por el flag _sending (por ejemplo, entre que el usuario termina de escribir y presiona enviar, sin que _sending esté todavía en true). Descartada como solución final tras confirmar que el bug reapareció en pruebas posteriores.
Opción A — chatId inmutable, separado de title (elegida). Solución arquitectónica definitiva: chatId se fija una sola vez al crear el chat y nunca vuelve a cambiar — es el nombre del archivo de por vida. title (campo que ya existía en el JSON pero no se usaba como fuente de verdad) pasa a ser el único valor mutable, editado por el renombrado automático o manual.
Implementación (Opción A)

memory.service.js — renameChat(chatId, newTitle, options) ya no hace fs.renameSync; solo actualiza chatMemory.title y reescribe el mismo archivo. listChats() devuelve [{chatId, title}, ...] en vez de array de strings, leyendo el title real de cada archivo. createChat() inicializa title = chatId.
chat.controller.js — endpoint /chat/rename cambia de {oldChatId, newChatId} a {chatId, newTitle}.
api.js — firma de renameChat() actualizada a (chatId, newTitle, projectId).
autoRename.js — eliminado el guard de protección contra colisión (ya no aplica, chatId no cambia) y la llamada a setActiveChat tras renombrar. listChats ahora se lee como c.title en vez de c directamente.
sidebar.js — loadChats, loadProjectChats, createActionsMenu reciben y operan con {chatId, title} como objeto — chatId para toda lógica de identidad/selección, title solo para el texto mostrado.
modals.js — openRenameModal precarga el input con title (no id) para chats; compara el valor nuevo contra title para detectar cambios reales.

Compatibilidad con datos existentes
No se requirió script de migración. Los chats ya creados conservan su chatId actual (su nombre de archivo de hoy, sea un timestamp o un nombre de texto de un renombrado previo) como identificador inmutable de aquí en adelante. El campo title, que ya existía en la estructura del JSON desde v1.4.0 pero no se usaba como fuente de verdad, pasa a serlo sin necesidad de tocar los archivos existentes.
Error encontrado durante la implementación
Al reescribir autoRename.js con el patrón ANTES/DESPUÉS, se reemplazó el archivo completo en lugar de solo la función tryAutoRename, perdiendo accidentalmente la función makeUniqueChatTitle y todos los imports del módulo (listChats, generateTitle, renameChat de api.js). Esto rompió la carga del módulo ES (SyntaxError: ... does not provide an export named 'makeUniqueChatTitle'), dejando toda la app sin funcionar (sidebar vacío, imposible enviar mensajes) porque app.js depende de ese export. Lección: cuando un cambio reescribe la mayoría de un archivo pequeño, dar el archivo completo en vez de un fragmento ANTES/DESPUÉS evita este tipo de pérdida silenciosa de exports no relacionados con el cambio en cuestión.
Decisión que no se tomó
Se consideró generar un id interno completamente nuevo y aleatorio (UUID) en vez de reusar el chatId existente como identificador inmutable. Descartada — habría requerido script de migración para asignar UUIDs a chats ya creados, y el chatId actual ya cumple el requisito de unicidad sin ese trabajo adicional. Reusarlo como inmutable fue la opción de menor costo con el mismo resultado.
Pendiente relacionado
Esta misma separación identidad/presentación no se aplicó a proyectos (renameProject sigue usando el nombre como identificador único, igual que los chats antes de este fix). No se reportó el mismo bug en proyectos porque no tienen renombrado automático en paralelo — el riesgo de colisión es mucho menor. Queda como mejora futura si se detecta un problema similar.

---

## 🖨️ Reemplazar Poppler por pdfjs-dist en pdf.rasterizer.js (v2.11.x)

### Decisión
`backend/services/attachment/ocr/rasterizers/pdf.rasterizer.js` deja de invocar `pdftoppm` (binario externo de Poppler vía `child_process`) y rasteriza PDFs usando `pdfjs-dist` (parseo del PDF en JS puro) + `@napi-rs/canvas` (superficie de dibujo en Node, sin DOM). El contrato público del módulo no cambia: `rasterizePdf(pdfPath, outDir, maxPages) → string[]`, mismo patrón de nombre de archivo de salida (`page-1.png`, `page-2.png`...). `pdf.ocr.extractor.js` no requirió ningún cambio — solo consume el array de rutas devuelto, nunca asume el nombre del archivo.

### Razón
Poppler es un binario del sistema operativo que el usuario final debía tener instalado en su PATH para que el OCR de PDFs escaneados funcionara — si no estaba presente, la función fallaba en silencio (`checkPoppler()` devolvía `false` y se registraba un warning, pero no había ninguna alternativa). Esto bloqueaba directamente el instalador único de Electron: cualquier persona que recibiera el `.exe` sin Poppler instalado perdía esa función sin saberlo. `pdfjs-dist` y `@napi-rs/canvas` son dependencias npm que se empaquetan dentro de `node_modules` y viajan con el instalador, eliminando esa dependencia externa.

### Opciones evaluadas
- **Mantener Poppler** — descartada, es la causa raíz del problema que se buscaba resolver.
- **`pdfjs-dist` + `canvas`** (paquete `canvas`, el "clásico" de Node) — fue la primera implementación intentada. Funcionaba sin errores pero generaba páginas completamente en blanco (ver "Errores encontrados" más abajo). Se determinó que `pdfjs-dist` v6.x espera específicamente `@napi-rs/canvas` en su `NodeCanvasFactory` interno, no `canvas`. Descartada tras confirmar la causa.
- **`pdfjs-dist` + `@napi-rs/canvas`** — elegida. Es la integración que `pdfjs-dist` v6.x soporta de forma nativa (su propio `NodeCanvasFactory` interno ya está escrito contra esta librería). No requiere compilación nativa local — trae binarios precompilados (prebuilds) para Windows x64, lo cual simplifica además el empaquetado futuro con `electron-builder` comparado con un addon compilado a mano.
- **LibreOffice headless como motor de rasterización de PDF** — no evaluada en profundidad para este caso porque reintroduce exactamente el mismo problema que Poppler (binario externo, mismo tipo de deuda técnica). Ver sección separada en ROADMAP.md ("Renderizado visual de DOCX/PPTX — Aspose + alternativas locales") para la discusión completa de motores externos opcionales, que es un problema relacionado pero distinto (esa sección es para DOCX/PPTX con motores opcionales seleccionables, no para PDF que necesita un piso garantizado sin depender de nada instalado).

### Errores encontrados durante la implementación

**1. `pdfjs-dist` v6.x es ESM puro, no CommonJS**
Síntoma: `Cannot find module 'pdfjs-dist/legacy/build/pdf.js'`. La ruta de import asumida (válida en versiones anteriores de la librería) ya no existe — la build `legacy/build` solo contiene archivos `.mjs`.
Causa: a partir de cierta versión, `pdfjs-dist` eliminó sus archivos de CommonJS (`pdf.js`) y solo distribuye ESM (`pdf.mjs`). El proyecto entero usa `require()` (backend CommonJS).
Solución: import dinámico (`await import('pdfjs-dist/legacy/build/pdf.mjs')`) dentro de la función `async rasterizePdf()`, con cacheo en una variable de módulo (`_pdfjsLib`) para no reimportar en cada llamada. No requirió convertir el proyecto a ESM.

**2. `standardFontDataUrl` faltante y en formato incorrecto**
Síntoma: `UnknownErrorException: Ensure that the standardFontDataUrl API parameter is provided`, y tras corregirlo, `Invalid factory url: "...\standard_fonts\" must include trailing slash`.
Causa: `pdfjs-dist` necesita la ruta a sus archivos de fuentes estándar embebidas, resuelta explícitamente en Node (en el navegador se resuelve sola). La ruta se construyó con `path.join()`, que en Windows usa backslashes (`\`) — `pdfjs-dist` espera esa ruta en formato tipo URL (forward slashes), aunque sea una ruta de archivo local.
Solución: `path.dirname(require.resolve('pdfjs-dist/package.json'))` para ubicar la carpeta del paquete instalado sin hardcodear versión, concatenado con `standard_fonts/`, y normalizado con `.split(path.sep).join('/')` antes de pasarlo a `getDocument()`.

**3. Render "exitoso" pero página en blanco**
Síntoma: `rasterizePdf()` no lanzaba ningún error y devolvía las rutas de los PNG esperados, pero los archivos generados estaban completamente en blanco (confirmado visualmente).
Causa raíz: con el paquete `canvas`, el `page.render()` de `pdfjs-dist` no tenía forma de crear correctamente las superficies de dibujo que usa internamente (máscaras, capas intermedias) porque su `NodeCanvasFactory` interno está escrito contra `@napi-rs/canvas`, no contra `canvas`. Pasar solo `canvasContext` sin un `canvasFactory` explícito compatible no producía error, pero tampoco pintaba nada.
Investigación: se inspeccionó el código fuente real de `pdfjs-dist` v6.0.227 (`legacy/build/pdf.mjs`) para confirmar la clase `NodeCanvasFactory` esperada, en vez de seguir intentando variantes a ciegas.
Solución: cambio de dependencia de `canvas` a `@napi-rs/canvas` (desinstalada la primera para no dejar dependencia muerta), e implementación de una clase `NodeCanvasFactory` propia con el contrato `create(width, height)` / `reset(canvasAndContext, width, height)` / `destroy(canvasAndContext)` que `pdfjs-dist` espera, pasada tanto a `getDocument({ canvasFactory })` como a `page.render({ canvasFactory })`.

### Validación
Probado end-to-end dentro de la aplicación real (no solo en aislamiento): PDF escaneado (imagen, sin texto seleccionable) subido como adjunto de chat → `attachment.service.js` detectó "PDF escaneado" → `pdf.ocr.extractor.js` → `rasterizePdf()` (código nuevo) → Tesseract OCR sobre la imagen generada, 93% de confianza → texto inyectado correctamente como contexto → respuesta del modelo coherente con el contenido real del documento. Sin ningún log ni invocación de Poppler en el flujo.

### Pendiente relacionado
- `checkPoppler()` se mantiene en el módulo (ahora siempre retorna `true`) solo por compatibilidad con cualquier código que la importe — candidata a limpieza en una pasada futura si se confirma que nada más la usa.
- El log `[attachment.service] Poppler disponible: true` en el arranque queda obsoleto (Poppler ya no se usa, solo se detecta su presencia en el sistema) — limpieza cosmética pendiente, no afecta funcionalidad.
- Empaquetado con `electron-builder`: igual que con los binarios CUDA de `node-llama-cpp`, falta verificar que el addon nativo de `@napi-rs/canvas` (prebuild específico de plataforma) viaje correctamente en el build final — mismo punto ya anotado en ROADMAP.md bajo "Empaquetado Electron — pendientes".

## [v2.x] Budget dinámico de contexto post-model-router + captura de error de context shift

### Problema
En proyectos con Context Snapshot activo y muchos archivos indexados (caso observado: 54 archivos,
18,248 caracteres ensamblados), un mensaje de chat podía fallar con:
`Error: Failed to compress chat history for context shift due to a too long prompt or system message`
lanzado por `node-llama-cpp`, en vez de obtener una respuesta.
Con el mismo Context Snapshot desactivado, el mismo proyecto respondía sin error — confirmando que
el contexto inyectado era la causa, no el routing de chats de proyecto en sí.

### Causa raíz
`budgeter.js` aplicaba su presupuesto (`maxFilesPerRequest`, `maxCharsTotal`) leído estáticamente
de `projectSettings.json` — sin considerar el `context_size` real del modelo que el Model Router
eligiera para ese mensaje, ni cuánto de esa ventana ya ocupaban el historial de chat + system
prompt base + mensaje del usuario. Cuando la suma total excedía la ventana del modelo,
`node-llama-cpp` intentaba su propia compresión de emergencia y crasheaba en vez de degradar.

### Opciones evaluadas

**Opción A — Budget dinámico post-model-router (elegida para causa raíz)**
Coordinar `budgeter.js` con el resultado del Model Router: calcular el presupuesto disponible
*después* de saber qué modelo fue seleccionado (y su `context_size` real) y cuánto ya ocupan
historial + system prompt base.

**Opción B — Captura de error con mensaje claro al usuario (elegida como safety net)**
Capturar el error específico de `node-llama-cpp` en el `catch` de `chat.controller.js` y
responder con un mensaje útil en vez del error crudo. No resuelve la causa raíz pero evita
el fallo silencioso/feo. Se implementó junto con la Opción A.

**Opción C — Límite estático más conservador en `projectSettings.json`**
Descartada. No escala — cada modelo tiene una ventana distinta y el límite óptimo varía
según el historial activo. Requeriría ajuste manual por proyecto y por modelo.

### Implementación

**Archivos modificados:**
- `token.profiles.js` — agregado `MODEL_CONTEXT_SIZES` con `context_size` real por modelo
  y función `getContextSize(model)`
- `budgeter.js` — `budget()` acepta nuevo parámetro `dynamicMaxChars`; si se pasa, tiene
  prioridad sobre `rules.maxCharsTotal`; mínimo absoluto de 500 chars
- `assembler.js` — `assemble()` acepta y pasa `dynamicMaxChars` a `budget()`
- `context.service.js` — `getProjectContext()` acepta y pasa `dynamicMaxChars` a `assemble()`
- `buildSystemPrompt.js` — acepta y pasa `dynamicMaxChars` a `getProjectContext()`
- `localai.service.js` — `streamToLocalAI()` extrae `options.dynamicMaxChars` y lo pasa a
  `buildSystemPrompt()`
- `chat.controller.js` — calcula `dynamicMaxChars` después de resolver el modelo:
  `(contextTokens - maxOutputTokens) * 4 - RESERVED_BASE_CHARS`; lo pasa en `streamOptions`;
  catch captura error de context shift y devuelve mensaje claro al usuario

**Fórmula de cálculo:**

dynamicMaxChars = (MODEL_CONTEXT_SIZES[model] - maxOutputTokens) * 4 - RESERVED_BASE_CHARS

RESERVED_BASE_CHARS = 1500 (system prompt base) + 1200 (2 mensajes de historial × 600 chars)

mínimo absoluto = 500 chars

### Resultado observado en prueba

[CONTEXT BUDGET] model=hermes-q5 contextTokens=8192 maxOutput=1400 → dynamicMaxChars=24468

[getProjectContext] items en index: 54

[budgeter] effectiveMaxChars=24468 (dinámico) | seleccionados=5 archivos | usados=6562 chars

54 archivos indexados → 5 seleccionados dentro del límite dinámico → respuesta sin crash.

### Pendiente
- Confirmar comportamiento con modelos de ventana pequeña (ej. `llama-3.2-3b-q4`, 4096 tokens)
  donde `dynamicMaxChars` resultaría ~8000 chars — caso más restrictivo que el límite estático.
- La Parte 1 (captura de error) cubre edge cases no anticipados por el budget dinámico,
  pero no se ha podido verificar en producción aún ya que el bug dejó de reproducirse.

  ## [v2.11.2] Exclusión de archivos sensibles del Context Snapshot

### Problema
`search-config.json` contiene credenciales (API keys de Tavily, URLs de SearXNG) y estaba
siendo indexado por el Context Snapshot. El modelo lo leía y exponía las credenciales en
respuestas al usuario al analizar el proyecto. Detectado cuando el modelo respondió una
pregunta sobre el chat del proyecto e incluyó la API key de Tavily en texto plano.

### Causa raíz
Los `ignoreGlobs` por defecto en `getDefaultSettings()` de `context.service.js` solo excluían
directorios de dependencias (`node_modules`, `.git`, `dist`, `build`) pero no archivos de
configuración con credenciales.

### Opciones evaluadas

**Opción A — Agregar exclusiones a `ignoreGlobs` por defecto (elegida)**
Ampliar la lista en `getDefaultSettings()` para cubrir patrones de archivos sensibles comunes.
Aplica a todos los proyectos nuevos automáticamente. Los proyectos existentes requieren
actualización manual de su `projectSettings.json` + refresh del snapshot.

**Opción B — Mover `search-config.json` fuera del directorio indexado**
Descartada. No escala — cada vez que se agregue un archivo sensible habría que moverlo
manualmente. No protege contra archivos `.env` u otras credenciales que puedan aparecer.

### Solución aplicada
Archivos modificados:
- `context.service.js` → `getDefaultSettings()`: `ignoreGlobs` ampliado con patrones de
  seguridad: `**/search-config.json`, `**/*.env`, `**/.env*`, `**/secrets*`, `**/credentials*`
- `projectSettings.json` del proyecto Prueba: mismas exclusiones aplicadas manualmente

### Resultado
Items en index bajaron de 54 a 40 tras refresh del snapshot. La API key de Tavily dejó
de aparecer en respuestas del modelo.

### Pendiente
- Revisar proyectos existentes en ambas máquinas y actualizar su `projectSettings.json`
  manualmente con los nuevos `ignoreGlobs`
- Evaluar si agregar más patrones: `**/config*.json`, `**/keys*`, `**/*.pem`, `**/*.key`

## [v2.11.3] Soporte de .md y .txt en Context Snapshot + calibración del budget

### Problema
El Context Snapshot solo indexaba extensiones de código — los .md de documentación nunca
entraban al contexto, causando respuestas pobres sobre la arquitectura del proyecto.

Al agregar .md surgieron crashes de context shift porque:
1. `upload.provider.js` leía archivos sin límite de tamaño
2. El ratio chars/token asumido (4) era incorrecto para español (real: ~3)
3. El system prompt base no estaba contado en el estimado de tokens

### Solución aplicada
- `snapshot.service.js` — agregado `.md` y `.txt` a `ALLOWED_EXTENSIONS`
- `snapshot.provider.js` — truncado diferenciado: 3000 chars para `.md`/`.txt`, 500 para `.js`
- `upload.provider.js` — truncado de 3000 chars (antes sin límite)
- `chat.controller.js` — ratio cambiado de `* 4` a `* 3`
- `token.profiles.js` — `hermes-q5` bajado de 8192 a 6000 como límite conservador

### Pendiente
- Tokenización real con `model.tokenize()` para eliminar estimación chars/token
- Modelo con ventana grande (Qwen2.5-14B 32K) para leer .md completos
- Búsqueda semántica con embeddings — v3.0

## v2.12.0 — Tokenización real con model.tokenize()

**Problema**
El budget de contexto dinámico (`dynamicMaxChars`) usaba una estimación fija de
`(contextTokens - maxOutput) * 3 - 7700` para calcular los chars disponibles para
el Context Snapshot. El factor `* 3` asumía uniformidad entre código, español y JSON,
y la constante `RESERVED_BASE_CHARS = 7700` no medía el mensaje real del usuario.

**Opciones evaluadas**
1. Mantener estimación `* 3` con constante ajustada manualmente — descartado: frágil,
   varía por modelo y tipo de contenido.
2. Exponer `model.tokenize()` de `node-llama-cpp` para medir tokens reales — elegido.

**Solución implementada**
- `llama.provider.js`: nueva función `countTokens(text)` que usa `_model.tokenize(text).length`.
  Fallback a `Math.ceil(text.length / 3.5)` si el modelo no está listo.
- `chat.controller.js`: importa `countTokens` desde `../services/localai/llama.provider`.
  Reemplaza la estimación fija por medición real del `finalMessage` antes de calcular
  el budget. Constantes de reserva ajustadas:
  - `SYSTEM_PROMPT_TOK = 1400` (global + mode + project + memory prompts)
  - `HISTORY_TOK = 500`
  - `SAFETY_MARGIN_TOK = 300`
- Conversión inversa a chars mantiene `* 3.5` (conservador para español/código mixto).

**Error encontrado durante implementación**
Primera iteración usó constantes demasiado bajas (350/300/150), lo que resultó en
`dynamicMaxChars=13275` — casi el doble del budget anterior — llenando el contexto
y causando `Failed to compress chat history` en `hermes-q5` (6000 tokens). Se
corrigieron las constantes a los valores actuales.

**Archivos modificados**
- `backend/services/localai/llama.provider.js`
- `backend/controllers/chat.controller.js`

## v2.13.0 — Modelo de ventana grande + estabilidad

**Problema**
Los modelos 8K se quedaban cortos para análisis documental. El loop detector era global y demasiado agresivo con modelos grandes. El acumulador de tokens dependía de LocalAI Docker (eliminado). `generateTitleFromText` causaba race condition con el 14B.

**Opciones evaluadas — modelo grande**
- Qwen2.5-14B Q4_K_M (8.99GB): ocupa 87% VRAM en RTX 4070, deja solo ~2K tokens para contexto. Descartado como modelo de contexto largo.
- Qwen2.5-14B Q3_K_M (7.34GB): ocupa 77% VRAM, deja ~6K tokens usables. Elegido.

**Solución**
- Alias `large-context` agregado a `capability.matrix.js`: desktop → `qwen2.5-14b-q3`, laptop → `qwen2.5-3b-q5`.
- `token.profiles.js`: contexto 6144 tokens, salida 900 tokens para el 14B.
- Loop detector: `isHeavyModel` detecta modelos 14B, usa ventana `-900` y `minLength=180` en vez de `-600`/`15`.
- Acumulador propio `_tokenAccum` en `localai.service.js` — `countTokens()` real en `meta.promptTokens` y `meta.completionTokens`.
- `metrics.routes.js`: reemplaza fetch a `localhost:8080` por `getTokenMetrics()` local.
- `generateTitleFromText`: detecta modelo 14B activo y usa fallback de título en vez de intentar switch.
- `contextSize` ahora se pasa desde `token.profiles.getContextSize()` hasta `llama.provider.stream()`.

**Errores encontrados**
- `InsufficientMemoryError` con contextSize=3072 en Q4_K_M: VRAM insuficiente. Resuelto bajando a 2048 y luego cambiando al Q3_K_M.
- `DisposedError` en stream: race condition entre `generateTitleFromText` y el stream del 14B. Resuelto con fallback de título.
- Duplicación de constantes en loop detector al aplicar el cambio: resuelto eliminando el bloque duplicado.

**Archivos modificados**
- `backend/services/localai/llama.provider.js`
- `backend/services/localai/token.profiles.js`
- `backend/services/localai.service.js`
- `backend/services/model.router/capability.matrix.js`
- `backend/routes/metrics.routes.js`
- `backend/controllers/chat.controller.js`
- `assets/modules/models.js`

## v2.14.0 — Búsqueda semántica con embeddings (Ollama)

**Problema**
El snapshot servía archivos por orden de mtime — sin relevancia semántica. Documentos grandes se truncaban. No había forma de recuperar solo las partes relevantes de un archivo largo.

**Opciones evaluadas**
1. `node-llama-cpp` para embeddings — descartado. Consume ~4-8GB de heap V8 al inicializar, crashea en proceso principal de Electron y en child process con Node.js 24 debido a pointer compression de V8 (~3.8GB límite real).
2. Ollama HTTP (`nomic-embed-text`) — elegido. Las llamadas son HTTP puras, sin buffers en heap V8, sin límite de memoria. Modelo descargado con `ollama pull nomic-embed-text`.

**Arquitectura implementada**
- `chunk.service.js` — divide archivos en fragmentos de ~4000 chars con solapamiento de 150 chars
- `vector.store.js` — guarda/lee embeddings en `embeddings.json` por proyecto, búsqueda por similitud coseno
- `embed.provider.js` — cliente HTTP para Ollama, alias `getEmbeddingAndRelease` por compatibilidad
- `snapshot.provider.js` — modo semántico cuando hay embeddings, fallback por mtime si no
- `generate-embeddings.js` — script standalone sin imports de Tempest, lanzado como child process desde `context.controller.js` al regenerar snapshot
- `context.controller.js` — spawn de `generate-embeddings.js` con `GENERATE_EMBEDDINGS=1` después de cada snapshot

**Errores encontrados**
- `node-llama-cpp` crasheaba con OOM en todo intento — proceso principal, child process con 8GB, Node.js 24. Causa: pointer compression de V8 limita heap a ~3.8GB independientemente del flag.
- Chunk de 8000 chars daba HTTP 500 en Ollama — reducido a 4000 chars.
- Un solo archivo grande consumía todos los chunks — resuelto con `MAX_CHUNKS_PER_FILE=5` luego subido a 15.
- Child process con `process.execPath` apuntaba a Electron en vez de Node.js — resuelto con `spawn('node', ...)`.

**Limitaciones conocidas — pendiente v4.0**
- Worker thread para embeddings en proceso principal sin OOM
- Embeddings para archivos subidos manualmente via botón "Subir archivos"

**Archivos nuevos**
- `backend/services/context/chunk.service.js`
- `backend/services/context/vector.store.js`
- `backend/services/context/embed.provider.js`
- `backend/services/context/providers/snapshot.provider.js` (reescrito)
- `backend/scripts/generate-embeddings.js` (reescrito)

**Archivos modificados**
- `backend/services/context/snapshot.service.js`
- `backend/controllers/context.controller.js`
- `backend/services/context/assembler.js`

## v2.14.1 — Fix regex loop detector para modelo 14B

**Problema**
`SyntaxError: Invalid regular expression: /(.{180,140})\1{1,}/s: numbers out of order in {} quantifier` al usar `qwen2.5-14b-q3` — el regex de detección de loops tenía `minLength=180` y `maxLength=140` invertidos.

**Causa**
El `maxLength` estaba hardcodeado a `140` sin considerar que `isHeavyModel` sube `minLength` a `180`, haciendo `{180,140}` inválido.

**Fix**
`loopMaxLength = isHeavyModel ? 500 : 140` — el máximo se ajusta por modelo junto con el mínimo.

**Archivo modificado**
- `backend/services/localai.service.js` línea ~385

## v2.15.0 — VAD + whisper.cpp standalone (migración de transcripción)

### Problema
El módulo de transcripción nunca fue migrado de LocalAI+Docker. Seguía llamando a `http://localhost:8080/v1/audio/transcriptions` que ya no corre desde v2.10.0. Todos los chunks fallaban con `ECONNREFUSED`.

### Opciones evaluadas

**Opción A — `nodejs-whisper` / `whisper-node` (npm)**
Wrappers de whisper.cpp con compilación en `postinstall`. Descartados: CPU-only documentado, compilación nativa frágil para instalador Electron, no aprovecha RTX 4070.

**Opción B — whisper.cpp standalone via `execFile` (elegida)**
Mismo patrón arquitectónico que ffmpeg — binario externo llamado con `execFileAsync`. Soporte CUDA real compilado en el binario. Sin dependencias npm nuevas. Interfaz reemplazable (`vad.detector.js`). Binario: `whisper-cublas-12.4.0-bin-x64.zip` de GitHub releases.

### VAD — detección de silencios reales

**Problema:** corte fijo cada 60s cortaba frases a la mitad, timestamps eran aproximados (`index * CHUNK_SECONDS`).

**Opciones evaluadas:**
- `@silero-vad` / `node-vad` — descartados: dependencia nativa adicional, más complejo para instalador.
- **ffmpeg `silencedetect` filter (elegido)** — sin dependencias nuevas, mismo ffmpeg ya en uso.

**Implementación:**
- `vad.detector.js` — interfaz reemplazable, patrón igual que `preprocessor.js`. Motor actual: ffmpeg `silencedetect` (noise=-35dB, d=0.8s). Reemplazable por Silero VAD sin tocar el servicio.
- Corte en `silence_end` (momento donde reanuda el audio, no donde empieza el silencio).
- Filtros: `MIN_CHUNK_SECONDS=20`, `MAX_CHUNK_SECONDS=90`, fallback a corte fijo si no hay silencios.
- Validado: 137 puntos de corte en video MP4 de ~40 min.

### Migración de `transcribeChunk`

- Elimina `axios`, `form-data`, `LOCALAI_TRANSCRIPTION_URL`, `TRANSCRIPTION_MODEL`.
- `execFileAsync('whisper-cli.exe', [...])` — genera `.txt` temporal junto al WAV.
- Lee el `.txt`, lo borra, devuelve el texto.
- `chunks` ahora son `{ path, startTime }` — timestamps precisos en modo `timestamps`.
- `mergeTranscriptionsWithTimestamps` usa `startTime` real en lugar de `index * CHUNK_SECONDS`.

### Modelos Whisper disponibles

| Modelo | Tamaño | Estado |
|---|---|---|
| `ggml-base.bin` | 147 MB | Disponible (usado en pruebas iniciales) |
| `ggml-small.bin` | 466 MB | Disponible |
| `ggml-large-v3.bin` | 3 GB | **Activo** |

Modelo activo configurable en una línea: `WHISPER_MODEL` en `transcription.service.js`.

### Fix descarga en Electron

`toPublicUrl()` devolvía `/outputs/...` — ruta relativa que en `file://` no resuelve al servidor Express. Cambiado a `http://localhost:3005/outputs/...` (URL absoluta).

### Archivos nuevos
- `backend/services/transcription/vad.detector.js`

### Archivos modificados
- `backend/services/transcription.service.js`
- `backend/modules/transcription.js` (eliminado mensaje intermedio)

### Deuda técnica para instalador
- `whisper-bin/` (~650 MB) + `models-localai/whisper/` (~3 GB para large-v3) deben empaquetarse con el instalador o descargarse en primer arranque.
- Patrón recomendado: descarga opcional en primer arranque (igual que modelos GGUF de chat).

## v2.16.0 — Persistencia de mensajes de transcripción + limpieza de archivos huérfanos + acceso a carpeta

### Problema
Los mensajes generados por el flujo de transcripción (`addMessage`/`addDocumentCard`) vivían solo en el DOM — nunca se guardaban en `chatHistory`. Al cambiar de chat y volver, `loadChatHistory` reconstruía el chat desde el JSON persistido y esos mensajes no existían ahí, desapareciendo por completo.

### Solución — persistencia explícita
Nuevo endpoint `POST /chat/message/save` (`chat.controller.js` → `saveMessage`) que llama a `memory.addChatHistoryMessage` — la misma función que usa el flujo normal de chat. `transcription.js` lo invoca después de mostrar el mensaje inicial y después de mostrar la card de resultado.

### Bug encontrado durante la implementación: mensaje final guardado en el chat equivocado
Primera versión de `saveMessageToHistory` leía `getChatState()` en el momento de guardar — si el usuario navegaba a otro chat mientras la transcripción seguía en curso, el mensaje final se guardaría en el chat que estuviera activo al terminar, no en el que inició la transcripción.

**Fix:** capturar `targetChat = getChatState()` al inicio del flujo de transcripción (antes de que el usuario pueda navegar) y pasarlo explícitamente a `saveMessageToHistory(role, content, target)` en ambas llamadas, en vez de volver a leer el estado global al momento de guardar.

### Bug de renderizado: links markdown rotos tras recargar historial
`renderText()` en `messageRenderer.js` solo reconocía URLs crudas (`/https?:\/\/[^\s]+/g`) — al reconstruir el mensaje persistido `[Ver documento](url)`, el regex capturaba el `)` de cierre como parte del `href`, generando un link roto (`...txt)` → 404 al hacer clic).

**Fix:** `renderText()` ahora reconoce primero la sintaxis markdown `[texto](url)` con un regex dedicado (`\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)`) y solo después busca URLs sueltas en el texto restante, excluyendo paréntesis/corchetes de cierre.

### Bug de descarga: el botón reconstruido abría el archivo en vez de descargarlo
La card original (`ui.js` → `addDocumentCard`) usa `downloadBtn.setAttribute('download', filename)` para forzar la descarga. El link markdown reconstruido desde el historial no tenía ese atributo — el navegador simplemente abría el archivo.

**Fix:** en `renderText()`, cuando el texto del link coincide con `/descargar/i`, se agrega `download` con el nombre de archivo extraído de la URL.

### Feature: reconstrucción visual de la card de documento
`loadChatHistory()` en `app.js` ahora usa `parseDocumentCardMessage()` para detectar el patrón de texto guardado (`📄 Documento generado...`) y llamar a `addDocumentCard()` en lugar de `addMessage()` cuando corresponde.

**Acoplamiento conocido:** el parser depende del formato exacto de texto que genera `transcription.js` (emoji, orden de líneas). Si ese formato cambia, hay que actualizar `parseDocumentCardMessage` en conjunto.

### Feature: limpieza de archivos huérfanos al borrar chat
**Problema identificado por el usuario:** los archivos en `backend/outputs/transcriptions/` nunca se borraban — ni por tiempo (no hay job de limpieza para esa carpeta, a diferencia de `uploads/attachments/`) ni al borrar el chat que los generó.

**Decisión explícita del usuario:** el ciclo de vida del archivo generado debe estar atado al ciclo de vida del chat — si se borra el chat, se borra el archivo. Sin expiración por tiempo.

**Implementación:** `deleteChat()` en `memory.service.js`, antes de borrar el JSON del chat:
1. Lee `chatHistory` del chat a punto de borrarse.
2. `extractGeneratedFileUrls()` — regex sobre mensajes `assistant` buscando el patrón `[Ver documento](url)`.
3. `publicUrlToFilePath()` — convierte la URL pública (`http://localhost:3005/outputs/...`) a ruta de disco real.
4. Borra cada archivo encontrado con `fs.unlinkSync` antes de borrar el `.json` del chat.
5. Cualquier error en la limpieza se loggea pero no bloquea el borrado del chat.

**Validado en producción:** el usuario borró varios chats de prueba desde la app; los 24 archivos de transcripción correspondientes se borraron correctamente de `outputs/transcriptions/`, confirmando el comportamiento esperado.

**Limitación conocida:** los chats borrados *antes* de este fix dejaron archivos huérfanos que no se pudieron limpiar retroactivamente — requirió revisión manual una única vez.

**Gap encontrado (no corregido en esta versión):** `deleteProject` borra la carpeta del proyecto de forma recursiva (`fs.rmSync`) sin pasar por esta limpieza — si un proyecto contiene chats con
---

## v2.16.1 — Fix empaquetado Electron (electron-builder)

### Contexto
El punto del ROADMAP "Electron Builder — generar `.exe` Windows portable" estaba marcado `[x]` desde v2.10.0, pero nunca se había vuelto a verificar tras la migración a `node-llama-cpp` y la separación de `backend/` como paquete npm propio. Al intentar regenerar el build desde la migración de disco H:\ → J:\, el `.exe` no abría — reveló que el empaquetado nunca estuvo realmente resuelto para la arquitectura actual.

### Problema 1 — ICU: el `.exe` moría al abrir
**Síntoma:** `[ERROR:base\i18n\icu_util.cc:232] Invalid file descriptor to ICU data received.` — Electron no encontraba `icudtl.dat`.

**Diagnóstico:** `dist\win-unpacked\` no tenía `icudtl.dat`, `v8_context_snapshot.bin` ni los `.pak` de Chromium, pese a que `node_modules\electron\dist\` (la fuente) sí los tenía completos y con el tamaño correcto. Se descartó que fuera el caché de `electron-builder` (`%LOCALAPPDATA%\electron-builder\Cache`) porque ni siquiera existía una carpeta `electron` ahí — el proyecto usa el Electron de `node_modules` directo, no un caché propio de `electron-builder`.

**Opciones evaluadas:**
- Cambiar target `portable` → `dir` — descartada, mismo resultado (el problema es en el paso de copiado, no en el de autoextracción del portable).
- Limpiar caché de `electron` (`%LOCALAPPDATA%\electron\Cache`, `~/.cache/electron`) y forzar redescarga — descartada, mismo resultado.

**Causa raíz:** Windows Defender bloqueaba/truncaba silenciosamente la copia de esos archivos binarios (`.dat`/`.bin`/`.pak`) durante el paso de empaquetado — comportamiento documentado en la comunidad de `electron-builder` (issue #460: "icudtl.dat: file changed as we read it").

**Solución:** agregar exclusión de Windows Defender para la carpeta del proyecto (`J:\Proyectos\IA\Tempest`). No es un fix de código — es un requisito de entorno en cualquier máquina donde se compile el build.

### Problema 2 — `Cannot find module 'dotenv'`
**Síntoma:** con el ICU resuelto, el `.exe` fallaba con `Error: Cannot find module 'dotenv'` al requerir `backend/server.js`. `backend/node_modules/` no existía en absoluto dentro de `dist\win-unpacked\resources\app\`.

**Diagnóstico:** el log de `electron-builder` mostraba:
searching for node modules  pm=npm searchDir=J:\Proyectos\IA\Tempest
searching for node modules  pm=traversal searchDir=J:\Proyectos\IA\Tempest
no node modules returned while searching directories  searchDirectories=[""]

**Causa raíz:** `electron-builder` filtra automáticamente qué `node_modules` incluir en el build basándose en el árbol de dependencias de producción del `package.json` del `appDirectory` (la raíz del proyecto). Como el `package.json` raíz solo declara `devDependencies` (`electron`, `electron-builder`) y `backend/` es un proyecto npm anidado con su propio `package.json` y `node_modules` separado, ese filtro automático no lo detecta — y termina excluyendo `backend/node_modules` por completo, aunque `"files": ["**/*"]` en teoría lo matchearía como glob literal. Este filtro de `node_modules` corre aparte del matching normal de `files` y tiene prioridad sobre él.

Esto confirma y cierra el "Problema encontrado" ya documentado en la entrada `v2.10.0` de arriba — en ese momento se había resuelto copiando `node_modules` manualmente, sin identificar la causa raíz real.

**Opciones evaluadas:**
- Agregar `"backend/node_modules/**/*"` explícito a `files` — probado en una sesión anterior, causó que `electron-builder` intentara procesar/comprimir `node-llama-cpp` completo (binarios CUDA, varios GB) durante más de una hora sin terminar. Descartada.
- `extraResources` copiando `backend/node_modules` como directorio crudo (elegida) — `extraResources`/`extraFiles` hacen una copia de archivos directa (`fs copy`), sin pasar por el filtro de dependencias de producción ni por el pipeline de `asar`/compresión. Como el target es `"dir"` (sin `asar`), es una copia recursiva simple, no hubo repetición del problema de la hora de build.

**Solución aplicada** — `package.json`, dentro de `build.extraResources`:
```json
{
  "from": "backend/node_modules",
  "to": "app/backend/node_modules"
}
```

**Validado:** `backend/node_modules/dotenv` presente tras rebuild (272 paquetes copiados). Los binarios CUDA de `@node-llama-cpp` (dentro de `backend/node_modules`) quedan incluidos por el mismo mecanismo, sin necesidad de una entrada separada — resuelve también ese punto pendiente de la entrada v2.10.0.

### Problema 3 — `MODELS_DIR` resolvía a una ruta incorrecta pese a `.env` correcto
**Síntoma:** con `backend/node_modules` ya presente, el modelo no cargaba. El log mostraba `[env] MODELS_DIR: J:\Proyectos\IA\Tempest\dist\win-unpacked\models-localai` (ruta sin sentido, no coincide con ninguna carpeta real), pese a que `resources\app\.env` tenía `MODELS_DIR=J:\Proyectos\IA\Tempest\models-localai` (correcto). Ninguna variable de entorno de Windows (`User`/`Machine`) pisaba el valor.

**Diagnóstico:** `backend/server.js` imprime `process.env.MODELS_DIR` en su línea 2 vía `console.log`, después de `require('dotenv').config(...)` en su línea 1 — en teoría debería reflejar el `.env`. Pero `shell/main.js` → `startBackend()` setea un fallback (`if (!process.env.MODELS_DIR) { process.env.MODELS_DIR = app.isPackaged ? path.join(path.dirname(process.execPath), 'models-localai') : ... }`) **antes** de requerir `server.js` (y por lo tanto antes de que `dotenv` cargue el `.env`). Como `dotenv.config()` no sobreescribe por defecto una variable ya presente en `process.env`, el fallback de `main.js` ganaba siempre, silenciosamente.

**Causa raíz:** orden de ejecución — el fallback de `MODELS_DIR` en `main.js` corre antes de que `dotenv` cargue el `.env` real, que vive un paso después dentro de `server.js`.

**Solución aplicada** — `shell/main.js`, primera línea de `startBackend()`:
```javascript
require(path.join(__dirname, '../backend/node_modules/dotenv'))
  .config({ path: path.join(__dirname, '../.env') });
```
(se requiere con ruta explícita porque `dotenv` vive solo en `backend/node_modules`, no es resoluble como `require('dotenv')` a secas desde `shell/`). `server.js` sigue llamando a `dotenv.config()` una segunda vez — es inofensivo (variables ya pobladas, no-op), queda como limpieza cosmética pendiente centralizar la carga de `.env` en un solo lugar.

**Validado:** `[env] MODELS_DIR: J:\Proyectos\IA\Tempest\models-localai` — valor correcto del `.env` tras el fix.

### Problema 4 — `ENOENT` en `backend/data/users.json`
**Síntoma:** `auth.service.js` → `saveUsers()` fallaba con `ENOENT` en el primer arranque, porque `backend/data/` (excluida del build a propósito, vía `"!backend/data/**/*"` en `files`, para no filtrar datos reales de usuario) no existe en un build limpio.

**Solución aplicada** — `backend/services/auth.service.js`, dentro de `saveUsers`:
```javascript
function saveUsers(users) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}
```

**Nota importante — no todo necesitaba fix:** al auditar el resto del código (`grep -rn "mkdirSync"` en todo `backend/`), se confirmó que `backend/data/users/` (chats y memoria por usuario) ya se autocreaba en `memory.service.js` (líneas 15 y 611), y `backend/outputs/transcriptions/` ya se autocreaba en `transcription.service.js` (líneas 37 y 256) — ambos con `fs.mkdirSync(..., { recursive: true })` ya implementado, probablemente agregado durante la migración a `node-llama-cpp` entre v2.14.1 y v2.16.0. Los `mkdir` manuales hechos durante esta sesión de debugging para esas dos carpetas no eran necesarios — solo `auth.service.js` tenía el gap real.

**Validado:** `[auth] Usuario admin creado con contraseña por defecto: admin` — carpeta y archivo creados automáticamente en un build limpio, sin ningún paso manual.

### Falso positivo — drag & drop de archivos no funcionaba en el `.exe`
**Síntoma:** arrastrar un PDF al chat no hacía nada — sin chip de adjunto, sin errores en consola (ni en el proceso principal ni en la consola de DevTools del renderer), el cursor mostraba el ícono de "prohibido" (⊘) al arrastrar sobre la ventana.

**Diagnóstico:** se descartó código (`contextIsolation`/`nodeIntegration` idénticos en dev y empaquetado; `attachments.js` no usa ninguna API de Electron específica para leer el archivo, solo `dataTransfer.files` estándar) y se descartó que faltaran scripts (`Sources` de DevTools confirmó que `attachments.js` cargaba bien). El cursor de "prohibido" sin ningún error es la señal característica de un bloqueo a nivel de sistema operativo, no de la aplicación.

**Causa raíz:** el `.exe` se estaba ejecutando desde una consola de PowerShell corriendo como Administrador (confirmado con `([Security.Principal.WindowsPrincipal]...).IsInRole(...Administrator)` → `True`). Windows bloquea el drag-and-drop de archivos entre procesos de distinto nivel de integridad (UIPI — User Interface Privilege Isolation): el Explorador de Windows corre sin elevar, y no puede soltar archivos sobre una ventana con privilegios de Administrador.

**Resultado:** no es un bug de la aplicación. Confirmado que funciona normal ejecutando el `.exe` sin privilegios elevados (como lo haría cualquier usuario real haciendo doble clic).

### Pendiente real que queda tras esta sesión
- `MODELS_DIR` sigue configurado como ruta absoluta de esta máquina (`J:\Proyectos\IA\Tempest\models-localai`) — no es portable a otra máquina todavía. Ver ROADMAP.md → "Instalador que incluye modelos GGUF o los descarga en primer arranque".
- Dónde debe vivir la carpeta de datos del usuario (`backend/data/`) en un instalador real para que sobreviva a rebuilds/actualizaciones — hoy vive dentro de `dist/win-unpacked/resources/app/`, que se borra en cada build limpio. Candidato: `%APPDATA%\Tempest IA\`, fuera de la carpeta de instalación.
- Verificar que el addon nativo de `@napi-rs/canvas` (usado para OCR de PDF escaneado, ver entrada "Reemplazar Poppler por pdfjs-dist") viaja correctamente en el build empaquetado — no se probó específicamente en esta sesión, aunque `extraResources` copiando todo `backend/node_modules` probablemente ya lo resuelve como efecto secundario.
- Firma de código para Windows (`signtool.exe` aparece en el log de cada build, pero no se confirmó si es una firma de confianza real o un certificado de prueba/local que no evita las alertas de SmartScreen).

### Archivos modificados en esta sesión
- `package.json` — nueva entrada en `build.extraResources` para `backend/node_modules`
- `shell/main.js` — carga de `dotenv` movida al inicio de `startBackend()`, antes del fallback de `MODELS_DIR`
- `backend/services/auth.service.js` — `fs.mkdirSync(recursive: true)` en `saveUsers`

## v2.16.2 — Fix transcripción en .exe + diagnóstico búsqueda web

### Transcripción genera archivos vacíos en el .exe empaquetado

**Problema:** `WHISPER_MODEL` en `transcription.service.js` se definía como `path.join(__dirname, '../../models-localai/whisper/ggml-large-v3.bin')` — ruta relativa al archivo fuente. En dev resuelve correctamente a la carpeta real del proyecto, pero en el `.exe` empaquetado `__dirname` apunta a `resources/app/backend/services`, así que la ruta terminaba en `resources/app/models-localai/whisper/...`, carpeta que no existe (electro-builder excluye `models-localai/` de `files`, y `extraResources` solo copia `*.yaml`, nunca el `.bin` de 3GB). `whisper-cli.exe` fallaba "failed to initialize whisper context" en los 13 chunks de cada transcripción, generando `.txt`/`.pdf` vacíos — sin error visible para el usuario más que un archivo en blanco.

**Causa raíz:** mismo patrón que el bug de `MODELS_DIR` resuelto en v2.16.1 para los modelos de chat — una ruta a modelo calculada de forma independiente en vez de usar la variable de entorno ya centralizada.

**Fix:** `WHISPER_MODEL = path.join(process.env.MODELS_DIR, 'whisper', 'ggml-large-v3.bin')`. `MODELS_DIR` ya se resuelve correctamente desde v2.16.1 (dotenv cargado antes que cualquier módulo del backend).

**Validado:** rebuild completo (`npm run build`), transcripción de audio real en `.exe` — archivo generado con contenido correcto.

### Búsqueda web no se activaba — diagnóstico

**Síntoma:** con el toggle 🌐 activo, ninguna pregunta disparaba búsqueda real (cero logs `[search]`/`[WEB SEARCH]`), el modelo respondía con conocimiento desactualizado.

**Causa raíz real:** la API key de Tavily estaba vacía en Servicios — `chat.controller.js` línea 202 requiere `config.webSearch && config.searchProvider && searchCfg.globalEnabled && ...` antes de llamar a `search.service.js`; sin key configurada el flujo nunca llegaba a intentar la búsqueda (aunque tampoco logueaba el motivo del fallo — punto débil a mejorar).

**Confusión durante el diagnóstico:** después de agregar la key y confirmar "✓ Conexión exitosa" en Servicios, la búsqueda seguía sin dispararse con la misma pregunta. Se determinó que `frontend/modules/webSearch.js` calcula `_provider`/`_enabledProviders` una sola vez al cargar la app (`initWebSearch()`); cambios en Servicios sin reiniciar la app dejan ese estado desactualizado. Reiniciar la app resolvió la inconsistencia. Pendiente confirmar si el mecanismo "sin recarga al guardar config" (documentado en v2.6.0-v2.7.0) realmente funciona — ver ROADMAP v3.0.

**Validado:** dos preguntas seguidas sin reiniciar entre medio, ambas con `[WEB SEARCH] provider=tavily | 6 resultados` en el log y respuestas reflejando información real de búsqueda (no genéricas).

**Nota aparte:** el modelo (`qwen2.5-7b-q5`) a veces ignora los resultados de búsqueda inyectados y responde con conocimiento desactualizado (ej. pregunta sobre versión de Node.js) — esto es un problema YA documentado en ROADMAP.md (pendientes v3.0, sección Búsqueda web), no relacionado con este fix.

## 🖥️ Splash screen de carga de modelos + chequeo de inventario (v2.17.0)

### Decisión
Ventana de splash frameless que se muestra desde `app.whenReady()` hasta que el modelo
default terminó de cargar en VRAM, con barra de progreso real vía `onLoadProgress` de
node-llama-cpp (degrada a indeterminada si el motor no dispara el callback). Sumado un
chequeo de inventario no bloqueante que verifica al arrancar si todos los `.gguf`
conocidos existen en disco.

### Opciones evaluadas
- Splash con solo texto de estado vs. con barra de progreso real — elegida la de progreso
  real: modelos de 8-14B tardan varios segundos y un mensaje estático no comunica avance.
- IPC (preload + contextBridge) para comunicar progreso entre main process y splash vs.
  `fetch` directo del splash a `/health` — elegido `fetch` directo: el splash no necesita
  ningún privilegio de Node, reutiliza el mismo contrato HTTP que ya usa `waitForBackend`,
  y evita agregar código a `preload.js`.
- Bloquear el arranque si falta CUALQUIERA de los modelos conocidos vs. solo advertir —
  elegido advertir sin bloquear: los modelos no-default son opcionales, se cargan bajo
  demanda vía `switchModel()`. Bloquear obligaría a tener los ~15 `.gguf` completos
  (decenas de GB) solo para poder abrir la app.

### Implementación
- `llama.provider.js` — nueva variable `_progress` (0..1), alimentada por `onLoadProgress`
  en `init()` y `switchModel()`, expuesta en `getStatus()`.
- `server.js` — `/health` expone `aiProgress` y `modelsInventory` (este último cacheado
  una sola vez al arrancar, no recalculado en cada request).
- `models.inventory.js` (nuevo, `backend/services/localai/`) — `checkModelsInventory()`:
  recorre `getKnownModelIds()` de `localai.service.js`, resuelve cada ruta con
  `resolveModelPath()` (reutilizado, sin duplicar el mapeo), verifica con
  `fs.existsSync()`. No carga ningún modelo, solo confirma que el archivo exista.
- `localai.service.js` — `MODEL_FILES` (antes `modelFiles`, variable local dentro de
  `resolveModelPath`) elevado a constante de módulo para poder exportarlo y reusarlo desde
  `models.inventory.js`; corregida de paso una entrada duplicada (`qwen2.5-14b-q3` estaba
  repetida dos veces con el mismo valor).
- `shell/main.js` — `createSplashWindow()` (ventana frameless 420×280, `show:false` hasta
  `ready-to-show`), `waitForModelReady()` (polling de `/health` hasta `ai==='ready'` o
  `'error'`, 600 intentos × 500ms = 5 min de margen), `createWindow()` ahora nace oculta y
  se muestra recién en su propio `ready-to-show`, momento en que cierra el splash.
- `shell/splash.html` (nuevo) — polling propio a `/health` cada 400ms, sin preload ni IPC;
  barra determinada si `aiProgress > 0`, indeterminada si no; línea de aviso si
  `modelsInventory.ok === false`.

### Bugs encontrados durante la implementación
- **`startBackend()` fuera del `try/catch` en `app.whenReady()`** — bug preexistente
  (ya estaba así antes de este trabajo). Si `require('../backend/server.js')` fallaba de
  forma síncrona (se reprodujo real durante las pruebas: un rename accidental de
  `server.js`), la excepción escapaba como `UnhandledPromiseRejectionWarning` sin pasar
  por el catch, y la app quedaba con el splash girando para siempre — sin diálogo de error
  ni cierre. Fix: mover `startBackend()` adentro del mismo `try` que ya envuelve
  `waitForBackend()` / `waitForModelReady()` / `createWindow()`.
- **`checkModelsInventory` como `undefined` tumbaba el arranque completo** — al integrar
  el chequeo de inventario, un archivo `models.inventory.js` creado vacío por error hizo
  que `checkModelsInventory` fuera `undefined`. Al llamarlo dentro de
  `initDefaultAdmin().then(...)` sin try/catch propio, la excepción cortaba el callback
  completo y `llamaProvider.init()` nunca llegaba a ejecutarse — el modelo quedaba en
  `'loading'` por defecto (no por estar cargando de verdad), y `waitForModelReady()`
  tardaba los 5 minutos completos en tirar un timeout genérico que no reflejaba la causa
  real. Fix: envolver el chequeo de inventario en su propio `try/catch`, para que un fallo
  ahí nunca bloquee la carga del modelo principal.
- **Lección de testing, no bug de código:** VS Code actualiza automáticamente las
  referencias `require()` cuando se renombra un archivo desde el Explorador — al renombrar
  `backend/server.js` para simular un fallo, `require('../backend/server.js')` en
  `main.js` quedó apuntando a `.gguf`, y no se revirtió solo al restaurar el nombre del
  archivo. Revisar también los `require()`/imports después de cualquier rename manual de
  archivos durante pruebas.

### Pendiente
- `capability.matrix.js` sigue con `provider: 'localai'` como nombre histórico — sin
  tocar en esta iteración, anotado para la separación Motor/Modelo (v4.0, ver ROADMAP.md).
- El campo `engine` en `MODEL_FILES` evaluado y pospuesto a propósito — mismo motivo.

---

## 📂 Lectura de carpeta vinculada por proyecto

### Decisión
Implementar `fs.provider.js` (hoy stub en `context/providers/`) como un provider nuevo,
separado de `snapshot.provider.js`, que lea una carpeta del disco vinculada manualmente
por el usuario a un proyecto. Sin servidor HTTP adicional: el backend ya corre en el mismo
proceso que tiene acceso al filesystem (Electron main / Node), así que la lectura es una
llamada local directa, igual que ya hace `snapshot.provider.js`.

Se descarta la lectura del disco en cada mensaje. En su lugar, arquitectura de dos capas:
- **`linked-folder.service.js`** (nuevo) — escaneo pesado: recorre la carpeta, aplica
  `ignoreGlobs`/límites, pasa binarios (PDF, DOCX, PPTX, imágenes) por los extractors
  existentes en `attachment/extractors/` (mismo pipeline que adjuntos, sin duplicar
  lógica de extracción), genera un índice/manifest y lo persiste. Se dispara solo con
  un botón "Actualizar carpeta" en el modal de context files — nunca automático por
  mensaje. `fs.watch` con debounce queda anotado como posible mejora futura, no parte
  de esta iteración.
- **`fs.provider.js` → renombrado a `linked-folder.provider.js`** — liviano, solo lee el
  manifest ya generado y lo entrega al Assembler. No toca el filesystem en cada request.

Config nueva en `projectSettings.json`:
```json
"linkedFolder": {
  "path": "...",
  "enabled": true,
  "scanMode": "deep",
  "maxDepth": 3,
  "maxFiles": 200,
  "maxFileSize": 5242880,
  "ignoreGlobs": ["node_modules", ".git", "dist"],
  "lastIndexed": "...",
  "contentHash": "...",
  "totalFiles": 0,
  "totalSize": 0,
  "status": "ok",
  "lastError": null
}
```

### Opciones evaluadas
Propuesta discutida en paralelo con Claude, Grok y ChatGPT; se comparó lo que cada uno
proponía antes de fijar el diseño final.

- **Nombre `fs.provider.js`** — descartado. En Node "fs" implica el filesystem completo;
  este provider hace algo específico (una carpeta vinculada por el proyecto). Elegido
  `linked-folder.provider.js`.
- **Fusionar con `snapshot.provider.js`** (propuesta de Grok) — descartada. Snapshot
  representa un repo indexado; la carpeta vinculada es una fuente viva y distinta, con
  su propio ciclo de refresh y su propio toggle `enabled`. El Assembler existe
  precisamente para combinar fuentes heterogéneas sin acoplarlas — fusionarlas ahorra un
  archivo pero rompe esa separación y complica agregar "múltiples carpetas vinculadas"
  más adelante.
- **Leer el disco directo en cada request de contexto** (como se planteó en la primera
  pasada de la propuesta) — descartada. Con carpetas de decenas/cientos de archivos,
  releer y volver a extraer (PDF/DOCX incluidos) en cada mensaje del usuario escala mal.
  Elegido el patrón service (escanea + indexa, bajo demanda) / provider (lee índice, sin
  tocar disco), igual al que ya usa snapshot con `context/index.json`.
- **Provider con lógica de escaneo propia** — descartada. Se separa a propósito en
  `linked-folder.service.js` (construye el manifest) y `linked-folder.provider.js` (solo
  lo lee), para que el provider siga el mismo contrato liviano que ya cumplen
  `upload.provider.js` y `snapshot.provider.js`.
- **Refresh automático (`fs.watch` sin confirmación del usuario)** — descartado para esta
  iteración. Costoso en carpetas grandes y puede disparar indexado en momentos
  inoportunos. Solo botón manual por ahora; watch con debounce queda anotado como mejora
  futura opcional.
- **Pipeline de extracción propio para archivos de la carpeta vinculada** (distinto al de
  adjuntos) — descartado. Debe existir un solo camino para PDF/DOCX/PPTX/imágenes →
  texto: los extractors de `attachment/extractors/`, reusados también aquí.
- **Ruta guardada solo como absoluta** — riesgo anotado, no resuelto todavía: rompe
  portabilidad si el proyecto se mueve a otra máquina. Pendiente definir si se guarda
  también una versión relativa, mismo problema ya documentado con `MODELS_DIR`.

### Implementación (backend completo)
- **`linked-folder.service.js`** (nuevo, `backend/services/context/`) — `generateLinkedFolderIndex()`:
  crawl con `ignoreGlobs` (glob-to-regexp propio, sin dependencia nueva),
  `EXCLUDED_DIRS` igual que snapshot, `maxDepth`, containment check en symlinks
  (reusa `isPathSafe` de `fs.provider.js` en vez de duplicarlo), selección final de
  archivos por recencia (mismo criterio que `snapshot.service.js`), válvula de
  seguridad `HARD_VISIT_CEILING=5000` entradas visitadas independiente de `maxFiles`.
  Extracción vía `attachment.service.extractText()` (mismo pipeline que adjuntos —
  PDF/DOCX/PPTX/imágenes con OCR, sin pipeline paralelo), con diffing por
  `mtimeMs`+`sizeBytes` para no re-extraer archivos sin cambios. Contenido cacheado en
  `context/linked-folder-files/<md5(relPath)>.txt`, manifest en `context/linkedFolder.json`.
- **`linked-folder.provider.js`** (nuevo, `providers/`) — liviano: lee `index.json`
  (`source: 'linked-folder'`) + manifest + contenido cacheado. Cero llamadas a `fs`
  sobre la carpeta original — el costo de crawl/OCR se paga solo en el refresh manual.
- **`assembler.js`** — agregado al `Promise.all` junto a upload/fs/snapshot. `budget()`
  y `contextFileTypes` (en `chat.controller.js`) ya eran agnósticos al `source` de cada
  item — no requirieron cambios.
- **`context.service.js`** — `linkedFolder` agregado a `getDefaultSettings()`.
  `loadSettings()` hace merge defensivo (`if (!parsed.linkedFolder) ...`) para proyectos
  cuyo `projectSettings.json` ya existía en disco antes de este cambio.
- **`context.controller.js`** — `refreshLinkedFolder` (POST, valida que la ruta exista y
  sea directorio, corre el scan, registra/actualiza/limpia items en `index.json` igual
  que `createSnapshot`, persiste `status`/`lastError`/`lastIndexed`/`contentHash` en
  settings — un scan fallido no borra lo que ya estaba indexado antes del intento) y
  `toggleLinkedFolder` (POST, mismo patrón que `toggleSnapshot`). `updateSettings`
  extendido para aceptar config de `linkedFolder` (`enabled`, `scanMode`, `maxDepth`,
  `maxFiles`, `maxFileSize`, `ignoreGlobs`) — deliberadamente **sin** permitir `path` ni
  los campos de estado ahí, para que un PATCH genérico no desincronice settings del
  manifest real (esos campos son propiedad exclusiva de `refreshLinkedFolder`).
- **`context.routes.js`** — `POST /project/:projectId/context/linked-folder/refresh` y
  `POST /project/:projectId/context/linked-folder/toggle`. El picker de carpeta reusa
  `GET /fs/browse`, ya existente — no hizo falta ruta nueva para eso.

### Bugs encontrados durante las pruebas (y corregidos)
Se probó `linked-folder.service.js`/`.provider.js` con datos reales (fixture con
código, docs, `node_modules`, `.git`, `.env`, `secrets.txt`, un symlink interno que
escapa de la raíz vinculada, y un segundo/tercer refresh con archivos modificados y
borrados). Aparecieron 2 bugs reales, no solo teóricos:

- **`**/secrets*` no excluía `secrets.txt` en la raíz** — `globToRegExp()` convertía
  `**` → `.*` dejando un `/` literal pegado (`^.*/secrets[^/]*$`), que exige sí o sí un
  directorio antes. Un archivo sensible en la raíz de la carpeta vinculada se colaba al
  contexto sin que el usuario lo supiera. Fix: `**/` y `/**` se resuelven como grupos
  opcionales (`(?:.*/)?` / `(?:/.*)?`) antes que un `**` suelto, igual que `.gitignore`.
- **Containment check comparaba un path resuelto (`realpathSync`) contra uno sin
  resolver** — `isPathSafe(real, rootPath)` usaba `rootPath` tal cual, no su realpath.
  Si la carpeta vinculada vive detrás de un symlink/junction (común en Windows, y
  reproducido en el sandbox de pruebas vía FUSE), la comparación podía dar falsos
  negativos con symlinks internos legítimos, o — peor — falsos positivos que dejan
  pasar un symlink que sí escapa. Fix: se calcula `realpathSync(resolvedRoot)` una sola
  vez en `generateLinkedFolderIndex()` y se compara siempre realpath-contra-realpath.
- Verificado con el fix: un symlink dentro de la carpeta vinculada apuntando a una
  carpeta realmente externa se detecta y se ignora con warning en logs.

### Cómo se probó
El sandbox de pruebas no tiene el binario nativo `sharp` compilado para Linux (usado
por `image.extractor.js`, atado a Windows en la máquina real) — se stubeó
`attachment.service.extractText()` para poder probar crawl/`ignoreGlobs`/`maxDepth`/
symlinks/diffing/limpieza sin ese binario. **La extracción real de PDF/DOCX/OCR no se
probó en este sandbox — queda pendiente de una prueba manual en la máquina real.**
Igual se confirmó que el pipeline de extracción es el mismo que usan los adjuntos
(`attachment.service.js`, sin pipeline paralelo).

Se encontró además que el mount de este sandbox bloquea `unlink` de forma sistemática
(falla `EPERM` incluso en archivos recién creados, sin relación con el código). Eso
impidió verificar en vivo la limpieza de contenido cacheado huérfano — la lógica se
ejecuta y el manifest queda correcto (el archivo removido sale del `files` del
manifest), pero no se pudo confirmar el borrado físico del `.txt` cacheado en este
entorno. Aprovechando el hallazgo, se cambió el `catch` silencioso de ese `unlinkSync`
por uno que loguea el error — antes un fallo de borrado (permiso, antivirus con lock)
quedaba completamente invisible.

### Implementación (frontend)
- **`frontend/index.html`** — nueva sección "Carpeta vinculada" en `contextFilesModal`,
  justo debajo de "Context Snapshot": toggle, input de ruta, botón de examinar, botón
  "Vincular/Actualizar", línea de estado. Reusa las clases CSS existentes de la sección
  Snapshot (`context-snapshot-section`, `snapshot-status`, etc.) con IDs nuevos — no
  hizo falta tocar el CSS.
- **`frontend/modules/contextFiles.js`** — bloque nuevo `── Carpeta vinculada ──`
  insertado entre el bloque de Snapshot y el de la lista de archivos. Lee
  `settings.linkedFolder` vía `GET /project/:id/settings`, muestra estado
  (sin vincular / vinculada sin escanear / activa con contador y fecha / pausada /
  error con `lastError`), toggle llama a `POST .../linked-folder/toggle`, botón llama
  a `POST .../linked-folder/refresh`. El explorador de carpetas (diálogo nativo de
  Electron + fallback a dropdown de `/fs/browse`) se **duplicó** en vez de compartir
  función con el bloque de Snapshot — deliberado, para no tocar ese código ya probado
  y funcionando (ver nota de arriba sobre no eliminar/reescribir código existente).
  Queda anotado como oportunidad de refactor a un helper compartido más adelante.
- Badge en la lista de items: `item.source === 'linked-folder'` ahora muestra "carpeta"
  junto al nombre, igual que el badge "snapshot" ya existente.

### Pendiente
- Extraer el explorador de carpetas (duplicado entre Snapshot y Carpeta vinculada) a un
  helper compartido — deuda técnica menor, aceptada a propósito por seguridad de no
  tocar código funcionando en la misma sesión que se agregó el feature nuevo.

### Unificación de UI — un solo input/botón para ambos scans
Feedback directo tras ver el modal corriendo: dos cajas casi idénticas pidiendo "señalá
una carpeta" es mala UX aunque la separación interna esté justificada — en la práctica
el usuario casi siempre quiere escanear la misma carpeta para código y documentos a la vez.

**Decisión:** una sola sección "Carpeta del proyecto" con un input + botón de examinar +
botón "↻ Escanear carpeta". Al hacer clic dispara `POST .../context/snapshot` y
`POST .../context/linked-folder/refresh` en paralelo (`Promise.allSettled`) contra la
misma ruta — si uno falla, el otro igual se completa y cada error se muestra por
separado. Los dos toggles ("Código (patch mode)" / "Documentos") y las dos líneas de
estado siguen siendo independientes, porque siguen siendo dos sistemas distintos por
dentro (mismo motivo que en la decisión de arriba: patch mode no se toca).

**Lo que se eliminó:** los dos inputs de ruta separados (`contextSnapshotRootInput`,
`contextLinkedFolderRootInput`) y sus dos botones de examinar — quedó uno solo
(`contextProjectFolderInput` / `contextProjectFolderBrowse`). Como efecto secundario
positivo, esto también resolvió la duplicación del explorador de carpetas anotada
arriba como deuda técnica — ya no hay dos copias del dropdown de `/fs/browse`, hay una.

**Implementación:**
- `frontend/index.html` — las dos secciones (`contextSnapshotSection`,
  `contextLinkedFolderSection`) se reemplazaron por una sola
  (`contextProjectFolderSection`) con dos filas internas (`context-subsource-row`,
  clase nueva chica agregada a `modals.css`) para los toggles/estados de código y
  documentos.
- `frontend/modules/contextFiles.js` — bloque único que reemplaza los dos bloques
  anteriores (`── Snapshot ──` y `── Carpeta vinculada ──`). Un solo explorador de
  carpetas compartido, dos funciones de estado (`refreshSnapshotStatus`,
  `refreshLinkedFolderStatus`) que ahora escriben al mismo `folderInput` compartido
  (snapshot tiene prioridad para prellenar si ambas rutas están vacías).
- `frontend/styles/modals.css` — una clase nueva (`.context-subsource-row`), sin tocar
  nada existente.

### Bug encontrado post-implementación: checkboxes más grandes de lo esperado
Al ajustar el tamaño del checkbox de "Documentos" se descubrió (vía DevTools →
Computed, con el usuario guiado paso a paso) que el ancho renderizado real era 26px,
no los 16px que `.context-toggle input[type="checkbox"]` declara. Causa: `.modal-box
input, .modal-box select, .modal-box textarea` (línea 37, pensada para inputs de texto)
no tiene restricción de tipo, así que también le aplica `padding: 12px` a cualquier
`<input type="checkbox">` dentro del modal. Con `box-sizing: border-box` global, si
`padding + border` (12+12+1+1=26px) supera el `width` declarado, el navegador fuerza la
caja a crecer hasta caber el padding — gana la especificidad en la declaración de
`width`, pero el resultado visual queda determinado por el padding igual.

**Esto afectaba también a los checkboxes "activo"/"siempre" de la lista de archivos**,
no solo a los nuevos — probablemente estuvieron renderizando ~26px en vez de los 16px
de diseño desde antes de esta sesión; la diferencia era menos notoria ahí que en el
checkbox de 11px de "Carpeta del proyecto", por eso recién se detectó ahora.

**Fix:** `padding: 0;` agregado a la regla base `.context-toggle input[type="checkbox"]`
(línea ~179) — corrige los checkboxes existentes de la lista de archivos de paso, no
solo los nuevos.

**Nota para futuros cambios de CSS:** el link de `modals.css` en `index.html` tiene un
query string de versión (`?v=N`) para evitar que Chromium sirva una copia cacheada del
archivo — subir el número cada vez que se edite este CSS.
- `contentHash` se calcula pero todavía no se usa para nada (pensado para detectar
  cambios sin recorrer todo — no hay caller que lo aproveche aún).
- No hay `fs.watch` — refresh es 100% manual por ahora, como se decidió.
- Ruta guardada como absoluta — mismo problema ya documentado con `MODELS_DIR`: no
  portable si el proyecto se mueve a otra máquina. No resuelto en esta iteración.
- **Validar en la máquina real**: extracción de PDF/DOCX/PPTX/imágenes (OCR) con los
  binarios reales (`sharp`, Poppler) — no se pudo probar en el sandbox de desarrollo.
  Smoke test recomendado: vincular una carpeta con al menos un PDF escaneado y un DOCX
  con imágenes antes de dar el feature por cerrado.

### Reversión de la unificación — cada fuente vuelve a tener su propia ruta
La unificación (sección anterior) partía de un supuesto que no se sostuvo en uso real:
que código y documentos casi siempre viven en la misma carpeta. El usuario probó con
rutas genuinamente distintas (`H:/Proyectos/IA/Tempest` para código, `D:/Documentos/...`
para documentos) y el input compartido rompió el feature: al escribir la segunda ruta
se perdía la primera, activar/desactivar un toggle no coincidía con la carpeta que el
usuario creía tener puesta, y el botón "Escanear" único terminaba re-escaneando la
carpeta equivocada para uno de los dos sistemas. Reporte exacto del usuario: *"cada
archivo de contexto no guarda su propia ruta... si le doy escanear me escaneará otra
carpeta que no elegí."*

**Decisión:** revertir a dos inputs independientes — cada fuente (Código / Documentos)
tiene su propio input de ruta, su propio botón de examinar, su propio botón de escanear
y su propia línea de estado. Nunca comparten valor ni disparan el scan de la otra. Se
conserva únicamente el agrupamiento visual (misma caja `.context-snapshot-section`) para
no volver a la sensación original de "dos bloques duplicados" — la solución a esa queja
era visual, no de compartir estado.

**Lo que NO se revirtió:** el explorador de carpetas (diálogo nativo Electron + fallback
dropdown `/fs/browse`) se mantuvo como una sola función reutilizable
(`attachFolderBrowser(inputEl, browseBtnEl)`), llamada una vez por cada input. Esto
resuelve la deuda técnica de "explorador duplicado" (anotada en Pendiente más arriba) sin
reintroducir el bug de ruta compartida, porque cada llamada opera sobre su propio
`inputEl` cerrado por clausura — no hay estado global entre las dos instancias.

**Implementación:**
- `frontend/index.html` — `contextProjectFolderSection` ahora contiene dos
  `.context-source-row` completas (label+input+examinar+escanear), cada una con IDs
  propios: `contextSnapshotRootInput`/`contextSnapshotBrowse`/`contextSnapshotBtn` para
  Código, `contextLinkedFolderRootInput`/`contextLinkedFolderBrowse`/`contextLinkedFolderBtn`
  para Documentos. Cada fila tiene su propio `.context-source-row-status` debajo.
- `frontend/styles/modals.css` — `.context-subsource-row` (de la unificación) reemplazada
  por `.context-source-row` / `.context-source-row-label` / `.context-source-row-status`;
  mismo fix de tamaño de checkbox, solo rescoped a la clase nueva.
- `frontend/modules/contextFiles.js` — bloque "Carpeta del proyecto" reescrito completo:
  `attachFolderBrowser()` extraída como función parametrizada (antes vivía inline
  atada al input compartido), `refreshSnapshotStatus()`/`refreshLinkedFolderStatus()`
  vuelven a prellenar cada una su propio input, y los dos `onclick` de escanear son
  ahora independientes (`fetch` directo a su propio endpoint, sin `Promise.allSettled`
  combinado — ya no tiene sentido combinarlos porque no comparten ruta).
- Sintaxis verificada con `node --check` contra una copia reconstruida en un directorio
  aparte con `"type":"module"` en `package.json` (el editor detectó bytes nulos en la
  copia leída directo del punto de montaje — desajuste de sincronización ya documentado
  en sesiones anteriores, no un bug real; el contenido vía herramienta de lectura de
  archivos siempre fue correcto).

### Segunda reversión — diagnóstico correcto: el bug nunca fue "código vs documentos"
Probando en la app real con 3 proyectos (`documentacion`, `lectura`, `Prueba`), el usuario
reportó que el input mostraba la MISMA ruta sin importar qué proyecto abriera. Esto
demostró que el diagnóstico de la sección anterior (separar Código/Documentos en dos
inputs) atacaba el síntoma equivocado — el problema nunca fue que código y documentos
necesitaran rutas distintas dentro de un mismo proyecto (de hecho el usuario confirmó
que sí quiere una sola ruta compartida ahí, con dos checkboxes abajo). El problema real
tiene dos causas separadas, ninguna relacionada con cuántos inputs hay en el HTML:

**Causa 1 (la principal) — el input del modal nunca se limpiaba entre proyectos.**
`contextFilesModal` reutiliza los mismos elementos del DOM para todos los proyectos (ya
documentado arriba para `snapshotToggle`/`snapshotBtn`/`closeBtn`, pero el input de ruta
no seguía ese patrón). `refreshSnapshotStatus()` prellenaba con
`folderInput.value = folderInput.value || data.snapshotRoot || ''` — como el input nunca
se vaciaba al abrir el modal, si el proyecto A dejó algo escrito, `folderInput.value` ya
no estaba vacío cuando se abría el proyecto B, así que el `|| data.snapshotRoot` nunca se
ejecutaba y B heredaba visualmente la ruta de A. **Fix:** `folderInput.value = ''`
explícito al inicio de `openContextFilesModal()`, antes de cualquier prellenado.

**Causa 2 (secundaria) — el diálogo nativo de Electron no recibía `defaultPath`.**
`shell/main.js`, handler IPC `select-folder`, llamaba a `dialog.showOpenDialog` sin
`defaultPath`. Sin ese parámetro, Electron/Windows recuerda la última carpeta visitada de
forma GLOBAL para todo el proceso — un solo historial de navegación para los botones de
examinar de todos los proyectos. No causaba el bug principal (eso era la Causa 1), pero sí
hacía que el diálogo abriera en un lugar confuso. **Fix:** `preload.js` y el handler ahora
aceptan un `defaultPath` opcional; `contextFiles.js` manda el valor actual del input en
cada llamada a `electronAPI.selectFolder(...)`.

**Decisión final sobre el layout:** un solo input de ruta por proyecto, compartido a
propósito por Código y Documentos (el usuario normalmente escanea la misma carpeta para
ambos). Se revirtió el diseño de dos filas completas de la sección anterior — ese diseño
resolvía un problema que no existía y no tocaba la causa real. Layout: un
`.context-snapshot-section` con un input + botón examinar + botón "↻ Escanear carpeta"
arriba, y abajo dos `.context-subsource-row` (checkbox + estado, sin input propio) para
Código y Documentos — igual a como se veía en la unificación original, con el bug de raíz
corregido.

**Implementación:**
- `frontend/index.html` — `contextProjectFolderSection` vuelve a un solo
  `contextProjectFolderInput`/`contextProjectFolderBrowse`/`contextProjectFolderBtn`,
  con dos `.context-subsource-row` (`contextSnapshotToggle`+`contextSnapshotStatus`,
  `contextLinkedFolderToggle`+`contextLinkedFolderStatus`) debajo, sin inputs propios.
- `frontend/styles/modals.css` — `.context-source-row`/`.context-source-row-label`/
  `.context-source-row-status` (de la sección anterior) reemplazadas de vuelta por
  `.context-subsource-row`, mismo fix de tamaño de checkbox reescopeado.
- `frontend/modules/contextFiles.js` — `folderInput.value = ''` agregado al inicio del
  bloque (la línea que faltaba y causaba todo). Explorador de carpetas vuelve a una sola
  instancia (`attachFolderBrowser(folderInput, folderBrowse)`) en vez de dos. Un solo
  botón "Escanear carpeta" dispara snapshot y linked-folder/refresh en paralelo
  (`Promise.allSettled`) contra la misma ruta, cada error se reporta por separado.
- `shell/main.js` — `select-folder` acepta `defaultPath` opcional, se lo pasa a
  `dialog.showOpenDialog` solo si viene definido.
- `shell/preload.js` — `selectFolder` reenvía el `defaultPath` recibido por IPC.
- Sintaxis verificada con `node --check` sobre una reconstrucción del archivo en
  directorio aparte (mismo desajuste de sincronización del punto de montaje documentado
  antes — no es un bug real, el contenido vía herramienta de lectura de archivos siempre
  fue correcto).

**Lección para futuras sesiones:** cuando un input dentro de un modal reutilizado (mismo
patrón que `snapshotToggle`/`snapshotBtn`) muestra datos de otro contexto, sospechar
primero de "¿se está limpiando este campo al abrir el modal?" antes de asumir que la
solución es cambiar cuántos campos hay en el formulario.

### Pendiente (actualizado)
- Probar en la app real con los 3 proyectos existentes: cada uno debe mostrar su propia
  ruta guardada (o vacío si nunca se escaneó), nunca la del último proyecto abierto.
- Confirmar que el diálogo nativo (📁) abre en la ruta actual del input, no en la del
  proyecto anterior.
- Confirmar que "↻ Escanear carpeta" actualiza correctamente los dos checkboxes
  (Código/Documentos) según lo que realmente haya en la carpeta.

## 📚 Parche: maxFileSize dejaba fuera libros/PDFs grandes

### Bug reportado
Usuario escaneó una carpeta de libros (`LIBROS`, 10 PDFs) con carpeta vinculada y solo se
indexaron 4. El log decía `"Escaneo truncado — límites alcanzados (maxFiles=200)"`, lo cual
era engañoso: con 10 archivos nunca se iba a llegar a 200.

### Diagnóstico
`linked-folder.service.js` tenía `DEFAULTS.maxFileSize = 5MB`. De los 10 PDFs de la carpeta,
solo 4 pesaban menos de 5MB (Registros Akásicos 1.2MB, El arte de la guerra 320KB, Lenguaje
corporal 673KB, Ortografía 645KB) — el resto (Aritmética de Baldor 76MB, dos libros de C/C++,
El Encantador de perros) quedaron excluidos por tamaño, no por cantidad. El mensaje de log
además tenía un bug real: `truncated` se calculaba como `visited.truncated || crawled.length
> selected.length`, una condición que es `true` tanto si el corte fue por `maxFiles` como por
`maxFileSize`, pero el `console.warn` solo mencionaba `maxFiles` sin importar cuál fue la
causa real.

### Opciones evaluadas
- **Subir el límite por defecto (elegida)** — cambio de una constante, aplica a todos los
  proyectos, sin UI nueva.
- **Agregar control de UI para ajustar `maxFileSize` por proyecto** — descartada por ahora:
  significaría construir una UI para un límite que probablemente deja de existir del todo
  una vez implementado tool use con chunking (ver sección de abajo) — no tiene sentido
  invertir en UI para algo que la arquitectura futura reemplaza por completo, no solo ajusta.
- **Chunking del contenido en vez de límite de tamaño** — la solución de raíz real (ningún
  archivo se excluye nunca, se lee en pedazos), pero requiere selección por relevancia
  (embeddings/tool use) para no reventar el contexto del modelo con un libro entero. Queda
  como parte del diseño de tool use (ver más abajo), no como parche inmediato.

### Implementación
- `backend/services/context/linked-folder.service.js` — `DEFAULTS.maxFileSize` subido de
  `5 * 1024 * 1024` a `100 * 1024 * 1024` (100MB), con comentario explícito de que es un
  parche corto, no el rediseño final.
- Mismo archivo — `generateLinkedFolderIndex()`: se agregó `oversizedCount` (archivos
  descartados por tamaño) y `truncatedByCount` (candidatos dentro de tamaño que igual
  superan `maxFiles`) como variables separadas. El log ahora arma un array `causes` y
  reporta exactamente cuál(es) de las tres razones (tamaño / cantidad / HARD_VISIT_CEILING)
  causó el corte, en vez de asumir siempre `maxFiles`.
- `snapshot.service.js` (código) no tiene `maxFileSize` — no aplicaba el mismo bug ahí,
  confirmado antes de tocar nada.
- Verificado con `node --check` sobre una reconstrucción simplificada de la función en
  `/outputs` (mismo desajuste de sincronización del punto de montaje ya documentado varias
  veces en este archivo — no es un bug real del código).

### ¿Qué hace este cambio?
Sube el límite de tamaño por archivo de 5MB a 100MB en el escaneo de carpeta vinculada, y
corrige el mensaje de log para que diga la causa real del corte (tamaño, cantidad, o límite
de recorrido) en vez de siempre culpar a `maxFiles`.

### ¿Por qué funciona?
`crawled.filter(f => f.sizeBytes <= opts.maxFileSize)` ahora tiene un techo mucho más alto,
así que libros/PDFs reales (10-80MB típicamente) entran. El log separa las tres condiciones
que ya existían pero se colapsaban en un solo mensaje impreciso.

### ¿Dónde puede fallar?
Un archivo de más de 100MB (poco común pero posible con PDFs escaneados de muy alta
resolución) seguiría quedando afuera — sigue siendo un techo, no una solución sin límite.
También: OCR/extracción de un PDF de 90MB puede tardar mucho (mismo tema ya documentado de
procesamiento secuencial sin indicador de progreso) — subir el límite de tamaño no acelera
la extracción, solo permite que empiece.

## 🔧 Tool use — diseño acordado (pendiente de implementar)

### Contexto
Evaluando por qué el snapshot/carpeta vinculada solo lee "los primeros N archivos" en vez
de decidir qué necesita según la pregunta del usuario, se identificó que el mecanismo que
resuelve esto se llama **tool use / function calling** — el mismo patrón con el que este
asistente (Claude, vía Cowork) explora y modifica el proyecto Tempest en estas sesiones
(Read/Grep/Glob encadenados según lo que se va encontrando). `node-llama-cpp` (motor local
de Tempest) soporta esto de forma nativa vía `functions` en `LlamaChatSession.prompt()`, con
soporte "oficial" (más confiable) para modelos basados en Llama 3 Instruct — el modelo
principal actual, `Hermes-3-Llama-3.1-8B`, cae en esa categoría.

### Decisión de alcance — solo lectura
Tool use se limita a herramientas de solo lectura: listar archivos (desde el manifest, sin
tocar disco), leer archivo (por chunks), buscar texto (grep sobre lo indexado). **Nunca
escritura/modificación de código** — eso se queda exclusivamente en patch mode, que ya tiene
su propio flujo cuidado (backup obligatorio, requiere `snapshotRoot`, parser multi-formato).
Mezclar un segundo camino de escritura complicaría innecesariamente algo que ya funciona y
que ya está documentado como sensible a timeouts con contexto pesado.

### Rediseño de la UI del modal de contexto (acordado, no implementado)
- **Carpeta del proyecto** (antes con checkboxes "Código (patch mode)" / "Documentos" +
  texto de estado con contador de archivos): se eliminan ambos checkboxes individuales y el
  texto de estado/contador. Queda **un solo checkbox** que pausa/permite que tool use busque
  en lo que esté escaneado (código + documentos juntos) — la separación interna entre
  snapshot y linked-folder sigue existiendo por dentro (siguen siendo dos manifests
  distintos, snapshot sigue atado a patch mode), pero no necesita reflejarse en dos
  controles separados de cara al usuario, porque no hay caso de uso real donde se quiera
  buscar documentos pero no código (o viceversa) dentro del mismo proyecto.
- **Botón "+ Subir archivos"**: se reubica debajo de Carpeta del proyecto (antes arriba) —
  cambio puramente visual.
- **Lista de archivos**: deja de mostrar los archivos escaneados de Carpeta del proyecto
  (snapshot/linked-folder). Pasa a mostrar EXCLUSIVAMENTE los archivos subidos a mano
  (botón "+ Subir archivos" o arrastrar). Razón: si tool use puede buscar el archivo cuando
  lo necesita, no tiene sentido mantener el contenido de una carpeta completa "estático" en
  el índice — información de fondo que consumía contexto en cada mensaje sin importar si la
  pregunta la necesitaba (razonamiento correcto del usuario, alineado con la razón de ser de
  RAG/tool use frente a "meter todo en el contexto").
- **alwaysInclude ("siempre")**: SE MANTIENE, pero exclusivamente para Lista de archivos
  (subidos a mano). Razón: tool use depende de que el modelo decida buscar algo — con un
  modelo local de 8B esa iniciativa es menos confiable que con un modelo grande en la nube,
  así que para contexto de fondo que debe influir SIEMPRE una respuesta (reglas de negocio,
  instrucciones fijas), conviene inyección garantizada en vez de depender de que el modelo
  piense en buscarlo. Si en el futuro se necesita "fijar" un archivo específico de la
  carpeta escaneada, la solución es subirlo también a Lista de archivos a mano — no se le
  agrega "siempre" a Carpeta del proyecto.
- **"Bloqueado" (candado de solo lectura para patch mode) — evaluado y DESCARTADO.** La idea
  era un tercer estado (activo/siempre/bloqueado) donde la IA puede leer un archivo de
  código pero patch mode nunca puede modificarlo. Se descartó porque no encaja en ningún
  control existente: Lista de archivos (donde vive alwaysInclude) solo tendrá archivos
  subidos a mano, que patch mode nunca toca de todas formas — protegerlos ahí no defiende
  nada real. Para que "bloqueado" tuviera sentido, haría falta o (a) una vista nueva de
  archivos individuales del snapshot dentro de Carpeta del proyecto, o (b) un campo de texto
  con patrones glob (reusando `globToRegExp`/`matchesIgnoreGlobs` ya existentes) que
  `apply.service.js` consulte antes de escribir. Ambas opciones son trabajo nuevo real sin
  caso de uso confirmado todavía — descartado, no pendiente.

### Agrupación de métodos relacionados (evaluados en conjunto con tool use)
De los 6 métodos evaluados para ayudar en estudio/tesis, se agrupan por dependencia técnica
real, no por afinidad temática:
- **Van en la misma versión que tool use** (mismo mecanismo de búsqueda por dentro):
  - **RAG** — no es trabajo separado, es el resultado automático de tener tool use +
    embeddings juntos. No necesita ítem propio de implementación.
  - **Reranking** — se engancha directo al mismo paso de búsqueda que tool use necesita
    construir; natural como parte de la misma versión o un parche rápido inmediatamente
    después.
- **Independientes — no dependen de tool use ni del rediseño de UI, se pueden hacer en
  cualquier momento:**
  - **Summarization** — llamada aparte al modelo pidiendo que resuma.
  - **Generación de preguntas/flashcards** — llamada aparte pidiendo preguntas de repaso.
  - **Extracción de conceptos/glosario** — llamada aparte pidiendo términos clave/definiciones.
  - Los tres son solo "tomar contenido + pedirle algo específico al modelo de chat", sin
    infraestructura nueva — candidatos a una versión chica y rápida, antes o después de tool
    use, sin bloquearse mutuamente.
- **Futuro sin fecha comprometida:**
  - **Mapas de conceptos / knowledge graphs** — el más pesado: necesita almacenamiento nuevo
    (grafo, no solo texto), UI de visualización nueva, y lógica de extracción de relaciones.
    No depende de tool use pero tampoco es rápido — queda en el roadmap sin versión asignada.

### Pendiente
- Implementar tool use en `localai.service.js` (loop de function calling, reusando
  `isPathSafe` de `fs.provider.js` para validar cualquier ruta que el modelo pida, y
  `chunk.service.js` para lectura de archivos por partes).
- Definir tope duro de iteraciones del loop (propuesto: 5-8) para evitar que una pregunta
  mal armada entre en un ciclo lento de inferencia en vez de responder.
- Rediseño de UI descrito arriba (Carpeta del proyecto con un solo checkbox, Lista de
  archivos desacoplada, botón de subir reubicado).
- Implementar chunking + selección por relevancia para Carpeta del proyecto, que
  reemplazaría por completo la necesidad de `maxFileSize` como límite duro (ver parche de
  arriba — el parche de 100MB es explícitamente temporal hasta que esto se implemente).

---

## 📦 Instalador — descarga de modelos GGUF/Whisper en el primer arranque

### Contexto
Punto del roadmap "Instalador que incluye modelos GGUF o los descarga en primer arranque".
`models-localai/` pesa ~80GB en la máquina de desarrollo (15 variantes de chat + visión +
embeddings + Whisper), así que bundlear todo en el instalador no es viable para un usuario
final. Al arrancar el proyecto ya existía una base parcial: `models.inventory.js` verificaba
con `fs.existsSync` qué `.gguf` de `MODEL_FILES` faltaban (sin cargarlos), expuesto en
`/health.modelsInventory`, y `splash.html` ya mostraba un warning no bloqueante si faltaba
alguno — pero no había forma de completar lo que faltaba, ni automática ni manual.

### Opciones evaluadas
- **Todo bundled en el instalador** — descartada: instalador de 15GB+, no se adapta a que el
  desktop (RTX 4070 12GB) y la laptop secundaria tienen distinta VRAM, y cada cambio de
  modelo obliga a reempacar todo.
- **Descarga total en el primer arranque (los 15 modelos)** — descartada: primer arranque
  inutilizable durante minutos/horas según conexión, y la mayoría de esos modelos son
  variantes para el model router (`capability.matrix.js`) que no hacen falta para empezar a
  usar la app.
- **Elegida: descarga en primer arranque, pero solo de lo REQUERIDO (`hermes-q4` + Whisper
  `large-v3`) + panel de descarga manual para el resto.** El usuario señaló explícitamente
  que la app no tenía forma manual de bajar el resto de `MODEL_FILES` — sin ese panel, los
  otros 13 modelos quedarían referenciados por el model router pero permanentemente
  inalcanzables para cualquiera que no copiara el `.gguf` a mano. El panel resuelve eso.

### Implementación
- **`backend/services/localai/models.catalog.js` (nuevo)** — capa de metadata de descarga
  (url, sha256, tamaño, `required`) que se apoya en `MODEL_FILES`/`resolveModelPath` de
  `localai.service.js` sin duplicarlos; `MODEL_FILES` sigue siendo la única fuente de verdad
  de nombre de archivo. Agrega también `whisper-large-v3` como modelo "extra" (no vive en
  `MODEL_FILES` porque es `.bin` de ggml, no `.gguf` — lo carga `whisper-cli.exe` directo, ver
  `transcription.service.js`).
- **`backend/services/localai/model.downloader.service.js` (nuevo, interfaz reemplazable)** —
  usa `fetch` nativo (mismo patrón que `search/providers/*.js`, sin sumar dependencias).
  Descarga a `archivo.gguf.part`, calcula sha256 en el mismo paso de escritura (streaming,
  sin segunda pasada), verifica contra el catálogo, y hace rename atómico `.part` → nombre
  final. Si falla cualquier paso, borra el `.part` — nunca deja un archivo corrupto con el
  nombre final (evitaría que `models.inventory.js` lo cuente como "existe" estando roto).
  Deduplica descargas concurrentes del mismo modelo (mismo `modelId` en curso devuelve la
  misma promesa) para que el chequeo de primer arranque y el panel manual no pisen la misma
  descarga dos veces.
- **`backend/services/localai/models.inventory.js` (editado)** — antes usaba
  `getKnownModelIds()`/`resolveModelPath()` de `localai.service.js` directo (solo chat).
  **Bug encontrado:** Whisper nunca estuvo cubierto por este chequeo — un Whisper faltante
  solo se notaba cuando la transcripción fallaba en producción, sin aviso previo en el splash.
  Fix: ahora usa `getAllModelIds()`/`resolveCatalogPath()` del catálogo nuevo, que incluye
  Whisper. Se agregó también el campo `okRequired` (todos los `required` presentes) separado
  de `ok` (todos, incluidos opcionales) — necesario para que el arranque solo bloquee por los
  requeridos y no por los 13 opcionales sin fuente confirmada todavía.
- **`backend/routes/models.routes.js` (nuevo)** — `GET /models/catalog` (catálogo + estado),
  `POST /models/:id/download` (dispara, no espera), `GET /models/:id/download/status`.
  Polling en vez de SSE a propósito: `splash.html` ya usa polling contra `/health` cada
  400ms — mantener un solo mecanismo de tiempo real en vez de sumar SSE solo para esto.
- **`backend/server.js` (editado)** — tras `checkModelsInventory()`, si `!okRequired`,
  descarga secuencialmente (no en paralelo — dos descargas grandes a la vez no bajan más
  rápido en total y complican el progreso mostrado) los modelos requeridos que falten antes
  de llamar a `llamaProvider.init()`. Se envolvió en try/catch que seguido logea y sigue
  (mismo criterio que el chequeo de inventario, ver bug de v2.16.2 arriba en este documento)
  — si la descarga falla, `llamaProvider.init()` va a fallar de forma visible igual
  (`ai.status = 'error'`), y `modelsDownload.error` en `/health` le da contexto específico al
  splash de que el problema fue la descarga y no la carga en VRAM. De paso, la ruta hardcodeada
  del modelo default (`path.join(modelsDir, 'Hermes-3-Llama-3.1-8B-Q4_K_M.gguf')`) se
  reemplazó por `resolveModelPath('hermes-q4')` — misma fuente de verdad que usa el catálogo,
  evita que diverjan si el nombre de archivo cambia.
- **`shell/splash.html` (editado)** — reutiliza la barra de progreso existente (antes solo
  para carga en VRAM) para mostrar "Descargando modelo (i/total): id — NN%" cuando
  `modelsDownload.inProgress`, con prioridad sobre el label de carga (no tiene sentido decir
  "cargando" mientras el archivo todavía no existe). El warning inferior ahora solo cuenta
  modelos OPCIONALES faltantes — los requeridos se están bajando solos o ya mostraron su
  propio mensaje de error arriba.
- **Panel de descarga manual (`frontend/settings.html` + `frontend/modules/settings.js`)** —
  nueva pestaña "Modelos" en el modal de Configuración, listando el catálogo completo con
  tamaño, estado (descargado / descargando NN% / sin fuente / requerido pendiente) y botón de
  descarga para lo que falte. Polling de 1.5s propio, se prende solo mientras esa pestaña está
  visible y se apaga al cambiar de panel o cerrar el modal (para no pegarle a
  `/models/catalog` sin necesidad).

### Checksums de los modelos requeridos
`hermes-q4` y `whisper-large-v3` quedaron con URL de origen y sha256 **verificados
directamente contra los archivos que ya estaban en disco** en la máquina de desarrollo
(`NousResearch/Hermes-3-Llama-3.1-8B-GGUF` y `ggerganov/whisper.cpp` respectivamente — ambos
tamaños de archivo coinciden exacto con lo esperado por esos repos). El resto de
`MODEL_FILES` (13 modelos) quedó en el catálogo con `url: null` — aparecen listados en el
panel pero sin botón de descarga habilitado hasta confirmar la fuente exacta (mismo nombre de
archivo puede existir en más de un repo/quant distinto en Hugging Face; completar a ciegas
arriesgaba bajar el archivo equivocado).

### Limitaciones conocidas
- **Sin reanudación de descarga** — si se corta a mitad de camino, el próximo intento
  arranca de cero (el `.part` se borra en el catch). Con archivos de 3-5GB esto puede doler
  en conexiones inestables; queda como mejora futura (rango HTTP + offset en el `.part`).
- **13 de los 15 modelos de `MODEL_FILES` no tienen `url`/`sha256` todavía** — se van
  completando de a uno en el catálogo a medida que se confirme el repo/quant exacto de cada
  uno. Hasta entonces aparecen en el panel como "sin fuente configurada", sin romper nada.
- **No se probó el flujo completo end-to-end** (descarga real desde Hugging Face, verificación
  de checksum, arranque de Electron) — el entorno donde se implementó no puede ejecutar el
  proyecto (dependencia nativa `sharp` compilada para Windows, incompatible con el sandbox
  Linux usado). Validado solo con `node --check` (sintaxis) en los archivos backend y
  frontend tocados. Pendiente: smoke test real en la máquina de desarrollo antes de dar esto
  por cerrado en el ROADMAP.

### Pendiente
- Evaluar reanudación de descargas cortadas (HTTP Range) si en la práctica resulta molesto.

### Actualización — catálogo completo (los 14 modelos restantes)
Todos los modelos de `MODEL_FILES` tienen ahora `url`/`sha256` reales en `models.catalog.js`,
verificados contra la API de Hugging Face (`lfs.oid` de cada repo — no adivinado a ciegas).
Fuentes usadas por modelo:

- `hermes-q5` → `NousResearch/Hermes-3-Llama-3.1-8B-GGUF` (mismo repo que `hermes-q4`)
- `llama-3.2-3b-q4` / `llama-3.2-3b-q8` → `NousResearch/Hermes-3-Llama-3.2-3B-GGUF`
- `qwen2.5-3b-q4` / `qwen2.5-3b-q5` → `Qwen/Qwen2.5-3B-Instruct-GGUF` (repo oficial — para el
  3B no divide el archivo en partes, a diferencia del 7B/14B, ver abajo)
- `qwen2.5-coder-3b-q8` → `Qwen/Qwen2.5-Coder-3B-Instruct-GGUF` (repo oficial)
- `qwen2.5-7b-q5` → `bartowski/Qwen2.5-7B-Instruct-GGUF`
- `qwen2.5-14b-q3` → `bartowski/Qwen2.5-14B-Instruct-GGUF`
- `gemma-2-9b-q4` → `bartowski/gemma-2-9b-it-GGUF`
- `llama-3.1-8b-q5` → `bartowski/Meta-Llama-3.1-8B-Instruct-GGUF`
- `phi-3-mini-q4` → `bartowski/Phi-3-mini-4k-instruct-GGUF`
- `deepseek-coder-6.7b-q6` → `TheBloke/deepseek-coder-6.7B-instruct-GGUF`
- `qwen2.5-vl-7b-q4` → `unsloth/Qwen2.5-VL-7B-Instruct-GGUF`
- `llava-1.6` → `cjpais/llava-1.6-mistral-7b-gguf`

**Por qué no siempre el repo oficial `Qwen/...`:** para 7B y 14B, el repo oficial de Qwen
divide los `.gguf` de más de ~4GB en varias partes (`-00001-of-00002.gguf`, etc.) — un formato
que `resolveModelPath()`/el downloader actual no manejan (esperan un archivo único). Los
`.gguf` únicos que ya tenía el usuario en disco para esos tamaños vienen de un requantizador
comunitario (bartowski, muy usado y confiable) que no divide el archivo. Para 3B el oficial sí
entrega archivo único, así que ahí se usó el repo de Qwen directo.

**Sobre las pequeñas diferencias de tamaño (~64-288 bytes) contra los archivos que el usuario
ya tenía en disco:** no son error de transcripción — se repite de forma consistente entre
varios modelos no relacionados. Es metadata GGUF (KV store) que varía levemente según la
versión de `llama.cpp` usada para cuantizar, no afecta el contenido de los pesos. No importa
para la descarga: el sha256 guardado es el del archivo tal cual se sirve en esa URL, así que
la verificación post-descarga siempre es consistente consigo misma — no se compara contra el
archivo viejo del usuario, que además puede no ser bit-a-bit idéntico al que ahora se ofrece.

### Actualización — "Descargar todos" + cola con límite de concurrencia
Pedido del usuario: botón para bajar todo el catálogo de una, pero sin que las ~13 descargas
salgan todas en paralelo (satura ancho de banda sin bajar más rápido en total, y castiga el
disco con varios streams grandes escribiendo a la vez).

**Implementado:**
- `model.downloader.service.js`: cola nueva (`_queue` + `_activeCount`) con
  `MAX_CONCURRENT_DOWNLOADS = 2` — número elegido como punto medio entre algo de paralelismo
  real y no competir demasiado por la misma conexión. `queueDownload(modelId)` es el nuevo
  punto de entrada para todo lo que venga del panel (clicks individuales y "Descargar todos");
  marca `queued` y encola, `_pumpQueue()` va sacando de la cola mientras haya lugar. Los 2
  requeridos del primer arranque (`server.js` → `ensureRequiredModels`) NO pasan por esta cola
  — siguen usando `downloadModel()` directo en su propio loop secuencial, ya probado en el
  smoke test real; no valía la pena tocar ese camino para sumarle esto.
- `models.routes.js`: `POST /models/:id/download` ahora llama `queueDownload` en vez de
  `downloadModel` directo (mismo límite de concurrencia también para clicks individuales).
  Nueva ruta `POST /models/download-all` — encola todos los modelos del catálogo con
  `!exists && hasSource`, ignora los que ya están descargados o siguen sin URL confirmada.
- `settings.html` / `settings.js`: botón "Descargar todos" arriba de la lista del panel
  Modelos. El estado `queued` ya existía en el frontend (de la implementación de
  `markQueued` para el primer arranque) así que no hizo falta UI nueva — los modelos en cola
  ya se veían como "En cola — esperando su turno" con la barra indeterminada.

### Actualización — botón "Abrir carpeta" de modelos
Mismo patrón que el botón ya existente de abrir la carpeta de transcripciones
(`open-transcriptions-folder`): nuevo handler IPC `open-models-folder` en `shell/main.js`,
expuesto en `preload.js` como `electronAPI.openModelsFolder()`, botón nuevo en el panel
Modelos. Usa `process.env.MODELS_DIR` (la misma variable que ya resuelve `startBackend()` y
que usa el backend para todo lo demás) en vez de recalcular la ruta — evita que este botón
pueda apuntar a un lugar distinto de donde el backend realmente busca/descarga los modelos.
Deshabilitado con tooltip si se corre fuera de Electron (navegador), igual que el de
transcripciones.

---

## 🖥️ Perfil de hardware: laptop no debe bajar hermes-q4

### Contexto
El sistema de descarga de modelos del primer arranque (sección anterior) fija `hermes-q4`
(8B, ~5GB) como el único modelo de chat "requerido", sin importar la máquina. Esto contradice
la razón por la que se descartó bundlear todo el catálogo: esa misma sección dice
textualmente que "el desktop (RTX 4070 12GB) y la laptop secundaria tienen distinta VRAM" —
pero la descarga automática del primer arranque terminó sin respetar esa diferencia. Una
laptop con 6GB de VRAM (RTX 4050) queda bajando y tratando de cargar un modelo pensado para
12GB. Encontrado retomando el proyecto en la laptop tras el `git pull` a v2.18.0.

Separado de esto: ya existía `HARDWARE_PROFILE` como mecanismo (`chat.controller.js`, decisión
"HARDWARE_PROFILE hardcodeado" más arriba en este archivo — const leída de `.env`, auto-detección
descartada explícitamente), y el selector de modelo de chat en el frontend (`MODEL_PROFILES` en
`frontend/modules/models.js`) ya filtraba por perfil correctamente. El gap estaba puntualmente en
`models.catalog.js` (qué es "requerido") y en `server.js` (qué modelo carga `llamaProvider.init()`
al arrancar) — ninguno de los dos consultaba el perfil.

### Opciones evaluadas para determinar el perfil activo
- **Seguir solo con `.env`** — descartada como única vía: un instalador NSIS pensado para
  alguien que no sabe qué es un `.env` no puede depender de que lo edite a mano antes del
  primer arranque; y como `.env` nunca se commitea, una instalación nueva sin ese archivo cae
  en el default `'desktop'`, reproduciendo el mismo bug.
- **Auto-detección de VRAM** (`nvidia-smi` o similar) — reevaluada a pedido del usuario y
  descartada de nuevo: mismo argumento que ya está documentado más arriba en este archivo
  (agrega una dependencia externa y un umbral arbitrario para resolver algo que hoy son 2
  máquinas conocidas), más el riesgo de clasificar mal GPUs integradas o VRAM compartida.
- **Elegida: toggle en Configuración → Preferencias, persistido en `app-settings.json` dentro
  de `userData`** (no en `.env`, no dentro de la carpeta de instalación) **+ pregunta opcional
  en el instalador NSIS en el primer install**, que pre-completa ese mismo archivo. Cubre los
  dos casos: quien instala desde el wizard lo contesta una vez sin tocar ningún archivo, y
  queda visible/editable después desde la app sin reinstalar. Etiquetas en la UI: "Breeze"
  (laptop) y "Storm" (desktop) — nombres elegidos por el usuario (antes "Light"/"Max"); las
  claves internas siguen siendo `'laptop'`/`'desktop'` en todo el código, sin cambios.

### Implementación
- **`backend/services/settings.service.js` (nuevo)** — `getHardwareProfile()`/`setHardwareProfile()`
  sobre `DATA_DIR/app-settings.json`. Orden de resolución: archivo persistido → `process.env.HARDWARE_PROFILE`
  (compatibilidad con el `.env` que ya usa el desktop de Roy, no se rompe nada ahí) → `'desktop'` por defecto.
- **`backend/services/localai/models.catalog.js`** — `required` deja de ser un booleano fijo
  por modelo; `getRequiredModelIdsForProfile(profile)` resuelve el modelo requerido vía
  `capability.matrix.resolve('general-fast', profile)` (mismo alias que ya usa el router en modo
  `auto` — hermes-q4 en desktop, qwen2.5-3b-q4 en laptop) + `whisper-large-v3` siempre. Se agrega
  también `getModelProfile(modelId)` (tag `'laptop'|'desktop'|'both'` por modelo, derivado de
  `capability.matrix.getAvailableModelIds()` + un mapa chico a mano para los 4 modelos que no
  participan de ningún alias del router: `llama-3.2-3b-q4`/`q8` → laptop, `qwen-coder-14b-q4` →
  desktop, `phi-3-mini-q4` → `'both'` por no estar asignado a ningún perfil todavía).
- **`backend/server.js`** — lee el perfil una sola vez al arrancar (`getHardwareProfile()`), lo
  pasa a `checkModelsInventory(profile)` y usa `capability.matrix.resolve('general-fast', profile)`
  en vez de `resolveModelPath('hermes-q4')` fijo para decidir qué modelo carga `llamaProvider.init()`.
- **`backend/controllers/chat.controller.js`** — la constante `HARDWARE_PROFILE` (leída una sola
  vez al cargar el módulo desde `.env`) se reemplaza por `readHardwareProfile()` llamada una vez
  por request — mismo problema y misma solución que ya se aplicó en `vision.service.js` con
  `getVisionModel()` (ver "v2.4.0 — Perfil laptop con LLaVA" más arriba): si no se lee en cada
  llamada, cambiar el perfil desde la UI no tiene efecto hasta reiniciar el proceso completo.
  Nuevo endpoint `POST /hardware-profile` (sin `authMiddleware`, igual que el `GET` existente —
  es config local de máquina, no dato de usuario) para guardarlo desde Preferencias.
- **Bug encontrado de paso:** en el segundo pase de "Visual + búsqueda web", el modelo de texto
  para el segundo pase estaba hardcodeado como `HARDWARE_PROFILE === 'laptop' ? 'hermes-q4' : 'qwen2.5-7b-q5'`
  — invertido: le daba el modelo pesado de desktop a la laptop. Corregido para usar
  `capability.matrix.resolve('general-standard', hardwareProfile)` — mismo modelo de antes en
  desktop (`qwen2.5-7b-q5`), `qwen2.5-3b-q5` en laptop.
- **Otro punto con el mismo problema, encontrado después:** `generateTitleFromText`
  (`localai.service.js`) leía `process.env.HARDWARE_PROFILE` directo en vez de pasar por
  `settings.service.js` — los títulos no respetaban el toggle de Configuración → Preferencias,
  solo lo que hubiera en `.env`. Corregido para usar `getHardwareProfile()`.
- **Aclaración sobre `llama-3.2-3b-q4`:** laptop tiene 3 modelos generales
  (rápido/moderado/inteligente, ver sección anterior) más este cuarto modelo — no es
  redundante ni un 4to general: está dedicado exclusivamente a `generateTitleFromText`
  (títulos de chat), confirmado con el usuario. Sigue tageado `'laptop'` en
  `models.catalog.js` (`UNMATRIXED_PROFILE_TAGS`) porque es real y específico de esa máquina,
  aunque no aparezca en el selector manual de chat (`MODEL_PROFILES.laptop`).
- **`backend/routes/models.routes.js`** — `/models/catalog` y `/models/download-all` ahora leen
  el perfil activo y lo pasan a `getCatalog(profile)`/`checkModelsInventory(profile)`. El catálogo
  sigue devolviendo TODOS los modelos (no los filtra el backend) — cada entrada lleva el campo
  `profile`, y el filtrado real lo hace el frontend, mismo patrón que ya usa `MODEL_PROFILES` para
  el selector de chat. `download-all` sí excluye del encolado los modelos de otro perfil.
- **Frontend (`settings.html` + `settings.js`)** — nueva sección "Rendimiento de esta máquina" en
  Preferencias con botones Breeze/Storm; `_renderModelsList()` filtra por `m.profile === HARDWARE_PROFILE
  || m.profile === 'both'`.
- **Instalador (`build/installer.nsh`, nuevo)** — página custom vía el hook `customPageAfterChangeDir`
  de electron-builder, solo en el primer install (si `app-settings.json` no existe todavía —
  se saltea entera en reinstalaciones/actualizaciones para no pisar un cambio hecho después
  desde la app). Escribe directo a `$APPDATA\Tempest IA\data\app-settings.json`.

### Inconsistencia encontrada (documentación vs. código)
Este mismo archivo y ROADMAP.md dan por implementado un `build/installer.nsh` con el aviso de
"reinstalar/actualizar" (sección "Instalador con selector de carpeta + aviso de reinstalar/
actualizar"), pero ese archivo **no existe en el repo** (`git ls-tree -r origin/work` no lo lista,
y `package.json` no tenía ninguna referencia a `nsis.include` antes de este cambio). No se
investigó la causa (¿se perdió en un commit, se escribió solo localmente en la máquina de
desarrollo original y nunca se subió?) — se deja constancia acá para que quien retome ese punto
sepa que la lógica de aviso reinstalar/actualizar sigue pendiente de escribirse de cero, no
solo de "encontrarse".

### Bug encontrado probando en la laptop real (no relacionado al perfil, pero bloqueaba probarlo)
Al probar el fix en la laptop apareció `NoBinaryFoundError` / `Binary GPU type mismatch. Expected:
cuda, got: false` al cargar `qwen2.5-3b-q4` — nada que ver con qué modelo se eligió, el problema
era que `llama.provider.js` llamaba `getLlama({ gpu: 'cuda' })` a secas: fuerza ÚNICAMENTE el
binario CUDA, y si el runtime de CUDA no está bien instalado en el sistema (`nvidia-smi` mostraba
driver OK pero sin CUDA Toolkit instalado — `nvcc` no reconocido), node-llama-cpp no tiene a
dónde caer y explota en vez de degradar a CPU. Corregido: `gpu: 'auto'` — mismo comportamiento en
una máquina donde CUDA funciona bien (sigue eligiendo CUDA), pero cae a CPU en vez de crashear
donde no. No resuelve que la laptop corra en GPU — sigue pendiente instalar el CUDA Toolkit ahí
si se quiere aceleración real — pero destraba poder arrancar la app mientras tanto.

## 💾 Instalador — opción de descargar e instalar CUDA Toolkit

### Contexto
Pedido explícito del usuario tras encontrar el bug de `NoBinaryFoundError` en la laptop (ver
sección anterior). Sin CUDA Toolkit, Tempest ahora arranca igual (gracias a `gpu: 'auto'') pero
corre en CPU — 5-15x más lento. La idea es que quien instale la app se entere de esto en el
momento, no lo descubra después preguntándose por qué la IA responde lento.

### Opciones evaluadas
- **Detectar y solo avisar con un link** — más simple y segura de mantener (nada que
  descargar/ejecutar desde el instalador), pero no es lo que pidió el usuario explícitamente
  ("que descargue e instale").
- **Empaquetar las DLLs de runtime de CUDA** (mucho más chicas que el Toolkit completo) en vez
  de pedir la instalación del Toolkit entero — más elegante a largo plazo, pero requiere
  investigar exactamente qué DLLs necesita el binario de `node-llama-cpp` y si es legal/viable
  redistribuirlas. Queda como posible mejora futura, no se investigó a fondo por tiempo.
- **Elegida: página custom que detecta `CUDA_PATH`, pregunta Sí/No, y si acepta descarga y
  ejecuta el instalador oficial de NVIDIA.** Es lo que pidió el usuario. Se agregó como segunda
  `Page custom` dentro del mismo `customPageAfterChangeDir` que ya usa la página de perfil de
  hardware (ver sección "Perfil de hardware: laptop no debe bajar hermes-q4").

### Implementación
- Detección vía `ReadEnvStr $0 "CUDA_PATH"` — variable de entorno de sistema que el instalador
  de NVIDIA setea al instalar el Toolkit. Si existe, `Abort` en la función `Show` salta la
  página entera (mismo patrón que la página de perfil).
- Radio buttons Sí/No, default en "No" a propósito — no forzar una descarga de varios GB sin
  que el usuario la pida activamente.
- La descarga real ocurre en `customInstall` (durante "Instalando archivos...", no en la página
  en sí) — mismo momento que se escribe `app-settings.json` del perfil de hardware.
- `NSISdl::download` (plugin de la distribución estándar de NSIS, sin dependencias extra)
  contra la URL de CUDA Toolkit 13.2 Update 1 — versión confirmada vigente al momento de
  escribir esto (consultado developer.nvidia.com/cuda-downloads), pero la URL exacta del
  instalador (nombre de archivo, build number) no se pudo confirmar 100% sin poder correr un
  build real en Windows. Si la descarga falla por cualquier motivo, cae a `ExecShell "open"`
  la página de NVIDIA en el navegador — nunca deja al usuario sin ninguna vía.
- El instalador de NVIDIA se ejecuta con `ExecWait`, NO silencioso — corre su propio wizard
  completo (EULA, selección de componentes, etc.), Tempest solo espera a que termine.
- Pase lo que pase acá (usuario dice que no, descarga falla, instalador de NVIDIA falla),
  nunca aborta ni condiciona la instalación de Tempest en sí.

### Pendiente / dónde puede fallar
- Sin compilar/probar en Windows real, igual que el resto de `installer.nsh`.
- **La URL de descarga hay que revisarla antes de cada build** — NVIDIA rota versión y nombre
  de archivo con cada release de CUDA Toolkit; una URL vieja simplemente activa el fallback del
  navegador (no rompe nada), pero conviene mantenerla actualizada para que la descarga directa
  funcione la mayoría de las veces.
- No se investigó si el instalador de CUDA Toolkit requiere privilegios de administrador — si
  los requiere y Tempest se instala sin admin (`perMachine: false`), `ExecWait` podría fallar o
  pedir elevación en medio del wizard de Tempest. A confirmar en la prueba real.
- (Pendiente heredado de la página de perfil de hardware, mismo archivo `installer.nsh`) Si en
  algún momento se necesita fusionar `app-settings.json` con más claves además de
  `hardwareProfile`, el instalador solo escribe en el primer install (archivo inexistente), así
  que no hay riesgo hoy — pero si ese bloque se llama en otro momento a futuro, sobrescribe el
  archivo entero en vez de fusionar.
- `qwen-coder-14b-q4` no está conectado a ningún alias real de `capability.matrix.js` (no lo
  elige el router automático en modo `auto`) — queda clasificado a mano en `models.catalog.js`,
  hay que mantenerlo ahí si algún día se conecta. (`phi-3-mini-q4` estaba en la misma situación
  y se eliminó del catálogo — ver sección siguiente.)

---

## 💾 CUDA Toolkit: descarga automática fallaba en la prueba real (fallback a navegador)

### Contexto
Primera prueba real del flujo de CUDA Toolkit: el usuario eligió "Sí, instalar", y terminó en la
página de NVIDIA en el navegador en vez de la instalación automática — es decir, cayó al
fallback documentado (`NSISdl::download` no devolvió `"success"`). Causa exacta no confirmable
sin logs de NSIS de esa corrida puntual (pudo ser la URL, o límites del plugin `NSISdl` con un
archivo de ~2GB por HTTPS — es un plugin simple, no pensado para descargas grandes).

### Decisión — usuario objetivo es poco técnico, la descarga automática importa
El usuario aclaró que apunta a alguien "que apenas sabe mover la PC" — si no baja CUDA Toolkit
por error de flujo (no por decisión propia), Tempest corre en CPU sin que la persona entienda
por qué está lento. Se evaluaron dos mejoras:

1. **Reintentar la descarga una vez** antes de rendirse (cubre cortes de red momentáneos, no
   cambia nada si el problema es la URL en sí).
2. **Verificar que CUDA quedó realmente instalado** después de que el usuario cierra el wizard
   de NVIDIA (antes, `ExecWait` esperaba a que el proceso cerrara y seguía sin chequear nada —
   si alguien cancelaba el wizard de NVIDIA sin querer, Tempest continuaba como si nada). Ahora
   se lee `CUDA_PATH` del registro (`HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\
Environment`) — **no** con `ReadEnvStr`, que lee el entorno heredado por el proceso del
   instalador de Tempest y no se entera de una variable que un proceso hijo (el instalador de
   NVIDIA) acaba de escribir en el registro durante la misma sesión. Si no se detecta, se
   pregunta si reintentar (corre de nuevo el mismo `.exe` ya descargado) o continuar sin él —
   nunca es un bloqueo permanente sin salida, porque alguien sin GPU NVIDIA real necesita poder
   terminar de instalar Tempest igual.

### Descartado
- **Cambiar `NSISdl` por `inetc.dll`** (plugin más robusto para descargas grandes por HTTPS,
  con reintentos y mejor manejo de redirects) — investigado, pero electron-builder NO lo trae
  bundleado por default: hay que sumar el binario aparte al repo en
  `build/x86-unicode/INetc.dll` (confirmado vía documentación de electron-builder sobre
  `addplugindir`). Se descartó por ahora para no sumar una dependencia binaria nueva ni otro
  ciclo de build-fallar-corregir en la única máquina Windows disponible para probar — si el
  reintento simple con `NSISdl` no alcanza, es la alternativa a implementar después.
- **Embeber el instalador de CUDA Toolkit completo (~2GB) dentro del instalador de Tempest** —
  descartado en la conversación previa a este fix: infla el instalador para todos los usuarios
  (incluso quienes no lo necesitan), hay que re-empaquetar 2GB a mano en cada release de CUDA, y
  no se verificó si los términos de redistribución de NVIDIA lo permiten.

### Pendiente / dónde puede fallar
- Sigue sin confirmarse la causa exacta de por qué falló la descarga esa vez — si el reintento
  simple tampoco alcanza en la próxima prueba, hay que mirar logs de NSIS de esa corrida
  específica antes de asumir que es la URL.
- No se investigó si el instalador de CUDA Toolkit requiere privilegios de administrador — si
  los requiere y Tempest se instala sin admin (`perMachine: false`), `ExecWait` podría fallar o
  pedir elevación en medio del wizard de Tempest. A confirmar en la prueba real.
- El chequeo de `CUDA_PATH` en el registro asume que el instalador de NVIDIA la escribe en
  `HKLM` (instalación a nivel de sistema) — no confirmado si en algún caso la escribe solo en
  `HKCU`. Si eso pasara, el chequeo daría falso negativo (diría que no se instaló aunque sí).

**Actualización — se probó y se descartó por completo:** en el `npm run build` con el fix ya
aplicado, la descarga automática (con reintento incluido) se quedó colgada en "Connecting..."
sin avanzar nunca, ni siquiera fallar rápido. Causa más probable: la página de NVIDIA genera el
link de descarga real vía JavaScript (dinámico/con token), no es una URL estática que un
downloader simple como `NSISdl` pueda resolver — coincide con que ni siquiera desde este entorno
se pudo confirmar por fetch directo que la URL fija sirviera. Se sacó todo el intento de
descarga/ejecución/verificación automática (`NSISdl`, `CudaToolkitIsInstalled`,
`CudaToolkitRunAndVerify`) y quedó solo: "Sí" → `ExecShell "open"` a
`developer.nvidia.com/cuda-downloads`, Tempest sigue instalándose sin esperar. Ver sección
siguiente para el detalle de este cambio.

---

## 💻 CUDA Toolkit: se abandona la descarga automática, solo se abre el navegador

### Contexto
Con la prueba real confirmando que la descarga automática no conecta (ver sección anterior), y
habiendo ya descartado antes tanto `inetc.dll` (dependencia binaria nueva) como embeber el
instalador completo (~2GB, problemas de tamaño/licencia) — no queda una forma confiable de
automatizar esto desde dentro del instalador NSIS.

### Decisión
"Sí" en la página de CUDA Toolkit ahora simplemente abre `developer.nvidia.com/cuda-downloads`
en el navegador default del usuario (`ExecShell "open"`) y el instalador de Tempest sigue su
flujo normal sin esperar a que el usuario termine nada del otro lado. Se sacaron del archivo:
`NSISdl::download` (con su reintento), `Function CudaToolkitRunAndVerify`, `Function
CudaToolkitIsInstalled` y el chequeo de `CUDA_PATH` vía registro — ya no tenían nada que
verificar, porque ya no hay una descarga/ejecución propia que verificar.

Se actualizó también el texto de la página (`CudaToolkitPageShow`): ya no promete "instalarlo
ahora", dice explícitamente que se abre la página oficial y que Tempest sigue instalándose
mientras tanto.

### Por qué no se armó una verificación igual, aunque sea sin la descarga automática
Se consideró mantener el chequeo de `CUDA_PATH` por registro después de abrir el navegador (para
al menos avisar si al final el usuario instaló o no), pero el usuario va a completar la descarga
e instalación de CUDA Toolkit en su propio tiempo, posiblemente después de que el instalador de
Tempest ya terminó — no hay un momento fijo en el flujo de instalación de Tempest donde tenga
sentido esperar ese resultado. Verificarlo en otro momento (por ejemplo al primer arranque de la
app) queda fuera del alcance de `installer.nsh` — pendiente abajo.

### Pendiente
- Evaluar si la propia app (no el instalador) debería detectar `CUDA_PATH` ausente en el primer
  arranque y avisarlo en la UI (ej. en el splash o en Configuración) — sería un lugar más
  confiable para esa verificación que el instalador, ya que no depende de que el usuario termine
  de instalar CUDA Toolkit dentro de la ventana de tiempo en que el instalador de Tempest sigue
  abierto.
- Confirmar en la próxima prueba real que `ExecShell "open"` efectivamente abre el navegador
  default sin errores y que el resto de la instalación de Tempest sigue avanzando en paralelo
  sin quedar bloqueada.

---

## 🙋 Se elimina el modo "todos los usuarios": bug de SetShellVarContext + no aporta nada

### Contexto
Probando el instalador en modo "Cualquiera que utilice este equipo" (per-machine), el usuario
notó que las páginas custom (perfil de hardware, CUDA Toolkit) parecían aparecer solo en modo
"Solo para mí". Investigando la causa real (no era simplemente "qué radio button se eligió"):

`multiUser.nsh` de electron-builder hace `SetShellVarContext all` cuando se elige "todos los
usuarios" — eso cambia a qué carpeta apunta `$APPDATA` dentro del instalador: en "solo para mí"
es `C:\Users\<usuario>\AppData\Roaming`, en "todos los usuarios" pasa a ser la carpeta compartida
(`C:\ProgramData`). Nuestro `customInstall` escribe `app-settings.json` en `$APPDATA\Tempest
IA\...`, así que en modo per-machine termina en `C:\ProgramData\Tempest IA\...`.

El bug real: la app corriendo (`app.getPath('userData')` de Electron, vía `APP_DATA_DIR` en
`backend/config/appPaths.js`) **siempre** resuelve a la carpeta del usuario actual
(`C:\Users\<usuario>\AppData\Roaming\Tempest IA`), sin importar cómo se instaló — Electron no
tiene ningún concepto de "instalación per-machine" para `userData`. Entonces, instalando en modo
"todos los usuarios", el perfil de hardware quedaba guardado en un lugar (`ProgramData`) que la
app nunca lee — `getHardwareProfile()` caía en el default (`desktop`) como si nunca se hubiera
elegido nada. Y como esa carpeta quedaba con el archivo ya escrito, reinstalaciones posteriores
en el mismo modo saltaban la página (creyendo que ya estaba configurado), lo que coincide
exactamente con el patrón que el usuario observó.

### Decisión
Tempest es un asistente personal — un usuario por máquina (el propio Roy, en su laptop y en su
desktop). El modo "todos los usuarios" no tiene un caso de uso real acá (a diferencia de una PC
compartida por varias cuentas de Windows, o un despliegue empresarial vía Group Policy/SCCM,
donde sí tendría sentido). Se eliminó la página "¿Para quién se instalará?" por completo: el
instalador ahora siempre instala en modo "solo para mí".

Implementación: electron-builder no expone una opción de config directa para "forzar per-user
sin mostrar la página" (solo existe la inversa, `perMachine: true`, que fuerza per-machine sin
preguntar). Se usó en cambio el hook `customInstallMode` que expone `multiUserUi.nsh` — seteando
`$isForceCurrentInstall` a `"1"` ahí, la página se salta entera y el instalador sigue directo en
modo per-user. Este macro vive FUERA del guard `!ifndef BUILD_UNINSTALLER` del resto del archivo
a propósito: electron-builder lo inserta en las dos pasadas de compilación (instalador y
desinstalador embebido), cada una dentro de una Function que ya está correctamente conectada a
su propia Page — no aplica ahí el problema de "función no referenciada" (warning 6010) que sí
aplica al resto de las Functions custom de este archivo.

### Por qué no simplemente cambiar la ruta de instalación a `C:\Program Files`
El usuario preguntó si convenía instalar en `C:\Program Files\Tempest IA` igual, ya que "la
mayoría de las aplicaciones se instalan ahí". Dos razones para no hacerlo:

1. **Contradicción técnica**: `C:\Program Files` está protegido por Windows — escribir ahí
   requiere privilegios elevados (UAC), sin importar si la cuenta es administradora. El modo
   "solo para mí" existe justamente para NO requerir esa elevación. Forzar la ruta a Program
   Files mientras se instala en modo per-user haría que el propio instalador falle al copiar
   archivos (o tenga que pedir elevación de todas formas, perdiendo el sentido del modo).
2. **Fricción con las auto-actualizaciones**: Tempest ya tiene auto-updates vía
   `electron-updater` (v2.18.0). Actualizar archivos dentro de Program Files requiere elevación
   en cada actualización — rompería las actualizaciones silenciosas en segundo plano. Es
   exactamente por esto que la mayoría de las apps de escritorio modernas con auto-actualización
   (Discord, Slack, VS Code, Chrome) instalan por defecto en la carpeta del usuario actual
   (`%LocalAppData%\Programs\<App>`, que es adonde ya apunta `setInstallModePerUser` en
   `multiUser.nsh`) en vez de Program Files — la premisa de "la mayoría instala en Program
   Files" no aplica bien a esta categoría de apps.

Conclusión: se mantiene la ruta por defecto de `setInstallModePerUser`
(`$LocalAppData\Programs\Tempest IA`), no se fuerza Program Files.

### Pendiente
- El usuario ya tiene una instalación per-machine vieja de pruebas en `C:\Program Files\Tempest
  IA` (de las pruebas de esta misma sesión). Con este cambio, esa instalación queda huérfana —
  el nuevo instalador (siempre per-user) no la va a detectar/actualizar/reemplazar
  automáticamente, porque busca en el registro per-user, no en HKLM. Recomendado: desinstalarla
  a mano (Configuración de Windows → Aplicaciones, o el uninstaller en esa misma carpeta) antes
  de asumir que solo queda una instalación de Tempest en la máquina.
- No probado en un build real todavía — confirmar que la página "¿para quién?" ya no aparece y
  que el resto del flujo (perfil de hardware, CUDA Toolkit, `customInstall`) sigue funcionando
  igual en modo per-user forzado.

---

## 🔤 Textos del instalador salían con escapes literales (`\355`, `\341`, etc.)

### Contexto
En la prueba real, la página de perfil de hardware mostraba literalmente "Eleg\355 el perfil
que corresponde a esta m\341quina" en vez de "Elegí el perfil que corresponde a esta máquina" —
los escapes octales (`\355`=í, `\341`=á, `\363`=ó, `\351`=é, `\372`=ú, `\226`=—) que se habían
usado en todos los strings de UI de `installer.nsh` no se estaban interpretando, salían tal cual
como texto.

### Causa
Al escribir el archivo originalmente se asumió que había que evitar caracteres UTF-8 directos en
los strings de NSIS (por precaución de compatibilidad, sin verificarlo en un build real) y se
usaron escapes `\NNN` en su lugar. Pero el compilador procesa el script en modo UTF-8 (confirmado
por el propio log de `makensis`: "Processing script file: ... (UTF8)") — en ese modo, `\NNN` no
se interpreta como el byte Latin-1/Windows-1252 correspondiente, así que la secuencia queda como
texto literal.

### Fix
Se reemplazaron todos los escapes octales por los caracteres UTF-8 reales (í, á, ó, é, ú, —)
directamente en los strings, en las 9 líneas donde aparecían (labels, radio buttons, mensajes de
`DetailPrint`). El archivo ya se guarda como UTF-8 de por sí, así que no hace falta ningún escape
para acentos/eñes en este archivo.

### Pendiente
- Si en el futuro se agrega texto nuevo a `installer.nsh` con tildes/ñ/guiones largos, escribirlo
  directo como carácter UTF-8 — no volver a usar escapes `\NNN`.

---

## 🌬️⛈️ Segundo rename de las etiquetas del perfil de hardware: Breeze / Storm

### Contexto
Después de "Light"/"Max", y de una propuesta intermedia ("Compact"/"Extended"), el usuario
eligió el nombre final: **Breeze** (laptop) y **Storm** (desktop) — con emoji (🌬️/⛈️) donde el
renderizado lo permite. Encaja además con el tema de "Tempest" (tormenta).

### Implementación
- `build/installer.nsh` — radio buttons sin emoji (diálogo nativo Win32, `nsDialogs`/nsis — no
  se confirmó que las fuentes/controles clásicos rendericen emoji a color de forma confiable, y
  ya hubo un bug de encoding en este mismo archivo esta sesión — se prefirió no arriesgar otro).
  También se reescribió el texto explicativo de la página a pedido del usuario: "Tempest
  descargará los modelos de IA más adecuados para este equipo. Selecciona el perfil que mejor se
  adapte a tu hardware. Podrás cambiar esta opción más adelante desde Configuración."
- `frontend/settings.html` + `frontend/modules/settings.js` — botones con emoji ("Breeze 🌬️" /
  "Storm ⛈️"), acá sí es HTML/CSS así que el emoji renderiza sin riesgo.
- Actualizado en toda la documentación que mencionaba "Light"/"Max": `DECISIONS.md`,
  `ROADMAP.md`, `MODELS.md`, `ARCHITECTURE.md`. Las claves internas siguen siendo
  `'laptop'`/`'desktop'`, sin cambios de código más allá de las etiquetas visibles.

### Pendiente
- Confirmar en un build real que los radio buttons de `installer.nsh` (sin emoji) se ven bien, y
  que el emoji sí renderiza correctamente en el panel web de Configuración.

---

## 🐛 Menú de modelos locales del chat mostraba siempre la lista de desktop

### Contexto
El usuario cambió el perfil a "Breeze" desde Configuración → Preferencias (confirmado guardado
correctamente), pero el desplegable de modelos del chat (botón "modo: Automático" → lista
manual) seguía mostrando los modelos de desktop (Hermes 8B, LLaMA 3.1 8B, Qwen 2.5 14B, etc.) en
vez de los de laptop.

### Causa
`frontend/app.js` llamaba a `renderLocalModels(menuViewLocal, ...)` (línea ~138, código de nivel
superior del módulo) **antes** de `await initHardwareProfile()` (línea ~245, más abajo en el
mismo archivo). Como `HARDWARE_PROFILE` en `models.js` arranca en `'desktop'` por default y solo
se actualiza cuando `initHardwareProfile()` resuelve el fetch a `/hardware-profile`, el menú se
armaba SIEMPRE con la lista de desktop, sin importar el perfil real guardado — ni un reinicio de
la app lo arreglaba, porque `renderLocalModels()` nunca se volvía a llamar después del primer
render (confirmado: un solo call-site en todo el frontend).

No era un problema del filtrado en sí (`MODEL_PROFILES[HARDWARE_PROFILE]` en `models.js` está
bien armado, un array por perfil) — era el orden de ejecución: la lista se construía con un
`HARDWARE_PROFILE` que todavía no reflejaba el valor real.

### Fix
- Se sacó la llamada a `renderLocalModels(...)` de su ubicación original (código de nivel
  superior, corría antes del `await`) y se armó como `refreshLocalModelsMenu()`, invocada recién
  después de `await initHardwareProfile()` — ahí `HARDWARE_PROFILE` ya tiene el valor resuelto.
- Además, se agregó un evento custom (`window.dispatchEvent(new
  CustomEvent('hardwareprofile-changed'))`) que dispara `settings.js` cuando el usuario cambia el
  perfil desde Preferencias, y `app.js` escucha ese evento para volver a armar el menú — así el
  desplegable de modelos del chat se actualiza en vivo sin reiniciar la app, mismo comportamiento
  que ya tenía el panel Configuración → Modelos (`_renderModelsList()`) desde antes.
- El callback `onSelect` que antes era una arrow function inline se extrajo a una función nombrada
  (`onLocalModelSelect`) para poder reusarla en cada re-render sin duplicar código.

### Pendiente
- Confirmar en una build real que, después del fix, el desplegable muestra los modelos de laptop
  desde el primer arranque (sin tener que tocar Preferencias) y que cambiar el perfil ahí
  refresca el desplegable sin reiniciar la app.

---

## 🧠 Modelos de razonamiento/análisis para Breeze (laptop)

### Contexto
El usuario notó que el selector manual de laptop (Breeze) no tenía equivalente a lo que Storm
(desktop) cubre como funciones separadas: "Razonamiento" (`qwen2.5-7b-q5`) y "Análisis"/"Análisis
profundo" (`gemma-2-9b-q4`/`qwen2.5-14b-q3`). Pidió explícitamente buscar en internet qué modelos
reales existen para esas funciones en el rango de tamaño que entra en 6GB VRAM — no simular ni
asumir que ya estaba cubierto por lo que hay descargado.

### Investigación
Búsqueda web (no hay nada de esto en el catálogo previo de Tempest, son modelos nuevos):
- **Razonamiento**: `Phi-4-mini-reasoning` (Microsoft, 3.8B, MIT) — a diferencia de los modelos
  generales ya presentes en laptop, este está afinado específicamente con cadenas de
  razonamiento matemático/lógico paso a paso, no es un genérico más.
- **Análisis**: `Qwen3-8B` (Alibaba, Apache 2.0) — el salto de tamaño real (8B vs los 3B de
  laptop) que hace que "análisis" sea una función distinta y no una cuarta variación del mismo
  nivel de capacidad, siguiendo el mismo criterio con el que se descartó antes tener un 4to
  modelo general redundante.
- Se descartó reproducir el esquema de desktop de DOS funciones separadas ("análisis" +
  "análisis profundo") — un modelo de 14B (como `qwen2.5-14b-q3` en desktop) no entra de forma
  confiable en 6GB VRAM. Una sola función "Análisis" con Qwen3-8B es el techo realista para esta
  VRAM.

### Fuente y verificación
GGUF confirmados en Hugging Face, sha256 (`lfs.oid`) sacado de la API de HF (`/api/models/{repo}/tree/main`),
mismo método que el resto del catálogo:
- `bartowski/microsoft_Phi-4-mini-reasoning-GGUF` → `microsoft_Phi-4-mini-reasoning-Q4_K_M.gguf` (2.49GB)
- `bartowski/Qwen_Qwen3-8B-GGUF` → `Qwen_Qwen3-8B-Q4_K_M.gguf` (5.03GB)

### Implementación
Agregados como `required: false` (descarga manual, no bloquean el primer arranque) y tageados
`'laptop'` en `UNMATRIXED_PROFILE_TAGS` (selección manual, igual que `qwen2.5-7b-q5`/
`gemma-2-9b-q4` en desktop — no están conectados a ningún alias de `capability.matrix.js`, no
los elige el router automático):
- `backend/services/localai.service.js` → `MODEL_FILES`
- `backend/services/localai/models.catalog.js` → `DOWNLOAD_INFO` + `UNMATRIXED_PROFILE_TAGS`
- `backend/services/localai/token.profiles.js` → `MODEL_CONTEXT_SIZES` (8192 para
  phi-4-mini-reasoning pese a soportar 128K nativo — limitado por VRAM disponible, no por el
  modelo; 6144 para qwen3-8b, mismo criterio que `qwen2.5-14b-q3` en desktop: modelo grande,
  contexto reducido) y `HARDWARE_TOKEN_PROFILES.laptop` (presupuesto de tokens de salida más alto
  para `phi-4-mini-reasoning` — un modelo de razonamiento genera cadena de pensamiento antes de
  la respuesta final, se corta a mitad de camino con el default de laptop)
- `frontend/modules/models.js` → `MODEL_PROFILES.laptop`, con las etiquetas "Razonamiento" y
  "Análisis" en los labels

### Riesgo real encontrado, NO resuelto a ciegas
`llama.provider.js` → `getChatWrapperName()` mapea cualquier archivo con "phi" en el nombre a
`ChatMLChatWrapper` — pero el `chat_template` real embebido en el GGUF de Phi-4-mini-reasoning
(confirmado contra la API de HF) usa tags `<|system|>`/`<|user|>`/`<|assistant|>`/`<|end|>`, NO
el formato ChatML (`<|im_start|>`/`<|im_end|>`). Es la misma clase de bug documentada arriba para
`phi-3-mini-q4` en la era LocalAI (`message.content` vacío por template mal aplicado) — no hay
forma de confirmar desde este entorno si node-llama-cpp lo tolera mejor con este wrapper
incorrecto o no. **No se cambió el wrapper a ciegas sin poder probarlo.**

`qwen3-8b` no tiene este riesgo — su `chat_template` real ya usa tags ChatML, que es lo que
espera el wrapper `'qwen'` ya usado con éxito por el resto de los modelos Qwen del catálogo.

### Pendiente
- **Probar `phi-4-mini-reasoning` en real apenas se descargue.** Si las respuestas salen vacías
  o con contenido corrupto (mismo síntoma que el bug histórico de `phi-3-mini-q4`), la causa más
  probable es el wrapper — cambiar a `JinjaTemplateChatWrapper` de node-llama-cpp (lee el
  template real embebido en el GGUF) o a `resolveChatWrapper()` (función propia de node-llama-cpp
  que auto-detecta el mejor wrapper por modelo) en vez de mantener el mapeo manual por nombre de
  archivo de `getChatWrapperName()`. Esta función manual quedó como una fuente de riesgo genérica
  — cualquier modelo nuevo que no calce con los 5 wrappers hardcodeados cae en ChatML "por las
  dudas", sin garantía de que sea correcto.
- Confirmar en un build real que ambos modelos aparecen en el panel Configuración → Modelos y en
  el desplegable manual del chat, solo bajo el perfil Breeze.

---

## 🛠️ `npm run build` fallaba: macro `MUI_HEADER_TEXT` no encontrada

### Contexto
Primer `npm run build` real en Windows (laptop) con `build/installer.nsh` ya incluido en
`package.json` → `build.nsis.include`. El empaquetado de la app (`dist\win-unpacked`) terminó
bien, pero la compilación del instalador NSIS abortó:

```
!insertmacro: macro named "MUI_HEADER_TEXT" not found!
!include: error in script: "...\build\installer.nsh" on line 100
Error in script "<stdin>" on line 75 -- aborting creation process
```

### Causa
`installer.nsh` usa `!insertmacro MUI_HEADER_TEXT` (en `HardwareProfilePageShow` y
`CudaToolkitPageShow`) para poner título/subtítulo a las páginas custom, pero el archivo solo
tenía `!include "nsDialogs.nsh"` y `!include "LogicLib.nsh"` — nunca incluía `MUI2.nsh`, que es
donde vive esa macro. El script base de electron-builder sí usa Modern UI 2 (se ve en las
variables `MUI_WELCOMEFINISHPAGE_BITMAP` del log), pero eso no alcanza para que la macro esté
disponible dentro de un archivo incluido aparte vía `customPageAfterChangeDir` — cada script
`!include`do necesita sus propios `!include` de las macros que usa.

### Fix
Se agregó `!include "MUI2.nsh"` al principio de `installer.nsh`, junto a los otros dos includes.

### Pendiente
- Confirmar que el resto del build (las dos páginas custom, el `customInstall`) compila y corre
  bien de punta a punta ahora que este error puntual está resuelto — puede haber más errores de
  NSIS todavía no descubiertos, este fue el primero que cortó la compilación.

---

## 🛠️ `npm run build` fallaba: warning 6010, función de página no referenciada

### Contexto
Con el fix de `MUI2.nsh` aplicado, el segundo `npm run build` avanzó más pero volvió a abortar:

```
warning 6010: install function "HardwareProfilePageShow" not referenced - zeroing code (0-58) out
Error: warning treated as error
```

### Causa
electron-builder compila `installer.nsi` **dos veces**: una pasada con `BUILD_UNINSTALLER`
definido (genera el `uninstaller.exe` que queda embebido en el instalador final) y otra sin
definir (el instalador real). `build/installer.nsh` se incluye tal cual en las dos pasadas
(`NsisTarget.js` lo agrega sin condicionar a `BUILD_UNINSTALLER`), pero el hook
`customPageAfterChangeDir` — el que efectivamente llama `Page custom HardwareProfilePageShow ...`
— vive dentro de `assistedInstaller.nsh` envuelto en `!ifndef BUILD_UNINSTALLER`, así que en la
pasada del uninstaller ese `Page custom` nunca se ejecuta. Resultado: las `Function` de las
páginas custom quedan definidas pero sin nada que las referencie en esa pasada — NSIS las
detecta como código muerto (warning 6010) y electron-builder trata cualquier warning de NSIS
como error fatal, abortando el build completo (no solo esa pasada).

### Fix
Se envolvió todo el contenido "de instalación" de `installer.nsh` (los `Var`, el macro
`customPageAfterChangeDir`, las 4 `Function` de las páginas custom y el macro `customInstall`)
en `!ifndef BUILD_UNINSTALLER ... !endif`. Así, en la pasada del uninstaller esas Functions ni
siquiera se definen — no hay código huérfano que genere el warning. Mismo patrón que usa el
propio template de electron-builder en varios de sus bloques (`installer.nsi` envuelve la
`Section "install"` completa igual).

### Descartado
- Suprimir el warning con algún flag de `makensis` (`-WX-` o similar) — electron-builder no
  expone esa opción de configuración, y aunque se pudiera, taparía cualquier warning real futuro
  en vez de arreglar la causa.

### Pendiente
- Confirmar que un build completo (las dos pasadas) termina sin más warnings ahora que el
  contenido está correctamente separado por pasada.

---

## 🗑️ `phi-3-mini-q4` eliminado del catálogo (node-llama-cpp)

### Contexto
`phi-3-mini-q4` ya había sido descartado antes como modelo de LocalAI por un bug de template
(ver más arriba: `message.content` vacío). Pese a eso, sobrevivió como entrada `required: false`
en `models.catalog.js` durante la migración a node-llama-cpp — sin bug conocido en este motor,
pero también sin estar conectado a ningún alias de `capability.matrix.js` ni al selector manual
del frontend (`MODEL_PROFILES` en `frontend/modules/models.js`). Es decir: aparecía en el
catálogo de descarga pero no cumplía ninguna función real, ni automática ni manual.

### Decisión
El usuario confirmó que las 3 funciones generales de laptop (rápido/moderado/inteligente) ya
están cubiertas por `qwen2.5-3b-q4` / `qwen2.5-3b-q5` / `llama-3.2-3b-q8`, y que no hay ningún
caso de uso pendiente para un 4to modelo general. Se eliminó `phi-3-mini-q4` de:
- `backend/services/localai.service.js` → `MODEL_FILES`
- `backend/services/localai/models.catalog.js` → `DOWNLOAD_INFO` y `UNMATRIXED_PROFILE_TAGS`
- `backend/services/localai/token.profiles.js` → `MODEL_CONTEXT_SIZES`

### Descartado
- Mantenerlo "por si acaso" — mismo criterio que se aplicó con `llama-3.2-3b-q4` (dedicado a
  títulos, tiene función propia) vs. este caso (sin función propia ni compartida).

### Pendiente / dónde puede fallar
- Queda un archivo huérfano `models-localai/phi-3-mini-q4.yaml` (config de la era LocalAI,
  previa a node-llama-cpp) — no lo lee ningún código actual, se puede borrar a mano si se quiere
  limpiar la carpeta, no es necesario para el funcionamiento de Tempest.
- Si en el futuro se vuelve a agregar Phi-3 al catálogo, revisar primero si el bug de template
  documentado arriba sigue aplicando (ese bug era específico de LocalAI/Docker, no de
  node-llama-cpp — no hay evidencia todavía de que se repita en el motor actual).

---

## 🎚️ Perfil de hardware: 3 niveles reales para laptop (rápido/moderado/inteligente)

### Contexto
El usuario confirmó, al retomar el proyecto en la laptop, que su forma de usar los modelos
generales es siempre con 3 niveles: rápido, moderado, inteligente — exactamente lo que ya
existía en el selector manual (`MODEL_PROFILES.laptop` en `frontend/modules/models.js`:
`qwen2.5-3b-q4` / `qwen2.5-3b-q5` / `llama-3.2-3b-q8`). Pero `capability.matrix.js` (el router
que elige el modelo cuando el chat está en modo "Automático") solo tenía 2 modelos reales para
laptop: `explain-deep` apuntaba al mismo `qwen2.5-3b-q5` que `general-standard` — el nivel
"inteligente" no existía en el automático, solo en el selector manual.

De paso se aclaró una confusión de nomenclatura: `llama-3.2-3b-q4` (Q4, sin participar del
router) NO es lo mismo que `llama-3.2-3b-q8` (Q8, sí está en el selector manual como
"Inteligente"). MODELS.md tenía una nota ("ya es el modelo de chat en laptop") que hablaba del
Q4 pero en realidad describía un rol que corresponde al Q8 — corregida.

### Decisión
`MATRIX.laptop['explain-deep']` pasa de `qwen2.5-3b-q5` a `llama-3.2-3b-q8` en
`capability.matrix.js`. Con esto el router automático usa los mismos 3 modelos reales que el
selector manual: `general-fast` = rápido (`qwen2.5-3b-q4`), `general-standard` = moderado
(`qwen2.5-3b-q5`), `explain-deep` = inteligente (`llama-3.2-3b-q8`). El modelo requerido del
primer arranque no cambia — sigue siendo `general-fast` (`qwen2.5-3b-q4`), consistente con el
nivel "rápido" que ya usaba antes de este ajuste.

### Alternativa descartada
Cambiar el modelo *requerido* del primer arranque de `qwen2.5-3b-q4` a `llama-3.2-3b-q8` —
descartada tras confirmar con el usuario que `qwen2.5-3b-q4` sí es el modelo real que usa el
router en "Automático" hoy (el nivel rápido), y que `llama-3.2-3b-q4` (no q8) es el que solo se
usa para títulos. No había necesidad real de cambiar el requerido, solo de completar el nivel
"inteligente" que faltaba en el automático.

### Pendiente / dónde puede fallar
`HARDWARE_TOKEN_PROFILES.laptop` en `token.profiles.js` no tiene una entrada propia para
`llama-3.2-3b-q8` — cae al `default` del perfil laptop (`{ normal: 500, code: 900, continue: 900 }`,
los mismos valores que `qwen2.5-3b-q4`). No es un error bloqueante, pero tampoco está afinado
para ese modelo específicamente — si en el uso real da respuestas cortadas o demasiado largas
en el nivel "inteligente", ese es el primer lugar a revisar.

---

## 📂 Instalador — EPERM al escribir dentro de Program Files

### Contexto
Con el instalador NSIS ya armado (ver sección anterior), instalar en `C:\Program Files\` y
después abrir la app normalmente (sin "Ejecutar como administrador") tira:
`EPERM: operation not permitted, mkdir 'C:\Program Files\Tempest IA\resources\app\backend\uploads\attachments'`.

Causa: Windows protege `Program Files` — un proceso normal (sin el prompt de UAC) no puede
crear archivos/carpetas ahí, sin importar si la cuenta es administradora. El instalador
copia los archivos ahí bien (con permisos elevados durante la instalación), pero la app
corre después SIN esos permisos, así que cualquier `mkdir`/`writeFile` dentro de su propia
carpeta de instalación falla. `backend/uploads/attachments` fue el primer caso que saltó,
pero el mismo problema aplicaba a `backend/data` (usuarios, memoria, contexto de proyectos),
`backend/outputs` (transcripciones, documentos generados), `backend/logs`, y a los modelos
GGUF/Whisper descargados por el feature nuevo (`MODELS_DIR` apuntaba junto al `.exe`).

### Opciones evaluadas
- **Instalación fija en `%LocalAppData%\Programs\...`, sin dejar elegir carpeta** —
  aplicada como parche temporal (`allowToChangeInstallationDirectory: false`) mientras se
  decidía el arreglo de fondo. Descartada como solución final: el usuario pidió explícitamente
  poder elegir dónde instalar (como ya hacía antes, ej. en una unidad H:).
- **Elegida: mover TODOS los datos escribibles a la carpeta de datos del usuario
  (`app.getPath('userData')`), separada de dónde está instalada la app.** Es el patrón
  estándar de cualquier instalador de Windows serio — la carpeta de instalación es de solo
  lectura en el uso normal; todo lo que la app necesita escribir vive en el perfil del
  usuario. Con esto, la app funciona igual sin importar dónde se instale (Program Files,
  H:, donde sea), así que se pudo reactivar el selector de carpeta.

### Implementación
- **`backend/config/appPaths.js` (nuevo)** — única fuente de verdad de las carpetas
  escribibles: `DATA_DIR`, `UPLOADS_DIR`, `OUTPUTS_DIR`, `LOGS_DIR`, todas derivadas de
  `APP_DATA_DIR` (env var `APP_DATA_DIR` si está seteada, si no `backend/` tal cual — cero
  cambio de comportamiento en desarrollo).
- **`shell/main.js`** — en `startBackend()`, si `app.isPackaged`, setea
  `process.env.APP_DATA_DIR = app.getPath('userData')` antes de requerir `server.js` (mismo
  patrón ya usado para `MODELS_DIR`). Además, `MODELS_DIR` empaquetado dejó de vivir junto al
  `.exe` (`path.dirname(process.execPath)`) — ahora vive junto a `APP_DATA_DIR`, mismo
  razonamiento: si el `.exe` está en Program Files, descargar un modelo ahí tendría el mismo
  EPERM.
- **13 archivos del backend actualizados** para importar de `appPaths.js` en vez de calcular
  su propia ruta con `path.join(__dirname, ...)`: `server.js`, `auth.service.js`,
  `context.service.js`, `context.routes.js`, `transcription.routes.js`,
  `transcription.service.js`, `memory.service.js`, `search.service.js`,
  `document.service.js`, `chat.routes.js`, `project.loader.js`, `chat.controller.js`,
  `devMode.service.js`. Los binarios estáticos (`whisper-cli.exe`, prompts empaquetados)
  siguen relativos a `__dirname` a propósito — no son datos escribibles, viven bien dentro de
  la carpeta de instalación.
- **Bug extra encontrado de paso:** `ocr.service.js` calculaba su cache con
  `path.join(process.cwd(), 'backend', 'data', 'ocr-cache')` — todavía más frágil que
  `__dirname` (depende de desde dónde se lanzó el proceso, no de dónde vive el archivo).
  Corregido para usar `DATA_DIR` también.
- **`package.json`** — `nsis.perMachine: false` (instala por usuario, nunca pide admin) +
  `allowToChangeInstallationDirectory: true` (reactivado — ya no hace falta bloquearlo).

### Limitación conocida
`app.getPath('userData')` en Windows resuelve a `%AppData%\Tempest IA` (perfil **Roaming**).
Para datos chicos (config, `users.json`, historial de chats) es correcto. Para los modelos
GGUF/Whisper (varios GB) lo ideal sería un perfil **Local** (`%LocalAppData%`), ya que Roaming
está pensado para sincronizarse en entornos de dominio/empresariales y no para archivos
grandes tipo caché. Funciona igual (no hay bug), pero no es el lugar semánticamente correcto
a largo plazo — queda pendiente separar modelos hacia `app.getPath('appData')` +
`Local\Tempest IA\models-localai` si esto molesta en la práctica (perfiles de dominio, backup
de Roaming innecesariamente pesado, etc.).

### Pendiente
- Smoke test real: instalar eligiendo `C:\Program Files\Tempest IA` a propósito y confirmar
  que arranca sin EPERM, con los modelos descargándose en `%AppData%\Tempest IA\models-localai`.
- Evaluar mover `models-localai` a `%LocalAppData%` en vez de `%AppData%` (ver limitación
  arriba).
- El `extraResources` de `package.json` sigue copiando los `.yaml` de `models-localai/` (ver
  bloque `build.extraResources`) — quedó huérfano ahora que los modelos reales no viven junto
  al `.exe`; no rompe nada pero es peso muerto en el instalador, se puede limpiar después.

---

## 🔄 Auto-actualizaciones con electron-updater (v2.18.0)

### Decisión
Usar `electron-updater` apuntando a GitHub Releases como fuente de actualizaciones —
aprovecha el flujo de versionado que ya existe (`git tag vX.X.X` + `git push origin vX.X.X`,
documentado en las instrucciones del proyecto) en vez de armar infraestructura de updates
propia (servidor, S3, etc.).

### Por qué sin token
Se confirmó que el repo `royvwork89-oss/Tempest-ai-assistant` es **público**
(`repository_public: true`, 45 releases ya publicados y visibles sin sesión iniciada). Los
repos públicos permiten leer releases y descargar assets sin autenticación — así que la app
distribuida a terceros no necesita ningún token de GitHub embebido (evita el riesgo de
seguridad de un token dentro de un binario público). Si el repo se volviera privado en el
futuro, esto habría que revisarlo — el feed dejaría de ser accesible sin credenciales.

### Implementación
- **`package.json`** — `electron-updater` como dependencia normal (no dev — corre dentro del
  proceso principal empaquetado). Bloque `build.publish` con `provider: github` +
  `owner`/`repo` — esto es lo que hace que `electron-builder` genere `latest.yml` en cada
  build (`dist/latest.yml`), el archivo que `electron-updater` lee para saber si hay una
  versión más nueva.
- **`shell/main.js`** — `initAutoUpdater()`, llamada una sola vez después de `createWindow()`
  (no bloquea el arranque, corre en segundo plano). Guardas:
  - `if (!app.isPackaged) return` — en desarrollo no hay `latest.yml` real que leer,
    `electron-updater` tiraría error sin aportar nada.
  - Todo envuelto en manejo de error que solo logea (`autoUpdater.on('error', ...)` y
    `.catch()` en `checkForUpdates()`) — igual que el chequeo de inventario de modelos, un
    fallo acá (sin internet, GitHub caído) nunca debe impedir que la app se use normalmente.
  - `update-downloaded` dispara un `dialog.showMessageBox` con "Reiniciar ahora" / "Más
    tarde" — nunca reinicia sin que el usuario lo confirme.

### Flujo de release (a partir de ahora)
Además de los comandos ya documentados (`git tag`, `git push`), para que una versión nueva
llegue a los usuarios como auto-update hace falta:
1. `npm run build` — genera el instalador Y `dist/latest.yml`.
2. Subir el instalador (`.exe`) **y** `latest.yml` como assets del GitHub Release de ese tag.
   Sin `latest.yml` en el Release, ningún usuario instalado va a detectar la actualización,
   sin importar cuántos tags se hagan.
   - Alternativa más directa: `npm run build -- --publish always` con la variable de entorno
     `GH_TOKEN` seteada (token personal con permiso `repo`, solo en la máquina de quien
     builda — nunca se distribuye) — electron-builder crea el Release y sube todo solo.

### Limitaciones conocidas
- **No probado de punta a punta todavía** — falta correr `npm install` en el proyecto real
  (la dependencia está en `package.json` pero no instalada) y hacer un release de prueba real
  para confirmar que una instalación vieja detecta y aplica la actualización.
- Solo funciona con el instalador NSIS — el build portable (`win-unpacked`) no tiene mecanismo
  de auto-reemplazo de archivos.
- Sin firma de código, el instalador que baja la actualización sigue disparando el aviso de
  SmartScreen de Windows en cada versión nueva, no solo en la instalación inicial.
- No hay botón manual de "buscar actualizaciones" en la UI todavía — el chequeo es automático
  al arrancar, silencioso si no hay nada nuevo. Se puede agregar un botón en Configuración →
  Preferencias más adelante si hace falta.

### Actualización — smoke test real + estado visual mejorado
Smoke test corrido por el usuario en Windows (`npm start` con los 16 modelos ya en disco):
`models.inventory` detectó los 16 correctamente (15 chat + Whisper), avisó de 3 opcionales
faltantes sin bloquear el arranque, no disparó descarga (los 2 requeridos ya estaban) y cargó
el modelo normal — sin regresiones. `npm run build` también corrió sin errores con el target
`dir` (portable) que ya existía.

Como todos los modelos requeridos ya estaban en disco antes de este smoke test, no se ejercitó
el camino real de descarga (solo se confirmó que el chequeo de inventario y el panel leen bien
el estado existente). Queda pendiente para el usuario forzar una descarga real (mover un
modelo requerido fuera de `models-localai/` y usar el botón Descargar del panel) — instrucciones
dadas en el chat: comparar el sha256 final con `Get-FileHash` de PowerShell contra los valores
de este documento es la verificación más fuerte, porque si el archivo no coincide byte a byte
el downloader lo descarta automáticamente y nunca llega a mostrarse como "Descargado".

**Feedback del usuario:** el estado de "Descargando… NN%" en texto plano no alcanzaba para
confiar en que la descarga era real — pidió barra de progreso visual, MB descargados/total, y
diferenciar claramente "descargando" / "en cola" / "cancelada por error de conexión o servidor".

**Decidido:** solo la parte de estado visual (barra + MB + velocidad estimada + distinción de
estados), NO pausar/reanudar — eso requiere HTTP Range y cancelación real de la conexión en
`model.downloader.service.js`, cambio más grande que se deja para cuando haga falta en la
práctica (ver "Pendiente" arriba).

**Bug encontrado en el primer instalador NSIS real:** el `.env` local (con `MODELS_DIR`
hardcodeado a la carpeta de desarrollo, más `JWT_SECRET` y la API key real de Tavily) se
empaquetaba dentro del instalador — `package.json` → `build.files` no lo excluía (`.gitignore`
es un mecanismo distinto, no afecta a electron-builder). `shell/main.js` carga `.env` antes de
decidir el fallback de `MODELS_DIR` para app empaquetada, así que la app instalada seguía
apuntando a la carpeta de desarrollo del usuario en vez de a su propia carpeta vacía — por eso
el primer smoke test del instalador no mostró ninguna descarga (estaba usando modelos que ya
existían en otro lado) y, más grave, cualquier instalador distribuido a un tercero venía con
credenciales reales adentro. **Fix:** agregado `"!.env"` a `build.files` en `package.json`.

**Implementado:**
- `model.downloader.service.js`: nuevo estado `'queued'` + `markQueued(modelId)` — antes, un
  modelo requerido que todavía no le tocaba el turno no tenía ningún estado (`getDownloadState`
  devolvía `null`), indistinguible de "no hay nada pendiente". `server.js` ahora marca todos
  los `missingRequired` como `queued` antes de arrancar el loop secuencial.
- `settings.js`: `_modelStatusMeta()` reemplaza al viejo `_modelStatusLabel()` — agrega barra
  de progreso real (ancho = % exacto, o animación indeterminada para `queued`/`verifying`),
  texto con bytes descargados/total (`_formatBytes`), velocidad estimada **calculada en el
  cliente** comparando la lectura actual contra la anterior entre ticks del polling de 1.5s
  (`_lastProgress`, Map en memoria del módulo — no requirió nada nuevo del backend), y botón
  "Reintentar" en vez de "Descargar" cuando el estado es `error`. El mensaje de error se
  prefija con "Descarga cancelada" para que quede claro que no fue algo silencioso.

### Rediseño a revisión 100% manual (v2.18.0)

**Contexto:** el diseño inicial (arriba) chequeaba automáticamente al arrancar con
`autoDownload = true` — si encontraba una versión nueva, la bajaba sola en segundo plano y
recién interrumpía al usuario cuando ya estaba lista para instalar. El usuario pidió control
explícito: un botón "Revisar actualizaciones" dentro de Configuración → Preferencias, una
animación de carga mientras se consulta GitHub, y una confirmación explícita antes de bajar
nada — en vez de descubrir una descarga ya en curso sin haberla pedido.

**Decisión:** se reemplazó el chequeo automático al arrancar por un flujo 100% disparado por
el usuario. `autoUpdater.autoDownload` pasa de `true` a `false` — ahora nunca se descarga nada
sin un click explícito de "Actualizar ahora" en el modal de resultado. Se descartó mantener
ambos flujos (automático + manual) porque coordinar dos triggers distintos sobre el mismo
`autoUpdater` (uno pudiendo empezar a bajar mientras el otro está revisando) agregaba
complejidad de sincronización sin un beneficio claro — el usuario pidió específicamente el
flujo manual, no un complemento al automático.

**Implementación:**
- `shell/main.js`: `initAutoUpdater()` (chequeo silencioso al arrancar) se elimina; en su
  lugar quedan tres handlers IPC registrados una sola vez al cargar el módulo (no dependen de
  `app.isPackaged` para *registrarse* — sí para *funcionar*, así el renderer nunca se rompe
  llamándolos en modo desarrollo):
  - `get-app-version` — devuelve `app.getVersion()`, se muestra siempre junto al botón.
  - `check-for-updates` — dispara `autoUpdater.checkForUpdates()` y resuelve la promesa
    escuchando los eventos `update-available` / `update-not-available` / `error` con
    `.once()` (se remueven los listeners en cuanto resuelve, para no acumularlos en
    revisiones repetidas). Devuelve `{ ok, updateAvailable, currentVersion, latestVersion }`
    o `{ ok:false, error }`. Se decidió por eventos en vez de inspeccionar el valor resuelto
    por `checkForUpdates()` directamente porque esos tres eventos son el contrato documentado
    de electron-updater para saber si HAY algo más nuevo — el valor resuelto solo describe la
    última entrada del feed, no si es más nueva que la instalada.
  - `download-update` — solo se llama después de que el usuario confirma en el modal; envuelve
    `autoUpdater.downloadUpdate()`.
  - El listener de `update-downloaded` (diálogo nativo "Reiniciar ahora / Más tarde") se
    mantiene igual que antes — es independiente de qué disparó la descarga.
  - Guarda `_updateCheckInFlight` para que un doble click no dispare dos revisiones
    concurrentes pisándose los listeners `.once()` entre sí.
- `shell/preload.js`: expone `getAppVersion`, `checkForUpdates`, `downloadUpdate`.
- `frontend/settings.html`: nueva sección "Actualizaciones" dentro del panel Preferencias
  (junto a "Archivos", mismo patrón visual) con la versión actual, el botón y un spinner CSS
  (`@keyframes settings-spin`, mismo enfoque que los estilos ya embebidos en el archivo). Nuevo
  modal `updateCheckModal` (mismo markup que `changePasswordModal`/`createUserModal`) para el
  resultado — reutiliza `.modal-overlay`/`.modal-box`/`.modal-actions` existentes, no se agregó
  CSS nuevo de modal.
- `frontend/modules/settings.js`: `_bindUpdateCheck()` (llamada una vez desde `initSettings()`,
  que a su vez se llama una sola vez al arrancar la app — no hace falta guardia de listener
  duplicado, mismo criterio que `openTranscriptionsBtn` ya existente) maneja el spinner y llama
  `_showUpdateModal(result)`, que arma el modal según tres casos: error, actualización
  disponible (con botón "Actualizar ahora" que llama `downloadUpdate` y deja un mensaje de
  "descargando, te avisamos cuando esté lista"), o sin actualización ("estás en la última
  versión"). `cloneNode`+`replaceWith` en los botones del modal antes de re-atachar listeners,
  mismo patrón que los modales compartidos de context files, para no acumular handlers en
  revisiones repetidas.
- Fuera de Electron (navegador, `window.electronAPI` no existe) el botón queda deshabilitado
  con un tooltip explicando que es solo para la app de escritorio — mismo criterio que
  `openModelsFolder`/`openTranscriptionsFolder`.

**Limitación que sigue pendiente:** igual que antes, no se probó de punta a punta contra un
Release real de GitHub (requiere publicar una versión nueva con `latest.yml` y probar desde una
instalación vieja). El diseño manual no cambia esa necesidad de prueba, solo el disparador.

## 🌿 Separación de ramas: `main` como única rama pública (v2.18.0)

### Contexto
Con el auto-updater ya andando, publicar en GitHub deja de ser solo "guardar el trabajo" — un
`git push` + `git tag` en `work`/`dev` ahora puede terminar convirtiéndose en algo que, si se
crea un GitHub Release desde ese tag, los usuarios instalados detecten como actualización. Hacía
falta separar claramente "guardé mi progreso" de "esto ya es una versión pública". Se confirmó
además que `main` en el repo remoto está congelada en `v2.1.0` — nunca se actualizó desde ahí,
todo el trabajo real viene pasando por `work`/`dev`, que hoy están en `v2.17.1` (más los cambios
de v2.18.0 de esta sesión, todavía sin commitear).

### Decisión
- **`work`** — rama activa de desarrollo día a día. Sin cambios respecto a como se venía
  usando: acá se commitea todo, sin tag, sin build de instalador.
- **`dev`** — espejo de lo que el desarrollador ya ejecutó y probó localmente y funciona, pero
  todavía no necesariamente listo para el público. Sigue siendo el paso intermedio, igual que
  antes.
- **`main`** — pasa a ser la ÚNICA rama pública. Solo se toca cuando una versión está lista para
  salir a usuarios reales, y es la ÚNICA rama desde la que se cortan tags que después se
  convierten en GitHub Release con instalador (`.exe` + `latest.yml`) adjuntos. Un tag en
  `work`/`dev` que nunca llega a `main` no debe tener Release publicado — así el auto-updater
  (que lee Releases, no ramas) nunca ofrece a un usuario instalado algo que no pasó por `main`.

### Flujo actualizado
Día a día (sin cambios):
```
git add .
git commit -m "descripción"
git push origin work
```

Reflejar en `dev` cuando algo ya probado funciona (sin cambios):
```
git checkout dev
git merge work
git push origin dev
git checkout work
```

Publicar al público (NUEVO — único camino que debe terminar en GitHub Release + instalador):
```
git checkout main
git merge dev
git tag vX.X.X
git push origin main
git push origin vX.X.X
npm run build
# subir el .exe + dist/latest.yml como assets del Release de ese tag en GitHub
# (o: npm run build -- --publish always   con GH_TOKEN seteado, hace el Release solo)
git checkout work
```

### Por qué no fusionar todo a `main` de una
`main` va a "saltar" de `v2.1.0` a lo que sea la próxima versión publicada (probablemente
`v2.18.0` con este trabajo) en un solo merge — es esperado y correcto: las versiones son
acumulativas, no hace falta recrear cada paso intermedio en `main`, alcanza con que el estado
final sea el correcto.

### Limitaciones conocidas
- Esto es una convención de proceso, no algo forzado por Git ni por `electron-builder` — nada
  impide técnicamente tagear y buildear desde `work`/`dev` por error. Si en algún momento se
  quiere, se podría agregar un chequeo en CI que rechace builds con `--publish` si la rama
  actual no es `main`, pero no se implementó (no hay CI configurado en el proyecto todavía).

## 🖥️ Instalador: se revierte `oneClick` y se agrega aviso de reinstalar/actualizar (v2.18.0)

### Contexto
El usuario pidió volver a permitir elegir la carpeta de instalación (se había quitado al pasar
a `oneClick: true` por el bug de "el wizard asistido siempre defaultea a Program Files"
documentado arriba), y agregar un aviso al arrancar el instalador si ya hay una versión
instalada: "reinstalar" si es la misma versión, "actualizar" si la instalada es más vieja.

### Por qué ahora es seguro volver a `oneClick: false`
El motivo original para sacar el selector de carpeta fue que el wizard asistido defaulteaba a
`C:\Program Files\Tempest IA`, y ahí la app tiraba `EPERM` al intentar escribir `uploads/`,
`data/`, etc. dentro de su propia carpeta de instalación sin permisos de admin. Esa causa raíz
ya está resuelta desde la migración a `app.getPath('userData')` (`backend/config/appPaths.js`,
documentado arriba): la app ya NO escribe datos dentro de su carpeta de instalación sin importar
dónde se instale. El único riesgo que queda si alguien elige manualmente Program Files es que el
INSTALADOR (no la app) necesite permisos para copiar los archivos ahí — con `allowElevation`
en su default (`true`), NSIS pide elevación (UAC) automáticamente en ese caso, igual que
cualquier instalador de Windows normal — ya no es un fallo silencioso, es el flujo esperado.

### Decisión
`package.json` → `build.nsis`:
```json
"oneClick": false,
"perMachine": false,
"selectPerMachineByDefault": false,
"allowToChangeInstallationDirectory": true,
```
- `oneClick: false` — vuelve el wizard con página de carpeta.
- `perMachine: false` + `selectPerMachineByDefault: false` — mantiene el default en instalación
  per-user (`%LOCALAPPDATA%\Programs\Tempest IA`, sin admin, sin riesgo de permisos), verificado
  contra la interfaz `NsisOptions` de electron-builder y el issue #4070 (`selectPerMachineByDefault`
  es justamente la opción que controla qué queda preseleccionado en esa página). El usuario puede
  cambiar a "para todos los usuarios" o a otra carpeta si quiere — ya no es forzado a nada, pero
  el camino por defecto sigue siendo el seguro.
- `allowToChangeInstallationDirectory: true` — habilita la página de selección de carpeta.

### Aviso de reinstalar/actualizar — `build/installer.nsh`
Se confirmó (issue #2939 de electron-builder: *"It is possible, but we don't have plans to
implement it. Help wanted"*) que esto **no existe nativo** en electron-builder. Se implementó a
mano vía el hook `nsis.include` (que por default ya apunta a `build/installer.nsh` sin
declarar nada extra en `package.json`), usando primitivas que sí están confirmadas en el código
fuente real de electron-builder (`assistedInstaller.nsh`, `installer.nsh`):
- `$hasPerMachineInstallation` / `$hasPerUserInstallation` — strings `"1"`/`"0"` (no
  `"true"`/`"false"`) que electron-builder ya deja seteadas tras `initMultiUser`, indicando si
  hay una instalación previa per-machine o per-user.
- `${UNINSTALL_REGISTRY_KEY}` — constante inyectada por electron-builder, apunta a la clave de
  desinstalación de Windows donde queda `DisplayVersion` de la instalación previa.
- `${VersionCompare}` de `WordFunc.nsh` (NSIS estándar, **no** viene incluido por
  electron-builder — se agrega manualmente con `!include "WordFunc.nsh"` al principio del
  archivo) — compara la versión instalada contra `${VERSION}` (la del instalador actual) y
  dispara uno de tres `MessageBox`: reinstalar (misma versión), actualizar (instalada más
  vieja), o aviso de downgrade (instalada más nueva — caso extra agregado por seguridad, no
  pedido explícitamente pero de bajo costo).
- Todo el bloque envuelto en `!ifndef ONE_CLICK` — esas variables ni se declaran en builds
  `oneClick: true`, así que si en el futuro se vuelve a ese modo, este archivo no rompe la
  compilación, solo queda inactivo.

### Limitaciones conocidas
- **No probado contra un build real todavía** — requiere compilar en Windows (`npm run build`)
  para confirmar que el NSIS compila sin errores de sintaxis; un error ahí es ruidoso (falla el
  build, no corrompe nada), pero no se pudo verificar en este entorno de trabajo (sandbox Linux
  sin compilador NSIS de Windows).
- El mensaje es puramente informativo (`MessageBox MB_OK`) — no ofrece cancelar la instalación
  ni elegir entre reinstalar/actualizar, solo avisa antes de que el wizard siga con sus páginas
  normales. Si más adelante se quiere que el usuario pueda abortar ahí mismo, se puede cambiar a
  `MB_OKCANCEL` y leer `IDCANCEL` con `Abort`.
- No hay snippet de referencia verificado en un repo real de electron-builder para este patrón
  específico (reinstalar/actualizar) — se armó desde primitivas NSIS confirmadas por separado,
  no copiado de un ejemplo existente.

---

## 🔄 Panel Servicios/Usuarios no se refrescaba sin reiniciar la app (v2.18.0)

### Causa
El botón de Configuración solo alterna `modal.classList.remove('hidden')` — nunca vuelve a
pedir datos al backend. Toda la carga de perfiles/usuarios del panel Servicios (y la lista de
usuarios del panel Usuarios) vivía dentro de `initSettings()`, que se ejecuta UNA sola vez, al
arrancar la app (`app.js` la llama una vez). Cualquier cambio hecho fuera de los botones propios
de ese panel — por ejemplo un perfil creado desde otra sesión/máquina — no se reflejaba hasta
reiniciar la app entera; cerrar y reabrir el modal de Configuración no alcanzaba, porque eso
tampoco vuelve a ejecutar `initSettings()`.

### Solución
`frontend/modules/settings.js` — se separó la carga de datos de la asignación de listeners:
- `refreshServiciosData(preferredTarget)` y `loadUsers()` (ya existía, era idempotente por
  reconstruir el DOM vía `innerHTML`) son ahora funciones nombradas, reusables, que solo
  refrescan datos y reconstruyen las listas — nunca vuelven a registrar listeners.
- Dos referencias mutables a nivel de `initSettings()`, `_refreshServiciosPanel` y
  `_refreshUsuariosPanel` (arrancan como no-op, se reasignan a las funciones reales dentro de
  cada bloque `if (_isAdmin)`), enganchadas al mismo lugar donde ya existía el patrón de
  arrancar/parar el polling del panel Modelos al cambiar de pestaña (`navButtons` →
  `data-section`): `if (target === 'servicios') _refreshServiciosPanel();` /
  `if (target === 'usuarios') _refreshUsuariosPanel();`.
- Los listeners de los botones (Guardar, Probar, Nuevo perfil, Eliminar perfil, reasignar
  perfil) se siguen agregando UNA sola vez — el refresco solo toca los `<select>`/listas, nunca
  vuelve a llamar `addEventListener`, así que no hay riesgo de clicks duplicados al reabrir la
  pestaña varias veces.
- `admins`/`users`/`profiles` pasaron a mutarse en sitio (`.length = 0; .push(...)`) en vez de
  reasignarse, para que las funciones cerradas sobre esas referencias (`_rebuildMainSelect`,
  `loadSelectedPerms`) siempre vean los datos más recientes sin tener que redefinirse en cada
  refresh.

### Sin cambios de backend
Es un bug puramente de frontend — ningún endpoint ni contrato de datos cambió.

---

## 🖥️🖧 Modo Servidor/Cliente — decisión de diseño para v4.0

### Contexto
El usuario planteó un escenario real de despliegue futuro: una empresa con varios equipos, uno
solo con GPU actuando de servidor, y el resto conectándose a él en vez de tener gráfica propia
cada uno. Se discutió si esto implica mantener dos productos separados (una versión "hogar" y
una "empresa").

### Decisión: un solo producto, no dos
La única diferencia real entre "modo hogar" y "modo empresa" es DÓNDE corre la inferencia — la
misma máquina que muestra la interfaz (hogar) o una máquina servidor aparte (empresa). Todo lo
demás (login, multiusuario, chats, memoria, perfiles de búsqueda) es idéntico y ya funciona
igual de bien para una familia (ej. cuentas separadas de padre e hijo, ya soportado hoy sin
ningún cambio) que para una empresa — de hecho la separación por usuario ya construida esta
misma sesión (ver "✅ Implementado — aislamiento real de credenciales por perfil/usuario" arriba)
sirve para ambos casos sin modificación.

Se descarta mantener dos códigos/productos separados: el costo de mantenimiento (arreglar cada
bug dos veces, decidir en qué versión va cada feature nueva) supera por mucho la ganancia de
"simplificar" la versión hogar, cuando en la práctica el multiusuario no le agrega complejidad
real a quien no lo usa (un admin que no crea usuarios extra sigue viendo la app exactamente
igual que hoy).

En vez de eso: el mismo selector de perfil que ya se planea rediseñar en v4.0 (ver "🔌 Separación
Motor/Modelo" más abajo) pasa a decidir también esto — un perfil de hogar dice "esta máquina
corre los modelos ella misma" (como hoy), un perfil de "cliente remoto" dice "pregúntale a la
máquina servidor en esta dirección". Mismo instalador, mismo código, una rama más en la pantalla
de selección de perfil en vez de un modo "para quién" aparte.

### Orden de trabajo decidido (dependencia real, no solo preferencia)
1. **Perfiles de modelos flexibles primero** — ya es el ítem existente en ROADMAP.md bajo
   "🔌 Separación Motor/Modelo": reemplazar los perfiles hardcodeados `desktop`/`laptop` por
   configuración editable. Es el más autocontenido de los tres (no requiere motor nuevo ni red),
   y los otros dos dependen de que este exista primero — de lo contrario se estarían parchando
   dos veces sobre el sistema hardcodeado actual.
2. **Múltiples motores después** (LocalAI binario standalone) — con perfiles ya flexibles, cada
   función de un perfil puede declarar no solo qué modelo sino con qué motor corre, sin tener
   que rehacer el esquema. Es también la pieza que más facilita el paso 3: LocalAI ya sabe
   atender varias peticiones concurrentes por diseño, a diferencia del uso actual de
   node-llama-cpp (`llama.provider.js` crea un contexto nuevo por petición, sin cola ni batching
   — ver limitación abajo).
3. **Servidor/cliente al final** — depende de los dos anteriores (un "cliente remoto" es
   literalmente un perfil más, y el caso servidor se beneficia de tener LocalAI ya funcionando
   para la concurrencia) y es la pieza de mayor riesgo/superficie: ramas nuevas en el instalador,
   exponer la API en la red local (`0.0.0.0` en vez de `localhost`, CORS, firewall de Windows),
   control de concurrencia sobre una sola GPU compartida por varios usuarios, y compatibilidad de
   versiones cliente/servidor. Mejor abordarlo cuando lo de abajo ya esté validado en uso real,
   no en paralelo con lo demás.

### Limitación de fondo conocida (no resuelta por esta decisión, solo documentada)
Incluso con LocalAI como motor, una sola GPU (ej. RTX 4070 12GB) tiene un techo real de cuántas
conversaciones simultáneas puede atender bien — la VRAM es límite duro (cada conversación activa
reserva KV cache proporcional al `context_size` configurado, no al prompt real, límite ya
documentado arriba en "Context/Snapshot"), y el cómputo de la GPU es límite blando (más
conversaciones a la vez, más lenta cada una). Ningún cambio de arquitectura de software elimina
ese techo — como mucho, una cola de peticiones bien diseñada (o el continuous batching que trae
LocalAI/llama.cpp server) evita que el sistema se caiga o degrade mal al acercarse a él.

---

### v2.18.1 — Migración de sharp a jimp (preprocessor.js + vision.service.js)

**Contexto:** pendiente abierto desde v2.2.3 — `sharp` tiene binarios nativos que necesitan
`electron-rebuild`, con riesgo de romper el empaquetado de Electron. En esta sesión no se
confirmó una falla real de `electron-rebuild` en la máquina de desarrollo (no hay evidencia en
el repo de un build fallido por esta causa); se resolvió el pendiente de forma preventiva a
pedido del usuario, en vez de esperar a que el problema apareciera en un build real.

**Alcance decidido con el usuario:** el pendiente original solo mencionaba `preprocessor.js`,
pero `sharp` también se usaba en `vision.service.js` (redimensionado antes de mandar la imagen
al modelo de visión). Se le presentaron dos opciones — migrar solo `preprocessor.js` (cierra el
pendiente tal cual está escrito, pero `sharp` sigue siendo dependencia obligatoria) o migrar los
dos usos y sacar `sharp` del todo — y eligió la segunda: resolver el problema de raíz en vez de
dejarlo a medias.

**Alternativas evaluadas:**

| Opción | Evaluación | Decisión |
|--------|-----------|---------|
| jimp (puro JS) | Sin binarios nativos, 100% empaquetable en Electron sin `electron-rebuild`. Más lento que sharp, pero el preprocesado corre una sola vez por imagen adjunta, no en un hot path — la diferencia de performance es irrelevante en la práctica. | ✅ Elegida |
| Mantener sharp y confiar en `electron-rebuild` | Es exactamente el riesgo que motivó el pendiente original en v2.2.3. | ❌ Descartada |
| OpenCV.js / @techstark/opencv-js | Resuelve el mismo problema (grayscale/normalize/resize) pero es una dependencia mucho más pesada (WASM, varios MB) para una necesidad simple. | ❌ Descartada — sobredimensionada |

**Cambios en `preprocessor.js`:**
- `sharp(inputPath).metadata()` → `Jimp.read(inputPath)` + `image.bitmap.width` para detectar si necesita upscaling.
- `.grayscale()` → `.greyscale()` (mismo efecto, nombre distinto en la API de jimp).
- `.normalize()` → `.normalize()` (mismo nombre, mismo efecto: estira el contraste al rango dinámico completo).
- `.resize(MIN_WIDTH_FOR_UPSCALE, null, { fit: 'inside', kernel: 'lanczos3' })` → `.resize({ w: MIN_WIDTH_FOR_UPSCALE })` — jimp calcula el alto automáticamente preservando el aspect ratio cuando solo se pasa `w`, mismo comportamiento que `fit:'inside'` con un solo eje fijo. jimp no tiene selector de kernel (Lanczos3 vs bilineal); usa su propio algoritmo de 2 pasos internamente — no se detectó diferencia visual relevante en las pruebas.
- `.png({ compressionLevel: 0 }).toFile(outputPath)` → `.write(outputPath)` — jimp no expone `compressionLevel` para PNG; usa su compresión por defecto (sin pérdida de datos de imagen, solo cambia el tamaño del archivo en disco, no la calidad para OCR).
- Contrato público sin cambios: `preprocessImage(inputPath) → { outputPath, wasProcessed }`.

**Cambios en `vision.service.js`:**
- `sharp(filePath).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70 }).toFile(tmpPath)` → jimp no tiene un equivalente directo a `withoutEnlargement` en `scaleToFit()` (siempre escala al tamaño más grande que entra en el rectángulo dado, incluso agrandando imágenes chicas). Se implementó el guard a mano: `factor = Math.min(maxDim / width, maxDim / height)`; solo se llama `image.scaleToFit({ w: 1024, h: 1024 })` si `factor < 1`. Export final con `image.write(tmpPath, { quality: 70 })` — jimp infiere el formato JPEG por la extensión `.jpg` del `tmpPath` y aplica `quality` al encoder.
- Contrato público sin cambios: `describeImage(filePath, hint) → { description, model }`.

**Nota sobre la API de jimp (v1.6.1):** el import cambió respecto a versiones viejas de jimp —
`const { Jimp } = require('jimp')` (named export), no `const Jimp = require('jimp')` como en
jimp 0.x. Relevante si se busca documentación/ejemplos viejos de jimp online.

**Dependencias:** `sharp` (`^0.34.5`) eliminado de `backend/package.json`; `jimp@^1.6.1` agregado.
`npm uninstall sharp` + `npm install jimp@1.6.1` corridos directamente sobre el proyecto real
(no en el sandbox de desarrollo, que no tiene binarios nativos de Windows) — `package-lock.json`
regenerado, `node_modules` actualizado. Confirmado sin referencias sueltas a `require('sharp')`
en todo `backend/`.

**Validación:** `node --check` sin errores de sintaxis en ambos archivos. Smoke test funcional
corrido con el `node_modules` real del proyecto (`node -e` generando imágenes de prueba en
memoria, sin depender de un archivo adjunto real):
- `preprocessImage()` sobre una imagen blanca de 500×700 → upscale correcto a 1000×1400 (ancho mínimo respetado, aspect ratio preservado).
- Lógica de `vision.service.js` sobre una imagen de 3000×1500 → shrink correcto a 1024×512 (respeta el límite de 1024 en el eje más grande).
- Misma lógica sobre una imagen de 200×100 → sin cambios (no agranda imágenes chicas, replica `withoutEnlargement: true`).
- Export a JPEG con `quality: 70` confirmado (archivo generado y legible).

**Pendiente real:** no se corrió el benchmark de confianza OCR (77%→87%, medido originalmente
con sharp en v2.2.3) con la implementación nueva de jimp con la misma imagen de referencia. El
pipeline es funcionalmente equivalente (mismas operaciones: greyscale, normalize, resize), pero
el algoritmo de resize interno es distinto (jimp no ofrece Lanczos3) — recomendado repetir esa
medición con una imagen real de baja calidad antes de dar el reemplazo por completamente
validado. Tampoco se probó `describeImage()` end-to-end contra Ollama real en esta sesión (el
sandbox de desarrollo no tiene acceso a la red del usuario ni al proceso Ollama local).

**Actualización — probado en la máquina real (post-sesión):** el usuario subió un adjunto real
(`test_ocr_recibo.png`, imagen de baja resolución con ruido simulando foto de recibo) a través
de la UI de Tempest. Log real: `[image.extractor] OCR completo: test_ocr_recibo.png | confianza:
95% | cached: false`. No es la misma imagen de referencia del benchmark original 77%→87%, pero
confirma que el pipeline jimp (`preprocessor.js`) funciona end-to-end sobre un adjunto real y
produce una confianza alta — sin errores ni warnings de `[preprocessor]` en consola. Sigue
pendiente repetir con la imagen de referencia exacta para una comparación 1:1.

---

### v2.18.1 — Fix: `InsufficientMemoryError` cargando `llava-1.6` en perfil laptop (modo visual)

**Contexto:** encontrado durante las pruebas manuales del fix de sharp→jimp de arriba — no
relacionado con ese cambio. El usuario subió una imagen a un chat con el mensaje "Analiza los
archivos adjuntos"; `mode.router.js` clasificó el adjunto como `mode: 'visual'` (no es el mismo
camino que `image.extractor.js` → `vision.service.js` → Ollama documentado arriba — este es un
segundo camino de visión, independiente: `model.router` resuelve un modelo GGUF con capacidad
visual vía `capability.matrix.js`, `llava-1.6` en perfil laptop, y lo carga directamente con
`node-llama-cpp` a través de `llama.provider.js`, igual que cualquier modelo de chat normal).

**Error real (log de consola, perfil laptop):**
```
[llama] Cambiando modelo: ...qwen2.5-3b-instruct-q4_k_m.gguf → ...llava-v1.6-mistral-7b.Q4_K_M.gguf
[llama] Modelo listo ✅ ...llava-v1.6-mistral-7b.Q4_K_M.gguf
Error en chat.controller: InsufficientMemoryError: A context size of 4096 is too large for the available VRAM
    at ... LlamaContext._create ...
```
Los pesos del modelo cargan bien (`gpuLayers: 99`, todas las capas en GPU — mismo default que
cualquier otro modelo, `llama.provider.js` no diferencia por perfil de hardware). El fallo ocurre
después, al crear el contexto (KV cache) para la inferencia: `llava-1.6` es un modelo 7B (Mistral)
más un proyector de visión, y en la laptop (RTX 4050, VRAM bastante más chica que la RTX 4070 12GB
de desktop) casi no queda VRAM libre tras cargar los pesos — un `context_size` de 4096 no entra.

**Diagnóstico — no es un caso nuevo:** es la misma clase de error ya documentada arriba para
`deepseek-coder-6.7b-q6` (desktop): `InsufficientMemoryError con contextSize=3072 en Q4_K_M:
VRAM insuficiente. Resuelto bajando a 2048...`. `token.profiles.js → MODEL_CONTEXT_SIZES` es una
tabla global por modelo (no por combinación modelo+perfil), y a `llava-1.6` nunca se le bajó el
valor al agregarlo al router — quedó en 4096 sin haberse probado antes con un adjunto real en la
laptop.

**Fix aplicado:** `MODEL_CONTEXT_SIZES['llava-1.6']` bajado de `4096` a `2048` en
`token.profiles.js`, mismo criterio numérico que funcionó para `deepseek-coder-6.7b-q6` en el
caso citado arriba.

**Pendiente real — número no confirmado en la máquina real:** no se pudo medir la VRAM libre real
de la laptop del usuario desde este entorno de desarrollo (sandbox sin esa GPU). `2048` es una
extrapolación del fix ya validado para otro modelo con el mismo error, no una medición propia.
Si sigue fallando, el siguiente paso es bajar más (ej. `1024`) — y si con `1024` la respuesta de
`describeImage`/modo visual queda demasiado corta para ser útil, evaluar si conviene forzar el
camino de Ollama (`vision.service.js`) también para el modo `visual` en laptop, en vez de cargar
un segundo modelo GGUF pesado con `node-llama-cpp` en una GPU ya ajustada de VRAM.

**Confirmado en la máquina real (post-fix):** el usuario repitió la prueba con el mismo adjunto.
`llava-1.6` cargó, generó el contexto de 2048 sin error, y devolvió una descripción correcta de
la imagen (transcribió el texto de la factura de prueba con precisión). `2048` queda confirmado
como valor funcional en esta laptop — no hizo falta bajar a `1024`.

---

### v2.18.1 — Fix: fallback de título ilegible + segundo `InsufficientMemoryError` en `generateTitleFromText`

**Contexto:** al confirmar el fix de arriba, apareció un segundo error en la misma request —
distinto síntoma, misma causa de fondo (contención de VRAM con `llava-1.6` activo):
`Error en generateTitleFromText: A context size of 512 is too large for the available VRAM`. El
chat no se rompió (la respuesta visual llegó bien), pero el título automático del chat quedó mal:
`testocrrecibopng` en vez de algo legible.

**Dos bugs distintos, encadenados:**

1. **`generateTitleFromText` no excluía los modelos de visión de la contención de VRAM.** La
   función ya tenía protección para modelos pesados (`isHeavyModel`, agregada para el caso
   `qwen2.5-14b-q3` — ver "Confirmar de forma robusta el fix del bug deepseek-coder-6.7b-q6" en
   ROADMAP.md), pero el check solo miraba `'14b'`/`'qwen2.5-14b'`. `llava-1.6` (7B + proyector de
   visión, `gpuLayers: 99`) nunca se agregó a esa lista aunque sufre exactamente el mismo
   problema: casi no queda VRAM libre para un segundo contexto de título en paralelo. El modelo
   SÍ entraba en la condición externa (`activePath.includes('q4_k_m')` — el filename de llava
   matchea), pero `isHeavyModel` daba `false`, así que igual intentaba generar el título con el
   LLM en vez de ir directo al fallback — y ahí explotaba.
   **Fix:** `isHeavyModel` en `localai.service.js → generateTitleFromText` ahora también chequea
   `activePath.includes('llava') || activePath.includes('vl-7b')` — cubre `llava-1.6` (laptop) y
   `qwen2.5-vl-7b-q4` (desktop) por igual, mismo criterio preventivo que los modelos 14B.

2. **El fallback de título no separaba nombres de archivo en palabras.** Cuando no hay texto de
   usuario (adjuntar una imagen sola, sin escribir nada), el frontend (`chat.js` línea ~195) usa
   el nombre del archivo como `titleText`: `files.map(f => f.name).join(', ')`. Si
   `generateTitleFromText` falla (como en el caso de arriba) o no hay modelo disponible, cae en
   `buildFallbackTitle(text)`, que antes solo removía caracteres no alfanuméricos sin insertar
   espacios — `"test_ocr_recibo.png"` → se comía el `_` y el `.` sin reemplazarlos por espacio →
   `"testocrrecibopng"`, una sola palabra ilegible.
   **Fix:** `buildFallbackTitle` en `localai.service.js` ahora primero quita la extensión
   (`.replace(/\.\w{1,5}$/, '')`) y reemplaza `_`, `-`, `.` por espacio ANTES de limpiar
   caracteres especiales, y capitaliza la primera letra del resultado (mismo criterio que ya
   usa `cleanGeneratedTitle` en su camino normal). `"test_ocr_recibo.png"` → `"Test ocr recibo"`.
   Casos probados: `"Como instalar Docker en Windows"` → sin cambios (no es un filename, sigue
   igual); `"factura-2026-Q3.pdf"` → `"Factura 2026"`; `"IMG_20260724_084512.jpg"` →
   `"IMG 20260724 084512"` (mejor que antes, aunque sigue sin ser un título "lindo" — es un caso
   límite de nombres de archivo puramente numéricos, sin arreglo real posible sin entender el
   contenido).

**Validación:** `node --check` sin errores. Probado standalone (fuera del proyecto real, réplica
exacta de la lógica) con los 4 casos de arriba — resultados esperados confirmados.

**Confirmado en la máquina real:** el usuario repitió la prueba (misma imagen, sin texto). Título
final del chat: "Test ocr recibo" — legible, sin la palabra pegada de antes. Log limpio: no
aparece `Error en generateTitleFromText` ni `InsufficientMemoryError` en ningún punto de la
request. Los dos fixes de esta entrada quedan validados end-to-end.

**Nota de diseño para el futuro:** el nombre de archivo como fuente de título (cuando no hay
texto de usuario) es una fuente pobre en general — no dice nada del contenido de la imagen. Con
el flujo actual, para cuando se llama a `generateTitleFromText` ya existe una descripción real de
la imagen (`visionDescription` en `chat.controller.js`, o el texto de OCR extraído). Usar esa
descripción como `titleText` en vez del nombre de archivo crudo daría títulos mucho más útiles
("Factura de Licencia Software" en vez de "Test ocr recibo") — no se implementó en esta sesión
por ser un cambio de mayor alcance (toca el frontend `chat.js` y el orden en que se dispara
`tryAutoRename` respecto a la respuesta visual). Candidato para v3.0/v4.0.

---

### v2.18.1 — Confirmado: `modo visual` sin Ollama no hace análisis visual real

**Contexto:** al intentar probar `vision.service.js`/jimp con un adjunto real (`test_vision_diagrama.png`, un diagrama sin texto pensado para disparar el fallback de OCR baja confianza), se descubrió que el usuario no corre Ollama — decisión deliberada, ya tomada en la migración a `node-llama-cpp` (v2.10.0) precisamente para no depender de procesos externos.

**Lo que se confirmó con la prueba real:**
- OCR dio 56% de confianza (por debajo de `MIN_CONFIDENCE=60`, `ocr.service.js`), como se esperaba para un diagrama sin texto — correctamente entró en la rama de fallback de `image.extractor.js`.
- `isVisionAvailable()` (`vision.service.js`) hizo `fetch` a `http://localhost:11434/v1/models` (Ollama), no obtuvo respuesta, y devolvió `false` sin loguear nada — comportamiento correcto de degradación elegante, ya documentado como tal en el código (`// Útil para degradación elegante: si no está disponible, saltarse sin error`). `describeImage()` (nuestro código migrado a jimp) nunca se ejecutó — sigue sin poder probarse end-to-end en este entorno, pero el smoke test aislado + esta prueba de degradación son la validación disponible dado el setup del usuario.
- Sin `describeImage()`, `image.extractor.js` devolvió el placeholder genérico ("OCR procesado pero no se detectó texto legible"). El chat igual respondió porque `mode.router.js` clasifica cualquier adjunto de imagen como `mode: 'visual'` y carga `llava-1.6` directo vía `node-llama-cpp` (el mismo camino ya arreglado de VRAM en esta sesión) — pero la respuesta fue básicamente el texto del prompt de instrucciones repetido ("Si la imagen contiene texto impreso, transcribirlo... Si es un diagrama, describir su estructura..."), sin ninguna referencia real al contenido del diagrama.

**Causa raíz confirmada — no es un bug nuevo, ya estaba documentado:** `MODELS.md` (línea 60-61) ya dice explícitamente que ni `llava-1.6` ni `qwen2.5-vl-7b-q4` soportan multimodal en `node-llama-cpp` v3.18 — "disponible via Ollama" es la única vía real de visión funcional hoy. El modo `visual` vía `node-llama-cpp` carga los pesos y responde, pero nunca recibe los bytes de la imagen — por eso el resultado es una alucinación/eco del prompt en vez de una descripción real. El fix de `context_size` de esta sesión evita el crash, pero no hace que este camino "vea" nada; sigue siendo así, y va a seguir siéndolo mientras el usuario no use Ollama.

**Decisión:** dado que el usuario eligió explícitamente no correr Ollama, no tiene sentido insistir en esa dependencia. Se agregó un pendiente concreto y accionable en ROADMAP.md → "🔌 Separación Motor/Modelo" → "Motor Python de visión sin Ollama para Capability=Visión": un modelo multimodal chico corriendo vía subprocess Python (mismo patrón que `whisper-cli.exe`), sin servidor HTTP externo. Se descartó como respuesta suficiente el pendiente ya existente en 🔮 vX.x ("esperar a que node-llama-cpp v4.x soporte multimodal") porque depende de un tercero sin fecha — no es algo que el proyecto pueda resolver por su cuenta. También se descartó confundirlo con "Motor Transformers + TrOCR" (ítem ya existente en la misma sección), que es solo extracción de texto, no describe contenido visual.

**Alcance de esta sesión:** solo se documentó y se agregó el pendiente — no se implementó el motor Python de visión (es una pieza de arquitectura nueva, no un fix puntual, y encaja mejor como parte de "Separación Motor/Modelo" en v4.0).

---

### v2.18.1 — Confirmado: `npm run build` (electron-builder) completa sin errores de binarios nativos

**La prueba que responde a la razón original de toda la migración de sharp a jimp.** El usuario corrió `npm run build` en la máquina real de Windows. Resultado: `Tempest IA Setup 2.18.0.exe` generado, firmado con `signtool.exe` y con blockmap — sin un solo error de `electron-rebuild` ni de binarios nativos. Confirma de raíz que el pendiente original de v2.2.3 ("si sharp da problemas con electron-rebuild, reemplazar por jimp") queda resuelto — jimp no tiene binarios que compilar, nada que romper en el empaquetado.

**Incidente en el camino, no relacionado con sharp/jimp:** el primer intento de build falló con `EACCES: permission denied, lstat 'backend\node_modules\.bin\mime'`. Causa probable: los `npm install`/`npm uninstall` de esta sesión (quitar sharp, agregar jimp) se corrieron desde el entorno Linux de desarrollo contra la carpeta del proyecto montada en Windows — los symlinks que npm genera en `node_modules\.bin` se crean distinto en Linux que en Windows, y quedaron enlaces que Windows no podía resolver via `lstat`. **Fix:** borrar `backend/node_modules` y correr `npm install` directamente desde PowerShell en la máquina Windows real — regenera los symlinks correctamente. Con eso, el build completó limpio en el segundo intento. **Lección para la próxima:** evitar correr `npm install`/`npm uninstall` sobre este proyecto desde el entorno de desarrollo Linux — mejor dar los comandos para que el usuario los corra directamente en su Windows, incluso si es un paso manual extra.

**Nota aparte, sin resolver — vulnerabilidades de npm audit:** el `npm install` limpio reportó `7 vulnerabilities (1 low, 1 moderate, 4 high, 1 critical)`. No se investigó cuáles son ni si son explotables en el contexto de Tempest (mayormente dependencias de desarrollo/build, a evaluar) — no estaba en el alcance de esta sesión. Pendiente revisar con `npm audit` cuando haya tiempo, antes de un release público.

---

### v2.19.0 — Detección automática de Patch Mode sin frase mágica (verbo + archivo)

**Contexto:** pendiente real de v3.0. `mode.router.js` solo activaba `coder/patch` con
triggers explícitos (`PATCH_TRIGGERS`: "dame el diff", "en formato patch", etc.). Un mensaje
tipo "corrige el bug de restar en calculator.js" caía en `coder/strict` — generaba código
suelto en vez de un diff aplicable, obligando al usuario a conocer la frase mágica.

**Decisión:** nueva regla en `detectMode()` (`mode.router.js`) — si el proyecto tiene Context
Snapshot activo (`hasProjectContext`, nuevo parámetro) Y el mensaje contiene un verbo de
modificación (`MODIFY_VERBS`: corrige, arregla, modifica, actualiza, soluciona, repara — y
variantes "-me") Y menciona un archivo con extensión de código (`FILE_MENTION_REGEX`),
dispara `coder/patch` automáticamente. `chat.controller.js` calcula `hasProjectContext`
leyendo `context/index.json` y filtrando `source === 'snapshot'` — deliberadamente NO incluye
`source === 'linked-folder'`, porque `buildPatchGrounding()` (el que arma el contenido real
del diff) siempre filtró solo por `snapshot`; incluir carpeta vinculada habría activado Patch
Mode en proyectos donde el grounding sale vacío (ver primer error encontrado, abajo).

**Error encontrado durante la implementación:** la primera versión de `hasProjectContext`
incluía `source === 'linked-folder'` además de `'snapshot'`, replicando el criterio que ya
usa `mode.router.js` para otras cosas. Se detectó ANTES de probar en la app (revisando
`buildPatchGrounding`) que ese helper ignora `linked-folder` por completo — la Carpeta
vinculada es a propósito una fuente separada de Patch Mode (documentos, no código para diff,
ver ROADMAP v2.17.0). **Fix:** `hasProjectContext` (hoy `loadProjectSnapshotItems`, ver
entrada de "Modo Proyecto" más abajo) filtra únicamente `source === 'snapshot'`, igual que
`buildPatchGrounding`, para que ambos coincidan siempre.

**Validado end-to-end en la app real:** mensaje "corrige el bug de restar en calculator.js"
sobre un archivo de prueba con un bug a propósito (`restar()` devolvía `a + b` en vez de
`a - b`) → log `[MODE ROUTER] mode=coder variant=patch reason="edición de archivo existente
detectada automáticamente"` → grounding inyectado → diff generado correcto (`a - b`) → botón
Aplicar escribió el cambio real en el archivo (con el fix de `patchRenderer.js` de abajo).

**Alternativas descartadas:** ampliar `CODER_STRICT_TRIGGERS` en vez de una lista nueva — se
descartó porque esa lista mezcla intención de "crear código nuevo" con "modificar código
existente"; conceptualmente son cosas distintas y conviene que activen modos distintos.

---

### v2.19.0 — Salvaguarda automática ante `InsufficientMemoryError`

**Contexto:** pendiente real de v3.0 — "confirmar de forma robusta" el fix de contexto
reducido para `deepseek-coder-6.7b-q6` (desktop). El mismo tipo de error (`InsufficientMemoryError:
A context size of N is too large for the available VRAM`) ya había aparecido dos veces antes,
en modelos y perfiles de hardware distintos (`deepseek-coder-6.7b-q6` en desktop, `llava-1.6`
en laptop — ambos documentados arriba), siempre resuelto bajando el número fijo en
`MODEL_CONTEXT_SIZES` a mano. "Confirmarlo" empíricamente para siempre no es alcanzable —
la disponibilidad real de VRAM varía según qué más esté corriendo (Ollama, otro proceso GPU).

**Decisión:** en vez de seguir bajando números a mano cada vez que reaparece, `chat.controller.js`
ahora atrapa específicamente ese error (`error.name === 'InsufficientMemoryError'` o el mensaje
`"too large for the available VRAM"`) alrededor del `for await` de `streamToLocalAI`, y
reintenta UNA vez con la mitad del `contextSize` configurado para ese modelo — sin recargar el
modelo en VRAM (`_createSession` en `llama.provider.js` solo crea un `context` nuevo con
`_model.createContext({ contextSize })` sobre el modelo ya cargado; `switchModel` — mucho más
caro — no se toca). `localai.service.js` (`streamToLocalAI`) acepta `options.contextSizeOverride`
para que el reintento pueda pedir un valor distinto al de `token.profiles.getContextSize()`.
El reintento solo aplica si todavía no se emitió ningún token al frontend — el error ocurre en
`createContext()`, antes de cualquier generación, así que no hay salida parcial que descartar.

**Validado en vivo, con datos reales (no simulados) de esta laptop (RTX 4050) —
modelo `qwen2.5-coder-3b-q8`, valor real de producción `contextSize: 8192`:**
- `16384` (2×) → cargó sin error. Sobra VRAM para el doble del valor real en este modelo/laptop.
- `65536` (8×) → `InsufficientMemoryError` → reintento con `32768` → **también falló** (el
  reintento solo hace `base/2`, y `32768` sigue siendo demasiado en esta laptop) → error final
  al usuario, sin romper nada, solo sin recuperar.
- `24576` (3×) → `InsufficientMemoryError` → reintento con `12288` → **funcionó** — diff
  generado y aplicado correctamente en la misma request. Confirma el mecanismo de recuperación
  end-to-end: detecta, reintenta con la mitad, responde.

**Conclusión de la prueba:** el techo real de VRAM para este modelo en esta laptop está entre
`16384` (ok) y `32768` (falla), y el reintento a la mitad SOLO recupera si el valor original no
se pasa de ~2× ese techo — para saltos más grandes (8×) un solo reintento no alcanza. Con el
valor real de producción (`8192`, bien por debajo del techo de `16384`), este escenario no
debería dispararse en uso normal; el valor de prueba (`24576`/`65536`) fue inflado a propósito
y SE REVIRTIÓ a `8192` en `token.profiles.js` antes de este commit — no debe quedar en el código.

**Alternativas descartadas:** reintentar en loop progresivo (100%→50%→25%→...) hasta un piso —
más robusto ante saltos grandes como el de `65536`, pero se descartó para esta iteración por
ser más código y más lento en el peor caso; un solo reintento cubre el caso real (valores de
producción normales, no inflados 8× a propósito). Si se repite en producción un caso donde un
solo reintento no alcanza, es candidato a revisar.

---

### v2.19.0 — Fix: botón "Aplicar" de Patch Mode nunca funcionaba en Electron

**Contexto:** encontrado mientras se probaba el punto anterior — el usuario generó un diff
correcto, le dio "Aplicar", y no pasó nada (ni error visible en consola del backend, ni
archivo modificado). El botón se ponía rojo unos segundos y volvía a "⚡ Aplicar".

**Causa raíz:** `frontend/modules/patchRenderer.js` arma su propio `fetch` a mano —
`fetch(\`/project/\${projectId}/patch/apply\`, { headers: { 'Content-Type': 'application/json' } })` —
sin `BASE_URL` y sin el header `Authorization`. Este archivo nunca se actualizó en dos
migraciones anteriores que sí tocaron el resto del frontend: la de `BASE_URL` para que las
rutas relativas resuelvan contra `http://localhost:3005` en vez de `file://` en Electron
(v2.11.0, aplicada en 7 módulos — `patchRenderer.js` no estaba en esa lista) y la de mandar el
JWT en cada fetch via el helper `authH()` (v2.8.1, aplicada en `contextFiles.js`). Sin
`BASE_URL`, en Electron (`file://`) el `fetch` con ruta relativa nunca llega al backend —
falla como error de red silencioso, entra al `catch` del frontend, y por eso NO aparece nada
en la consola del backend (la request nunca la alcanza). `authMiddleware` tampoco loguea nada
en un 401 — doble motivo por el que este bug pasó desapercibido tanto tiempo sin dejar rastro.

**Diagnóstico:** se descartó el diagnóstico inicial de "problema en el backend" recién después
de confirmar con `Glob`/backups que `apply.service.js` nunca llegó a crear el backup
(`_writeWithBackup` es lo primero que hace antes de escribir — su ausencia prueba que la
función ni se ejecutó). Eso descartó cualquier causa del lado del backend y apuntó al frontend.

**Fix:** `patchRenderer.js` importa `BASE_URL` (`config.js`) y `getToken` (`login.js`), agrega
el mismo helper `authH()` que ya usa `contextFiles.js`, y el fetch pasa a
`fetch(\`\${BASE_URL}/project/\${projectId}/patch/apply\`, { headers: authH({ 'Content-Type': ... }) })`.

**Validado en vivo:** con el fix, "Aplicar" generó el backup real
(`backups/2026-07-25T05-34-46_calculator.js.bak`) y escribió el cambio en el archivo real del
disco — confirmado tanto por el botón cambiando a "✓ Aplicado" (verde, estado permanente) como
por la existencia del backup en disco.

**Nota:** este bug es independiente de todo lo demás de esta sesión — pudo haber estado roto
desde que se implementó el botón Aplicar (v1.7.0). No hay forma de saber desde cuándo exactamente
sin revisar el historial de git de `patchRenderer.js`.

---

### v2.19.0 — Fix: chat "fantasma" del proyecto (`chatId: 'default'` nunca se promovía a chat real)

**Contexto:** reportado por el usuario como comportamiento raro — al seleccionar la carpeta de
un proyecto, siempre aparecía "un chat que ya estaba ahí" con contenido viejo acumulado, sin
nombre, y escribir en él no creaba un chat nuevo en la lista.

**Causa raíz (dos bugs, no uno):** `createProject()` (`memory.service.js`) crea automáticamente
un chat con id literal `'default'` como placeholder al crear el proyecto — diseño intencional
(`sidebar.js` ya lo excluye de la lista visible de chats en dos lugares:
`chat.chatId !== 'default'`). El problema estaba en dos módulos que NO respetaban esa
convención: (1) `ensureGeneralChatExists()` (`chat.js`) — el guard `if (state.chatId && state.mode
!== 'landing') return;` trataba `chatId: 'default'` como si fuera un chat real ya existente
(string no vacío = truthy), así que nunca creaba un chat nuevo al escribir — todo se guardaba
para siempre en ese `default.json` compartido por proyecto. (2) `loadChatHistory()` (`app.js`) —
al seleccionar el proyecto, pedía y renderizaba el historial real de ese `default.json` (que
con el bug anterior ya tenía mensajes acumulados de sesiones previas) en vez de mostrar una
vista en blanco.

**Fix:** `ensureGeneralChatExists()` — el guard ahora excluye explícitamente `'default'`:
`if (state.chatId && state.chatId !== 'default' && state.mode !== 'landing') return;`.
`loadChatHistory()` — si `getChatState().chatId === 'default'`, no pide historial al backend,
solo limpia `chatBox.innerHTML`.

**Dato sin resolver — no es un bug de código, es limpieza de datos:** los `default.json` que ya
existían antes del fix (`admin/projects/Prueba/chats/default.json`,
`local-user/projects/Prueba/chats/default.json`, y potencialmente otros proyectos) van a seguir
mostrando los mensajes viejos acumulados hasta que se borren o vacíen a mano — el fix frena que
sigan creciendo hacia adelante, no limpia lo ya escrito.

---

### v2.19.0 — Resolución de archivo por búsqueda semántica en Patch Mode grounding

**Contexto:** `buildPatchGrounding()` (`chat.controller.js`) resolvía el archivo objetivo del
diff por coincidencia exacta de nombre en el mensaje; si no había coincidencia, agarraba **el
primer archivo del snapshot que hubiera, a ciegas** (`items.find(i => manifest.files[i.relPath])`)
— con un solo archivo indexado nunca se nota, pero con varios archivos es una apuesta, no una
elección.

**Decisión:** antes de caer al fallback ciego, se agregó `findTargetBySemanticSearch()` — reusa
el mismo store de embeddings por proyecto (`vector.store.js` + `embed.provider.js`, Ollama
`nomic-embed-text`) que `snapshot.provider.js` ya usa desde v2.14.0 para elegir contexto en
modos normales. Vectoriza el mensaje del usuario, busca los 5 chunks más similares
(`searchSimilar`), y toma el primer chunk cuyo `relPath` siga siendo un item activo del
snapshot. Si no hay embeddings generados todavía o la consulta a Ollama falla, cae al
comportamiento anterior sin romper nada — comportamiento estrictamente aditivo.

**Nota de integración con la entrada siguiente ("Modo Proyecto"):** esta pieza nació primero,
pero terminó siendo también la base técnica del gate de intención semántica — ver esa entrada
para el detalle de cómo se evitó duplicar la llamada a Ollama entre ambas.

**Sin probar en vivo todavía:** requiere un proyecto con más de un archivo indexado en el
snapshot para tener sentido (con un solo archivo, el fallback ciego ya elige bien por
descarte). Queda pendiente de validación con un caso de prueba real de varios archivos.

---

### v2.19.0 — Arquitectura "Modo Proyecto": gate de intención semántica antes de `detectMode()`

**Contexto — pedido explícito del usuario, no un pendiente pre-existente:** dentro de un chat
de proyecto, el usuario espera que Tempest asuma que sus mensajes se refieren a ese proyecto
salvo que diga lo contrario — igual que "Project files" de ChatGPT. Ejemplo concreto dado:
"quiero que el botón Copiar también copie el Markdown" debería activar Patch Mode y encontrar
el archivo correcto (`patchRenderer.js`) sin que el usuario mencione ningún nombre de archivo
ni use un verbo de la lista fija (`agrega`, en este ejemplo, ni siquiera está en `MODIFY_VERBS`).

**Diagnóstico previo, importante para entender la decisión:** conversación explícita con el
usuario sobre qué tan lejos llega hoy el "entendimiento" de Tempest sobre su propio proyecto.
Conclusión honesta, verificada leyendo el código fuente (no de memoria): el Context Snapshot
NO construye ningún conocimiento estructural — `chunk.service.js` parte archivos en ventanas de
texto de 3500 chars sin ningún criterio sintáctico (no sabe qué es una función, un import, una
clase); `vector.store.js` guarda `{ relPath, text, charStart, vector }`, texto crudo y su
vector, nada de relaciones. No existe ninguna fase de análisis de arquitectura independiente
del LLM — toda "comprensión" ocurre, fragmentada, dentro de la ventana de contexto de un
request puntual, y no persiste entre requests. Este diagnóstico deja abierta, a propósito, la
puerta a una futura "arquitectura cognitiva" (grafo estructural del proyecto — imports,
exports, relaciones reales entre archivos, generado por análisis estático, no por LLM) que el
propio usuario definió como la siguiente fase del proyecto, después de esta. Ver ROADMAP.md →
v5.0 → "🧠 Arquitectura cognitiva" para el pendiente registrado (sin diseñar todavía).

**Decisión de esta iteración (alcance acotado a propósito, NO la arquitectura cognitiva
completa):** un paso intermedio, con la infraestructura de embeddings que YA existe —
`backend/services/patch/intent.resolver.js` (nuevo). Antes de llamar a `detectMode()`, si el
proyecto tiene Context Snapshot, `resolvePatchIntent(userMessage, projectDataPath, items)`
vectoriza el mensaje, busca el chunk más similar en el store de embeddings, y si el score de
similitud coseno supera `SEMANTIC_PATCH_THRESHOLD = 0.5`, devuelve `{ relPath, score }`.
`chat.controller.js` pasa el resultado como `hasSemanticPatchMatch` a `detectMode()`
(`mode.router.js`), que ahora tiene una nueva regla de máxima prioridad (después de los
triggers explícitos): si hay match semántico, entra a `coder/patch` sin necesitar verbo ni
nombre de archivo. Si no hay match (mensaje sin relación clara con el snapshot), no fuerza
nada — el mensaje sigue el flujo normal de detección (general/explain/strict) exactamente
como antes. `buildPatchGrounding()` recibe el mismo match ya resuelto (`preResolvedMatch`) para
no volver a consultar Ollama por el mismo mensaje dos veces en el mismo request.

**Decisión de diseño — dónde vive el gate, y por qué no en `mode.router.js`:** `mode.router.js`
es, a propósito, una función pura y síncrona (sin I/O, sin red) desde su diseño original — eso
la hace fácil de testear con casos fijos (ver los tests standalone corridos durante esta
sesión). El gate semántico necesita red (Ollama) y disco (leer `embeddings.json`), así que se
resolvió ANTES, en `chat.controller.js` (que ya es async y ya hace I/O), y se le pasa a
`detectMode()` como un booleano ya resuelto — mismo patrón que `hasProjectContext`. Alternativa
descartada: hacer `detectMode()` async y que haga el I/O ella misma — se descartó porque
mezclaría enrutamiento puro con efectos secundarios, y rompería la testeabilidad síncrona actual.

**Umbral `0.5` — punto de partida instrumentado, no un valor final ni una decisión definitiva:**
el usuario pidió explícitamente NO tratar esto como "ajustar un número para salir del paso" —
pidió la arquitectura real. La arquitectura real de todos modos necesita, inevitablemente, un
umbral numérico en algún punto (cualquier sistema de similitud semántica lo necesita); lo que
se evitó fue construir un experimento descartable — el umbral vive en una constante nombrada
(`SEMANTIC_PATCH_THRESHOLD`, `intent.resolver.js`), documentada, y cada decisión queda logueada
con el score real (`[PATCH INTENT] mejor match: ... score=X (umbral=0.5)`) para poder ajustarlo
con datos de uso real en vez de a ciegas — este es el comportamiento PERMANENTE de "modo
Proyecto", no un flag temporal a desactivar.

**Sin calibrar ni probar en vivo todavía:** requiere Ollama respondiendo embeddings reales y un
proyecto con snapshot generado — la lógica de ruteo se validó con casos fijos (mock de
`hasSemanticPatchMatch` true/false), pero el número `0.5` en sí no tiene todavía ningún dato
real de este proyecto detrás. Queda como primer paso de validación antes de confiar en el
comportamiento para uso diario.

**Riesgo conocido, documentado a propósito:** un umbral mal calibrado tiene dos modos de falla
opuestos — muy sensible dispara Patch Mode en conversación genérica dentro de un proyecto
("¿qué hace este proyecto?" podría parecerse lo suficiente a algún chunk de código como para
cruzar el umbral); muy exigente sigue sin detectar pedidos genuinos como el del bug de ayer.
Ninguno de los dos es catastrófico — Patch Mode sin grounding real ya se maneja con el `return
''` silencioso de `buildPatchGrounding`, y "no detectar" simplemente devuelve a la conversación
normal — pero ambos requieren ojo del usuario durante el uso real hasta calibrar.