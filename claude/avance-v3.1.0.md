# Avance v3.1.0 — Documentos persistentes por chat

## Estado

- **Versión en curso:** v3.1.0 (documentos persistentes por chat).
- **Último guardado:** v3.0.11.7 (commit de esta sesión; ver git log para el hash). El guardado `c8ee716` "v3.0.11.5" contiene el código de v3.1.0.
- **Versión publicada:** todavía no hay tag `v3.1.0`. `package.json` sigue en `3.0.11`.
- **Verificado 23/11:** todo v3.1.0 hasta v3.0.11.5 está en `c8ee716` (GitHub). Las +1847 del panel eran el diff de `work` contra `main`, no cambios sin commit.
- **Desktop:** desde el 23/11 tiene fragmentos BM25, compuerta y aviso de la compuerta con umbral 3000, mismo código que laptop. Sin probar.

## Hecho

- Documentos guardados por chat (backend y barra de chips en el frontend).
- Alias `doc-read` en el router (`task.detector.js`).
- Documentos largos por fragmentos con BM25 (laptop y desktop; desktop con umbral 3000, sin probar).
- Compuerta "sin coincidencia" (`checkNoMatchGate`), en laptop y desktop (desktop sin probar).
- Nota en el encabezado sobre las preguntas dentro de una transcripción.
- **Pendiente 3 (small talk):** `isSmallTalk` (retriever) y `skipDocumentsForSmallTalk` (service), llamada desde el controlador justo antes de la compuerta. Un mensaje que es solo saludo o cortesía, sin `?` y sin adjunto en ese turno, no recibe documentos y se responde como chat normal.

## Dónde se probó

- **Laptop (RTX 4050, versión de desarrollo):** todo lo de "Hecho" excepto small talk.
- **Small talk:** solo con un script (12 mensajes y 5 casos de la función). **Sin probar en la app**, ni laptop ni desktop.
- **Desktop (RTX 4070):** nada probado. Desde el 23/11 tiene fragmentos, compuerta y aviso de la compuerta con umbral 3000 (mismo código que laptop).

## Módulos (`backend/services/chatdocs/`)

- `chat-docs.store.js`: guarda en `projects/<proj>/chat-docs/<chatId>/index.json` + `<docId>.txt`. Tope 500,000 caracteres (flag `storageTruncated`), máx. 10 activos, dedupe por SHA-256.
- `chat-docs.selector.js`: función pura que elige qué documentos van al modelo.
- `chat-docs.retriever.js`: fragmentos (BM25), preguntas globales, palabras ausentes y `isSmallTalk`. Función pura, sin disco ni modelo.
- `chat-docs.service.js`: `prepareTurn` (fase 1), `renderForModel` (fase 2), `skipDocumentsForSmallTalk`, `checkNoMatchGate`, `finalizeTurn`, avisos.
- Cableado en `chat.controller.js` (endpoints `GET /chat/documents` y `POST /chat/documents/status`) y `frontend/modules/chatDocuments.js`.

## Decisiones y por qué (opciones descartadas incluidas)

1. **Alcance = chat.** Los documentos se guardan completos y se reenvían cada turno mientras estén activos. Descartado: el camino temporal de adjuntos (recortaba en silencio a 7500 caracteres) y los context files del proyecto (son del proyecto, no del chat).
2. **Nunca recortar en silencio:** cada encabezado dice qué rangos de caracteres recibió el modelo, y la interfaz avisa "N de M fragmentos".
3. **Los documentos son contenido NO confiable:** se neutralizan los delimitadores propios (`<<<`, `>>>`, "--- DOCUMENTOS ...").
4. **Cortocircuitos SIN llamar al modelo:** documento quitado, con error o perdido; "el documento" sin ninguno activo; varios que no caben (se pregunta cuál); y la compuerta sin coincidencia.
5. **Presupuesto de tokens para documentos** = ventana − 1400 (system) − respuesta − min(historial, 1000) − mensaje − 5 % ventana − 200.
6. **Alias propio `doc-read`** (laptop: `qwen2.5-3b-q5`; desktop: `llama-3.1-8b-q5`). Los alias son fijos; en la v4.0 solo cambia el modelo asignado a cada alias. La elección de Qwen frente a Llama 3.2 3B es EVIDENCIA de pruebas (llama q8 contestó mal en 2 muestras), no una regla.
7. **Fragmentos con BM25, no embeddings.** Descartado: embeddings (nomic rinde mal en español, hay un bug abierto en su generación, y BM25 basta para encontrar palabras que el texto contiene). Fragmentos de ~1400 caracteres; se eligen hasta 4 con puntaje ≥ 0.4 del mejor, más vecinos si caben. Los seguimientos sin palabras buscables reutilizan los fragmentos anteriores SIN vecinos. Umbral: `DOC_FRAGMENT_TOKENS` laptop = 3000; desktop = null (desactivado). (reemplazado el 23/11: desktop = 3000, mismo código que laptop; sin probar en desktop)
8. **Las preguntas globales** (resume, lista los temas, de qué trata) NO usan fragmentos: documento completo si cabe, si no principio y final. Se resuelven bien solo con la "ficha" de la Etapa 2 (no aprobada).
9. **La ventana grande** (alias `large-context`, 16384 en laptop) se decide comparando los tokens estimados que se enviarían contra el presupuesto REAL de la ventana normal del modelo `doc-read`. Descartado: el límite fijo de 7500 caracteres.
10. **Compuerta "sin coincidencia"** (`checkNoMatchGate`): si TODAS las palabras con contenido de la pregunta faltan en TODOS los documentos largos, responde sin modelo con un aviso fijo. Condiciones: documento largo, el mensaje parece pregunta, no es pregunta global. Las palabras salen de la pregunta del usuario; JAMÁS poner palabras de tema en el código. Si falta solo alguna, el encabezado lo dice. Descartado: mandar el documento completo (un 3B con 12 mil tokens inventa justo cuando debería decir "no aparece"); instruirlo solo en el prompt (lo ignora).
11. **Small talk** (`isSmallTalk`): lista cerrada de saludos y cortesías; el mensaje cuenta solo si no tiene `?` y TODAS sus palabras están en la lista. Se aplica antes de la compuerta, vaciando `selection.included` ese turno. Descartado: agregar "hola" a `STOPWORDS`, porque la pregunta quedaría sin palabras buscables y se reenviarían los fragmentos del turno anterior.

