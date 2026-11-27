# Pruebas

Registro de cada intento de prueba, incluidos los que fallaron o se revirtieron. Un intento no se borra nunca. Una sección por versión (`## vX.X.X`), la más reciente arriba. Leer solo la sección de la versión en curso, nunca el archivo completo.

Formato por intento: fecha · equipo · documento (descripción genérica, nunca contenido) · consulta · cambio aplicado antes (o "ninguno") · resultado (pasó / falló / parcial) · datos técnicos · conclusión y siguiente paso.

## v3.1.0

### 27/11/2026 · laptop (NEXUS) · Dos documentos activos, pregunta concreta de relatividad con la línea D (pasó; un solo añadido del modelo: "especial")

- **Fecha:** 27/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, con la línea D aplicada.
- **Documentos:** el podcast (165,041 car.) y el texto de relatividad, ambos activos en el mismo chat de la prueba anterior. Sin adjuntar nada en este turno.
- **Consulta:** "¿cuánto tiempo pasa para la gemela viajera?"
- **Cambio aplicado antes:** ninguno (la línea D de la prueba anterior).
- **Resultado:** pasó. La respuesta usó solo el texto de relatividad: la gemela viajera envejece más despacio, unos 5 años para ella frente a unos 10 de su hermana en la Tierra, viajando al 87 % de la velocidad de la luz. No habló del podcast ni se obligó a cubrir los dos documentos (la línea D no forzó una sección por documento). Las cifras (5, 10 y 87 %) coinciden con las que el mismo texto dio en las pruebas del 25/11 con un solo documento activo. En ese día el 3B había añadido una frase inventada ("los relojes… cerca del sol"); esta vez no hay ninguna frase de ese tipo.
  - **Verificado después, con permiso del usuario, contando palabras en la copia guardada del texto de relatividad:** "estrella" aparece 1 vez (el viaje de la gemela es a una estrella a poco más de cuatro años luz, al 87 %); "relatividad general" aparece 1 vez; "especial" aparece 0 veces. Es decir, "durante su viaje a una estrella" y "relatividad general" son fieles al texto; "relatividad especial" lo añadió el 3B (el término es correcto en física, pero no está en el documento). Gramática: "ella solo transcurrieron unos 5 años" (error de concordancia del 3B).
- **Datos técnicos:** sin consola pegada en este turno; no se anotaron `usados`/`promptTokens`.
- **Conclusión y siguiente paso:** la línea D no empeora una pregunta concreta con dos documentos activos en laptop. Falta repetir las dos pruebas de la línea D en desktop (confirmar hostname 'indomita').

### 27/11/2026 · laptop (NEXUS) · Dos documentos juntos DESPUÉS de la línea D (pasó; documento 1 fiel al texto, un solo añadido del 3B en el documento 2)

- **Fecha:** 27/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, `npm start` reiniciado tras aplicar la línea D (`chat-docs.service.js:452-455`).
- **Documentos:** el podcast (165,041 car.) y el texto de relatividad (10,925 car.), adjuntados juntos en el primer mensaje de un chat nuevo (`chat-1795803680631`).
- **Consulta:** "analiza los documentos y dime que de trata cada uno". No es idéntica a la del intento fallido ("analiza estos documentos"); tampoco cuenta como pregunta global (ni "analiza los documentos" ni "que de trata" coinciden con la regla), así que el podcast llegó otra vez como fragmentos por palabra.
- **Cambio aplicado antes:** la línea D (con 2 o más documentos usados, "Hay N documentos: … responde con una sección por cada documento").
- **Resultado:** la estructura pasó. La respuesta trae una sección por documento, con el nombre de cada archivo: "**Documento 1: premiosdirac…**" y "**Documento 2: Relatividad…**". El podcast ya no se ignora (antes, 27/11 sin la línea, la respuesta tomaba los dos por relatividad). Sin "Soy Tempest." ni negaciones.
  - Documento 1 (podcast): habla del "Premio Nobel de Física", la inflación, ondas gravitacionales y Starobinsky. **Verificado después (27/11, con permiso del usuario, contando palabras en la copia guardada):** "nobel" 56 veces, "starobinsky" 13, "inflaci" 72, "ondas gravitacionales" 15, "dirac" 4, "breakthrough" 12. El contenido del documento 1 es fiel al texto; la duda anterior sobre el Nobel era infundada.
  - Documento 2 (relatividad): relatividad, velocidad de la luz constante, dilatación del tiempo, relojes atómicos y GPS. **Verificado después (conteo en la copia del texto):** "relojes at" 2 veces y "gps" 3 están en el texto; "altas energ" 0 veces, o sea que "altas energías" fue un añadido del 3B (la frase aparece 4 veces en el podcast, así que pudo mezclarla de ahí; no probado).
- **Datos técnicos (consola):** modo explain; `estimado=6000tok presupuesto ventana normal=4571tok → ventana ampliada: sí`; alias `large-context` (`qwen2.5-3b-q5`, ventana 16384), presupuesto 13338 tok, `usados=2 omitidos=0`, `promptTokens` estimado 4688 (4304 en el intento anterior). Aviso del podcast: 4 de 131 fragmentos (5,157 de 165,041 car.). Sin error de memoria.
- **Conclusión y siguiente paso:** la línea D cambió el resultado de "ignora el podcast" a "una sección por documento". Falta: la segunda prueba (pregunta concreta del texto de relatividad con los dos activos, para comprobar que no inventa sobre el podcast) y las dos en desktop. El contenido del documento 1 queda sin verificar hasta poder leer el texto.

### 27/11/2026 · laptop (NEXUS) · Dos documentos adjuntados juntos, DESPUÉS de C + A + B y del reparto de presupuesto (código: pasó; lectura del 3B: falló)

- **Fecha:** 27/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, mismo `npm start` de la prueba anterior (código v3.0.11.9).
- **Documentos:** el podcast (165,041 car.) y el texto de relatividad (10,925 car.), adjuntados juntos en el primer mensaje de un chat nuevo (`chat-1795802473169`).
- **Consulta:** "analiza estos documentos".
- **Cambio aplicado antes:** reparto de presupuesto entre documentos (`estimateCharsForBudget`, pendiente 18) y C + A + B (pendiente 22), hechos en desktop el 26/11.
- **Resultado:** el código pasó y la lectura del modelo falló.
  - Código: `[CHAT DOCS] usados=2 omitidos=0`, los dos documentos llegaron al modelo.
  - Lectura: la respuesta trata los dos documentos como si fueran de relatividad. Dice que "el primer documento" habla de relojes atómicos en aviones, dilatación del tiempo y GPS, y que "el segundo documento profundiza" con la gravedad. Todo eso es del texto de relatividad; del podcast (premios de física, fósforo, Belcher, gran oxidación) no dice nada, y le atribuye contenido que no es suyo. No hubo "Soy Tempest." ni negación.
- **Datos técnicos (consola):** modo explain; `[CHAT DOCS] estimado=6122tok presupuesto ventana normal=4578tok → ventana ampliada: sí`; alias `large-context` (`qwen2.5-3b-q5`, ventana 16384), presupuesto 13345 tok, `promptTokens` estimado 4304. Sin error de memoria con la ventana de 16384. Diferencia con desktop: allí no hubo ventana ampliada (desktop no está en `LARGE_CONTEXT_PROFILES`) y se repartió el presupuesto. Aviso de la interfaz no copiado.
- **Conclusión y siguiente paso:** en desktop, con el 8B, el mismo caso cubrió los dos documentos por separado; en laptop, el 3B ignora el podcast y mezcla. Es la hipótesis 4 del pendiente 22 ("con varios documentos, nada le pide cubrir cada uno"), cuya opción D quedó "solo si hace falta tras A y B". Decisión del usuario: aplicar D (en los dos perfiles o solo en laptop, decisión 13) o dejarlo como limitación conocida del 3B con la salida de un documento activo a la vez.

### 27/11/2026 · laptop (NEXUS) · Fósforo, Belcher y biología canina DESPUÉS de C + A + B (pasó; sin "Soy Tempest")

- **Fecha:** 27/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, `npm start` reiniciado tras bajar v3.0.11.9 (`10f1204`).
- **Documento:** el podcast de 165,041 caracteres, adjunto solo en el primer mensaje de un chat nuevo ("Fósforo Documento 4").
- **Consultas (en orden, mismo chat):** (1) "¿Qué dice el documento sobre el fósforo?" con el adjunto; (2) "¿Qué dice sobre las Islas Belcher?"; (3) "que dice sobre la biología canina?".
- **Cambio aplicado antes:** C (plurales de stopwords), A ("Responde ahora a esto: «…»" al final del bloque) y B (sin repetir "dilo y no lo inventes" por fragmento), hechos en desktop el 26/11.
- **Resultado:** pasó. Ninguna respuesta empieza con "Soy Tempest." ni repite la pregunta (el riesgo del 25/11 con una línea parecida no se dio). Ninguna abre negando.
  - Fósforo: lo describe como elemento muy limitante para la vida en ecosistemas marinos, uno de los menos abundantes, usado por las enzimas, y relaciona las rocas de las Islas Belcher en Canadá con el oxígeno y la disponibilidad de fósforo. Error de detalle: dice "rocas de hace 2 a 1 millones de años" (el texto habla de unos 2.050 millones). 3 de 131 fragmentos (4,009 car.).
  - Belcher: rocas analizadas en las Islas Belcher, subártico de Canadá, isótopos para entender el oxígeno y el fósforo en el paleoproterozoico. Corta, sin la forma de circuito de carreras. 3 de 131 fragmentos (4,094 car.).
  - Biología canina: "El documento no menciona nada sobre la biología canina." Aviso con "canina" como palabra ausente. 3 de 131 fragmentos (3,882 car.).
- **Datos técnicos:** respuestas y avisos copiados de la app y una captura; sin consola, así que no se confirmó el alias ni el modelo en este intento. Barra: 1/10.
- **Conclusión y siguiente paso:** C + A + B no rompen al 3B y mejoran la lectura del fósforo (sin negar, con más detalle que antes). Falta en laptop la prueba de dos documentos adjuntados juntos.

### 26/11/2026 · desktop · Mensaje con imagen (parcial: la visión pasó; la parte "con documento activo" no se cubrió)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), `[server] Perfil de hardware activo: desktop`; misma máquina (INDOMITA).
- **Documento:** ninguno visible en este turno. El chat (`chat-1795736191828`) es nuevo y no hay línea `[CHAT DOCS]` en consola.
- **Consulta:** "analiza esta imagen", con una captura de un videojuego.
- **Cambio aplicado antes:** ninguno relacionado con visión.
- **Resultado:** parcial. **La visión pasó en desktop:** modo `visual`, OCR con 35 % de confianza → categoría `visual` → `qwen2.5-vl-7b-q4`, respuesta sin abortar (en laptop, el 25/11, `llava` superó los 180 s). Descripción aceptable con errores de detalle: ubicó "Hablar A" abajo a la derecha (está al centro) y cruzó la ropa de los dos personajes. **No se cubrió lo que pide el pendiente 4:** imagen en un chat con documento activo y, en el turno siguiente sin imagen, comprobar que el documento sigue disponible. El aviso "Los archivos adjuntos valen solo para este mensaje" es el del camino temporal, esperado por diseño (un mensaje con imagen no entra al sistema de documentos).
- **Datos técnicos (consola):** `[OCR] Cache hit`, 1,222 palabras, varianza 21.5; `[MODEL ROUTER] alias visual → qwen2.5-vl-7b-q4`. La consola pegada se corta ahí, sin tiempos ni carga del modelo.
- **Conclusión y siguiente paso:** repetir en el chat donde el podcast está activo: enviar la imagen y luego, sin imagen, "¿qué dice sobre el fósforo?". Vigilar el cambio de modelo visión → 8B de lectura (en laptop dio errores de VRAM, pendientes 19 y 20).

### 26/11/2026 · desktop · Segundo intento de imagen, otra vez sin documento activo (parcial; hallazgo nuevo: error de VRAM en desktop)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), `[server] Perfil de hardware activo: desktop`; misma máquina (INDOMITA), tras reiniciar `npm start`.
- **Documento:** ninguno. Chat nuevo (`chat-1795736818042`), otra vez sin ninguna línea `[CHAT DOCS]` en consola — sigue sin probarse la combinación real con un documento activo.
- **Consulta:** "analisa la imagen" (mismo archivo del intento anterior).
- **Cambio aplicado antes:** ninguno.
- **Resultado:** parcial. La visión volvió a responder bien, sin abortar: describió el entorno, los corazones, "OBJETOS + MAPA", "+HABLA", el botón "Hablar A" y "0 0 0". **Hallazgo nuevo:** `Error en generateTitleFromText: Error A context size of 512 is too large for la available VRAM`, justo al cargar `qwen2.5-vl-7b-q4`. Es el mismo tipo de error de los pendientes 19 y 20, vistos antes solo en laptop; es la primera vez que aparece en desktop. No detuvo la respuesta visual, solo el título automático del chat.
- **Datos técnicos (consola):** `[vision] Análisis de imágenes listo`, modelo de chat por defecto `hermes-q4` cargado, luego el error de `generateTitleFromText` al intentar cargar el modelo de visión en paralelo. Alias `visual` → `qwen2.5-vl-7b-q4`, igual que el intento anterior.
- **Conclusión y siguiente paso:** sigue pendiente hacer esta prueba en un chat CON el podcast ya activo (no uno nuevo). El error de VRAM queda anotado como hallazgo nuevo, agrupado con los pendientes 19/20; no se investiga más a fondo a menos que el usuario lo pida.

### 26/11/2026 · desktop · Imagen en el chat correcto (CON el podcast activo), tras el recorrido completo de fósforo/Belcher/canina/eje/small talk/pregunta global (parcial: el chip sobrevivió, sin error de VRAM; falta la pregunta posterior sin imagen)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), `[server] Perfil de hardware activo: desktop`; misma máquina (INDOMITA).
- **Documento:** el podcast, activo en el chat "Fósforo Documentos 2" (`chat-1795735783223`), guardado de una sesión anterior.
- **Consulta (en orden, mismo chat):** repetición completa del guion de hoy — (1) fósforo, (2) Islas Belcher, (3) biología canina, (4) "eje central", (5) "gracias", (6) "hola", (7) "¿de qué habla el documento?", y después (8) "analiza la imagen" con un adjunto nuevo (captura de otro videojuego, de fantasía/ciencia ficción).
- **Cambio aplicado antes:** C + A + B del 26/11 (ya aplicados en pruebas anteriores de hoy; esta es una repetición en un chat con historial).
- **Resultado:** los turnos 1-7 pasaron igual que en el intento anterior de hoy (fósforo y Belcher sin negar, canina y eje sin inventar, small talk y pregunta global sin cambios). **Turno 8 (imagen): parcial.** La visión respondió sin error (OCR 45 % confianza, 121 palabras, `qwen2.5-vl-7b-q4`, sin el error de VRAM del intento anterior — ese chat ya tenía los modelos resueltos, a diferencia del chat nuevo de antes). El chip del documento **siguió visible en la barra** ("Documentos del chat 1/10") inmediatamente después del mensaje con imagen. Falta la pregunta posterior SIN imagen para confirmar que el documento responde, no solo que el chip se ve.
- **Datos técnicos (consola):** dos peticiones en el log pegado: una del chat nuevo del intento anterior (`chat-1795736818042`, con el error de VRAM ya anotado) y una de este chat (`chat-1795735783223`, sin error). `generateTitleFromText` no se repite aquí porque el chat ya tenía título.
- **Conclusión y siguiente paso:** falta un último mensaje, sin adjuntar nada, preguntando algo del documento (p. ej. Islas Belcher otra vez) para cerrar el pendiente 4 por completo.
- **Cierre (mismo chat, turnos 9 y 10): pasó.** (9) "¿qué dice sobre las Islas Belcher?", sin imagen → `doc-read` (`llama-3.1-8b-q5`), `[CHAT DOCS] usados=1 omitidos=0`, 3 de 131 fragmentos (4,094 car.), respuesta correcta y sin negar (rocas analizadas, subártico de Canadá, forma de circuito de carreras). El cambio de modelo `Hermes-q4 → Meta-Llama-3.1-8B-Q5` funcionó sin `InsufficientMemoryError`, con la visión de Ollama usada justo antes (en laptop este paso falló, pendientes 19 y 20). (10) La misma pregunta repetida: misma respuesta, sin cambio de modelo. **El pendiente 4 queda completo en desktop:** el documento sobrevive a un turno con imagen y responde bien en el turno siguiente.

