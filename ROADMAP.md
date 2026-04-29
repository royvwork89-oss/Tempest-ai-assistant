# 🧩 Tempest - Roadmap

## 🚧 Estado actual

Versión actual: v0.3.1

Sistema funcional con:

- Chat local con IA
- LocalAI como motor principal
- Memoria por usuario/proyecto/chat
- Chats independientes
- Proyectos con múltiples chats
- Sidebar tipo workspace
- Renombrar y eliminar chats/proyectos
- Modal de confirmación para eliminar
- Creación de proyectos con nombre manual
- Renombrado automático de chats con IA
- Transcripción de audio
- Exportación TXT, PDF y DOCX
- Menú de herramientas (+)
- renderizado de bloques de código estilo terminal
- botón para copiar código generado
- input multilínea con `Shift + Enter`
- textarea autoexpandible con límite de altura
- estructura visual preparada para adjuntar archivos/imágenes en el futuro
- Mejora de limpieza de títulos generados por IA
- Prevención básica de nombres duplicados en chats
- Renderizado visual de bloques de código
- Botón para copiar código
- Input multilínea con autoexpansión
- Base visual preparada para archivos adjuntos

---

## 🔥 Prioridad alta

### 🧠 Memoria

- [ ] Mejorar detección de datos importantes
- [ ] Evitar duplicados en perfil/memoria
- [ ] Añadir resumen automático por chat
- [ ] Añadir resumen automático por proyecto
- [ ] Separar memoria corta y larga de forma más estricta
- [ ] Limpiar historial viejo sin perder resumen

### 🧩 Proyectos y chats

- [ ] Validar nombres para evitar caracteres inválidos
- [ ] Evitar nombres duplicados de chats/proyectos
- [ ] Mejorar renombrado automático de chats
- [ ] Permitir renombrado automático opcional de proyectos
- [ ] Añadir opción de cancelar creación de chat pendiente
- [ ] Mejorar visual de proyecto activo/chat activo
- [ ] Guardar estado de proyecto colapsado/expandido en localStorage

### 🧾 UI/UX

- [ ] Reemplazar `prompt()` de renombrar por modal propio
- [ ] Añadir modal de error visual
- [ ] Añadir loader animado de respuesta
- [ ] Añadir confirmación visual al renombrar
- [ ] Mejorar diseño de menú de tres puntos
- [ ] Mejorar diseño móvil

---

## ⚙️ Transcripción de audio

- [ ] Implementar corte por silencio real (VAD)
- [ ] Mejorar manejo de errores por fragmento
- [ ] Optimizar tiempo de procesamiento
- [ ] Permitir elegir idioma del audio
- [ ] Limpiar automáticamente uploads/audio
- [ ] Limpiar automáticamente uploads/chunks
- [ ] Añadir análisis automático de transcripción
- [ ] Enviar transcripción al chat como contexto opcional

---

## 📄 Exportación

- [ ] Mejorar formato de PDF
- [ ] Mejorar formato DOCX
- [ ] Añadir descarga directa desde frontend
- [ ] Permitir elegir solo un formato de salida
- [ ] Añadir nombres de archivo más descriptivos

---

## 🤖 Integración IA

- [ ] Mejorar prompt del generador de títulos
- [ ] Añadir selección automática de modelo
- [ ] Añadir modo híbrido local + API externa
- [ ] Añadir análisis de archivos
- [ ] Añadir herramientas nuevas al menú +

---

## 🧪 Testing

- [ ] Probar `/chat`
- [ ] Probar `/chat/history`
- [ ] Probar `/chat/create`
- [ ] Probar `/chat/rename`
- [ ] Probar `/chat/delete`
- [ ] Probar `/project/create`
- [ ] Probar `/project/rename`
- [ ] Probar `/project/delete`
- [ ] Probar `/title/generate`
- [ ] Probar `/transcribe`

---

## 🚀 Futuro

- [ ] Migrar JSON a SQLite/PostgreSQL
- [ ] Añadir sistema de login
- [ ] Añadir múltiples usuarios reales
- [ ] Añadir búsqueda semántica con embeddings
- [ ] Añadir app desktop con Electron
- [ ] Añadir sincronización opcional
- [ ] Añadir respaldo/exportación de memoria

