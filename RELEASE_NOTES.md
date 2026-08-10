## ✨ Novedades

**Análisis de imágenes 100% local con Ollama**
Tempest ahora puede describir y responder preguntas sobre imágenes adjuntas usando un modelo de
visión (LLaVA / Qwen2.5-VL) corriendo localmente vía Ollama. Incluye detección en vivo de los
requisitos (Ollama instalado, modelo descargado, complemento de visión, registro), registro
con un solo botón desde el panel de Modelos, y un aviso claro en el chat cuando falta algo —
sin tecnicismos, sin dejar la app "pensando" innecesariamente.

**Generación de documentos desde el chat**
Pedile a Tempest que redacte algo y exportalo directo a PDF, DOCX o TXT ("crea un documento en
pdf sobre..."). Los documentos generados quedan disponibles para ver/descargar y persisten en
el historial del chat.

**Búsqueda web con degradación honesta**
Si la búsqueda web está activa pero el proveedor falla (por ejemplo, sin conexión), Tempest ya
no responde en silencio con información desactualizada — avisa explícitamente que no pudo
verificar el dato en tiempo real.

## 🛠️ Estabilidad y confiabilidad

- Corregido un bug que podía dañar archivos al usar "Aplicar" en Patch Mode (el cálculo del
  rango a reemplazar tomaba una línea de más).
- El motor de inferencia ahora se recupera automáticamente si falla el cambio a un modelo no
  descargado, en vez de dejar toda la app (chat, documentos, transcripción) inutilizable hasta
  reiniciar.
- Patch Mode: más protecciones contra doble aplicación, mejor manejo de archivos no encontrados
  o no legibles, y ya no alucina contenido de archivos que no puede ver.
- El chat ya no queda "congelado" tras un error — el estado de streaming se limpia correctamente.
- Corrección de un router de intenciones que confundía palabras similares (ej. "crear" se
  interpretaba como pedido de código).

## 🎙️ Transcripción y motores empaquetados

- ffmpeg/ffprobe y whisper-cli ahora se empaquetan/descargan automáticamente — la transcripción
  funciona en una instalación limpia sin pasos manuales.
- Si todos los fragmentos de audio fallan, ahora se reporta como error real en vez de un archivo
  vacío marcado como "éxito".

## 📦 Empaquetado y actualizaciones

- Auto-actualización con barra de progreso real y cancelación funcional.
- Corregido el 404 del auto-updater por desajuste de nombre entre el instalador y `latest.yml`.
- Exportar/importar chats y proyectos completos como respaldo fuera de la app.

## 🔒 Privacidad y diagnóstico

- Logging estructurado por request (errores + requests), con consentimiento explícito y opt-in
  por usuario para qué se guarda.
- Panel de Modelos sin parpadeo, con agrupación clara de modelos de visión.

## 🐛 Otras correcciones

Decenas de bugs encontrados y corregidos durante pruebas exhaustivas de cada feature: manejo de
adjuntos e imágenes con OCR, contención de VRAM entre modelos, mensajes de error más claros
cuando falta un modelo por descargar, y varios ajustes de precisión en Patch Mode.