### 26/11/2026 · desktop · Prueba A, palabra única ("moraleja"), DESPUÉS de C + A + B (pasó en lo esencial, mejor que la versión de laptop)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), `[server] Perfil de hardware activo: desktop`; misma máquina (INDOMITA), mismo chat que las pruebas anteriores de hoy (`chat-1795735783223`, podcast activo).
- **Consulta:** "¿Cuál es la moraleja sobre bosones y fermiones?" ("moraleja" aparece una sola vez en el documento, ~48 %).
- **Cambio aplicado antes:** C + A + B del 26/11.
- **Resultado:** pasó limpio, sin ninguna invención. "La moraleja sobre bosones y fermiones es que a altas energías, la diferencia entre bosones y fermiones carece de sentido. Cuando se está consciente del superespacio completo, donde ambos tipos de partículas están interconectados, entonces los bosones y fermiones son considerados como una misma cosa naturalmente." Sin "Soy Tempest" al inicio (a diferencia de la respuesta de laptop el 25/11 a la misma pregunta) y sin el añadido inventado que tuvo el 3B esa vez ("debido a su superposición cuántica").
- **Verificado contra el texto real (con permiso del usuario, `backend/data/.../chat-1795735783223/premiosdiracbreakthroughsupergr-coffeebr.txt`):** el pasaje real dice, casi palabra por palabra, "en el momento que tú eres consciente de todo el superespacio... la diferencia entre bosón y fermión carece de sentido... bosones y fermiones son de manera natural la misma cosa, esa es la moraleja". "Superespacio" es del documento, no una invención del modelo.
- **Datos técnicos (consola):** `doc-read` (`llama-3.1-8b-q5`), presupuesto 5419 tok, `usados=1 omitidos=0`, `promptTokens` estimado 2664.
- **Conclusión y siguiente paso:** primera prueba de la Prueba A en desktop, y la mejor de las tres veces que se ha hecho esta pregunta (laptop antes de C+A+B: con invención; laptop 25/11: con invención; desktop 26/11 con C+A+B: sin invención). Falta repetir en laptop con C+A+B para comparar directamente.

### 26/11/2026 · desktop · Fósforo y Belcher, DESPUÉS de C + A + B (pasó: sin negación, respuestas correctas)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), `[server] Perfil de hardware activo: desktop`; misma máquina (INDOMITA).
- **Documento:** el podcast, adjunto en el mensaje, chat nuevo (`chat-1795735783223`).
- **Consulta (en orden, mismo chat):** (1) "¿Qué dice el documento sobre el fósforo?"; (2) "¿Qué dice sobre las Islas Belcher?".
- **Cambio aplicado antes:** C (filtro de plurales de stopwords), A (pregunta repetida al final del bloque) y B (sin repetir "dilo y no lo inventes" por fragmento), los tres del 26/11.
- **Resultado:** pasó. Las dos respuestas describen el contenido real **sin abrir negando** (antes: "el documento no menciona nada sobre el fósforo" + contradicción en la misma respuesta; "No hay ninguna mención a las Islas Belcher" + luego lo describe).
  - Fósforo: "El documento menciona que el fósforo es un elemento importante para la vida, pero relativamente escaso... nutriente limitante... falta podría haber contribuido a un colapso ecológico..." — coincide con el texto real verificado antes (fragmentos 106/108/109).
  - Belcher: "Las Islas Belcher son mencionadas... rocas que han sido analizadas... forma extraña, similar a un circuito de carreras... subártico de Canadá." — coincide palabra por palabra con el texto real verificado antes (fragmento 109).
- **Datos técnicos (consola):** `doc-read` (`llama-3.1-8b-q5`) en los dos turnos (modos explain y general), 3 de 131 fragmentos cada uno (4,009 y 4,094 car., igual que antes del cambio), `usados=1 omitidos=0`. Sin cambios de mecánica (mismos fragmentos, mismo alias); solo cambió la redacción del bloque.
- **Continuación (mismo chat, mismo día):** se completó el guion con 5 turnos más.
  - (3) "¿Qué dice sobre la biología canina?" → "No se menciona nada sobre la biología canina en el documento adjunto." Pasó: sigue sin inventar. 3 de 131 fragmentos (3,882 car.), aviso con "canina" como palabra ausente.
  - (4) "¿Cuál es el eje central?" → `[CHAT DOCS] sin coincidencia: eje, central` → `cortocircuito: no_match`. Pasó: la compuerta no se tocó y sigue igual.
  - (5) "gracias" → explicó el significado de la palabra, sin documentos (`usados=0`). Igual que antes.
  - (6) "hola" → saludo fijo, sin llamar al modelo. Igual que antes.
  - (7) "¿de qué habla el documento?" → pregunta global, principio y final (19,556 de 165,041 car., 12 %). Respuesta coherente sobre "Coffee Break", premios de física, supergravedad, universo temprano y el telescopio TMT en Hawái; no se detectó invención evidente.
- **Conclusión y siguiente paso:** recorrido completo sin regresiones. Small talk, compuerta, biología canina (control negativo) y la pregunta global siguen igual que antes; fósforo y Belcher pasaron de fallar a responder bien. Fuerte evidencia a favor de la hipótesis 1 (las instrucciones negativas repetidas pesaban más que el texto leído). Falta: el caso de dos documentos, y repetir fósforo/Belcher en **laptop**, donde está el riesgo conocido del 25/11 con una línea parecida a la de A.

### 26/11/2026 · desktop (INDOMITA) · Recorrido de 8 turnos en un chat: fragmentos, seguimiento, palabras ausentes, compuerta y small talk (parcial)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), hostname INDOMITA confirmado, versión de desarrollo, `npm start` reiniciado tras descargar v3.0.11.8 (`603ab9f`).
- **Documento:** el mismo podcast de 165,041 caracteres (131 fragmentos), adjunto solo en el turno 1 de un chat nuevo (`chat-1795715062446`).
- **Consulta (en orden, mismo chat):** (1) "¿Qué dice el documento sobre el fósforo?", con el adjunto; (2) "¿Qué dice sobre las Islas Belcher?" (se envió con unas comillas sobrantes al final); (3) "¿Y qué más dice de eso?"; (4) "Qué dice sobre la biología canina?"; (5) "¿Cuál es el eje central?"; (6) "gracias"; (7) "hola"; (8) "¿de qué habla el documento?" (sin el "hola," del guion).
- **Cambio aplicado antes:** ninguno (código de v3.0.11.8, umbral de fragmentos en desktop 3000).
- **Resultado:** parcial. Todos los mecanismos funcionaron en desktop (fragmentos, reutilización en el seguimiento, palabras ausentes en el aviso, compuerta, small talk y pregunta global). La lectura del modelo falló en T1 y T2.
- **Datos técnicos (consola y respuestas en pantalla; el log `requests-2026-11-26.jsonl` no se revisó):**
  - Perfil: `[server]`, `[CONFIG]` y `[MODEL ROUTER]` dicen `desktop`. Inventario: modelos completos.
  - T1: modo explain, alias `doc-read` (`llama-3.1-8b-q5`), ventana 8192, presupuesto 5655 tok, 3 de 131 fragmentos (4,009 car.), `promptTokens` estimado 1600, `maxTokens` 500. Cambio de modelo hermes-q4 → llama-3.1-8b-q5 sin error de memoria. Respondió que el documento no menciona el fósforo y, en la misma respuesta, que se menciona como elemento importante y escaso: se contradice. Falló.
  - T2: modo general, `doc-read`, presupuesto 5599 tok, 3 de 131 fragmentos (4,094 car., el mismo tamaño que el T2 de laptop del 24/11, que pasó), `maxTokens` 1400. Respondió que no hay mención de las Islas Belcher; solo habló de rocas de Canadá y de "las islas". Falló.
  - T3: modo general, `doc-read`, los mismos 3 fragmentos (el aviso dijo "los mismos del mensaje anterior"). La respuesta repitió palabra por palabra la de T2 y añadió un párrafo que la contradice (dice que sí se menciona Belcher y la describe). Mecanismo pasó; respuesta parcial, con copia del turno anterior.
  - T4: modo general, `doc-read`, 3 de 131 fragmentos (3,882 car.). El aviso terminó con la palabra ausente "canina". El modelo respondió que no hay información sobre ese tema. Pasó (en laptop, el 3B inventó una definición 2 de 2 veces).
  - T5: consola `[CHAT DOCS] sin coincidencia: eje, central` y `cortocircuito: no_match`; aviso fijo sin llamar al modelo. Pasó.
  - T6 "gracias": alias `general-standard` (`qwen2.5-7b-q5`), `usados=0`, `promptTokens` 791; cambio de modelo sin error de memoria. Sin documentos: pasó. La respuesta explicó el significado de la palabra "gracias" en vez de tomarla como agradecimiento.
  - T7 "hola": saludo fijo con un nombre de persona, sin `buildSystemPrompt` ni llamada al modelo, igual que en laptop (pendiente 16). La consola imprimió `[MODEL ROUTER]` y `[CHAT DOCS] usados=0` antes del saludo.
  - T8: modo general, `doc-read`, pregunta global: principio y final, 19,552 de 165,041 car. (12 %), `promptTokens` 5962; la interfaz avisó que no vio la parte del medio. Sin ventana ampliada: desktop no está en `LARGE_CONTEXT_PROFILES` (en laptop, con 16384, llegó el 28 %). La respuesta trae el nombre del premio y apellidos distorsionados; no se verificó contra el texto.
  - `maxTokens` 500 en el turno explain y 1400 en los turnos general con documento (sin investigar por qué en general sale el valor de código).
- **Conclusión y siguiente paso:** en desktop funcionan todos los mecanismos de v3.1.0 probados aquí. Falla la lectura del 8B con 3 fragmentos que el 3B de laptop sí leyó (Belcher). Antes de tocar código, repetir fósforo y Belcher en un chat nuevo para ver si la falla es constante. Siguen sin probar en desktop: Prueba A, chat nuevo sin documentos, cambiar de chat y regresar, la prueba del umbral con un documento de ~3500 tokens y las pruebas mecánicas.

### 26/11/2026 · desktop · Chat nuevo no arrastra documentos: pregunta genérica sin coincidir con la expresión de referencia implícita (falló: el modelo inventó documentos)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), confirmado por el bloque `[MODEL ROUTER]` de la consola (`hardware: desktop`), misma máquina (INDOMITA) confirmada hoy antes; `[CONFIG]` no se usa para confirmar el equipo (pendiente 10).
- **Documento:** ninguno. Chat nuevo (`chat-1795723127375`), creado después de un chat con el podcast activo, tras reiniciar `npm start`.
- **Consulta:** "¿tienes algún documento?"
- **Cambio aplicado antes:** ninguno.
- **Resultado:** falló. El objetivo de la prueba era confirmar que un chat nuevo no arrastra documentos de otro chat; en cambio, el modelo inventó documentos ficticios ("instrucciones de configuración, guías de uso y un resumen general" de "mi proyecto Tempest").
- **Datos técnicos (consola):** modo general, alias `general-standard` (`qwen2.5-7b-q5`), `promptTokens` estimado 345. **Sin ninguna línea `[CHAT DOCS]`** en todo el turno: el sistema de documentos del chat no intervino.
- **Causa (lectura de código, sin cambiar nada):** `DOCUMENT_REFERENCE_RE` (`chat-docs.selector.js:22-23`) es intencionalmente estrecha (`"el/este/ese documento"`, `"el pdf"`, `"lo que te pasé"`, etc.). "¿tienes **algún** documento?" no coincide, así que `referencesDocumentImplicitly()` devuelve falso. Con 0 documentos activos y sin coincidir esa expresión, `prepareTurn` no genera el cortocircuito `no_documents`: el turno sigue como chat general sin ninguna protección, y el modelo alucina libremente.
- **Precedente:** mismo patrón exacto el 25/11 en laptop (NEXUS), con otra pregunta en un chat sin documentos — ver la entrada "Prueba A con palabra única: no válida (chat sin documento)" de esa fecha (`chatDocs.activeCount 0`, `outcome "none"`, sin línea `[CHAT DOCS]`, "respuesta inventada, sin relación con el documento"). No es un fallo nuevo de desktop: es el mismo comportamiento en los dos perfiles, no detectado como problema en su momento.
- **Conclusión y siguiente paso:** el cortocircuito "sin documentos activos" protege solo frente a una expresión muy específica, no frente a cualquier pregunta razonable sobre si hay documentos. Sin editar código: pendiente evidencia "antes" (capturas) y decisión del usuario sobre cómo ampliar la detección, antes de tocar `DOCUMENT_REFERENCE_RE` o `prepareTurn`. Falta todavía la segunda parte de esta prueba: cambiar de chat y regresar al que tiene el documento.

### 26/11/2026 · desktop · Misma prueba, DESPUÉS del arreglo (pasó)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), `[server] Perfil de hardware activo: desktop` y `[CONFIG] hardwareProfile: 'desktop'` en consola; misma máquina (INDOMITA) de la prueba anterior.
- **Documento:** ninguno. Chat nuevo (`chat-1795724488624`), tras reiniciar `npm start`.
- **Consulta:** "¿tienes algún documento?" (la misma del "antes").
- **Cambio aplicado antes:** opción C del análisis: (A) `DOCUMENT_REFERENCE_RE` ampliada con el patrón de pregunta de existencia (`chat-docs.selector.js:18-24`) y (B) nota determinista "[No hay documentos activos en este chat.]" cuando `outcome === 'none'` sin cortocircuito (`chat.controller.js`, rama `else if` después de la 884). Sintaxis OK, CRLF conservado en los dos archivos; probado antes con un script contra la regex real (7/7 casos).
- **Resultado:** pasó. Respuesta: "No tengo ningún documento activo en este chat. Adjunta el archivo otra vez para que pueda leerlo."
- **Datos técnicos (consola):** `[CHAT DOCS] cortocircuito: no_documents`. Se resolvió por la opción A (el cortocircuito sin modelo), no hizo falta que interviniera B. No hay línea `[MODEL ROUTER]` ni carga de modelo para este turno: no se llamó al modelo.
- **Conclusión y siguiente paso:** confirmado el arreglo con la misma pregunta y el mismo chat sin documentos que falló antes. Falta: probar otras formas de la pregunta que dependan de B en vez de A (por ejemplo "¿ves algo adjunto?"), y la segunda parte de la prueba original: cambiar de chat y regresar al que tiene el documento.

