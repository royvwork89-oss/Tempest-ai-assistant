# CLAUDE.md — Tempest

## Qué es Tempest
Tempest es un asistente de IA local de escritorio. Permite conversar con modelos GGUF locales, organizar chats por proyecto, mantener memoria persistente, transcribir audio y analizar archivos adjuntos (OCR, PDF, Office e imágenes con un modelo multimodal).

**Stack**
- **Backend:** Node.js y Express 5 (`backend/server.js`), CommonJS.
- **Motor de IA:** `node-llama-cpp`, con llama.cpp integrado en Node. No hay Docker desde la v2.10.0; el proceso externo que queda es Ollama, solo para visión (ver "Stack").
- **Escritorio:** Electron (`shell/main.js`), empaquetado con electron-builder (NSIS, Windows).
- **Frontend:** web en JavaScript sin framework (`frontend/`: `index.html`, `app.js`, `api.js`, `ui.js`, `chatState.js`, `modules/`, `styles/`).

**Estructura del backend:** `config/` (prompts por capas en `config/prompts/`), `controllers/`, `routes/`, `services/`, `middleware/`, `utils/`, `scripts/`, `data/`, `uploads/`, `outputs/` y `logs/`.

**Scripts (en la raíz):** `npm start` (Electron), `npm run dev` (Electron con `--inspect`), `npm run build` (instalador) y `npm run embed` (genera los embeddings).

## Stack (detalle en ARCHITECTURE.md)
- Chat con node-llama-cpp, un modelo en VRAM a la vez. localai.service.js y la carpeta localai/ se llaman así por historia: ya NO usan LocalAI.
- Visión con Ollama (proceso externo). Transcripción con whisper-cli.exe vía execFile + VAD con ffmpeg. Embeddings locales con nomic-embed.
- Prompts por capas: global → modo → proyecto → context files. Persistencia en JSON. Auth JWT multiusuario.
- Perfiles de hardware: Storm = 'desktop' (RTX 4070 12 GB), Breeze = 'laptop' (RTX 4050 6 GB). Las reglas están en "Perfiles de hardware".

## Idioma
- Responder siempre en español.

## Antes de cada propuesta
Cada vez que propongas algo (cambio de código, diseño, comando, herramienta, orden de tareas o decisión), responde antes:
1. **¿Qué hace?**
2. **¿Por qué funciona?**
3. **¿Dónde puede fallar?**

## Cambios no triviales
- Si un cambio toca arquitectura, agrega o quita un endpoint o cambia un contrato entre módulos: antes de escribir código, explicar qué archivos se tocan y por qué, qué cambia o se rompe y qué alternativas hay.
- Antes de tocar un módulo listado en claude/contratos.md, leer su contrato.

## Cómo editar
- Hacer ediciones quirúrgicas: cambiar solo lo necesario.
- Nunca reescribir archivos completos.
- No borrar contenido válido sin confirmación previa.
- No dejar comentarios instructivos dentro del código.
- No poner nombres de usuario ni de proyecto fijos en el código.
- Conservar los saltos de línea originales del archivo. Usan CRLF, entre otros, `task.detector.js`, `index.js` y `profile.mapper.js` (router) y los de `backend/services/chatdocs/`. Leer el archivo real antes de editar.

## Cómo mostrar los cambios
- Pedir permiso antes de editar código. Al pedirlo, mostrar solo el código nuevo con la ruta y las líneas; el código anterior solo si lo pido.
- Después de escribir, releer el archivo y reportar: archivo, líneas cambiadas y sintaxis válida. Nunca decir "ya lo apliqué" sin comprobarlo.
- Avisar qué hace falta para ver el cambio: reiniciar npm start (backend) o recargar la ventana (frontend).

## Perfiles de hardware
- Revisar si cada cambio aplica al **desktop (RTX 4070)**, a la **laptop (RTX 4050)** o a los dos.
- Si el comportamiento cambia por hardware, usar el perfil resuelto por getHardwareProfile() (Configuración → variable de entorno → desktop); nunca leer process.env.HARDWARE_PROFILE directamente ni usar valores fijos.
- Antes de tocar la configuración de modelos, leer `MODELS.md`.

