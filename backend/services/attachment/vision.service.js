/**
 * vision.service.js
 * Cliente para modelo multimodal (LLaVA / Qwen2-VL) vía LocalAI.
 * Interfaz reemplazable — contrato:
 *   describeImage(filePath: string) → Promise<{ description: string, model: string }>
 *
 * Notas de migración:
 * - En Electron: reemplazar implementación sin cambiar el contrato.
 * - Para API externa (OpenAI Vision, Google Vision): mismo contrato, distinto transporte.
 * - VISION_MODEL debe coincidir con el name: de llava.yaml en models-localai/.
 */

const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp'); // migrado desde sharp en v2.18.1 — ver DECISIONS.md
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// BUG REAL (v3.0.0, app instalada): este archivo leía el perfil de
// `process.env.HARDWARE_PROFILE` directo, con default 'desktop'. Esa variable
// viene del `.env` del repo — que está EXCLUIDO del build (`"!.env"` en
// package.json). En la app instalada no existe, así que visión creía estar en
// 'desktop' y elegía `qwen2.5-vl-7b-q4` mientras TODO el resto de la app
// operaba correctamente como 'laptop' (perfil elegido en el instalador y
// persistido en app-settings.json). Resultado: buscaba un modelo que el
// usuario nunca descargó, en vez de `llava-1.6` que sí tenía. La fuente de
// verdad es `getHardwareProfile()` (settings.json → env → default), que ya
// usaba el resto del backend; este archivo era el único desalineado.
const { getHardwareProfile } = require('../settings.service');

function getVisionModel() {
  const profile = getHardwareProfile();
  return process.env.VISION_MODEL ||
    (profile === 'laptop' ? 'llava-1.6:latest' : 'qwen2.5-vl-7b-q4:latest');
}

// ─── Auto-registro del modelo de visión en Ollama ─────────────────────────
// Tener Ollama instalado NO alcanza: además hay que registrar el modelo con
// `ollama create <nombre> -f <Modelfile>` (visto en ollama/setup.ps1, hasta
// ahora un paso manual por PowerShell). Este mapeo conecta cada modelo de
// `getVisionModel()` con su Modelfile y los .gguf de los que depende
// (`models-localai/`, los mismos que baja el panel de Modelos — ver
// models.catalog.js, ambos marcados `required: false`: son opcionales, no
// se bajan solos al arrancar la app).
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

// BUG REAL (v3.0.0, encontrado probando la app INSTALADA): los .gguf NO viven
// en `<raíz del proyecto>/models-localai/` cuando la app está empaquetada.
// Ahí esa carpeta ni siquiera existe (está excluida del build) — los modelos
// se descargan a la carpeta de usuario escribible (`MODELS_DIR`, seteada por
// shell/main.js a `app.getPath('userData')/models-localai`). Todo el resto del
// código ya resolvía esto igual (localai.service.js, models.catalog.js,
// embed.provider.js, transcription.service.js); este archivo era el único que
// asumía la ruta del repo, así que en la app instalada el chequeo de .gguf
// daba "faltan" SIEMPRE y `ensureVisionModelRegistered()` cortaba en silencio.
// Mismo patrón que el resto del código, a propósito.
function getModelsDir() {
  return process.env.MODELS_DIR
    ? path.resolve(process.env.MODELS_DIR)
    : path.join(PROJECT_ROOT, 'models-localai');
}

// Se resuelve por llamada (no una vez al cargar el módulo) porque MODELS_DIR
// la setea shell/main.js en startBackend(), y este módulo podría cargarse
// antes según el orden de requires.
function getOllamaVisionSetup(baseName) {
  const modelsDir = getModelsDir();
  const setups = {
    'llava-1.6': {
      modelfile: path.join(PROJECT_ROOT, 'ollama', 'llava.Modelfile'),
      ggufFiles: [
        path.join(modelsDir, 'llava-v1.6-mistral-7b.Q4_K_M.gguf'),
        path.join(modelsDir, 'mmproj-model-f16.gguf')
      ]
    },
    'qwen2.5-vl-7b-q4': {
      modelfile: path.join(PROJECT_ROOT, 'ollama', 'qwen2.5-vl-7b-q4.Modelfile'),
      ggufFiles: [
        path.join(modelsDir, 'Qwen_Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf'),
        path.join(modelsDir, 'mmproj-Qwen_Qwen2.5-VL-7B-Instruct-f16.gguf')
      ]
    }
  };
  return setups[baseName] || null;
}