### 26/11/2026 · desktop · Camino B (nota determinista) probado con una frase que A no cubre (pasó)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), `[server] Perfil de hardware activo: desktop`; misma máquina (INDOMITA).
- **Documento:** ninguno. Chat nuevo (`chat-1795724701456`), tras reiniciar `npm start`.
- **Consulta:** "¿ves algo adjunto?" — elegida porque no coincide con `DOCUMENT_REFERENCE_RE` (verificado con un script: `referencesDocumentImplicitly('¿ves algo adjunto?')` → `false`), así que aísla el camino B.
- **Cambio aplicado antes:** ninguno adicional (mismo cambio de la prueba anterior).
- **Resultado:** pasó. Respuesta: "No veo ningún documento adjunto en este chat. ¿Podrías explicarme qué necesitas ayuda con?"
- **Datos técnicos (consola):** `general-standard` (`qwen2.5-7b-q5`), `promptTokens` estimado 348. **Sin línea `[CHAT DOCS]`** (ni `cortocircuito` ni `ventana=...`): consistente con que no hubo shortCircuit y `outcome` no fue `'select'`. No hay ninguna línea de consola que confirme directamente que la nota B se agregó al mensaje; se infiere por descarte (A no coincidió, cero documentos activos, respuesta coherente con el texto de la nota) más la respuesta correcta. Pendiente: agregar un log propio para el camino B, igual que el `cortocircuito: no_documents` de A, para no depender de inferencia.
- **Conclusión y siguiente paso:** los dos caminos de la opción C quedan probados y pasaron. Falta la segunda parte de la prueba original (cambiar de chat y regresar) y, si se quiere, el log explícito del camino B.

### 26/11/2026 · desktop · Log de diagnóstico del camino B, confirmado en consola (pasó)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), `[server] Perfil de hardware activo: desktop`; misma máquina (INDOMITA).
- **Documento:** ninguno. Chat nuevo (`chat-1795727316298`), tras reiniciar `npm start`.
- **Consulta:** "¿ves algo adjunto?" (la misma de la prueba anterior).
- **Cambio aplicado antes:** `console.log('[CHAT DOCS] nota: sin documentos activos...')` y `trace.chatDocs.noDocsNote = true` agregados a la rama `else if` del camino B (`chat.controller.js`, después de la línea 888). Sintaxis OK, CRLF conservado (1903 líneas).
- **Resultado:** pasó. La consola muestra `[CHAT DOCS] nota: sin documentos activos (la pregunta no coincidió con la referencia implícita)`, justo antes de `buildSystemPrompt`, confirmando en vivo que el camino B se activó. Respuesta correcta, igual que antes.
- **Conclusión y siguiente paso:** el camino B ya no depende de inferencia; queda visible en consola y en el trace del log. Falta la segunda parte de la prueba original: cambiar de chat y regresar al que tiene el documento.

### 26/11/2026 · desktop · Cambiar de chat y regresar al que tiene el documento (pasó)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), misma máquina (INDOMITA) de las pruebas de hoy.
- **Documento:** el podcast, activo en un chat ya existente ("Fósforo Documentos"), con el chip "premiosdiracbreakthroughsupergr-coffe..." en la barra.
- **Consulta:** navegación: desde el chat "Email Adjunto" (sin documentos, de una prueba anterior) se cambió al chat "Fósforo Documentos"; dentro de ese chat, "gracias", "hola" y "¿de qué habla el documento?" (capturas de pantalla, no logs de consola).
- **Cambio aplicado antes:** ninguno (verificación visual, no de código).
- **Resultado:** pasó. En "Email Adjunto" no aparece ninguna barra de documentos (correcto, no tiene ninguno). Al volver a "Fósforo Documentos", la barra muestra "Documentos del chat (1/10): premiosdiracbreakthroughsupergr-coffe... ✕" sin recargar la ventana. "gracias" y "hola" se respondieron como saludo/cortesía (small talk); "¿de qué habla el documento?" se contestó con contenido real del documento (medalla, premios Breakthrough, supergravedad, gravitón/gravitino, materia oscura, gran oxidación), no inventado.
- **Datos técnicos:** solo capturas de pantalla, sin consola ni log revisados para este intento.
- **Conclusión y siguiente paso:** la prueba "Chat nuevo no arrastra documentos (cambiar de chat)" queda completa en desktop: tanto la parte de "no arrastrar" (pendiente 23) como la de "cambiar y regresar" pasaron.

### 26/11/2026 · desktop · Pruebas mecánicas: quitar y reactivar un documento (pasó)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), `[server] Perfil de hardware activo: desktop`; misma máquina (INDOMITA).
- **Documento:** el podcast, adjuntado en el chat nuevo "Análisis Documento" (`chat-1795727816031`).
- **Consulta (en orden, mismo chat):** (1) "analiza este documento", con el adjunto; (2) el usuario desactivó el documento a propósito (clic en ✕ del chip) y preguntó "que temas habla el documento?"; (3) el usuario reactivó el documento (clic en ↺) y repitió la misma pregunta.
- **Cambio aplicado antes:** ninguno.
- **Resultado:** pasó, de punta a punta. Con el documento desactivado, respondió el aviso correcto sin llamar al modelo; reactivado, volvió a usarlo con normalidad.
- **Datos técnicos (consola):**
  - T1 "analiza este documento": modo explain, `doc-read` (`llama-3.1-8b-q5`), presupuesto 5663 tok, `usados=1`. Respuesta correcta sobre el contenido (premio Dirac/Breakthrough, investigadores, encuesta TMT en Hawái).
  - T2 (documento desactivado): `[CHAT DOCS] cortocircuito: no_documents`. Respuesta fija: "No tengo ningún documento activo en este chat. Adjunta el archivo otra vez para que pueda leerlo." (`NOTICES.noDocuments()`, no `NOTICES.removed()`, porque la pregunta no nombra el archivo por su nombre — comportamiento esperado por diseño, decisión 4). Barra: "Documentos del chat (0/10)" con icono ↺.
  - T3 (documento reactivado, misma pregunta): `doc-read`, presupuesto 5439 tok, `usados=1`. Respuesta correcta y completa sobre los temas del documento. Barra: "Documentos del chat (1/10)" con icono ✕.
- **Conclusión y siguiente paso:** quitar y reactivar un documento pasa de punta a punta en desktop, igual que en laptop el 25/11. Pendiente 4 del avance, parte de desktop: completada.

### 26/11/2026 · desktop · Dos documentos adjuntados juntos en el mismo mensaje (confirma la hipótesis del pendiente 18: `budget_exceeded`, no `not_selected`)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), `[server] Perfil de hardware activo: desktop`; misma máquina (INDOMITA).
- **Documento:** los dos adjuntados a la vez en un chat nuevo (`chat-1795728565802`): el podcast (165,041 car.) y "Relatividad ¿Por Qué el Tiempo No Transcurre Igual para Todos" (más corto).
- **Consulta:** "analiza estos dos documentos", con los dos adjuntos en el mismo mensaje.
- **Cambio aplicado antes:** ninguno.
- **Resultado:** uno de los dos quedó fuera, con el texto "no cabía en el contexto de este mensaje" (`OMITTED_REASON_TEXT.budget_exceeded`, `frontend/ui.js:205`), no el texto corregido en el pendiente 18 ("no era el que pedías", que es para `not_selected`). Confirma la hipótesis ya anotada en el pendiente 18: con un documento largo, `packToBudget` (`chat-docs.selector.js`) mide por caracteres completos del documento entero, no por lo que realmente se envía por fragmentos, así que el segundo documento sale `budget_exceeded` aunque ambos se hayan adjuntado juntos en el mismo mensaje (no es el caso "nuevo + ya activo" que cubre el pendiente 18; aquí los dos son nuevos).
- **Datos técnicos (consola):** modo explain, `doc-read` (`llama-3.1-8b-q5`), presupuesto 5662 tok, `usados=1 omitidos=1`. El podcast se envió con 4 de 131 fragmentos (4,894 car.); "Relatividad..." no se envió. Los dos quedaron guardados y activos en la barra (10 % cada uno, según el aviso).
- **Conclusión y siguiente paso:** no es un bug nuevo de v3.1.0, es el límite ya conocido y pospuesto a v4.0 (decisión 14, ítem B: medir los documentos por su tamaño en fragmentos, no por caracteres completos). No se propone ningún cambio de código para esto en v3.1.0.

### 26/11/2026 · desktop · Mismo par de documentos, orden de adjunto invertido, DESPUÉS del arreglo del presupuesto (parcial: el arreglo funcionó para el primer orden; con el orden invertido, el otro documento quedó fuera)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), `[server] Perfil de hardware activo: desktop`; misma máquina (INDOMITA).
- **Documento:** los mismos dos de la prueba anterior, en un chat nuevo (`chat-1795729584674`), pero adjuntados en **orden invertido**: "Relatividad ¿Por Qué el Tiempo No Transcurre Igual para Todos.txt" primero, el podcast ("premiosdirac...") segundo.
- **Consulta:** "analiza estos documentos", con los dos adjuntos.
- **Cambio aplicado antes:** `estimateCharsForBudget` (26/11), el mismo de la prueba anterior.
- **Resultado:** parcial. Con el orden invertido, el que quedó fuera fue el podcast (antes había sido "Relatividad..."). Los dos documentos quedaron guardados y activos en la barra (2/10).
- **Datos técnicos (consola):** modo explain, `doc-read` (`llama-3.1-8b-q5`), presupuesto 5663 tok (similar al de la prueba anterior), `usados=1 omitidos=1`, `promptTokens` estimado 3310. La respuesta usó solo "Relatividad...", sin mención de fragmentos (se envió completo, no por fragmentos); el podcast salió `budget_exceeded` ("no cabía en el contexto de este mensaje").
- **Confirmado con los metadatos reales (con permiso del usuario, leídos del `index.json` del chat, no el contenido del documento):** "Relatividad..." = 10,925 caracteres reales; "premiosdirac..." (podcast) = 165,041. El umbral de fragmentos (3000 tok × 3.5) da un tope de 10,500 caracteres. Relatividad (10,925) queda apenas 425 caracteres por encima del tope, así que `estimateCharsForBudget` también la recorta a 10,500 — igual que al podcast. Con los dos documentos recortados al mismo tope (10,500 cada uno), suman 21,000 contra un presupuesto de ~19,820: no caben los dos juntos, en ningún orden, con los tamaños reales de estos dos archivos.
- **Corrección sobre la verificación previa:** el script de prueba usó un segundo documento simulado de 8,000 caracteres (una suposición, no el tamaño real). Con ese número sí cabían los dos; con el tamaño real (10,925), no. El arreglo no está roto: hace justo lo que debía (recortar cada documento por su estimado de fragmentos), pero estos dos documentos reales, con sus tamaños reales, no caben juntos de todas formas.
- **Dato adicional:** Relatividad se envió COMPLETA (sin aviso de fragmentos) en el turno que sí se usó, aunque sus 10,925 caracteres superan el tope de 10,500 en caracteres. Esto pasa porque el tope en caracteres es una aproximación (3.5 car./token); el conteo real de tokens de `llama.provider` dio ≤3000 tokens para ese texto, así que no necesitó fragmentos al renderizar, aunque sí se la cuenta como "larga" en la estimación de presupuesto. Es una imprecisión conocida de la aproximación por caracteres, no un error del cambio de hoy.
- **Conclusión y siguiente paso:** el arreglo del 26/11 mejora los casos donde el segundo documento es claramente más chico que el tope de fragmentos; con estos dos documentos reales, ambos quedan justo en o por encima del tope, así que ninguno de los dos órdenes alcanza. No se propone ningún cambio adicional sin que el usuario decida si vale la pena seguir ajustando esto.

### 26/11/2026 · desktop · Mismos dos documentos, DESPUÉS del reparto de presupuesto (código: pasó; lectura del modelo: parcial, ignoró uno de los dos)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), `[server] Perfil de hardware activo: desktop`; misma máquina (INDOMITA).
- **Documento:** los mismos dos de las pruebas anteriores (podcast 165,041 car., Relatividad 10,925 car.), en un chat nuevo (`chat-1795734136127`), adjuntados juntos.
- **Consulta:** "analiza estos documentos".
- **Cambio aplicado antes:** el reparto de presupuesto (`longShareCount`) del 26/11.
- **Resultado:** parcial. **El código pasó:** `[CHAT DOCS] usados=2 omitidos=0` — los dos documentos entraron, ninguno quedó fuera. Coincide exacto con la simulación de antes (5,250 car. cada uno a nivel de selección). **La lectura del modelo fue incompleta:** la respuesta solo habla de la relatividad (tiempo, velocidad de la luz, gravedad, GPS); no menciona nada del podcast (premio Dirac/Breakthrough, investigadores, encuesta de Hawái/TMT), aunque sus 4 fragmentos (5,449 de 165,041 car.) sí llegaron al modelo.
- **Datos técnicos (consola y respuesta):** modo explain, `doc-read` (`llama-3.1-8b-q5`), presupuesto 5663 tok, `promptTokens` estimado 4767. Podcast: 4/131 fragmentos (más que los 3 anteriores, porque ahora comparte presupuesto con Relatividad en vez de acapararlo todo). El aviso menciona "documentos" como palabra ausente en el podcast (correcto, es una palabra genérica de la pregunta, no del tema). Relatividad: enviada completa (no es largo según el umbral real de tokens), guardada y activa junto al podcast (2/10 en la barra).
- **Conclusión y siguiente paso:** el arreglo de presupuesto queda confirmado en la app con los tamaños reales: el problema de "uno se queda totalmente fuera" está resuelto para este par de documentos. Queda un problema distinto, ya conocido en otra forma (pendiente 22, el modelo no lee bien todo lo que recibe): con dos documentos en el mismo mensaje, el 8B centró toda la respuesta en uno y no usó nada del otro, aunque lo tenía. No se propone cambio de código para esto ahora; es el mismo tipo de limitación de lectura del modelo, aplicada al caso de varios documentos.

