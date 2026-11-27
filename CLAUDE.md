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

## Antes de cada cambio de código
Antes de modificar, implementar, eliminar o reemplazar código, responder: 1) ¿Qué hace? 2) ¿Por qué funciona? 3) ¿Dónde puede fallar? Para explicaciones, recomendaciones o propuestas que no tocan código, no usar este formato.

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
- Para toda tarea que modifique algo (código, archivos, configuración), primero presentar un plan y esperar mi aprobación antes de ejecutar. No hace falta que te lo recuerde en cada sesión.
- Pedir permiso antes de editar código. Al pedirlo, mostrar solo el código nuevo con la ruta y las líneas; el código anterior solo si lo pido.
- Después de escribir, releer el archivo y reportar: archivo, líneas cambiadas y sintaxis válida. Nunca decir "ya lo apliqué" sin comprobarlo.
- Avisar qué hace falta para ver el cambio: reiniciar npm start (backend) o recargar la ventana (frontend).
- Cambios chicos (1 a 3 por archivo): puedes proponer varios archivos a la vez. Cambios grandes: un archivo a la vez y esperar mi confirmación antes del siguiente.
- Después de editar, recordarme recargar en VS Code las pestañas de esos archivos, para que un buffer sin guardar no pise lo escrito.
- No tocar archivos fuera del repo sin pedirlo antes.

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
- Si un push sale rechazado, no forzarlo: avisarme con la salida completa.
- Nunca borrar ramas ni tags sin pedirlo antes.
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
- El alcance de cada versión lo decide el usuario. Nunca mover un pendiente a otra versión ni marcarlo como pospuesto sin que yo lo indique; si crees que conviene, propónlo y espera mi decisión.

## Análisis
- Diseño y decisiones: usar /analisis (Opus). El resto del trabajo, con el modelo de la sesión.
- El modelo se elige solo con opusplan: Opus al planear, Sonnet al ejecutar. /analisis queda para análisis sueltos fuera de una tarea.
- No pedir permiso para activar /analisis cuando el pedido encaje con su descripción: se activa sola. La línea "Análisis con [modelo]" con la que empieza es el aviso de qué modelo se usó. Sigue pudiéndose activar a mano con /analisis en cualquier momento.

## Skills
- Las skills del proyecto viven en .claude/skills/<nombre>/SKILL.md.
- Toda skill con campo model debe empezar su respuesta con la línea: "[Nombre de la skill] con [nombre exacto del modelo]".
- Las skills que hacen commits, push, tags o editan documentos oficiales llevan siempre disable-model-invocation: true.

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
- En cualquier documento de cierre (README.md, ROADMAP.md, DECISIONS.md): si algo no funciona con ciertos valores o condiciones, documentar cuáles.
- ARCHITECTURE.md: si se agrega un módulo, documentarlo. FLOW.md: si cambia un flujo, actualizarlo. MODELS.md: cambios de modelos con pruebas de humo.
- Si dos módulos tienen un contrato implícito, documentarlo (y agregarlo a claude/contratos.md).
- ROADMAP.md tiene 3 bloques: (1) "Estado actual", foto de lo que hace la app hoy; (2) historial, una sección "## vX.X.X — título" por versión; (3) pendientes por versión objetivo. Un pendiente completado pasa al historial y se elimina de pendientes; nunca dejar [x] en pendientes ni inventar la versión de un ítem.
- Los pendientes de ROADMAP.md se ordenan por cercanía: (a) la versión con alcance definido (hoy v4.0, con sus puntos ya planeados); (b) la versión que se trabaja después de terminar esa (hoy v5.0); (c) la sección "vX.x" al final, para ideas sin fecha ni planificación, guardadas solo para que no se olviden. Cada ítem vive en una sola de esas secciones y solo cambia de una a otra cuando el usuario lo indica. Los pendientes se escriben con "- [ ]". Al completarse, el ítem sale de pendientes y pasa a la sección de su versión en el historial, escrito con "- [x]", y el título de esa sección lleva ✅ al cerrar la versión. Al pasar al historial, el ítem se reescribe como resumen breve de lo que realmente se hizo: puede cambiar el nombre, y si la opción planeada no resultó viable y se usó otra, describe la opción usada, no la planeada. El historial del roadmap es un resumen; la explicación completa (opciones evaluadas, la elegida y por qué, las descartadas y por qué, errores y cómo se resolvieron) va en DECISIONS.md, y el ítem puede apuntar a ahí con "ver DECISIONS.md → <título>".
- Lista de cierre, al dar por cumplido el objetivo de una versión (después de que el usuario confirme la prueba de punta a punta y antes del commit con tag). Cada archivo se edita con permiso, mostrando ANTES/DESPUÉS:
  - package.json y package-lock.json: la versión nueva (de ahí salen el nombre del instalador y app.getVersion()).
  - README.md: "Versión actual" y la lista de funciones.
  - ROADMAP.md: "Estado actual", la sección nueva "## vX.X.X — título" en el historial (resumen breve, con ✅ en el título) y los pendientes completados fuera de pendientes.
  - DECISIONS.md: el "Borrador para DECISIONS.md" de claude/avance.md, revisado contra el código real.
  - FLOW.md, ARCHITECTURE.md y MODELS.md: solo los que apliquen según "Reglas de documentación".
  - claude/contratos.md: los contratos nuevos o cambiados.
  - claude/avance.md: limpiarlo para la siguiente versión y actualizar la línea "Versión en curso" (líneas 1 y 7).
  - claude/pruebas.md: dejar cerrada la sección de la versión, sin borrar intentos.