// El instalador oficial de Ollama para Windows agrega su carpeta al PATH
// DE USUARIO (%LOCALAPPDATA%\Programs\Ollama) — pero un proceso ya en
// ejecución, o lanzado por un Explorer que no se reinició desde que se
// instaló Ollama, puede seguir viendo el PATH viejo. `npm start` (lanzado
// desde una terminal nueva, que sí carga el PATH actualizado) encontraba
// `ollama` sin problema; la app YA INSTALADA (lanzada por doble-click,
// heredando el entorno de Explorer) no — confirmado en pruebas reales: cero
// líneas `[vision]` en el log, ni siquiera el intento de `ollama --version`
// llegaba a loguear nada porque fallaba en el primer paso, en silencio.
// Fix: si `ollama` a secas no resuelve por PATH, se prueba la ruta default
// del instalador de Windows como fallback antes de rendirse. Se cachea el
// binario que funcionó para no repetir el intento fallido en cada llamada.
const OLLAMA_DEFAULT_WIN_PATH = process.platform === 'win32' && process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe')
  : null;

let _ollamaBin = null;

async function resolveOllamaBin() {
  if (_ollamaBin) return _ollamaBin;

  try {
    await execFileAsync('ollama', ['--version']);
    _ollamaBin = 'ollama';
    return _ollamaBin;
  } catch {
    // sigue abajo con el fallback
  }

  if (OLLAMA_DEFAULT_WIN_PATH && fs.existsSync(OLLAMA_DEFAULT_WIN_PATH)) {
    try {
      await execFileAsync(OLLAMA_DEFAULT_WIN_PATH, ['--version']);
      _ollamaBin = OLLAMA_DEFAULT_WIN_PATH;
      return _ollamaBin;
    } catch {
      // tampoco — sigue sin encontrarse
    }
  }

  return null; // no está en el PATH ni en la ubicación default — no instalado, o instalado en otro lado
}

async function isOllamaInstalled() {
  return (await resolveOllamaBin()) !== null;
}

// `ollama list` lanza un subproceso. Antes se llamaba una vez cada tanto (solo
// al adjuntar una imagen) y no importaba, pero el panel de Modelos ahora
// consulta el estado cada 1,5s mientras está abierto — eso serían 40 procesos
// por minuto para responder algo que casi nunca cambia. Cache corta: al
// registrar se invalida a mano, así que el panel refleja el cambio al toque y
// el resto del tiempo no gasta nada.
const REGISTERED_TTL_MS = 10000;
let _registeredCache = { key: null, value: false, at: 0 };

async function isModelRegisteredInOllama(baseName) {
  const now = Date.now();
  if (_registeredCache.key === baseName && now - _registeredCache.at < REGISTERED_TTL_MS) {
    return _registeredCache.value;
  }

  const bin = await resolveOllamaBin();
  if (!bin) return false;

  let value = false;
  try {
    const { stdout } = await execFileAsync(bin, ['list']);
    value = stdout.toLowerCase().includes(baseName.toLowerCase());
  } catch {
    value = false;
  }
  _registeredCache = { key: baseName, value, at: now };
  return value;
}

// Paso de "primera vez" — se llama antes de cada chequeo/uso de visión, pero
// solo hace trabajo real la primera vez: si el modelo ya está registrado,
// `isModelRegisteredInOllama` corta acá (un solo `ollama list`, rápido). Se
// autocura sin importar el orden en que el usuario instale Ollama o baje el
// .gguf desde el panel de Modelos — no depende de engancharse a ningún otro
// paso puntual. Ver DECISIONS.md.
// Estado del registro, para que el panel de Modelos pueda mostrarlo y no
// quede como un proceso invisible de varios minutos dentro de un request de
// chat (ver DECISIONS.md → "Registro del modelo de visión desde el panel").
// `_inFlight` además evita que dos llamadas concurrentes lancen dos
// `ollama create` sobre el mismo modelo: puede pasar fácil con el botón del
// panel y un mensaje con imagen al mismo tiempo, o con dos imágenes seguidas.
let _registerState = { status: 'idle', error: null, startedAt: null, finishedAt: null };
let _inFlight = null;

function getVisionRegistrationState() {
  return { ..._registerState };
}