### 26/11/2026 · desktop · Mismos dos documentos, DESPUÉS de C + A + B (pasó: la respuesta cubre los dos documentos por separado)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), `[server] Perfil de hardware activo: desktop`; misma máquina (INDOMITA).
- **Documento:** los mismos dos (podcast 165,041 car., Relatividad 10,925 car.), chat nuevo (`chat-1795736043349`), adjuntados juntos.
- **Consulta:** "analiza estos documentos".
- **Cambio aplicado antes:** C (filtro de plurales de stopwords), A (pregunta repetida al final del bloque) y B (sin repetir "dilo y no lo inventes" por fragmento), del 26/11, sobre el reparto de presupuesto ya probado antes.
- **Resultado:** pasó. La respuesta identifica y resume **cada documento por separado**: "El primer documento... habla sobre la producción de oxígeno en la Tierra... paleoproterozoico... falta de nutrientes como el fósforo" (podcast, correcto) y "El segundo documento... explica conceptos básicos sobre la relatividad... el tiempo no transcurre igual... dependiendo de su velocidad y posición" (Relatividad, correcto). Antes, con el mismo par de documentos, ignoraba por completo el podcast.
- **Datos técnicos (consola):** modo explain, `doc-read` (`llama-3.1-8b-q5`), presupuesto 5663 tok, `usados=2 omitidos=0`, `promptTokens` estimado 4363. Podcast: 3 de 131 fragmentos (4,093 car.). Relatividad: enviada completa. Los dos guardados y activos en la barra.
- **Conclusión y siguiente paso:** A y B no solo arreglaron fósforo/Belcher con un documento — también resolvieron el caso de dos documentos que antes ignoraba uno. Queda probar lo mismo en laptop (riesgo conocido del 25/11 con una línea parecida a la de A).

### 26/11/2026 · desktop (INDOMITA) · Repetición del recorrido de 8 turnos en otro chat (parcial, mismo patrón)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (RTX 4070), hostname INDOMITA confirmado, versión de desarrollo, mismo arranque de `npm start` que el intento anterior.
- **Documento:** el mismo podcast de 165,041 caracteres (131 fragmentos), adjunto solo en el turno 1 de un chat nuevo (`chat-1795715843061`).
- **Consulta (en orden, mismo chat):** las mismas 8 del intento anterior de hoy.
- **Cambio aplicado antes:** ninguno.
- **Resultado:** parcial, mismo patrón que el primer intento de hoy. Fragmentos, seguimiento, palabras ausentes, compuerta y small talk funcionaron igual. T1 (fósforo) y T2/T3 (Belcher) volvieron a fallar, con fragmentos del mismo tamaño que el primer intento (4,009 y 4,094 car.).
- **Datos técnicos (consola):**
  - T1: `doc-read` (`llama-3.1-8b-q5`), 3 de 131 fragmentos (4,009 car.), `promptTokens` estimado 1600. Respondió "no menciona el fósforo explícitamente" y a continuación lo describe como posible nutriente limitante: contradicción más suave que el primer intento, mismo resultado de fondo (niega la mención).
  - T2: `doc-read`, 3 de 131 (4,094 car.). Respondió que no hay mención de Belcher "en el contexto de la producción o uso del fósforo"; sí usa datos de ese fragmento (rocas, isótopos de azufre y oxígeno) pero omite el nombre "Belcher" que está en el mismo texto.
  - T3 (seguimiento): mismos 3 fragmentos ("los mismos del mensaje anterior"); repitió la respuesta de T2 sin cambios, sin la contradicción que sí apareció en el primer intento.
  - T4 (biología canina): 3 de 131 (3,882 car.), aviso con "canina", respondió bien que no se menciona. Pasó, igual que el primer intento.
  - T5 (eje central): `cortocircuito: no_match`, sin llamar al modelo. Pasó.
  - T6 "gracias": `general-standard` (`qwen2.5-7b-q5`), `usados=0`. Explicó el significado de "gracias" en vez de tomarlo como agradecimiento, igual que el primer intento.
  - T7 "hola": saludo fijo con nombre de persona, sin llamar al modelo. Igual que el primer intento.
  - T8 "de qué habla el documento": `doc-read`, principio y final, 19,524 de 165,041 car. (12 %). Mencionó el premio, Breakthrough, supergravedad, gravitón/gravitino, materia oscura y la gran oxidación; no se verificó contra el texto.
- **Conclusión y siguiente paso:** el fallo de lectura en fósforo/Belcher se repite 2 de 2 en desktop hoy, con fragmentos de tamaño parecido. Ver la entrada siguiente para la verificación contra el texto guardado. El resto de mecanismos (fragmentos, compuerta, palabras ausentes, small talk) se comportó igual en los dos intentos.

### 26/11/2026 · desktop · Verificación de fósforo y Belcher contra el texto guardado (búsqueda correcta; confirma fallo de lectura del modelo)

- **Fecha:** 26/11/2026.
- **Equipo:** desktop (script aparte contra el archivo ya guardado del primer chat de hoy, `chat-1795715062446`; con permiso del usuario para leer dentro de `backend/data/`).
- **Documento:** el mismo podcast guardado (165,041 car., 131 fragmentos).
- **Consulta:** se reconstruyó la búsqueda real (`splitIntoChunks` + `rankChunks` + `pickFragments` de `chat-docs.retriever.js`) para "¿Qué dice el documento sobre el fósforo?" y "¿Qué dice sobre las Islas Belcher?", sin límite de presupuesto, y se comprobó qué fragmentos contienen las palabras clave.
- **Cambio aplicado antes:** ninguno (solo lectura, con permiso).
- **Resultado:** pasó la verificación de búsqueda. Confirma que el fallo de los dos intentos de hoy es de lectura del modelo, no del buscador.
- **Datos técnicos:**
  - Fósforo: `queryTerms` `["fosforo"]`. Fragmentos elegidos: 106, 108, 109 — los 3 contienen la palabra. El fragmento 108 dice, en su propio texto: "El menos abundante y el que suele ser limitante es el fósforo (...) se usa como combustible para las enzimas"; el 109: "los nutrientes son básicamente fósforo (...) el fósforo es el más relevante".
  - Belcher: `queryTerms` `["isla", "belcher"]`. Fragmentos elegidos: 108, 109, 110 — solo el 109 contiene el término exacto, y ahí dice explícitamente: "En las Islas Belcher, además (...) unas islas que yo no sabía que existían y que tienen forma como de circuito de carreras."
- **Conclusión y siguiente paso:** en los dos casos, el fragmento enviado contiene la respuesta de forma explícita, y el modelo (el 8B en desktop hoy, igual que el 3B en laptop el 24/11 para fósforo) dijo que no se menciona. No se arregla cambiando BM25 ni el umbral de fragmentos: el mecanismo de búsqueda ya hace su parte. Queda para v3.1.1 investigar por qué el modelo falla leyendo fragmentos que sí contienen la respuesta (formato del bloque, encabezado, orden de los fragmentos en el prompt).

### 25/11/2026 · laptop (NEXUS) · Fósforo tras revertir el cambio del historial (pasó)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, `npm start` reiniciado tras la reversión.
- **Documento:** el podcast, adjunto en el mensaje, chat nuevo `chat-1795658261639`.
- **Consulta:** "¿Qué dice el documento sobre el fósforo?"
- **Cambio aplicado antes:** reversión del pendiente 2 (sin `skipHistory` ni línea de preguntas anteriores); se mantienen la regla de vecinos y el resto de cambios de v3.1.0.
- **Resultado:** pasó. La respuesta habla de las rocas de las Islas Belcher en el subártico de Canadá y dice que "la falta de fósforo es mencionada como un elemento crucial limitante". La primera consulta no dio error de memoria.
- **Datos técnicos (consola):** modo explain, alias `doc-read` (`qwen2.5-3b-q5`), ventana 8192, `presupuesto=5555tok usados=1 omitidos=0`, `promptTokens` estimado 1541 (el mismo de las pruebas con 3 fragmentos). Aviso no copiado.
- **Conclusión y siguiente paso:** la reversión deja la app como antes del pendiente 2 y la regla de vecinos sigue funcionando. Fósforo con la regla de vecinos en chats nuevos: 4 de 5. Laptop terminado; siguiente: desktop.

### 25/11/2026 · laptop (NEXUS) · Chat largo repetido con "solo preguntas anteriores" (pendiente 2, opción A): falló, peor que antes

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, `npm start` reiniciado tras aplicar el cambio.
- **Documento:** el podcast, adjunto solo en el primer mensaje, chat nuevo `chat-1795657031940`.
- **Consultas:** las mismas 10 del chat largo anterior.
- **Cambio aplicado antes:** en turnos con documentos, sin historial (`skipHistory`) y con la línea "Preguntas anteriores en este chat (solo contexto, no las respondas): «…»" al principio del mensaje (`chat.controller.js:873-882`, `localai.service.js:400`).
- **Resultado por turno (antes → ahora):**
  - T1 fósforo (sin línea de preguntas, es el primero): no mencionaba el fósforo → lo menciona como factor limitante. La primera consulta no dio error de memoria.
  - T2 Belcher: copiaba T1 → "Soy Tempest. Si preguntan sobre las Islas Belcher, responde que están en el subártico de Canadá y tienen una forma circular rodeada por agua." Falla distinta.
  - T3 supergravedad: bien → "Soy Tempest. ¿Qué dice sobre la supergravedad en el documento?" Regresión.
  - T4 neutrinos: parcial → parcial (misma confusión fermión/bosón).
  - T5 biología canina: bien → solo "Soy Tempest." Regresión.
  - T6 gran oxidación: bien → "Soy Tempest. ¿Qué te llama la atención de este estudio sobre la gran oxidación?" Regresión.
  - T7 "¿Y eso cuándo fue?": fallaba por "fue" → contesta las preguntas anteriores de la lista ("no contiene información sobre los neutrinos, la biología canina o la gran oxidación... mencionada en tus preguntas anteriores"). Es el riesgo previsto.
  - T8 tiburones: compuerta → compuerta (igual).
  - T9 premio Dirac: contestaba "tiburones" → "Soy Tempest. El documento menciona que recibiste 3 de los fragmentos sobre el premio Dirac... no contiene información específica sobre el premio Dirac." Ya no habla de tiburones, pero no responde.
  - T10 fósforo: copiaba T1 → menciona el fósforo como elemento limitante. Mejora.
- **Datos técnicos (consola):** T1 modo explain, T2 a T10 modo general; alias `doc-read` (`qwen2.5-3b-q5`); fragmentos idénticos a la prueba anterior (3, 3, 4, 2, 3, 4, 4, —, 3, 3); `promptTokens` estimado entre 1215 y 1933 (antes entre 1541 y 2536). Log no leído.
- **Conclusión y siguiente paso:** la copia de respuestas desapareció (T2, T9 y T10 ya no copian), pero la línea de preguntas anteriores rompe al 3B: de 8 turnos con esa línea, solo T10 responde bien y T4 parcial; aparece "Soy Tempest." y repite o reformula la pregunta. T1 y T10, que no tienen o no dependen de esa línea, salen bien. La línea es la causa probable (T1 sin ella responde bien); sin probar por separado. Propuesta: quitar la línea y dejar solo el historial apagado en turnos con documentos (opción D), más corregir "fue" (pendiente 13) para que los seguimientos reutilicen los fragmentos anteriores.

### 25/11/2026 · laptop (NEXUS) · Chat largo: 10 preguntas sobre el podcast en un solo chat (falló: contaminación por historial y un seguimiento roto)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, `npm start` reiniciado; con el cambio de vecinos ya aplicado.
- **Documento:** el podcast de 165,041 caracteres, adjunto solo en el primer mensaje, chat `chat-1795656068150`.
- **Consultas y resultado por turno:**
  - T1 "¿Qué dice el documento sobre el fósforo?" (con adjunto): "Error interno del servidor" (`InsufficientMemoryError` con 8192 y con el reintento de 4096; pendiente 20, tercera vez). Reenvío: respuesta sobre Belcher, isótopos y oxígeno sin mencionar el fósforo; 3 fragmentos (4,009 car.). Falló.
  - T2 "¿Qué dice sobre las Islas Belcher?": copia palabra por palabra la respuesta de T1. 3 fragmentos (4,094 car.). Contaminación.
  - T3 supergravedad: respuesta sobre el tema (Witten, teorema de energía positiva, supersimetría), con una palabra en portugués ("não"). 4 fragmentos (5,045 car.). Pasó.
  - T4 neutrinos: habla de sabores y superposición, pero dice que el sabor puede ser "fermiónico o bosónico", que es una confusión. 2 fragmentos (2,705 car.). Parcial.
  - T5 biología canina: "El documento no contiene información específica sobre la biología canina"; aviso con "canina" ausente; 3 fragmentos. Pasó.
  - T6 gran oxidación: cianobacterias, estudio en PNAS ("PENAS"), glaciaciones; no da la fecha. 4 fragmentos (5,489 car.). Pasó con matices.
  - T7 "¿Y eso cuándo fue?": "El documento no contiene información específica sobre la gran oxidación". Falló. Reconstrucción con el retriever: la única palabra buscable es "fue" (no está en `STOPWORDS`), así que no se reutilizan los fragmentos del turno anterior y se mandan 4 fragmentos al azar que contienen "fue" (48, 104, 107, 126; 5,353 car., coincide con el aviso).
  - T8 tiburones: la compuerta respondió "No encontré 'tiburones'..." sin llamar al modelo (`cortocircuito: no_match`). Pasó.
  - T9 "¿Qué dice sobre el premio Dirac?": "El documento no contiene información específica sobre los tiburones". Contestó la pregunta anterior. Contaminación. Reconstrucción: recibió los fragmentos 59 a 61 (3,809 car.), el 60 con "Dirac" 4 veces.
  - T10 "¿Qué dice el documento sobre el fósforo?": repite casi igual la respuesta de T1 y T2 (Belcher, "205 millones de años"), sin mencionar el fósforo. 3 fragmentos (4,009 car.). Contaminación.
- **Cambio aplicado antes:** ninguno nuevo (el de vecinos ya estaba).
- **Datos técnicos (consola):** T1 en modo explain; T2 a T10 en modo general; alias `doc-read` (`qwen2.5-3b-q5`) en todos; ventana 8192; `promptTokens` estimado entre 1541 y 2536, creciendo con el historial. El número de mensajes de historial de cada turno está en el log (`historyMessagesIncluded`), no leído.
- **Conclusión y siguiente paso:** el historial SÍ contamina con el 3B en un chat largo: 3 de 9 turnos respondidos copian una respuesta anterior o contestan la pregunta anterior (T2, T9, T10), incluida la respuesta fija de la compuerta (T9). El pendiente 2 queda reabierto con esta evidencia. Hallazgo aparte: "fue" falta en `STOPWORDS` y rompe los seguimientos (va con el pendiente 13). Fósforo tras el cambio de vecinos: 2 de 3 en chats nuevos (T1 de este chat falló).