## Problemas ya detectados (no repetir)

- `doc-read` solo se activaba con `mode === 'explain'`. Las preguntas de seguimiento caen en `general` y el modelo cambiaba entre turnos; en laptop falló con `InsufficientMemoryError` al pasar llama q8 → qwen q5 (causa exacta SIN confirmar; solo se sabe que desapareció al fijar un modelo). Ahora la condición es `hasChatDocs && (explain || general)`. No volver a limitarla a explain.
- `neutralize()` no cubría "--- FIN DOCUMENTOS ---". Corregido.
- Los seguimientos con vecinos cambiaban los índices de fragmentos. Los vecinos no se agregan cuando `source === 'previous'`.
- Las preguntas globales con "temas" devolvían fragmentos basura: `isGlobalQuestion` se evalúa sobre texto normalizado (sin acentos: "enlístame", "resúmeme").
- Un modelo de 3B ignora instrucciones del encabezado (caso "Einstein y la llorona"): lo comprobable por código se decide en código, no en el prompt.
- El buscador tomaba "hola" como coincidencia si la palabra aparece en el documento. Mitigado con el pendiente 3, solo para mensajes que son únicamente saludo o cortesía; "hola" junto con otras palabras sigue buscando.
- Posible contaminación del historial: "Enlístame los temas" repitió temas de turnos anteriores. HIPÓTESIS sin confirmar; falta la prueba de control en chat nuevo.
- La búsqueda es por palabra: sinónimos o variantes de la transcripción (huicae/wiccae) cuentan como ausentes. Documentar, no "arreglar" con aproximaciones sin probarlas.
- La ventana de 32K falló antes en laptop. El tope probado es 16384.
- El selector de modelo vuelve a "Automático" al reiniciar la app: cuidado al interpretar pruebas manuales.
- `@napi-rs/canvas` no carga en Linux (`node_modules` tiene binarios de Windows): ejecutar el controlador solo en Windows o con módulos simulados.

## No hacer

- No limitar `doc-read` a modo explain. Fragmentos/compuerta activos en desktop desde el 23/11 (desktop: 3000); obligatorio probarlos en desktop antes de cerrar v3.1.0.
- No enviar el documento completo a laptop cuando la pregunta no tiene coincidencia.
- No reintroducir matching aproximado en `applyPatch` (decisión previa de Patch Mode).
- No cambiar `normalize`/`locateWholeLines` de `apply.service.js` sin cambiar `reconcile.service.js` (contrato compartido).

## Pendiente

1. **Mostrar las palabras ausentes en el aviso del mensaje** (deterministas, sin depender del modelo). La compuerta ya las muestra cuando faltan todas; falta cuando solo faltan algunas (caso "Einstein y la llorona"). Propuesta: enviarlas en `[DONE]` (`documents.absentWords`) y mostrarlas en `ui.js`, igual en laptop y desktop.
2. **Limitar el historial cuando hay documentos.** Decidir tras la prueba de control en un chat nuevo.
3. **Probar small talk en la app**, en laptop y en desktop.
4. **Pruebas mecánicas:** quitar y reactivar un documento, chat nuevo sin documento, dos documentos, borrar un chat, mensaje con imagen. Desktop completo.
5. **Documentación de v3.1.0** (nada escrito todavía):
   - [ ] `DECISIONS.md` (opciones, elegida, descartadas, errores)
   - [ ] `ROADMAP.md`
   - [ ] `README.md`
   - [ ] `FLOW.md` (línea 21 desactualizada)
   - [ ] `claude/bug-documentos-largos.md`
   - [ ] `package.json` a `3.1.0`
   - [ ] Commit, tag `v3.1.0` y push: los hace el usuario, solo cuando lo confirme.
6. **Etapa 2** (ficha por fragmento) para preguntas globales: no aprobada.
7. **Deuda para v4.0:** `LARGE_CONTEXT_PROFILES` y `MODEL_CONTEXT_SIZES` tienen modelos fijos en el código.
8. **Prueba en desktop del umbral 3000:** usar el mismo documento de ~3500 tokens, una vez con fragmentos y otra completo. Si completo responde mejor con el 8B, subir el umbral de desktop al presupuesto (~4600).
9. **Idea para v4.0 (Etapa B, perfiles de modelo):** calcular el umbral como fracción del presupuesto del `doc-read` (razón 0.65 calibrada en laptop), porque ahí el modelo y el contexto serán configurables.