async function ensureVisionModelRegistered() {
  if (_inFlight) return _inFlight;
  _inFlight = _ensureVisionModelRegistered().finally(() => { _inFlight = null; });
  return _inFlight;
}

async function _ensureVisionModelRegistered() {
  const baseName = getVisionModel().split(':')[0];
  const setup = getOllamaVisionSetup(baseName);
  if (!setup) return false; // VISION_MODEL custom fuera del mapeo conocido — no tocar nada

  const bin = await resolveOllamaBin();
  if (!bin) {
    console.warn('[vision] Ollama no encontrado (ni en PATH ni en la ruta default) — sin análisis de imágenes');
    return false;
  }
  if (await isModelRegisteredInOllama(baseName)) return true;

  const missingGGUF = setup.ggufFiles.filter(f => !fs.existsSync(f));
  if (missingGGUF.length) {
    // Antes esto era un `return false` MUDO. Costó dos ciclos completos de
    // rebuild+reinstalar diagnosticarlo, porque en el log no quedaba rastro
    // de nada: ni error, ni intento. Si esta rama se toma, hay que poder
    // verlo — y con la ruta concreta que se buscó, que era justamente lo
    // que estaba mal.
    console.warn(
      `[vision] Faltan .gguf para registrar "${baseName}" — el análisis de imágenes queda desactivado:\n` +
      missingGGUF.map(f => `  - ${f}`).join('\n')
    );
    return false;
  }

  let tmpModelfile = null;
  try {
    // El Modelfile del repo apunta a los .gguf con rutas RELATIVAS
    // (`FROM ../models-localai/...`), que solo resuelven bien corriendo desde
    // el repo. En la app instalada el Modelfile queda en
    // `resources/app/ollama/` y los .gguf en la carpeta de usuario — no hay
    // ninguna ruta relativa que conecte las dos. En vez de tocar el Modelfile
    // del repo (que sí sirve tal cual para `ollama/setup.ps1` manual), se
    // genera una copia temporal con las rutas ya absolutas y se registra desde
    // ahí. Se matchea por nombre de archivo contra los .gguf ya resueltos y
    // verificados arriba, así el mapeo no depende de cómo esté escrita la
    // parte relativa de la ruta.
    const original = fs.readFileSync(setup.modelfile, 'utf8');
    const resolved = original.replace(/^(\s*FROM\s+)(.+)$/gim, (line, prefix, ref) => {
      const wanted = path.basename(ref.trim().replace(/^["']|["']$/g, ''));
      const abs = setup.ggufFiles.find(f => path.basename(f) === wanted);
      return abs ? `${prefix}${abs}` : line;
    });

    tmpModelfile = path.join(os.tmpdir(), `tempest-${baseName}-${Date.now()}.Modelfile`);
    fs.writeFileSync(tmpModelfile, resolved, 'utf8');

    _registerState = { status: 'registering', error: null, startedAt: Date.now(), finishedAt: null };
    console.log(`[vision] Registrando "${baseName}" en Ollama por primera vez...`);
    await execFileAsync(bin, ['create', baseName, '-f', tmpModelfile], {
      cwd: os.tmpdir(),
      // `ollama create` copia los pesos a su propio almacén de blobs (varios
      // GB). En un disco lento eso puede tardar bastante, así que el límite es
      // generoso — pero existe: sin timeout, un `ollama create` colgado dejaba
      // el request de la imagen esperando para siempre, sin forma de saberlo.
      timeout: 20 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024
    });
    _registerState = { status: 'done', error: null, startedAt: _registerState.startedAt, finishedAt: Date.now() };
    // Invalidar a mano en vez de esperar el TTL: el usuario acaba de esperar
    // varios minutos mirando el panel, no puede quedarse 10s más en "falta
    // registrar" cuando ya terminó.
    _registeredCache = { key: baseName, value: true, at: Date.now() };
    console.log(`[vision] "${baseName}" registrado en Ollama ✅`);
    return true;
  } catch (err) {
    _registerState = { status: 'error', error: err.message, startedAt: _registerState.startedAt, finishedAt: Date.now() };
    console.error(`[vision] Error registrando "${baseName}" en Ollama:`, err.message);
    return false;
  } finally {
    if (tmpModelfile) { try { fs.unlinkSync(tmpModelfile); } catch {} }
  }
}

// ─── Estado completo del setup de visión, para el panel de Modelos.
// Responde las cuatro preguntas que determinan si el análisis de imágenes va a
// funcionar, en el orden en que importan: ¿este modelo lo sabemos registrar?
// ¿está Ollama? ¿están los .gguf? ¿ya está registrado? Cada una con el dato
// concreto que hace falta para actuar (qué archivos faltan, cuánto va a
// ocupar), en vez de un booleano suelto.
async function getVisionSetupStatus() {
  const visionModel = getVisionModel();
  const baseName = visionModel.split(':')[0];
  const setup = getOllamaVisionSetup(baseName);

  if (!setup) {
    return {
      visionModel, baseName, supported: false, ollamaInstalled: false,
      ggufReady: false, missingGGUF: [], registered: false, extraBytes: null,
      registration: getVisionRegistrationState()
    };
  }

  const missingGGUF = setup.ggufFiles.filter((f) => !fs.existsSync(f));
  const ggufReady = missingGGUF.length === 0;
  const ollamaInstalled = await isOllamaInstalled();
  const registered = ollamaInstalled ? await isModelRegisteredInOllama(baseName) : false;

  // Cuánto espacio extra va a ocupar el registro: `ollama create` COPIA los
  // pesos a su almacén, no los mueve ni los referencia. Con los archivos ya en
  // disco el número es exacto, así que se muestra el real y no una estimación.
  let extraBytes = null;
  if (ggufReady) {
    try {
      extraBytes = setup.ggufFiles.reduce((sum, f) => sum + fs.statSync(f).size, 0);
    } catch { extraBytes = null; }
  }

  return {
    visionModel, baseName, supported: true, ollamaInstalled,
    ggufReady, missingGGUF, registered, extraBytes,
    registration: getVisionRegistrationState()
  };
}

// Cuál de los tres requisitos falta, en el orden en que hay que resolverlos.
// Devuelve null si está todo listo. Lo usa el pipeline de imágenes para decirle
// al frontend QUÉ tarjeta mostrar: el usuario no tiene que hacer lo mismo en
// los tres casos, así que un "no disponible" genérico no alcanzaría.
async function getMissingVisionRequirement() {
  const s = await getVisionSetupStatus();
  if (!s.supported) return null;      // modelo custom fuera del mapeo — no opinamos
  if (!s.ollamaInstalled) return 'ollama';
  if (!s.ggufReady) return 'files';
  if (!s.registered) return 'registration';
  return null;
}

function getVisionParams() {
  // Misma corrección que en getVisionModel(): la fuente de verdad del perfil
  // es getHardwareProfile(), no process.env directo (el .env no se empaqueta).
  // Acá el efecto era más silencioso pero igual de real: en la app instalada
  // una laptop recibía los parámetros de desktop (max_tokens 1024,
  // repeat_penalty 1.8) en vez de los suyos, ya calibrados con pruebas reales.
  const profile = getHardwareProfile();
  if (profile === 'laptop') {
    // Antes: repeat_penalty 2.0, frequency_penalty 1.5, presence_penalty 1.0 —
    // fijados en v2.4.1 sin acceso a hardware real de laptop, para combatir
    // loops de texto repetido. Validación en laptop real (v3.0.0) encontró un
    // efecto secundario: penalizar tan agresivo empuja al modelo hacia
    // patrones memorizados poco relacionados con la imagen (plantillas de
    // rechazo tipo "no puedo ayudarte", ver DECISIONS.md). Bajado a valores
    // menos extremos, más cerca de desktop, para probar si reduce ese efecto
    // sin reintroducir los loops.
    //
    // CONFIRMADO CON PRUEBA REAL (v3.0.0, laptop): la descripción esta vez sí
    // fue real y relevante a la imagen (no más plantillas de rechazo), pero
    // el modelo entró en un loop parcial (repitió casi textual "En la parte
    // superior derecha hay una barra roja con textos que parecen ser
    // opciones o botones...") y la respuesta se cortó a mitad de palabra —
    // `removeLoops()` solo elimina ORACIONES completas idénticas, así que no
    // pudo limpiar el fragmento final incompleto (sin punto final todavía
    // cuando llegó al límite). Con 512 tokens, el loop alcanzó a comerse el
    // presupuesto completo antes de que el modelo terminara de describir el
    // resto de la imagen. Subido a 768 — no elimina el loop en sí (ver nota
    // de arriba, ya se probó penalizar más agresivo y trajo un problema
    // peor), pero le da más margen para terminar la descripción completa
    // aunque repita alguna oración en el camino.
    return { max_tokens: 768, temperature: 0.1, repeat_penalty: 1.3, frequency_penalty: 1.2, presence_penalty: 0.3 };
  }
  return { max_tokens: 1024, temperature: 0.1, repeat_penalty: 1.8, frequency_penalty: 1.2 };
}

const VISION_TIMEOUT_MS = 180_000;

/**
 * Convierte una imagen a base64 data URL.
 * Soporta PNG, JPEG, WEBP, GIF.
 */
function toBase64DataURL(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
  const mime = mimeMap[ext] || 'image/png';
  const data = fs.readFileSync(filePath);
  return `data:${mime};base64,${data.toString('base64')}`;
}

/**
 * Envía la imagen al modelo multimodal y devuelve su descripción.
 * @param {string} filePath - ruta absoluta a la imagen
 * @param {string} [hint]   - pista opcional del usuario (ej. "es un diagrama de flujo")
 * @returns {Promise<{ description: string, model: string }>}
 */

function removeLoops(text) {
  const paragraphs = text.split(/\n+/);
  const seen = new Set();
  const result = [];

  for (const para of paragraphs) {
    const clean = para.trim();
    if (!clean) continue;
    const key = clean.toLowerCase().replace(/\s+/g, ' ');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
  }

  const joined = result.join('\n');
  const sentences = joined.split(/(?<=[.!?])\s+/);
  const seenSentences = new Set();
  const finalSentences = [];

  for (const sentence of sentences) {
    const key = sentence.trim().toLowerCase();
    if (key.length < 20) { finalSentences.push(sentence); continue; }
    if (!seenSentences.has(key)) {
      seenSentences.add(key);
      finalSentences.push(sentence);
    }
  }

  const output = finalSentences.join(' ').trim();
  return output.length > 2000 ? output.slice(0, 2000).replace(/\s+\S*$/, '…') : output;
}

async function describeImage(filePath, hint = '') {
  // Redimensionar a máximo 1024px y comprimir para no superar límite gRPC de 4MB
  const tmpPath = path.join(os.tmpdir(), `vision_${crypto.randomBytes(6).toString('hex')}.jpg`);
  try {
    const image = await Jimp.read(filePath);
    const maxDim = 1024;
    // Equivalente a fit:'inside' + withoutEnlargement:true — solo achica, nunca agranda
    const factor = Math.min(maxDim / image.bitmap.width, maxDim / image.bitmap.height);
    if (factor < 1) {
      image.scaleToFit({ w: maxDim, h: maxDim });
    }
    await image.write(tmpPath, { quality: 70 });
  } catch {
    // Si jimp falla, usar imagen original
  }
  const effectivePath = fs.existsSync(tmpPath) ? tmpPath : filePath;
  const dataURL = toBase64DataURL(effectivePath);

  // Antes solo pedía describir la escena — el modelo priorizaba narrar lo que
  // ve (personajes, paisaje) y nunca transcribía texto en pantalla (HUD,
  // carteles, botones) aunque fuera legible para él. Encontrado en pruebas
  // de v3.0.0 (ver DECISIONS.md). Se agrega el pedido explícito de texto
  // visible como instrucción aparte, sin volverlo obligatorio (si no hay
  // texto, simplemente no hay nada que listar).
  const prompt = hint
    ? `Describe en detalle lo que ves en esta imagen. Contexto: ${hint}. Si hay texto visible en la imagen (carteles, títulos, botones, interfaz), transcribilo también.`
    : 'Describe brevemente lo que ves en esta imagen en español. Si hay texto visible (carteles, títulos, botones, interfaz), transcribilo también.';

  const params = getVisionParams();
  const body = {
  model: getVisionModel(),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataURL } },
        { type: 'text', text: prompt }
      ]
    }
  ],
  ...params,
  stream: false,
};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Vision API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const choice = data?.choices?.[0];
    let description = removeLoops(choice?.message?.content?.trim() || '');
    const truncated = choice?.finish_reason === 'length';

    // Cuando se corta por `finish_reason: 'length'`, la última oración queda
    // a mitad de palabra (sin punto final) — `removeLoops()` solo saca
    // oraciones REPETIDAS, no toca esta última porque no tiene con qué
    // compararla. Encontrado en prueba real: la respuesta terminaba en
    // "...alta resolución de esta imagen comp" — un corte feo y a mitad de
    // palabra. Si truncó, recortamos ese resto colgante hasta el último
    // punto/cierre real, para que se lea como una descripción completa
    // (más corta) en vez de una frase rota.
    if (truncated) {
      const lastSentenceEnd = Math.max(
        description.lastIndexOf('.'), description.lastIndexOf('!'), description.lastIndexOf('?')
      );
      if (lastSentenceEnd > 0) description = description.slice(0, lastSentenceEnd + 1);
    }

    return { description, model: getVisionModel(), truncated };

  } finally {
    clearTimeout(timeout);
    // Limpiar temporal
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
}