### 25/11/2026 · laptop (NEXUS) · Fósforo repetido con adjunto en el mismo mensaje, DESPUÉS del cambio de vecinos (pasó)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, mismo `npm start` de las pruebas anteriores.
- **Documento:** el podcast de 165,041 caracteres, adjunto en el mensaje, chat nuevo `chat-1795655585743`.
- **Consulta:** "¿Qué dice el documento sobre el fósforo?"
- **Cambio aplicado antes:** `pickFragments` sin vecinos con 2 o más fragmentos coincidentes (`chat-docs.retriever.js:219-223`).
- **Resultado:** pasó. La respuesta menciona el fósforo: "Se especula sobre el papel del fósforo como elemento limitante para estos sistemas biológicos y cómo su escasez podría haber contribuido al colapso", además de rocas de las Islas Belcher en el subártico de Canadá y una caída de la producción de oxígeno. En el texto aparecen "limitante" (1 vez) y "colapso" (5); "escasez" no aparece literal (es palabra del modelo). La cifra "colapso durante unos 50 millones de años hace unos 2 mil millones" no se pudo confirmar: "50 millones" aparece como subcadena 7 veces, algunas dentro de "2.050 millones" o "250 millones"; no se verificó cada frase.
- **Datos técnicos (consola):** modo explain, alias `doc-read` (`qwen2.5-3b-q5`), ventana 8192, `presupuesto=5555tok usados=1 omitidos=0`, `promptTokens` estimado 1541, sin cambio de modelo. Aviso: 3 de 131 fragmentos (4,009 de 165,041 caracteres).
- **Conclusión y siguiente paso:** con la regla de vecinos, el fósforo en la condición original da 2 respuestas que mencionan el fósforo de 2 pruebas (antes: 0 de 4). Muestra pequeña y el 3B es variable. Laptop cumple lo esperado del cambio; falta probarlo en desktop con el 8B (y comprobar que no empeora).

### 25/11/2026 · laptop (NEXUS) · Biología canina con adjunto en el mismo mensaje, DESPUÉS del cambio de vecinos (pasó)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, mismo `npm start` de las pruebas anteriores.
- **Documento:** el podcast de 165,041 caracteres, adjunto en el mensaje, chat nuevo `chat-1795655428155`.
- **Consulta (la misma del antes):** "que dice sobre la biología canina?" ("biología" aparece 3 veces en el texto; "canina" 0).
- **Cambio aplicado antes:** `pickFragments` sin vecinos con 2 o más fragmentos coincidentes (`chat-docs.retriever.js:219-223`).
- **Resultado:** pasó. La respuesta dice: "La biología canina no está mencionada en los documentos proporcionados. Sin embargo, se discute la fotosíntesis y su evolución... la Gran Oxidación... hace aproximadamente 2 mil 400 millones de años." Antes (dos intentos, 25/11) el modelo respondía con una definición general inventada de la biología canina. El texto menciona 2.400 millones de años en el tramo de la fotosíntesis; no se verificó cada frase.
- **Datos técnicos (consola):** modo explain, alias `doc-read` (`qwen2.5-3b-q5`), ventana 8192, `presupuesto=5558tok usados=1 omitidos=0`, `promptTokens` estimado 1540 (antes 2841), sin cambio de modelo. Aviso: 3 de 131 fragmentos (3,882 de 165,041 caracteres; antes 7 fragmentos y 9,135 caracteres) y "Palabras de tu pregunta que no aparecen en el documento: "canina"."
- **Conclusión y siguiente paso:** con la misma consulta que fallaba 2 de 2, ahora el modelo dice que el tema no está en el documento: 1 de 1 (una sola prueba; el 3B es variable). Falta repetir el fósforo y, si se quiere confianza, repetir canina. Sin probar en desktop.

### 25/11/2026 · laptop (NEXUS) · Islas Belcher con adjunto en el mismo mensaje, DESPUÉS del cambio de vecinos (pasó, sin cambio de fragmentos)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, mismo `npm start` de la prueba anterior (el cambio ya estaba cargado).
- **Documento:** el podcast de 165,041 caracteres, adjunto en el mensaje, chat nuevo `chat-1795655347635`.
- **Consulta:** "¿Qué dice sobre las Islas Belcher?"
- **Cambio aplicado antes:** `pickFragments` sin vecinos con 2 o más fragmentos coincidentes (`chat-docs.retriever.js:219-223`).
- **Resultado:** pasó. La respuesta habla de rocas en el subártico canadiense, la forma de circuito de carreras, el paleoproterozoico, rocas con sulfatos y azufre, y que los productores de oxígeno sueltan sobre todo el isótopo ligero (oxígeno 16). En el texto aparecen "circuito de carreras" (1), "oxígeno 16" (6), "sulfato" (5), "isótopo" (8), "canadiense" (2) y "azufre" (10). Hay una errata ("variedades más ligas") y "rodeadas por agua" es trivial; no se verificó cada frase.
- **Datos técnicos (consola):** modo explain, alias `doc-read` (`qwen2.5-3b-q5`), ventana 8192, `presupuesto=5557tok usados=1 omitidos=0`, `promptTokens` estimado 1548, sin cambio de modelo (el q5 ya estaba cargado). Aviso: 3 de 131 fragmentos (4,094 caracteres), igual que antes del cambio: con un solo fragmento coincidente se conservan sus vecinos.
- **Conclusión y siguiente paso:** el cambio no altera la consulta de una sola coincidencia y la respuesta sigue bien. Siguiente: biología canina y repetir el fósforo. Sin probar en desktop.

### 25/11/2026 · laptop (NEXUS) · Fósforo con adjunto en el mismo mensaje, DESPUÉS del cambio de vecinos (pasó)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, `npm start` reiniciado con `ollama ps` vacío.
- **Documento:** el podcast de 165,041 caracteres, adjunto en el mensaje, chat nuevo `chat-1795655228608`.
- **Consulta (la misma de las cuatro anteriores):** "¿Qué dice el documento sobre el fósforo?"
- **Cambio aplicado antes:** `pickFragments` ya no agrega fragmentos vecinos cuando hay dos o más fragmentos que coinciden (`chat-docs.retriever.js:219-223`).
- **Resultado:** pasó. La respuesta menciona el fósforo: dice que se analizaron rocas de las Islas Belcher en el subártico canadiense, en la era paleoproterozoica, con énfasis en el fósforo como nutriente limitante y elemento clave de los ecosistemas marinos. En el texto original aparecen "limitante" (1 vez, línea 2081), "nutriente" (6), "paleoproterozoic" (1), "subártic" (2) y "fósforo" (9); la frase de los "isótopos relevantes para sustancias biológicamente importantes" es vaga y no se verificó. La primera consulta no dio error de memoria.
- **Datos técnicos (consola):** modo explain ("adjunto + verbo de lectura"), alias `doc-read` (`qwen2.5-3b-q5`), ventana 8192, `presupuesto=5555tok usados=1 omitidos=0`, `promptTokens` estimado 1541 (antes 2566). Aviso: 3 de 131 fragmentos (4,009 de 165,041 caracteres), los fragmentos 106, 108 y 109 que reconstruyó el script. El cambio q4 a q5 funcionó sin `MEMORY RETRY`.
- **Conclusión y siguiente paso:** con la misma consulta y las mismas condiciones, pasa de 0 de 4 respuestas útiles a 1 de 1; es una sola prueba y el 3B es variable, así que falta repetirla. El prompt baja de 2566 a 1541 tokens estimados. Siguiente paso: Belcher y biología canina en chats nuevos, y repetir el fósforo una vez más. Sin probar en desktop.

### 25/11/2026 · laptop (NEXUS) · Aviso "no era el que pedías", DESPUÉS del cambio de texto (pasó)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado en esta sesión, versión de desarrollo, ventana recargada (Ctrl+R) tras editar `frontend/ui.js:206`.
- **Documentos:** el podcast y el texto de relatividad, ambos activos (2/10), chat "Documento Guardar".
- **Consulta:** "¿Por Qué el Tiempo No Transcurre Igual para Todos." (la misma del antes), esta vez SIN adjuntar de nuevo el archivo de relatividad.
- **Cambio aplicado antes:** `not_selected` en `frontend/ui.js:206`: de "no era el que pedías en este mensaje" a "en este mensaje se usó otro documento; para usar este, quita los demás en la barra de documentos".
- **Resultado:** pasó. Bajo la respuesta, el aviso dice "premiosdiracbreakthroughsupergr-coffeebreaksenalruido.txt: no se envió al modelo (en este mensaje se usó otro documento; para usar este, quita los demás en la barra de documentos)." La respuesta usó el texto de relatividad.
- **Datos técnicos:** texto copiado del chat, sin consola. Diferencia con el antes: aquel turno llevaba el archivo adjunto (regla 1 del selector) y este no (regla 3, repite los documentos del turno anterior); en los dos casos el motivo es `not_selected` y sale el mismo texto. En la copia, el aviso del turno del "antes" ya no aparece porque los avisos solo se dibujan en vivo, no al recargar el historial.
- **Conclusión y siguiente paso:** el texto nuevo se ve en la app. La captura exacta con adjunto no se repitió; si se quiere el par idéntico, volver a adjuntar relatividad. Pendiente 18 cerrado en laptop; sin probar en desktop (el cambio es solo de texto y vale para los dos perfiles). Observación del modelo: la respuesta dice que Einstein propuso la "relatividad general" en 1905 (el texto habla de 1905 para la especial y 1915 para la general): confusión del 3B, no cambia código.

### 25/11/2026 · laptop (NEXUS) · Aviso "no era el que pedías", captura del ANTES para el cambio de texto del pendiente 18

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado en esta sesión, versión de desarrollo.
- **Documentos:** el podcast (guardado en el primer mensaje) y el texto de relatividad (adjunto en este mensaje), chat "Documento Guardar".
- **Consulta usada para el par antes/después:** "¿Por Qué el Tiempo No Transcurre Igual para Todos." con el archivo de relatividad adjunto (el título del documento, sin signo de cierre).
- **Cambio aplicado antes:** ninguno.
- **Resultado (antes):** el aviso bajo la respuesta dice: "premiosdiracbreakthroughsupergr-coffeebreaksenalruido.txt: no se envió al modelo (no era el que pedías en este mensaje)." y debajo: "\"Relatividad ... .txt\" quedó guardado en este chat". La barra muestra 2/10. La respuesta fue sobre el texto de relatividad (velocidad de la luz, relojes, GPS, gemelas), correcta en lo general.
- **Datos técnicos:** captura de pantalla, sin consola; motivo `not_selected` (`frontend/ui.js:206`).
- **Conclusión y siguiente paso:** captura del "antes" disponible. Siguiente paso: cambiar el texto de `not_selected` en `frontend/ui.js:206`, recargar la ventana y repetir la misma consulta adjuntando de nuevo el archivo de relatividad en este chat para la captura del "después".

### 25/11/2026 · laptop (NEXUS) · Guardar un documento con un mensaje corto, preparando la captura del antes (pasó con una respuesta inesperada)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado en esta sesión, versión de desarrollo.
- **Documento:** el podcast de 165,041 caracteres, adjunto en el primer mensaje de un chat nuevo ("Documento Guardar").
- **Consulta:** "guarda este documento".
- **Cambio aplicado antes:** ninguno.
- **Resultado:** el documento quedó guardado y activo (1/10, aviso "quedó guardado en este chat"), pero la respuesta fue: "No encontré 'guarda' en el documento ... Busco por las palabras del texto: si el documento usa otra palabra para eso, pregunta con esa. Si tu pregunta no es sobre el documento, quítalo de la lista de documentos del chat." Es la compuerta sin coincidencia, sin llamar al modelo.
- **Datos técnicos:** causa por lectura de código, sin consola de este turno: "documento" está en `DOC_QUESTION_RE` (`chat-docs.retriever.js:40`), por eso `looksLikeDocQuestion` da verdadero sin signos de pregunta; "guarda" no aparece en el texto largo y `checkNoMatchGate` (`chat-docs.service.js:194-212`) responde con el aviso. `isSmallTalk` no aplica porque el mensaje trae adjunto.
- **Conclusión y siguiente paso:** funciona como está diseñado, pero un mensaje de guardado que nombre el documento recibe un aviso de "no encontré". Queda como pendiente 21, menor. Siguiente paso de la preparación: en este mismo chat adjuntar el texto de relatividad con la pregunta sobre los dos documentos.

### 25/11/2026 · laptop (NEXUS) · Simulación con script: menos fragmentos vecinos de relleno (sin cambio en el código)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (NEXUS), script fuera del repositorio que usa `chat-docs.retriever.js` sin modificarlo; no se abrió la app.
- **Documento:** el podcast de 165,041 caracteres (131 fragmentos).
- **Consultas:** fósforo, Islas Belcher, biología canina, "¿Qué es la gran oxidación?" y "¿Qué dice sobre las cianobacterias y el oxígeno?", con presupuesto de 8,200 caracteres.
- **Cambio aplicado antes:** ninguno. Regla simulada: si 2 o más fragmentos coinciden con la pregunta, no agregar vecinos; con 1 solo, agregarlos como hoy.
- **Resultado:** la regla hace lo esperado. Fósforo: de 6 fragmentos (8,158 car.; coincidencias 0, 1, 0, 6, 2, 0) a 3 (4,009 car.; 1, 6, 2). Belcher: sin cambio, 3 fragmentos (un solo fragmento coincide, se conservan sus vecinos). Biología canina: de 6 a 3 (3,882 car.). Gran oxidación: de 6 a 4 (5,489 car.). Cianobacterias y oxígeno: de 6 a 4 (5,431 car.), pero se pierde el vecino 106, que trae "oxígeno" 6 veces y no entraba en el ranking.
- **Datos técnicos:** `MIN_SCORE_RATIO = 0.4`, `MAX_RANKED = 4`, `TARGET_CHUNK_CHARS = 1400` (`chat-docs.retriever.js:13-16`).
- **Conclusión y siguiente paso:** la regla quita los fragmentos de relleno sin coincidencias en las consultas de una palabra; en consultas de dos palabras puede dejar fuera un vecino útil. Falta el permiso del usuario para aplicarla y probarla en la app (fósforo con adjunto, Belcher y biología canina) y después en desktop.

### 25/11/2026 · laptop (NEXUS) · Fósforo en el mismo chat con el documento ya guardado, modo general (falló igual; la hipótesis del modo queda descartada)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, mismo chat `chat-1795652502083` de la entrada anterior.
- **Documento:** el podcast de 165,041 caracteres, ya guardado en el chat (sin adjuntar de nuevo).
- **Consulta:** "¿Qué dice el documento sobre el fósforo?" (la misma).
- **Cambio aplicado antes:** ninguno.
- **Resultado:** falló igual. La respuesta vuelve a hablar de rocas de las Islas Belcher, cambios isotópicos en azufre y oxígeno en sulfatos y el desplome de la producción de oxígeno, sin mencionar el fósforo.
- **Datos técnicos (consola):** modo general ("default"), alias `doc-read` (`qwen2.5-3b-q5`), ventana 8192, `presupuesto=5435tok usados=1 omitidos=0`, `promptTokens` estimado 2660 (en explain fueron 2566); aviso: 6 de 131 fragmentos (8,158 caracteres), idéntico a los intentos con adjunto.
- **Reconstrucción con el retriever en un script aparte (no cambia código):** con la consulta, el ranking da 108 (puntuación 6.61), 109 (4.97) y 106 (3.49); `pickFragments` completa el presupuesto con los vecinos 105, 107 y 110 y envía los fragmentos 105 a 110 (1382, 1299, 1383, 1339, 1371 y 1384 caracteres, total 8,158, coincide con el log). El fósforo aparece 0, 1, 0, 6, 2 y 0 veces en esos fragmentos: el 108 lo trae 6 veces y el modelo lo recibió. En la consulta de las Islas Belcher solo se enviaron 3 fragmentos (4,094 caracteres) y se respondió bien.
- **Conclusión y siguiente paso:** la búsqueda es correcta; el fallo es de lectura del modelo de 3B, que ante 6 fragmentos (3 de ellos sin la palabra) contesta con lo más llamativo del texto. Con la misma pregunta falla igual en modo explain (con adjunto) y en modo general (documento guardado), así que el modo no es la causa para el fósforo. Resumen en la condición probada: 0 de 4 respuestas útiles en esta consulta con 6 fragmentos (T1, intento 2, intento 3 y este), salvo una vez en otro chat de hace horas con el documento guardado, cuyo conteo de fragmentos no se anotó. Opciones (sin aplicar): enviar menos fragmentos de relleno (vecinos) cuando ya hay varios con coincidencia, o probar el mismo documento con el 8B en desktop.