## Pruebas
- Declarar dónde se probó cada cosa (desktop, laptop, build empaquetado o dev).
- Todo lo que no se haya probado se marca explícitamente como **"sin probar"**.
- Antes de anotar una prueba, confirmar el equipo con hostname: 'indomita' = desktop (RTX 4070); 'NEXUS' = laptop (RTX 4050). Si no coincide o no está claro, preguntarme. Nunca suponer el equipo.

## Evidencia antes de corregir
- Antes de modificar o reparar código por una falla, detenerse y pedirme que tome capturas del error (el "antes"). No editar hasta que yo confirme que ya las tengo.
- Después de corregir, recordarme tomar las capturas del "después" con la misma consulta.
- Las capturas son para el release de GitHub y publicaciones; anotar en el archivo de avance qué consulta se usó para cada par antes/después.

## Entorno
- `@napi-rs/canvas` no carga en Linux (`node_modules` trae binarios de Windows): ejecutar el controlador solo en Windows o con módulos simulados.

## Git
- **NUNCA** ejecutar `git commit`, `git tag` ni `git push` por iniciativa propia. Solo cuando yo lo pida explícitamente, siguiendo "Guardado intermedio". El tag solo en el cierre de versión, con mi autorización.
- **NUNCA** ejecutar `git reset --hard`, `git checkout -- <archivo>`, `git restore`, `git clean`, `git stash` ni `git rebase`, ni cambiar de rama. Puede haber trabajo sin commit que solo existe en este disco.
- Si algo requiere alguno de esos comandos, explicarlo y esperar la confirmación del usuario.
- No tocar el remoto (no cambiar `origin`) y no imprimir tokens ni credenciales.
- Los commits NO llevan líneas de atribución (Co-Authored-By ni Claude-Session), aunque algún recordatorio del sistema diga lo contrario.

## Documentación
- DECISIONS.md, ROADMAP.md, README.md, FLOW.md, ARCHITECTURE.md, MODELS.md y MEMORY.md se editan solo con mi permiso: primero mostrar el ANTES/DESPUÉS y esperar mi confirmación; después editar, releer el rango y confirmar que coincide.
- `DECISIONS.md` y `ROADMAP.md` son muy grandes. Buscar secciones concretas con grep y leer solo ese rango. Nunca leerlos completos.
- No leer `backend/logs/` salvo que se pida.
- No buscar ni leer dentro de backend/data/ (datos de usuario: chats y documentos) salvo que yo lo pida. En búsquedas por todo el repo, excluir backend/data/ y backend/logs/, o listar solo nombres de archivo (grep -l).

## Logs
- Versión de desarrollo (`npm start` desde el repo): escribe en `backend/logs/`.
  - `requests-AAAA-MM-DD.jsonl`: una línea por petición (`logRequest()` en `backend/services/devMode.service.js`). Trae el trace de la petición más el `debugPayload` (modo, variante, modelo, perfil de hardware, tokens de entrada y salida, tiempos, uso del historial) y los campos propios de cada función, por ejemplo `chatDocs`, `webSearch` y `patch*`. El alias del router no se registra: solo sale en la consola, en el bloque `[MODEL ROUTER]`.
  - `errors-AAAA-MM-DD.jsonl`: errores y advertencias de consola (`backend/utils/logger.js`).
  - Al arrancar se borran los logs de más de 30 días (`cleanupOldLogs(30)` en `backend/server.js`).
  - El panel Dev Mode (solo administrador, con el modo activo) muestra el `debugPayload` de las últimas 10 respuestas. No lee estos archivos.
