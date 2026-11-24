# Avance v3.1.0 — Documentos persistentes por chat

## Contexto

- **Versión en curso:** v3.1.0 (documentos persistentes por chat).
- **Último guardado:** commit `c8ee716` "v3.0.11.5" en la rama `work`. Está subido a GitHub y descargado en el desktop.
- **Versión publicada:** todavía no hay tag `v3.1.0`. `package.json` sigue en `3.0.11`.
- **Cambios sin commit en `work`:** Verificado 23/11: todo v3.1.0 está en c8ee716 (GitHub). Las +1847 del panel eran el diff de work contra main, no cambios sin commit.

## Hecho

Todo lo de esta sección se probó en la **laptop (RTX 4050)**, versión de desarrollo.

- **Documentos guardados por chat**
  - Backend en `backend/services/chatdocs/` (store, selector, retriever y service).
  - Barra de chips en el frontend: `frontend/modules/chatDocuments.js`.
- **Alias `doc-read` en el router** (`task.detector.js`)
  - Laptop: `qwen2.5-3b-q5`. Desktop: `llama-3.1-8b-q5`.
  - Se activa cuando hay documentos y el modo es `explain` o `general`.
- **Documentos largos por fragmentos con BM25**
  - El umbral es de 3000 tokens y solo aplica en laptop. En desktop el umbral es `null`.
- **Compuerta "sin coincidencia"**
  - Si ninguna palabra de la pregunta aparece en el documento, Tempest responde sin llamar al modelo.
  - Está en `checkNoMatchGate` (`chat-docs.service.js`) y conectada en `chat.controller.js`.
- **Nota en el encabezado**
  - Indica al modelo que las preguntas que aparecen dentro de una transcripción no son del usuario.

## Pendiente por decidir

1. **Mostrar las palabras ausentes en el aviso del mensaje**, por ejemplo "No aparece: einstein". El modelo de 3B ignoró la nota del encabezado en la prueba "Einstein y la llorona".
2. **Limitar el historial cuando hay documentos.** "Enlístame los temas" repitió temas de turnos anteriores. Falta mi prueba de control en un chat nuevo.
3. **Saludos con un documento activo.** "hola" devuelve contenido del documento, porque esa palabra aparece en la transcripción de prueba.

## Sin probar

- **Desktop (RTX 4070):** nada probado. Ahí no hay fragmentos ni compuerta.
- **Pruebas mecánicas pendientes:**
  - [ ] Quitar y reactivar un documento.
  - [ ] Chat nuevo sin documento.
  - [ ] Dos documentos a la vez.
  - [ ] Borrar un chat.
  - [ ] Mensaje con imagen.

## Pendiente de documentación

Para v3.1.0 no hay nada escrito todavía.

- [ ] `DECISIONS.md`
- [ ] `ROADMAP.md`
- [ ] `README.md`
- [ ] `FLOW.md` (la línea 21 está desactualizada)
- [ ] `claude/bug-documentos-largos.md`
- [ ] Subir `package.json` a `3.1.0`
- [ ] Commit, tag `v3.1.0` y push. Los hace el usuario, solo cuando lo confirme.

## Limitaciones conocidas

- La búsqueda es por palabra exacta: un sinónimo cuenta como palabra ausente.
- Las preguntas globales ("resume", "lista los temas") dan respuestas flojas. Mejorarían con una Etapa 2 que agregue una "ficha" por fragmento, pero no está aprobada.
- El error de memoria al cambiar de modelo con 6 GB de VRAM no tiene causa confirmada.