### 25/11/2026 · laptop (NEXUS) · Fósforo, tercer intento en la condición original, tras reiniciar y cerrar el navegador (primera consulta sin error; respuesta sin mencionar el fósforo)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, `npm start` reiniciado; el usuario cerró el navegador y otros programas antes para liberar VRAM.
- **Documento:** el podcast de 165,041 caracteres, adjunto en el mensaje, chat nuevo `chat-1795652502083`.
- **Consulta:** "¿Qué dice el documento sobre el fósforo?" (la misma del T1).
- **Cambio aplicado antes:** ninguno (se cerraron programas del usuario).
- **Resultado:** la primera consulta respondió sin error de memoria. La respuesta no dice "no hay información", pero tampoco menciona el fósforo: habla del descenso de oxígeno hace unos 2.050 millones de años, las rocas de las Islas Belcher en Canadá, cambios isotópicos en azufre y oxígeno en sulfatos y un desplome de la producción biológica de oxígeno. No contesta lo que se preguntó. "Sulfato" y "azufre" aparecen 10 veces en el texto, así que esos datos no parecen inventados; no se verificó cada afirmación.
- **Datos técnicos (consola):** modo explain ("adjunto + verbo de lectura"), alias `doc-read` (`qwen2.5-3b-q5`), ventana 8192, `presupuesto=5555tok usados=1 omitidos=0`, `promptTokens` estimado 2566; aviso: 6 de 131 fragmentos (8,158 caracteres), los mismos del T1 y del intento anterior. El cambio q4 a q5 funcionó sin `MEMORY RETRY`. Tras la prueba: `ollama ps` vacío y GPU en 4,965 MiB con q5 cargado (en el fallo anterior fueron 4,959 MiB: cerrar el navegador no cambió visiblemente el uso en reposo).
- **Conclusión y siguiente paso:** (a) condición original (adjunto en el mismo mensaje, modo explain, mismos 6 fragmentos): 0 de 3 respuestas útiles (falso negativo ×2 y respuesta sin fósforo). Con el documento guardado (modo general) la misma pregunta salió bien. (b) El error de memoria no se repitió esta vez; la diferencia más clara con el intento fallido es que no había pasado poco tiempo desde un uso de `llava` (se queda residente 5 minutos). Es una hipótesis, no está probada: el uso en reposo de VRAM no cambió al cerrar el navegador. Siguiente paso: repetir la pregunta en este mismo chat, sin adjuntar, ya con el documento guardado (modo general).

### 25/11/2026 · laptop (NEXUS) · Fósforo con el documento adjunto en el mismo mensaje, chat nuevo (falló dos veces de forma distinta)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo, `npm start` reiniciado poco antes; minutos antes se habían hecho las pruebas de imagen con `llava`.
- **Documento:** el podcast de 165,041 caracteres, adjunto en el mensaje, chat nuevo `chat-1795652162329` ("Fósforo Documento").
- **Consulta:** "¿Qué dice el documento sobre el fósforo?" (la misma del T1 del 24/11), enviada dos veces: la segunda es un reenvío del usuario tras el error.
- **Cambio aplicado antes:** ninguno.
- **Resultado:** intento 1 falló con "Error interno del servidor"; intento 2 respondió, pero con el falso negativo del T1: "El documento no contiene información específica sobre el fósforo... No hay menciones directas ni fragmentos específicos sobre el fósforo en este texto". El documento sí habla del fósforo (8 coincidencias en el texto).
- **Datos técnicos (consola):** intento 1: modo explain, alias `doc-read` (`qwen2.5-3b-q5`); el cambio q4 a q5 terminó ("Modelo listo") pero la creación del contexto falló: `[MEMORY RETRY] InsufficientMemoryError ... contextSize base=8192 — reintentando con contextSize=4096` y luego `InsufficientMemoryError: A context size of 4096 is too large for the available VRAM` (`llama.provider.js:175`, `localai.service.js:502`, `chat.controller.js:1111`). Intento 2: modo explain, ventana 8192, `presupuesto=5543tok usados=1 omitidos=0`, `promptTokens` estimado 2576, 6 de 131 fragmentos (8,158 caracteres), el mismo conteo que el T1 del 24/11. El aviso dice que el documento "ya estaba guardado en este chat" (el intento fallido ya lo había guardado). Tras la prueba: `ollama ps` vacío y GPU en 4,959 de 6,141 MiB.
- **Conclusión y siguiente paso:** (a) falso negativo del fósforo reproducido en la condición original (adjunto en el mismo mensaje, modo explain, mismos 6 fragmentos): 2 de 2 incluyendo el T1; con el documento ya guardado (modo general) la misma pregunta salió bien. (b) El error del primer intento es un fallo de memoria al crear el contexto del modelo q5 en la 4050, el mismo patrón que el de la visión (primera operación pesada falla, la segunda funciona); el reintento con 4096 no bastó. Posible causa, sin probar: `llava` seguía residente en Ollama (se queda 5 minutos tras su último uso). Pendiente 20 en avance. Siguiente paso: repetir en otro chat nuevo con `ollama ps` vacío, y después separar el efecto del modo con el documento guardado primero y la pregunta en el segundo mensaje.

### 25/11/2026 · laptop (NEXUS) · Imagen en chat nuevo sin documentos, tras reiniciar (falló el primer intento, pasó el segundo)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050, 6,141 MiB), hostname NEXUS confirmado, versión de desarrollo, `npm start` recién reiniciado.
- **Documento:** ninguno. Chat nuevo `chat-1795651277497`. Imagen: la misma captura de pantalla de la prueba anterior (con OCR en caché).
- **Consulta:** "¿Qué ves en esta imagen?", con la imagen adjunta, dos veces seguidas (la segunda es un reenvío del usuario).
- **Cambio aplicado antes:** ninguno.
- **Resultado:** intento 1 falló; intento 2 pasó. Intento 1: la visión con `llava-1.6` abortó ("This operation was aborted"), el router subió el alias a `general-standard` (`qwen2.5-3b-q5`) por "contexto pesado" y el cambio de modelo q4 a q5 falló con `InsufficientMemoryError: Not enough VRAM`; la recuperación del q4 también falló ("No se pudo recuperar el modelo anterior tampoco"); la pantalla mostró "Error interno del servidor". Intento 2: la visión funcionó (llava ya cargado en Ollama), alias `visual` con `llava-1.6`, y la respuesta describió la escena de videojuego (menú con "Habla", objetos, entorno natural) con errores de redacción ("fondó", "of") y detalles dudosos ("primer jugador", "opción A").
- **Datos técnicos (consola y estado):** durante el intento 1, `ollama ps` mostró `llava-1.6:latest` 5.0 GB, 100 % GPU, contexto 4096, con la tarjeta en 5,895 de 6,141 MiB y 100 % de uso. El tiempo de espera de visión es 180 s (`vision.service.js:356`). La visión no cambia desde el commit `85e6171` (v3.0.0); el upgrade de alias es del commit `e9e1893` (router) y la recuperación de modelo de v3.0.0.
- **Conclusión y siguiente paso:** el fallo ocurre sin documentos, así que no lo causan los documentos del chat. Patrón: el primer análisis con `llava` en frío supera los 180 s y, al caer al camino de texto, el cambio de modelo no cabe porque `llava` sigue ocupando la VRAM en Ollama; el segundo intento funciona con `llava` ya cargado. Causa de la lentitud sin probar (hipótesis: VRAM sobrecargada con el modelo de chat residente y Steam y Epic usando la GPU). El usuario dice que antes funcionaba sin problema; falta saber en qué condiciones. Pendiente 19 en avance.

### 25/11/2026 · laptop (NEXUS) · Turno sin imagen justo después del turno con imagen (pasó)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo.
- **Documento:** el podcast largo activo (relatividad quitado), chat `chat-1795648993510`; el turno anterior llevó una imagen.
- **Consulta:** "¿Qué dice sobre las Islas Belcher?", sin adjuntar nada.
- **Cambio aplicado antes:** ninguno.
- **Resultado:** pasó. El documento volvió a usarse y la respuesta salió del podcast (Canadá, subártico, isótopos, falta de nutrientes como el fósforo, 2.050 millones de años; mismos datos ya verificados en el texto en la prueba anterior). El chip siguió en 1/10.
- **Datos técnicos (consola):** modo general ("default"), alias `doc-read` (`qwen2.5-3b-q5`), ventana 8192, `presupuesto=5285tok usados=1 omitidos=0`, `promptTokens` estimado 2101.
- **Conclusión y siguiente paso:** con la entrada anterior, "mensaje con imagen en un chat con documento" queda pasada en laptop en lo que toca a los documentos: la imagen no los usa ni los quita y el siguiente turno los recupera. El fallo de visión (`llava` abortó) queda aparte.

### 25/11/2026 · laptop (NEXUS) · Mensaje con imagen en un chat con documento activo (parcial: documento intacto, visión falló)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo.
- **Documento:** el podcast largo activo (relatividad quitado), chat `chat-1795648993510`.
- **Imagen:** una captura de pantalla de la carpeta del usuario (nombre "Captura de pantalla 2026-05-23 210951.png"); el OCR leyó 1170 palabras, así que es una imagen con mucho texto.
- **Consulta:** "¿Qué ves en esta imagen?", con la imagen adjunta.
- **Cambio aplicado antes:** ninguno.
- **Resultado:** parcial. Pasó: el turno no usó el documento (sin línea `[CHAT DOCS]`, `promptTokens` estimado 1025), el chip del podcast siguió en 1/10 y apareció el aviso "Los archivos adjuntos valen solo para este mensaje". Falló: el análisis de visión; la respuesta fue "no puedo ver o analizar imágenes adjuntas".
- **Datos técnicos (consola):** modo visual ("adjunto de imagen sin código"), OCR con caché (confianza 33 %, categoría "visual"), `Vision fallback falló: This operation was aborted` al analizar con `llava-1.6:latest`; luego `attachmentContext` de 794 caracteres, alias `general-standard`, `qwen2.5-3b-q5`. Causa del aborto sin investigar (podría ser tiempo de espera de Ollama con el modelo de chat en VRAM; no se probó).
- **Conclusión y siguiente paso:** sin probar el turno siguiente sin imagen (debe volver a usar el podcast). El fallo de visión es del módulo de imágenes, no de los documentos del chat; para separarlo, repetir la imagen en un chat sin documentos.

### 25/11/2026 · laptop (NEXUS) · Un solo documento activo a la vez, con los dos guardados (pasó; una frase inventada)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo.
- **Documentos:** el podcast largo y el texto corto de relatividad, ambos en `chat-1795648993510`; en cada turno se dejó activo solo uno (el otro quitado).
- **Consultas:** (1) con solo relatividad activo: "¿Cuánto tiempo pasa para la gemela viajera?"; (2) con solo el podcast activo: "¿Qué dice sobre las Islas Belcher?". Sin adjuntar nada en ninguna.
- **Cambio aplicado antes:** ninguno.
- **Resultado:** pasó, con una salvedad. (1) Dio la cifra correcta: unos 5 años para ella y unos 10 en la Tierra; añadió "los relojes en la Tierra avanzan más rápido debido a la gravedad débil cerca del sol", que el texto no dice (0 coincidencias de "el sol"). (2) Respondió desde el podcast: rocas en las Islas Belcher, subártico de Canadá, isótopos, falta de nutrientes como el fósforo, oxígeno que cae hace 2.050 millones de años. Verificado en el texto: Canadá, subártico, isótopo, nutriente y la cifra de 2.050 aparecen. El error de "Antártida" no volvió.
- **Datos técnicos (consola):** ambos turnos en modo general ("default"), alias `doc-read` (`qwen2.5-3b-q5`), ventana 8192, `usados=1 omitidos=0`. (1) `promptTokens` estimado 3497, documento completo. (2) `promptTokens` estimado 1945; aviso "3 de 131 fragmentos (4,094 de 165,041 caracteres)".
- **Conclusión y siguiente paso:** con un único documento activo el selector lo elige bien (confirmado en la práctica la salida del pendiente 18). Las respuestas buenas de esta sesión han salido en modo general y las malas en explain (biología canina ×2, Belcher en el turno con adjunto); es un patrón, no una causa probada. Queda mensaje con imagen con documento activo.

### 25/11/2026 · laptop (NEXUS) · Quitar y reactivar cada uno de los dos documentos, solo la barra (parcial)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo.
- **Documentos:** el podcast largo y el texto corto de relatividad, ambos en `chat-1795648993510`.
- **Consulta:** ninguna; solo se pulsaron las X y las flechas de reactivar.
- **Cambio aplicado antes:** ninguno.
- **Resultado:** parcial. Pasó: la barra mostró 1/10 con el podcast activo, 0/10 con los dos quitados y 1/10 con solo relatividad activo; cada chip se tacha y se reactiva por separado. Sin probar: el efecto en la respuesta de cada combinación.
- **Datos técnicos:** solo capturas, sin consola.
- **Conclusión y siguiente paso:** dejar un solo documento activo es la salida para el pendiente 18 (con uno solo, la regla 5 lo elige). Probarlo: con relatividad activo, preguntar por la gemela; con el podcast activo, preguntar por las Islas Belcher.

### 25/11/2026 · laptop (NEXUS) · Dos documentos en un chat, una pregunta sobre los dos (falló: un documento omitido)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo.
- **Documentos:** el podcast de 165,041 caracteres (ya activo en el chat) y un texto corto de divulgación sobre relatividad (unas 300 líneas), adjuntado con este mensaje. Chat `chat-1795648993510`, barra en 2/10.
- **Consulta:** "Del documento del podcast, ¿qué dice sobre las Islas Belcher? Y del documento de la relatividad, ¿cuánto tiempo pasa para la gemela viajera?"
- **Cambio aplicado antes:** ninguno.
- **Resultado:** falló. El podcast quedó omitido; el aviso dice "no se envió al modelo (no era el que pedías en este mensaje)". La respuesta solo usó el texto de relatividad y no contestó lo de las Islas Belcher. Sobre la gemela dijo que el viajero regresa más joven (con el 87 % de la velocidad de la luz) pero no dio la cifra (unos 5 años frente a unos 10); mezcló además el GPS.
- **Datos técnicos (consola):** modo explain ("adjunto + verbo de lectura"), alias `doc-read` (`qwen2.5-3b-q5`), ventana 8192, `presupuesto=5309tok usados=1 omitidos=1`, `promptTokens` estimado 3499.
- **Causa (leída en el código, no probada con un cambio):** `selectDocuments` (`chat-docs.selector.js:103-109`), regla 1: si hay un documento adjuntado en este mensaje, solo entra ese más el que se nombre por su nombre de archivo (`findNamedDocument`, coincidencia de texto exacta, `:31-48`). "Documento del podcast" no es el nombre del archivo, así que el podcast sale como `not_selected`. Además, `packToBudget` mide por `doc.chars` completos (165,041), no por el tamaño en fragmentos: aunque se nombrara, es probable que saliera como `budget_exceeded` (sin comprobar el valor de `provisionalBudgetChars`).
- **Conclusión y siguiente paso:** en un turno con adjunto nuevo, un documento largo (por fragmentos) y otro no caben juntos con las reglas actuales, y el aviso "no era el que pedías" es engañoso cuando sí lo pedías. En los turnos siguientes, la regla 3 repite los documentos del turno anterior (relatividad), así que para volver al podcast hay que nombrarlo por su nombre de archivo exacto. Queda como pendiente 18; las alternativas se discuten con el usuario antes de tocar código.