## Versiones
- Tercer dígito: parche o bug. Segundo: feature completo con UI. Primero: versión mayor estable. Cuarto: guardado intermedio, sin tag (detalle en "Guardado intermedio"): sirve para guardar el trabajo sin terminar y continuarlo en otro equipo. En un guardado intermedio NO se tocan package.json, package-lock.json ni el número de versión de README.md y ROADMAP.md: siguen en la última versión terminada hasta que se cierre la siguiente.

## Cierre de versión (solo con mi autorización, después de confirmar la documentación)
- No proponer documentación de cierre ni tag hasta que yo confirme que la función se probó de punta a punta en la app y lo autorice.
- Commit con tag vX.X.X, push de work y del tag. Mismo procedimiento que el guardado intermedio: git status, archivos por ruta, reportar hash.
- Release: título "vX.X.X — descripción corta". Marcar "Latest" solo si lleva el .exe, el .blockmap y latest.yml del mismo build; si no, "None".
- Después del push del tag, preparar la información del release (título según la línea anterior): cuerpo con qué cambió, dónde se probó cada cosa y qué quedó sin probar, y limitaciones conocidas; lista de capturas de evidencia que debo adjuntar; y si corresponde "Latest" o "None" según los archivos de dist/. La app instalada busca actualizaciones en el release "Latest".
- dev y main: NO usar reset --hard. Preguntarme; el flujo nuevo será por pull request.

## LinkedIn
- Al cerrar una versión (después de preparar la información del release) y cuando se resuelva una falla importante, decirme si recomiendas publicarlo en LinkedIn: "Publicar" o "No publicar", con una o dos líneas de por qué.
- Criterio: solo se recomienda publicar si hay una historia concreta: un problema real, cómo se investigó, qué solución se aplicó y qué se aprendió. No se publican avances sin esa historia (cambios menores, ajustes de configuración, versiones de mantenimiento).
- Si recomiendas publicar, indicar qué parte de la historia se contaría (problema, investigación, solución y aprendizaje en una línea cada uno, tomados de claude/avance.md y claude/pruebas.md) y qué capturas de evidencia sirven.
- La evidencia y los ejemplos solo pueden salir del documento de prueba publicable; nunca de documentos privados ni de datos de usuarios.
- No redactar el post salvo que yo lo pida. Si lo pido: investigar primero qué publicaciones valoran los reclutadores al contratar juniors; estructura gancho → contexto → problema → investigación → solución → resultados honestos → lección → llamada a la acción → stack y hashtags; sin métricas inventadas; imagen: un diagrama limpio, sin código ilegible, terminales ni información privada.