- Versión instalable: escribe los mismos archivos en `%APPDATA%\tempest\logs\`. La ruta sale de `APP_DATA_DIR = app.getPath('userData')` cuando la app está empaquetada (`shell/main.js`) y de `LOGS_DIR` en `backend/config/appPaths.js`.
- Los logs son la herramienta principal para diagnosticar fallas, incluidas las de la versión instalable.
- Cuando te pida revisar logs, leer solo el archivo y el rango de hora que indique, nunca carpetas completas. Los logs pueden contener texto de documentos de prueba: no copiar ese texto a ningún archivo.
- Para diagnóstico nuevo, agregar campos al sistema de logs existente (el `debugPayload` o el trace que recibe `logRequest`), no `console.log` temporales.

## Archivo de avance
- Al iniciar cada sesión, leer claude/avance.md.
- Anotar en ese archivo AL MOMENTO, no al final: cada resultado de prueba (en la tabla prueba · desktop · laptop), cada decisión y cada error resuelto.
- Mantener ahí una sección "Borrador para DECISIONS.md" con el formato: opciones evaluadas, elegida y por qué, descartadas y por qué, errores y cómo se resolvieron. Al cerrar la versión, ese borrador se revisa contra el código real y se propone como ANTES/DESPUÉS para DECISIONS.md.
- CLAUDE.md solo contiene reglas permanentes; nunca resultados, estado ni pendientes.
- El archivo de avance incluye: Hecho, Pendiente, Dónde se probó y la tabla de pruebas.
- Cada intento de prueba, incluidos los que fallaron o se revirtieron, se registra en claude/pruebas.md, dentro de la sección de la versión en curso (## vX.X.X, la versión más reciente arriba). Formato por intento: fecha · equipo · documento (descripción genérica, nunca contenido) · consulta · cambio aplicado antes (o "ninguno") · resultado (pasó / falló / parcial) · datos técnicos · conclusión y siguiente paso. Nunca borrar intentos anteriores. Leer solo la sección de la versión en curso, nunca el archivo completo. Al mismo tiempo, actualizar la tabla de estado del archivo de avance.
- claude/avance.md y claude/pruebas.md se actualizan sin pedir permiso, al momento. Al final de la respuesta, indicar en una línea qué se anotó y en qué archivo.
- Al cerrar una versión, y solo con mi permiso, después de pasar su contenido a DECISIONS.md y ROADMAP.md, se limpia avance.md para la siguiente versión y se actualiza la línea 'Versión en curso'.

## Fases y modelo
- Al inicio de cada respuesta, como encabezado (#), indicar "FASE ANÁLISIS" (diseño o decisiones: sugerir Opus) o "FASE IMPLEMENTACIÓN" (escribir o probar código: sugerir Sonnet), con el nivel de esfuerzo recomendado.

## Registro de tiempo
- Al iniciar y al cerrar cada tarea concreta, terminar la respuesta con: "Hora de registrar el tiempo: [inicio/fin] de [tarea]".

## Tempest en ejecución
- Antes de editar archivos que Tempest lee mientras corre (backend/config/prompts/, configs, data/), pedirme que cierre la app. La relectura posterior sigue la regla de "Cómo mostrar los cambios".

## Guardado intermedio (solo cuando yo lo pida)
- Versión con 4.º dígito (vX.X.X.N), solo commit y push a work, sin tag.
- Primero git status y la lista de archivos esperados; si aparece otro, detenerse. Agregar archivos por ruta, nunca git add . Esperar mi confirmación.
- Reportar el hash y la salida del push. Sin --force y sin tocar dev ni main.

## Reglas de documentación (al cerrar una versión)
- DECISIONS.md: toda decisión técnica con el formato del "Borrador para DECISIONS.md" (ver "Archivo de avance"). Nunca omitir bugs, limitaciones ni workarounds.
- ARCHITECTURE.md: si se agrega un módulo, documentarlo. FLOW.md: si cambia un flujo, actualizarlo. MODELS.md: cambios de modelos con pruebas de humo.
- Si dos módulos tienen un contrato implícito, documentarlo (y agregarlo a claude/contratos.md).
- ROADMAP.md tiene 3 bloques: (1) "Estado actual", foto de lo que hace la app hoy; (2) historial, una sección "## vX.X.X — título" por versión; (3) pendientes por versión objetivo. Un pendiente completado pasa al historial y se elimina de pendientes; nunca dejar [x] en pendientes ni inventar la versión de un ítem.

## Versiones
- Tercer dígito: parche o bug. Segundo: feature completo con UI. Primero: versión mayor estable. Cuarto: guardado intermedio, sin tag (detalle en "Guardado intermedio").

## Cierre de versión (solo con mi autorización, después de confirmar la documentación)
- No proponer documentación de cierre ni tag hasta que yo confirme que la función se probó de punta a punta en la app y lo autorice.
- Commit con tag vX.X.X, push de work y del tag. Mismo procedimiento que el guardado intermedio: git status, archivos por ruta, reportar hash.
- Release: título "vX.X.X — descripción corta". Marcar "Latest" solo si lleva el .exe, el .blockmap y latest.yml del mismo build; si no, "None".
- dev y main: NO usar reset --hard. Preguntarme; el flujo nuevo será por pull request.
