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

Para agregar más perfiles en el futuro, los cambios necesarios son:

1. **Backend — `search-config.json`**: agregar sección `profiles` con cada perfil y su config de providers.
2. **Backend — `auth.service.js`**: `profileId` ya es un string libre — solo hay que validar que el valor exista en la lista de perfiles.
3. **Backend — `search.controller.js`**: `getConfig` ya bifurca por `profileId`. Cambiar el `if (profileId === 'global')` por una búsqueda en el mapa de perfiles.
4. **Frontend — `settings.html`**: el `<select>` de "Perfil asignado" en la fila de usuario ya tiene opciones hardcodeadas (`none`, `global`). Reemplazar por opciones dinámicas desde el backend.
5. **Frontend — panel Servicios**: el dropdown ya muestra "Perfil Global" como primera opción. Agregar los nuevos perfiles arriba de los usuarios en el mismo orden.
6. **UI nueva**: pantalla de creación/edición de perfiles (nombre, providers, usuarios asignados).

**Sin cambios necesarios en:** `users.json` (profileId ya es string libre), `webSearch.js` (consume `enabledProviders` del backend), lógica de chat (no sabe de perfiles).

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