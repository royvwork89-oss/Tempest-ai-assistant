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