### 25/11/2026 · laptop (NEXUS) · Quitar y reactivar un documento, efecto en la respuesta (pasó; fidelidad del modelo parcial)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo.
- **Documento:** el podcast de 165,041 caracteres, guardado en el chat `chat-1795648993510` ("Biología Canina 2"), sin volver a adjuntarlo.
- **Consulta:** "¿Qué dice el documento sobre el fósforo?", enviada dos veces: con el chip quitado (0/10) y tras reactivarlo (1/10).
- **Cambio aplicado antes:** ninguno.
- **Resultado:** pasó. Con el chip quitado, respuesta: "No tengo ningún documento activo en este chat. Adjunta el archivo otra vez para que pueda leerlo." Tras reactivar, el contador volvió a 1/10 y la respuesta usó el documento (fósforo, rocas, Islas Belcher).
- **Datos técnicos (consola):** con el chip quitado, `[CHAT DOCS] cortocircuito: no_documents`, sin llamada al modelo. Tras reactivar, modo general ("default"), alias `doc-read` (`qwen2.5-3b-q5`), ventana 8192, `usados=1 omitidos=0`, `promptTokens` estimado 2633, `estimado=3000tok`. Sigue saliendo `[CONFIG] hardwareProfile: 'desktop'` con perfil activo laptop (pendiente 10).
- **Fidelidad:** la respuesta con el documento activo dice "Islas Belcher (Antártida)". El texto menciona las Islas Belcher una vez y, en ese tramo, un hablante corrige "Antártida" por Canadá. Es el caso conocido de 3B que toma un desliz de la transcripción como dato. El resto (fósforo, rocas del Paleoproterozoico, colapso de ecosistemas) aparece en el texto; no se verificó cada afirmación.
- **Conclusión y siguiente paso:** quitar y reactivar funciona de punta a punta, y un documento quitado se corta en backend sin tocar el modelo. No se cambia código por el error de "Antártida". Corrección posterior: esta consulta no cuenta para el pendiente 10, porque el documento ya estaba guardado (modo general); el T1 original fue con el documento adjunto en el mismo mensaje en un chat nuevo (modo explain). Pendiente 10: 0 de 3 en la condición original.

### 25/11/2026 · laptop (NEXUS) · Quitar un documento del chat, solo la parte visual (parcial)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo.
- **Documento:** el podcast de 165,041 caracteres, ya guardado en el chat `chat-1795648993510` ("Biología Canina 2").
- **Consulta:** ninguna. Solo se pulsó la X del chip.
- **Cambio aplicado antes:** ninguno.
- **Resultado:** parcial. Pasó: al pulsar la X el chip queda tachado, el contador pasa de 1/10 a 0/10 y aparece el botón de reactivar. Sin probar: que la respuesta siguiente deje de usar el documento, y que reactivar lo devuelva (las capturas enviadas no muestran el chip reactivado).
- **Datos técnicos:** capturas de pantalla, sin log ni consola de este paso. En las capturas 1 y 2 el cuadro de texto muestra los caracteres "×¥¥_" que el usuario no mencionó; en la 3 ya no están. Sin explicar, sin reproducir.
- **Conclusión y siguiente paso:** con el chip quitado, hacer una pregunta que solo el documento responda y registrar respuesta y consola; después reactivar y repetirla.

### 25/11/2026 · laptop (NEXUS) · Biología canina repetida en otro chat nuevo (aviso pasó; respuesta del modelo falló otra vez)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), hostname NEXUS confirmado, versión de desarrollo.
- **Documento:** el podcast de 165,041 caracteres. Chat nuevo (`chat-1795648993510`, "Biología Canina 2"), adjunto con el primer mensaje.
- **Consulta:** "que dice sobre la biología canina?" (misma de la entrada anterior).
- **Cambio aplicado antes:** ninguno.
- **Resultado:** aviso pasó (7 de 131 fragmentos, palabra ausente "canina"); respuesta del modelo falló: contesta con conocimiento general ("la biología canina no se trata de un campo específico reconocido... estudios sobre el comportamiento o salud del perro") en vez de decir que el documento no lo trata.
- **Datos técnicos:** modo explain ("adjunto + verbo de lectura"), alias `doc-read` (`qwen2.5-3b-q5`), ventana 8192, `[CHAT DOCS] estimado=3000tok`, `promptTokens` estimado 2841, historial 0. Primer turno tras reiniciar: cambió de q4 a q5. Consola: `[CONFIG] hardwareProfile: 'desktop'` con `[server] Perfil de hardware activo: laptop` (pendiente 10, sigue sin explicar).
- **Conclusión y siguiente paso:** 2 de 2 fallos con adjunto en el mismo turno (modo explain, historial 0); el acierto previo fue modo general con el documento ya guardado. Hipótesis sin probar: el modo explain ("responde SOLO con texto explicativo") empuja a contestar en general. Prueba que la separa: repetir una pregunta sin volver a adjuntar, en este mismo chat.

### 25/11/2026 · laptop (NEXUS) · Palabras ausentes en el aviso, antes/después (aviso pasó; respuesta del modelo falló)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), versión de desarrollo, tras reiniciar `npm start`.
- **Documento:** el podcast de 165,041 caracteres. Chat nuevo (`chat-1795642257343`), adjunto con el primer mensaje.
- **Consulta (misma del "antes"):** "que dice sobre la biología canina?" ("biología" aparece 3 veces en el texto; "canina" 0).
- **Cambio aplicado antes:** `absentWords` en `chat-docs.service.js`, aviso en `frontend/ui.js` y campo en el trace de `chat.controller.js:880` (pendiente 1 del avance).
- **Resultado:** el aviso pasó; la respuesta del modelo falló.
- **Antes (25/11, prueba B, turno 6):** el aviso decía solo "7 de 131 fragmentos"; el modelo respondió que el documento no tiene información sobre el tema.
- **Después:** el aviso añade `Palabras de tu pregunta que no aparecen en el documento: "canina".` y el log trae `absentWords: ["canina"]`. Pero el modelo respondió con una definición general inventada de la biología canina (género Canis, perros y ancestros) en vez de decir que el documento no la trata.
- **Datos técnicos:** modo explain ("adjunto + verbo de lectura"), alias `doc-read` (`qwen2.5-3b-q5`), 7/131 fragmentos (9,135 car.), `tokensIn` 3125, `tokensOut` 94, 5.9 s, historial 0/0. En el antes (turno 6 de la prueba B) el modo fue general y la respuesta correcta; la diferencia puede ser el modo, el historial (10 mensajes allí, 0 aquí) o azar: no se probó cuál.
- **Nota del usuario:** se hizo en un chat nuevo porque había borrado chats antiguos para limpiar la lista. No forma parte de la prueba.
- **Conclusión y siguiente paso:** la función del aviso funciona. El modelo ignoró el encabezado que le dice qué palabras faltan y respondió con conocimiento general: es el caso ya registrado de un 3B que ignora instrucciones del encabezado (avance, "Problemas ya detectados"). No se cambia código por esto. Si se quisiera cerrarlo por código, la compuerta solo actúa cuando faltan TODAS las palabras; con una ausente de varias, la decisión sigue en el modelo. Queda como observación para v4.0.

### 25/11/2026 · laptop (NEXUS) · Cambiar de chat, segundo documento y chat nuevo sin documento (barra de documentos: fallo confirmado en pantalla)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), versión de desarrollo.
- **Documento:** el podcast de 165,041 caracteres (chat de Cabildo) y un segundo documento de texto de divulgación (chat "Documento"), adjunto en un chat distinto.
- **Consulta:** (a) en el chat del segundo documento, pregunta de qué habla; (b) cambiar entre el chat de Cabildo y el del segundo documento y volver; (c) "+ Nuevo Chat" sin documento, mirar la barra y enviar "que dice ese documento?".
- **Cambio aplicado antes:** ninguno.
- **Resultado:** parcial. Cambiar de chat y volver: pasó en pantalla (cada chat muestra su propio chip). Chat nuevo: falló en pantalla (la barra mostraba el documento del último chat visto); al enviar el primer mensaje el chip desapareció.
- **Datos técnicos:**
  - (a) La respuesta lista diez temas científicos. No se verificó contra el texto de ese segundo documento (no se leyó), y no se miró el log de ese turno.
  - (b) Capturas del usuario: al volver a cada chat, la barra "Documentos del chat (1/10)" muestra el chip correcto de ese chat. No se envió pregunta tras volver; falta ese dato del backend.
  - (c) Captura "antes": pantalla de bienvenida del chat nuevo con el chip del segundo documento visible y la pregunta escrita. Tras enviar, el chat creado respondió "No tengo ningún documento activo en este chat. Adjunta el archivo otra vez para que pueda leerlo" (cortocircuito correcto del backend). El defecto es solo de la interfaz: la barra no se oculta en la pantalla de bienvenida y engaña al usuario.
  - Código (ya leído): los manejadores de "+ Nuevo chat" (`frontend/app.js:187` y `frontend/modules/sidebar.js:485`) ponen `chatId: null` y llaman a `renderWelcomeScreen()` (`app.js:217`) sin llamar a `refreshChatDocuments()`, que con `chatId` vacío oculta la barra (`chatDocuments.js:90`).
- **Conclusión y siguiente paso:** pendiente 17 confirmado. Con captura del "antes" tomada, se aplicó `refreshChatDocuments();` al final de `renderWelcomeScreen` (`frontend/app.js:224`).
- **Después (25/11, laptop, mismo recorrido, ventana recargada):** pasó. El usuario confirma que en un chat nuevo ya no aparece el archivo adjunto y que solo se ve en el chat donde se adjuntó. Dato del usuario, sin captura archivada. Sin probar: borrar el chat actual, "Importar chat" y desktop.

### 25/11/2026 · laptop (NEXUS) · Small talk con documento activo en la app (pasó)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), versión de desarrollo.
- **Documento:** el mismo podcast de 165,041 caracteres. Chat nuevo (`chat-1795573240470`), adjunto en el turno 1 y activo todo el tiempo.
- **Consulta (en orden):** (1) pregunta por una institución local mencionada una vez al principio, con el adjunto; (2) "hola"; (3) "gracias"; (4) "hola, ¿de qué habla el documento?".
- **Cambio aplicado antes:** ninguno adicional.
- **Resultado:** pasó. Los mensajes que son solo saludo o cortesía no recibieron documentos; el mensaje que mezcla saludo y pregunta sí los usó.
- **Datos técnicos (log `requests-2026-11-25.jsonl`):**
  - T1: modo explain, `doc-read` (`qwen2.5-3b-q5`), 5/131 fragmentos (6,423 car.), `tokensIn` 2400, 5.2 s.
  - T2 "hola": `activeCount` 1 pero sin `used`, `tokensIn` null, `tokensOut` 9, 1 ms. Respondió el saludo fijo de `localai.service.js`, sin llamar al modelo. La respuesta usa un nombre de persona: sin saber si sale del perfil guardado o del respaldo fijo `'Rogelio'` del código (pendiente 16). No se leyeron los datos del usuario para comprobarlo.
  - T3 "gracias": sin `used`, consola `[CHAT DOCS] ... usados=0`, `tokensIn` 426, `tokensOut` 29, 0.9 s, historial 3/3, alias `general-standard`. La respuesta mencionó el Cabildo y el documento, que salen del historial del turno 1, no de documentos enviados.
  - T4: modo general, alias `large-context` (ventana 16384; consola: estimado 47155 tok contra presupuesto 4571 de la ventana normal), pregunta global: documento parcial, principio y final, 46,948 de 165,041 car. (28 %), `tokensIn` 13234, `tokensOut` 196, 37.0 s, historial 5/5. La interfaz avisó que no vio la parte del medio. La respuesta incluye nombres y términos distorsionados por la transcripción (p. ej. un nombre de premio y un apellido mal escritos); no se verificó el resto contra el texto.
  - `contextSize` figura 0 en el log aunque la consola dice 16384 en T4 (campo no actualizado en el log; sin investigar).
  - `[CONFIG]` sigue imprimiendo `hardwareProfile: 'desktop'` con el router en `laptop` (pendiente 10).
- **Conclusión y siguiente paso:** small talk funciona en la app en laptop. "hola" solo no llegó ni a `isSmallTalk`: lo atrapa antes el saludo fijo. Falta probar small talk en desktop, cambiar de chat y regresar, y las pruebas mecánicas.

