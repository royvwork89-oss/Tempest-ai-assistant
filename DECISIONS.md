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

## 🐛 Patch Mode via system prompt — bug conocido (pendiente)

### Problema
El modelo genera diffs incorrectos cuando el contexto del archivo llega únicamente via system prompt (context files del proyecto). El output es código inventado, loops o formato incorrecto.

### Síntoma
- `effectiveContext.length=0` en el log — el adjunto temporal está vacío
- `contextFiles: 5145 chars` — el contexto sí llega al system prompt
- El modelo ignora el contenido real y genera diffs de archivos inventados

### Causa probable
DeepSeek 6.7B no ancla correctamente el SEARCH block al contenido del archivo cuando ese contenido está en el system prompt en lugar de en el mensaje del usuario. Necesita el archivo como parte del mensaje directo, no como contexto de fondo.

### Confirmado en
v2.0.2 y v2.0.3 — el bug existía antes de la modularización de contextFiles.js.

### Solución propuesta (pendiente v3.0)
Inyectar el contenido del archivo relevante directamente en el mensaje del usuario en patch mode, no solo en el system prompt.

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

### Bug conocido: Patch Mode via system prompt
El modelo genera diffs incorrectos cuando el contexto del archivo llega únicamente via system prompt (context files del proyecto). `effectiveContext.length=0` en el log — el adjunto temporal está vacío — pero `contextFiles` sí llegan. Confirmado en v2.0.2 y v2.0.3 — no introducido por la modularización. Fix pendiente v3.0: inyectar el archivo relevante directamente en el mensaje del usuario en patch mode.

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