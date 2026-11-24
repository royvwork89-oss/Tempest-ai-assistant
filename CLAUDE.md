# CLAUDE.md — Tempest

## Qué es Tempest
Tempest es un asistente de IA local de escritorio. Permite conversar con modelos GGUF locales, organizar chats por proyecto, mantener memoria persistente, transcribir audio y analizar archivos adjuntos (OCR, PDF, Office e imágenes con un modelo multimodal).

**Stack**
- **Backend:** Node.js y Express 5 (`backend/server.js`), CommonJS.
- **Motor de IA:** `node-llama-cpp`, con llama.cpp integrado en Node. No hay Docker ni procesos externos desde la v2.10.0.
- **Escritorio:** Electron (`shell/main.js`), empaquetado con electron-builder (NSIS, Windows).
- **Frontend:** web en JavaScript sin framework (`frontend/`: `index.html`, `app.js`, `api.js`, `ui.js`, `chatState.js`, `modules/`, `styles/`).

**Estructura del backend:** `config/` (prompts por capas en `config/prompts/`), `controllers/`, `routes/`, `services/`, `middleware/`, `utils/`, `scripts/`, `data/`, `uploads/`, `outputs/` y `logs/`.

**Scripts (en la raíz):** `npm start` (Electron), `npm run dev` (Electron con `--inspect`), `npm run build` (instalador) y `npm run embed` (genera los embeddings).

## Idioma
- Responder siempre en español.

## Antes de cada cambio de código
Antes de editar, responder estas tres preguntas:
1. **¿Qué hace?**
2. **¿Por qué funciona?**
3. **¿Dónde puede fallar?**

## Cómo editar
- Hacer ediciones quirúrgicas: cambiar solo lo necesario.
- Nunca reescribir archivos completos.
- No borrar contenido válido sin confirmación previa.
- No dejar comentarios instructivos dentro del código.
- No poner nombres de usuario ni de proyecto fijos en el código.

## Perfiles de hardware
- Revisar si cada cambio aplica al **desktop (RTX 4070)**, a la **laptop (RTX 4050)** o a los dos.
- Si el comportamiento cambia según el hardware, usar `process.env.HARDWARE_PROFILE === 'laptop'`. No usar valores fijos en el código (VRAM, capas, contexto, nombres de modelo, etc.).
- Antes de tocar la configuración de modelos, leer `MODELS.md`.

## Pruebas
- Declarar dónde se probó cada cosa (desktop, laptop, build empaquetado o dev).
- Todo lo que no se haya probado se marca explícitamente como **"sin probar"**.

## Git
- **NUNCA** ejecutar `git commit`, `git tag` ni `git push`. Los hace el usuario cuando confirme la documentación.
- **NUNCA** ejecutar `git reset --hard`, `git checkout -- <archivo>`, `git restore`, `git clean`, `git stash` ni `git rebase`, ni cambiar de rama. Hay trabajo sin commit que solo existe en este disco.
- Si algo requiere alguno de esos comandos, explicarlo y esperar la confirmación del usuario.

## Documentación
- `DECISIONS.md`, `ROADMAP.md`, `README.md` y `FLOW.md` **no se editan directamente**. Los cambios se proponen en bloques **ANTES / DESPUÉS** para que el usuario los pegue.
- `DECISIONS.md` y `ROADMAP.md` son muy grandes. Buscar secciones concretas con grep y leer solo ese rango. Nunca leerlos completos.
- No leer `backend/logs/` salvo que se pida.

## Al terminar cada sesión
Actualizar `claude/avance-<versión en curso>.md` (por ejemplo, `claude/avance-v3.1.0.md`). La versión en curso se toma de la sesión; si no está clara, preguntarla al usuario. El archivo incluye:
- **Hecho:** cambios realizados y archivos tocados.
- **Pendiente:** lo que queda por hacer.
- **Dónde se probó:** desktop, laptop o "sin probar", para cada cosa.