### 25/11/2026 · laptop (NEXUS) · Prueba B, memoria entre turnos (pasó, 7 turnos; incluye compuerta y coincidencia parcial)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), versión de desarrollo.
- **Documento:** el mismo podcast de 165,041 caracteres. Chat nuevo (`chat-1795572138698`), adjunto solo en el turno 1; el chip siguió activo todo el tiempo.
- **Consulta (en orden, mismo chat):** (1) pregunta por la moraleja de un tema del documento; (2) pregunta por los tres investigadores de la extensión supersimétrica de la teoría de Einstein; (3) seguimiento sin palabras nuevas ("¿Y qué más dice de eso?"); (4) pregunta por una institución local mencionada solo una vez al principio (~4 %).
- **Cambio aplicado antes:** ninguno adicional (el arreglo de `rawQuestion` ya estaba).
- **Consulta, turnos 5 a 7 (el usuario añadió dos preguntas erradas a propósito):** (5) pregunta por un término técnico mencionado una sola vez al final (~89 %); (6) pregunta por un tema con una palabra presente en el texto y otra ausente (coincidencia parcial); (7) pregunta cuyas palabras con contenido no aparecen en el texto.
- **Resultado:** pasó. El documento siguió disponible sin volver a adjuntarlo durante los 7 turnos.
- **Datos técnicos (log `requests-2026-11-25.jsonl`):**
  - T1: modo general, 7/131 fragmentos (8,978 car.), `tokensIn` 2978, adjunto en este turno, historial 0/0.
  - T2: modo explain, 8/131 (9,886 car.), `tokensIn` 3465, historial 2/2. Mismo fallo de 1 apellido de 3 que en la prueba A (2 de 3 correctos).
  - T3 (seguimiento): modo general, mismos 8 fragmentos (la interfaz avisó "los mismos del mensaje anterior"), `tokensIn` 3472, historial 4/4.
  - T4: modo general, 5/131 (6,423 car.), `tokensIn` 2584, historial 6/6. El modelo respondió con el dato del principio del documento (el programa podrá grabarse con público en un museo, en dos semanas). Matiz: atribuyó al Cabildo el anuncio que el texto asigna a su Departamento de Prensa. Reconstrucción con el retriever (aproximada): el fragmento 4, el único con la palabra, entra entre los 5 elegidos.
  - T5: modo general, 3/131 (3,840 car.), `tokensIn` 1918, `tokensOut` 132, historial 8/8. La respuesta cita nombres, elementos y la idea de que el análisis es técnico; verificado contra el texto: los cinco apellidos, "azufre" y "bario" aparecen en el documento (1, 1, 1, 1, 1, 10 y 1 veces). Sin invención detectada.
  - T6 (coincidencia parcial): la palabra con contenido "biología" aparece 3 veces en el texto y "canina" 0. Modo general, 7/131 (9,135 car.), `tokensIn` 3515, `tokensOut` 13, historial 10/10. Respondió que el documento no tiene información sobre ese tema, correcto. El aviso de la interfaz solo dice "7 de 131 fragmentos", sin mencionar la palabra ausente (pendiente 1 del avance).
  - T7 (compuerta): "eje" y "central" aparecen 0 veces en el texto. La consola muestra `[CHAT DOCS] sin coincidencia ... cortocircuito: no_match`; el log guarda `shortCircuit: no_match`, sin tokens ni duración. Respondió con el aviso fijo sin llamar al modelo, correcto.
  - Alias `doc-read` en la consola (revisado por el usuario) en los turnos 1 a 6, con modos general y explain: sin cambio de modelo entre turnos. El turno 7 no llama al modelo.
  - Historial creciendo 0, 2, 4, 6, 8, 10 mensajes sin contaminar las respuestas: el fallo 1b no se reprodujo en 7 turnos (segundo intento, ver 24/11).
  - `[CONFIG]` sigue imprimiendo `hardwareProfile: 'desktop'` con el router en `laptop` (pendiente 10).
- **Conclusión y siguiente paso:** la memoria entre turnos, el cambio de zona del documento, la coincidencia parcial y la compuerta funcionan en laptop. Sigue pendiente: desktop completo, small talk, cambiar de chat y regresar, y las pruebas mecánicas.

### 25/11/2026 · laptop (NEXUS) · Prueba A con palabra única, con documento (pasó en lo esencial)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), versión de desarrollo.
- **Documento:** el mismo podcast de 165,041 caracteres. Se adjuntó en el segundo turno de un chat que ya tenía un primer turno sin documento (la consulta anterior, no válida), con la misma pregunta.
- **Consulta:** "¿Cuál es la moraleja sobre bosones y fermiones?". La palabra "moraleja" aparece una sola vez en el texto (~48 %).
- **Cambio aplicado antes:** ninguno (el arreglo de `rawQuestion` ya estaba).
- **Resultado:** pasó en lo esencial. El modelo dijo que en alta energía las partículas no saben si son fermiones o bosones, que es la idea del texto. Añadió "debido a su superposición cuántica", que el pasaje no dice, y empezó con "Soy Tempest".
- **Datos técnicos:**
  - Log: `chatDocs` select, 7 de 131 fragmentos (8,978 de 165,041 car.), `tokensIn` 2978, `tokensOut` 43, 2.5 s, `finishReason` "stop". Modo general, alias `doc-read` (`qwen2.5-3b-q5`), así que `doc-read` también se activa en general (contrato).
  - Reconstrucción con el retriever, aproximada (no se guardan los índices): el fragmento 63, el único con "moraleja", queda entre los mejor puntuados y se envía.
  - `historyMessagesTotal` 0 y `historyMessagesIncluded` 0 en este turno, aunque el chat tenía un turno previo. Sin explicar; no se investigó.
  - `[CONFIG]` sigue imprimiendo `hardwareProfile: 'desktop'` (4.ª vez, pendiente 10).
- **Conclusión y siguiente paso:** la búsqueda del dato del centro con palabra única funciona y el modelo lo lee. Falta la prueba A en un chat que arranque con el documento, para descartar efecto del primer turno, y la prueba B.

### 25/11/2026 · laptop (NEXUS) · Prueba A con palabra única: no válida (chat sin documento) + observación de la barra de documentos

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), versión de desarrollo.
- **Documento:** ninguno adjunto en este chat. Chat nuevo creado con "+ Nuevo Chat" después de un chat que sí tenía documento.
- **Consulta:** pregunta por la moraleja de un tema del documento (palabra única en el texto). Se envió sin documento, así que no prueba nada de la búsqueda.
- **Cambio aplicado antes:** ninguno adicional.
- **Resultado:** no válida como prueba A. Sí confirma que el backend NO arrastra documentos a un chat nuevo.
- **Datos técnicos:**
  - Log: `chatDocs.activeCount` 0, `outcome` "none", attachments vacío, modo general, alias `general-standard` (`qwen2.5-3b-q5`), `tokensIn` 340, `tokensOut` 85, 2.1 s. La consola no tiene línea `[CHAT DOCS]`. El modelo respondió con conocimiento general (respuesta inventada, sin relación con el documento).
  - Observación del usuario: al pulsar "+ Nuevo Chat", la barra "Documentos del chat" parecía seguir mostrando el documento del chat anterior. Sin captura todavía; no confirmado visualmente.
  - Lectura del código (hipótesis, sin probar en la app): los dos manejadores de "+ Nuevo chat" (`frontend/app.js:187` y `frontend/modules/sidebar.js:485`) ponen `chatId: null` y dibujan la bienvenida, pero no llaman a `refreshChatDocuments()`. Esa función con `chatId` vacío oculta la barra; hoy solo se llama al abrir un chat (`app.js:278, 282`) y al recibir `data.documents` (`chat.js:320`).
- **Conclusión y siguiente paso:** el chip viejo sería un defecto de la interfaz, no del backend. Siguiente paso: captura del "antes" (chat con documento → "+ Nuevo Chat" → barra visible) y, solo con el permiso del usuario, llamar a `refreshChatDocuments()` en los dos manejadores. La prueba A con palabra única se repite con el documento adjunto.

### 25/11/2026 · laptop (NEXUS) · Prueba A repetida tras el arreglo de las respuestas fijas (parcial)

- **Fecha:** 25/11/2026.
- **Equipo:** laptop (RTX 4050), versión de desarrollo.
- **Documento:** el mismo podcast de 165,041 caracteres, 131 fragmentos. Chat nuevo, adjunto una sola vez.
- **Consulta:** la misma de la prueba A (pregunta por los tres investigadores que proponen la extensión supersimétrica de la teoría de Einstein). Sin la palabra única en la consulta.
- **Cambio aplicado antes:** `rawQuestion: rawTrimmed` en `chat.controller.js:1111` y `shortcutText` en `localai.service.js:364` (pendiente 15 del avance).
- **Resultado:** parcial. El modelo ya se llama y responde sobre el tema, pero uno de los tres apellidos es incorrecto (2 de 3 bien; el segundo lo sustituyó por otro apellido de la física que no está en el documento).
- **Datos técnicos:**
  - `requests-2026-11-25.jsonl`, chat nuevo: `tokensIn` 3403, `tokensOut` 31, `durationMs` 5414, `finishReason` "stop", historial 0, alias `doc-read` (`qwen2.5-3b-q5`), modo explain, 8 de 131 fragmentos (9,886 de 165,041 car.). Antes: `durationMs` 2 y `tokensIn` null.
  - Reconstruido con el retriever en un script aparte: se enviaron los fragmentos 59, 60, 61, 62, 69, 70, 71 y 73; el 61 contiene la respuesta (el hablante dice los tres apellidos seguidos, con "o como se diga" sobre el segundo). La búsqueda fue correcta; el error es de lectura del modelo.
  - El aviso de la interfaz salió bien ("8 de 131 fragmentos") y el documento quedó guardado en el chat.
  - `[CONFIG]` sigue imprimiendo `hardwareProfile: 'desktop'` con el router en `laptop` (3.ª vez, pendiente 10). El cambio de modelo q4 → q5 ocurrió sin error en este intento.
- **Conclusión y siguiente paso:** el arreglo de las respuestas fijas funciona (el modelo se llama y recibe el fragmento). El fallo restante es de un modelo de 3B que "corrige" un nombre mal transcrito hacia uno que conoce; es la misma clase de falla que el T1 del fósforo (lectura, no búsqueda). Siguiente paso: la prueba A con una palabra única (p. ej. la de "moraleja") y la prueba B (memoria entre turnos). No se cambia código por esto.

### 24/11/2026 · laptop (NEXUS, confirmado con hostname) · Prueba A, dato del centro (falló)

- **Fecha:** 24/11/2026.
- **Equipo:** laptop (RTX 4050), versión de desarrollo.
- **Documento:** mismo podcast de divulgación científica de 165,041 caracteres. Adjunto una sola vez en un chat nuevo, con el mensaje.
- **Consulta:** "¿Cuáles son los tres investigadores que proponen construir la teoría de Einstein con supersimetría?". La respuesta está en ~46 % del texto. La palabra única de esa zona (un apellido transcrito) NO estaba en la pregunta: el diseño de la prueba no cumplió la condición de palabra única.
- **Cambio aplicado antes:** ninguno.
- **Resultado:** falló. Respuesta casi instantánea y sin relación con la pregunta ni con el documento (una lista de objetivos de otro tema). Capturas del "antes" tomadas por el usuario.
- **Datos técnicos:**
  - Router: modo explain, alias `doc-read` (`qwen2.5-3b-q5`), perfil balanceado.
  - `[CHAT DOCS] estimado=3000tok presupuesto ventana normal=4555tok → ventana ampliada: no`; después `ventana=8192 presupuesto=5540tok usados=1 omitidos=0`. La consola pegada no muestra cuántos fragmentos se enviaron ni sus índices.
  - `[CONFIG]` volvió a imprimir `hardwareProfile: 'desktop'` con el router en `laptop` (ya visto el 24/11, pendiente 10).
- **Conclusión y siguiente paso:** sin causa confirmada. Hipótesis sin probar: (a) las palabras de la pregunta son comunes en el documento y BM25 trajo fragmentos equivocados; (b) el texto sobre objetivos viene de un contexto de proyecto o prompt, no del documento. Siguiente paso: leer el `requests-*.jsonl` de ese turno (campo `chatDocs`) para ver fragmentos y tokens, y repetir con una consulta que lleve la palabra única. No se edita código hasta confirmar las capturas.
- **Diagnóstico posterior (25/11, log + código):** causa CONFIRMADA; las hipótesis (a) y (b) quedan descartadas.
  - `requests-2026-11-25.jsonl`: se enviaron 8 de 131 fragmentos (9,886 car.), pero `durationMs: 2`, `tokensIn: null`, `contextSize: 0`, `finishReason: null`. El modelo NUNCA se llamó.
  - La respuesta sale de `getControlledMemoryAnswer` (`backend/services/localai/memory.answers.js:90-93`, frase `'que quiero'` → objetivos del perfil). `streamToLocalAI` (`localai.service.js:370`) la evalúa sobre `finalMessage`, y el controlador ya le pegó el bloque de documentos (`chat.controller.js:872`, llamada en 1111). Si el texto del documento contiene una frase fija, se responde con la memoria del perfil sin llamar al modelo.
  - El documento contiene "que quiero" 4 veces (39.0 %, 41.8 %, 52.5 % y 96.8 %) y "que hora" 1 vez (1.3 %). La pregunta sola no coincide con ninguna frase fija (comprobado con script).
  - Riesgo derivado, sin probar: una pregunta global que mande el principio del documento devolvería la hora (`getCurrentTimeAnswer`, `'que hora'`). El mismo fallo puede darse con el contexto de la búsqueda web, que también va dentro de `finalMessage`.

### 24/11/2026 · laptop · Documento largo: fósforo → Belcher (parcial)

- **Fecha:** 24/11/2026.
- **Equipo:** laptop (RTX 4050), versión de desarrollo.
- **Documento:** transcripción larga de un podcast de divulgación científica, 165,041 caracteres, 131 fragmentos. Adjunto una sola vez en un chat nuevo.
- **Consulta:** en el mismo chat, en este orden: (1) "¿Qué dice el documento sobre el fósforo?" (2) "¿Qué dice sobre las Islas Belcher?". Capturas del "antes" tomadas; las del "después" van con las mismas consultas.
- **Cambio aplicado antes:** ninguno.
- **Resultado:** parcial. T1 falló y T2 pasó.
- **Datos técnicos:**
  - Alias `doc-read` (`qwen2.5-3b-q5`) en los dos turnos (modos explain y general). La prueba 4 (todos los turnos con `doc-read`) pasó en estos 2 turnos.
  - T1: 6 de 131 fragmentos (8,158 car.), tokensIn 2932, tokensOut 60, 6.6 s, historial 0. El modelo respondió que el documento no tiene información específica sobre el fósforo, y sí la tiene.
  - T2: 3 de 131 fragmentos (4,094 car.), tokensIn 1831, tokensOut 91, 2.8 s, 2 mensajes de historial. Respondió sobre las Islas Belcher; la frase extra sobre el fósforo está en los fragmentos enviados.
  - Búsqueda correcta, reconstruida con el retriever en un script aparte porque el log no guarda los índices (los conteos coinciden con el log). T1 envió los fragmentos 105 a 110; el 106, el 108 y el 109 mencionan "fósforo" (1, 6 y 2 veces). T2 envió del 108 al 110; "Islas Belcher" está en el 109.
  - Vistos en la terminal, sin confirmar: `[CONFIG]` imprime `hardwareProfile: 'desktop'` aunque el router y el log dicen `laptop`; y `generateTitleFromText` falló con "context size of 512 is too large for the available VRAM" justo después de cambiar de modelo.
- **Conclusión y siguiente paso:** el fallo 1b (contaminación del historial) no se reprodujo y la hipótesis no tiene apoyo en este intento. La falla de T1 es de lectura del modelo, no de la búsqueda. Siguiente paso: repetir la consulta del fósforo en chats nuevos (pendiente 10 del avance) para ver si el falso "no hay información" es constante o intermitente. La corrección, si la hay, se decide con ese resultado.

### 23/11/2026 · desktop · Small talk con script (pasó, solo script)

- **Fecha:** 23/11/2026.
- **Equipo:** desktop (script, sin la app).
- **Documento:** ninguno (funciones puras con mensajes sueltos).
- **Consulta:** 12 mensajes y 5 casos de la función. La lista de mensajes no quedó anotada.
- **Cambio aplicado antes:** implementación de `isSmallTalk` (retriever) y `skipDocumentsForSmallTalk` (service), llamada desde el controlador justo antes de la compuerta (guardado v3.0.11.7).
- **Resultado:** pasó, según el avance. El resultado por mensaje no quedó anotado.
- **Datos técnicos:** sin registro más allá de los conteos (12 mensajes, 5 casos).
- **Conclusión y siguiente paso:** sin probar en la app, ni laptop ni desktop. Probarlo en la app con un documento activo, en laptop y en desktop (pendiente 3 del avance).