/**
 * Verifica si el modelo multimodal está disponible en LocalAI.
 * Útil para degradación elegante: si no está disponible, saltarse sin error.
 */
async function isVisionAvailable() {
  try {
    // Antes de preguntarle a Ollama qué modelos tiene: si Ollama está
    // instalado pero el modelo todavía no fue registrado con `ollama
    // create` (paso manual hasta ahora, ver ollama/setup.ps1), esto lo
    // registra solo. Sin esto, el ping de abajo devolvía "no disponible"
    // para siempre aunque el usuario ya hubiera instalado Ollama y bajado
    // el .gguf — nada disparaba el `ollama create` que faltaba.
    // ACÁ ANTES SE LLAMABA A ensureVisionModelRegistered(). Se sacó.
    //
    // La idea era que se autocurara: si faltaba el registro, se hacía solo. Y
    // funcionaba — pero `ollama create` copia varios GB y tarda MINUTOS, y esto
    // corre dentro del request del chat. El resultado real, probado por el
    // usuario en escritorio (modelo y complemento ya descargados, registro
    // borrado a propósito): adjuntar una imagen dejaba el chat "pensando" un
    // rato largo, sin decir nada, en vez de avisar al instante que faltaba un
    // paso. Un proceso de varios GB no debería arrancar solo, sin que nadie lo
    // pida y sin forma de verlo.
    //
    // Ahora el registro pasa únicamente por el botón del panel de Modelos, que
    // muestra progreso y avisa cuánto espacio va a ocupar; y si falta, el chat
    // responde de inmediato con la tarjeta que dice exactamente qué falta. La
    // detección automática de Ollama sigue intacta (resolveOllamaBin no cachea
    // los fallos), que es lo que promete la pantalla del instalador.
    const res = await fetch(`${OLLAMA_URL}/v1/models`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.warn(`[vision] Ollama respondió ${res.status} a ${OLLAMA_URL}/v1/models — visión no disponible`);
      return false;
    }
    const data = await res.json();
    const models = data?.data?.map(m => m.id) || [];
    const visionModel = getVisionModel();
    const found = models.some(m => m === visionModel || m.startsWith(visionModel.replace(':latest', '')));
    if (!found) {
      // Caso raro pero posible: el registro se dio por bueno y aun así el
      // modelo no aparece listado. Saber QUÉ tiene Ollama registrado es la
      // diferencia entre diagnosticarlo en un log y tener que adivinar.
      console.warn(
        `[vision] "${visionModel}" no figura entre los modelos registrados en Ollama ` +
        `(hay ${models.length}: ${models.join(', ') || 'ninguno'}) — visión no disponible`
      );
    }
    return found;
  } catch (err) {
    // Las tres salidas mudas de esta función (respuesta no-ok, modelo ausente,
    // y esta excepción) eran el último tramo del pipeline sin rastro en el
    // log. Acá cae, entre otros, el caso de Ollama instalado pero con el
    // servidor apagado: `ollama --version` funciona igual, el registro puede
    // haber salido bien, y el fetch falla. Sin este warn ese escenario se ve
    // idéntico a "no hay nada instalado". Misma lección que costó cuatro
    // reinstalaciones en esta serie — ver DECISIONS.md.
    console.warn(`[vision] No se pudo consultar Ollama en ${OLLAMA_URL}: ${err.message} — visión no disponible`);
    return false;
  }
}

module.exports = {
  describeImage,
  isVisionAvailable,
  getVisionModel,
  ensureVisionModelRegistered,
  getVisionSetupStatus,
  getVisionRegistrationState,
  getMissingVisionRequirement
};