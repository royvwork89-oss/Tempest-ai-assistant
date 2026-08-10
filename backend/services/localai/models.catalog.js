'use strict';

const path = require('path');
const { resolveModelPath, getKnownModelIds } = require('../localai.service');
const { resolve: resolveCapability, getAvailableModelIds } = require('../model.router/capability.matrix');

// ─── Catálogo de descarga — capa que se apoya en MODEL_FILES (localai.service.js)
// sin duplicarlo. MODEL_FILES sigue siendo la única fuente de verdad de
// modelId → nombre de archivo; acá solo agregamos lo necesario para poder
// bajar cada modelo: origen, tamaño esperado, checksum y de qué perfil de
// hardware es.
//
// `required` YA NO es un booleano fijo por modelo — depende del perfil activo
// (ver getRequiredModelIdsForProfile). Antes, hermes-q4 (8B) estaba
// hardcodeado como el único requerido, así que una laptop con 6GB de VRAM
// terminaba bajando y cargando un modelo que no puede correr bien — el
// perfil "requerido" real es "el modelo general-fast de ESTE hardware" +
// Whisper. Ver DECISIONS.md → "Perfil de hardware: laptop no debe bajar
// hermes-q4".
//
// `url: null` = fuente todavía no confirmada. El modelo aparece igual en el
// catálogo (para que se vea que existe y falta), pero sin botón de descarga
// habilitado hasta completar la fuente — ver DECISIONS.md.

// ─── Whisper no vive en MODEL_FILES (es .bin de ggml, no .gguf de llama.cpp,
// lo carga whisper-cli.exe directo — ver transcription.service.js). Se agrega
// acá como modelo "extra" para que el catálogo y el chequeo de inventario lo
// cubran también.
function getModelsDir() {
  return process.env.MODELS_DIR
    ? path.resolve(process.env.MODELS_DIR)
    : path.join(__dirname, '../../../models-localai');
}

const EXTRA_MODELS = {
  'whisper-large-v3': {
    resolvePath: () => path.join(getModelsDir(), 'whisper', 'ggml-large-v3.bin')
  },
  // ─── whisper-cli: NO es un modelo de datos, es el ejecutable que corre el
  // modelo de arriba (whisper.cpp compilado con soporte CUDA). Va en
  // whisper-bin/ (hermano de ffmpeg-bin/, en la raíz del proyecto), no dentro
  // de models-localai/ — no es contenido descargable "de usuario", es parte
  // del propio programa. Se agrega al catálogo porque hasta v3.0.0 este
  // binario se copiaba a mano y nunca tuvo mecanismo de distribución (ver
  // ROADMAP.md → "whisper-bin/whisper-cli.exe no existe" y DECISIONS.md).
  'whisper-cli': {
    resolvePath: () => path.join(__dirname, '../../../whisper-bin/whisper-cli.exe')
  },
  // ─── Proyectores multimodales (mmproj) — BUG REAL encontrado probando la app
  // instalada (v3.0.0): un modelo de visión GGUF son SIEMPRE dos archivos, los
  // pesos del lenguaje + el proyector de visión (mmproj). El catálogo solo
  // tenía los pesos, así que `llava-1.6`/`qwen2.5-vl-7b-q4` se descargaban
  // "completos" desde el panel de Modelos pero les faltaba la mitad que
  // convierte píxeles en tokens — y `ollama create` no puede registrar el
  // modelo sin ella. En la máquina de desarrollo el mmproj estaba puesto a
  // mano desde antes (mayo), así que el hueco quedó invisible hasta probar en
  // una instalación limpia. Se agregan acá (y no en MODEL_FILES) por la misma
  // razón que Whisper: no son modelos de chat, no pasan por el router.
  'llava-1.6-mmproj': {
    resolvePath: () => path.join(getModelsDir(), 'mmproj-model-f16.gguf')
  },
  'qwen2.5-vl-7b-q4-mmproj': {
    resolvePath: () => path.join(getModelsDir(), 'mmproj-Qwen_Qwen2.5-VL-7B-Instruct-f16.gguf')
  }
};

// ─── Archivos que SIEMPRE tienen que bajar junto con otro modelo. Hoy solo
// mmproj: pedir "llava-1.6" y recibir algo que no puede ver imágenes no es
// una descarga incompleta, es una descarga inservible. Se resuelve acá, en el
// catálogo, y no en el panel del frontend, para que valga igual para el click
// individual, "Descargar todos", y cualquier caller futuro.
const COMPANION_MODELS = {
  'llava-1.6': ['llava-1.6-mmproj'],
  'qwen2.5-vl-7b-q4': ['qwen2.5-vl-7b-q4-mmproj']
};

function getCompanionModelIds(modelId) {
  return COMPANION_MODELS[modelId] || [];
}

const DOWNLOAD_INFO = {
  // ── Requeridos en el primer arranque — fuente y checksum confirmados ──
  'hermes-q4': {
    url: 'https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q4_K_M.gguf',
    sha256: 'd4403ce5a6e930f4c2509456388c20d633a15ff08dd52ef3b142ff1810ec3553',
    sizeBytes: 4920733824,
    required: true
  },
  'whisper-large-v3': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
    sha256: '64d182b440b98d5203c4f9bd541544d84c605196c4f7b845dfa11fb23594d1e2',
    sizeBytes: 3095033483,
    required: true
  },
  // Build oficial de ggml-org/whisper.cpp (release v1.9.2), CUDA 12.4 — mismo
  // runtime que ya usaba el .exe compilado a mano que faltaba en la laptop
  // (ver ROADMAP.md). En vez de mantener un binario propio sin mecanismo de
  // distribución, se usa el build público del proyecto upstream: mismo
  // whisper.cpp, mismo CUDA, publicado por ellos, sin que Tempest tenga que
  // compilar ni alojar nada. `type: 'zip-bundle'` le dice al downloader que
  // esto no es un archivo suelto: hay que bajar el .zip, extraerlo y dejar
  // whisper-cli.exe + sus .dll (cudart/cublas) juntos en whisper-bin/ — ver
  // model.downloader.service.js. sha256 y tamaño confirmados contra la
  // página de release de GitHub (releases/expanded_assets/v1.9.2) el
  // 2026-08-06 — NO se pudo verificar bajando el .zip en sí durante este
  // cambio porque el entorno usado para programarlo bloquea
  // release-assets.githubusercontent.com (el CDN real de los assets); el
  // hash es el que GitHub muestra en su propia página, no uno calculado
  // localmente. Confirmar con una descarga real antes de dar esto por
  // cerrado — ver DECISIONS.md.
  'whisper-cli': {
    url: 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-cublas-12.4.0-bin-x64.zip',
    sha256: '443110ddaad70d4290ab2e77179e31cf712035bbc4fad56bb4519a90c917b39c',
    sizeBytes: 671088640,
    required: true,
    type: 'zip-bundle',
    bundleMainFile: 'whisper-cli.exe'
  },

  // ── Resto de MODEL_FILES — fuente confirmada contra la API de Hugging Face
  // (lfs.oid de cada repo, no adivinado). El tamaño puede diferir en unos
  // pocos cientos de bytes del archivo local original del usuario (metadata
  // GGUF varía levemente entre versiones de llama.cpp usadas para cuantizar)
  // — no es un problema: el sha256 acá es el del ARCHIVO SERVIDO en esa URL,
  // así que la verificación post-descarga siempre es consistente consigo
  // misma. Ver DECISIONS.md para el detalle de qué repo se usó para cada uno.
  'hermes-q5': {
    url: 'https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q5_K_M.gguf',
    sha256: 'b2fb813afad50963f29a9e69cd844a02add63d6a29f965fef4e084fdd10075d3',
    sizeBytes: 5732987008,
    required: false
  },
  'qwen2.5-7b-q5': {
    url: 'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q5_K_M.gguf',
    sha256: '2e998d7e181c8756c5ffc55231b9ee1cdc9d3acec4245d6e27d32bd8e738c474',
    sizeBytes: 5444831936,
    required: false
  },
  'qwen2.5-14b-q3': {
    url: 'https://huggingface.co/bartowski/Qwen2.5-14B-Instruct-GGUF/resolve/main/Qwen2.5-14B-Instruct-Q3_K_M.gguf',
    sha256: '2f68ac3ba018f7de7641229f19adafde5e59d02bbf5651fdbcc510bb9f3facca',
    sizeBytes: 7339204736,
    required: false
  },
  'deepseek-coder-6.7b-q6': {
    // Cambiado de TheBloke a QuantFactory (v3.0, pruebas de julio 2026) —
    // el archivo de TheBloke generaba salida no confiable en Patch Mode
    // (diffs repetidos/sin sentido, cambios inventados). node-llama-cpp
    // marcaba el modelo con "missing pre-tokenizer type" y "GENERATION
    // QUALITY WILL BE DEGRADED" al cargarlo — conversión GGUF vieja
    // (TheBloke, repo inactivo) sin los metadatos de tokenizer que
    // versiones actuales de llama.cpp esperan. QuantFactory es una
    // reconversión más reciente del mismo modelo base, mismo Q6_K, mismo
    // nombre de archivo. Ver DECISIONS.md.
    url: 'https://huggingface.co/QuantFactory/deepseek-coder-6.7b-instruct-GGUF/resolve/main/deepseek-coder-6.7b-instruct.Q6_K.gguf',
    sha256: '432b8d797969ca87634a95662e89f2e10c9190d5f8ffc1d8691e7c31752bc2af',
    sizeBytes: 5531347936,
    required: false
  },
  'gemma-2-9b-q4': {
    url: 'https://huggingface.co/bartowski/gemma-2-9b-it-GGUF/resolve/main/gemma-2-9b-it-Q4_K_M.gguf',
    sha256: '13b2a7b4115bbd0900162edcebe476da1ba1fc24e718e8b40d32f6e300f56dfe',
    sizeBytes: 5761057728,
    required: false
  },
  'llama-3.1-8b-q5': {
    url: 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf',
    sha256: '14e10feba0c82a55da198dcd69d137206ad22d116a809926d27fa5f2398c69c7',
    sizeBytes: 5732992416,
    required: false
  },
  'llama-3.2-3b-q4': {
    url: 'https://huggingface.co/NousResearch/Hermes-3-Llama-3.2-3B-GGUF/resolve/main/Hermes-3-Llama-3.2-3B.Q4_K_M.gguf',
    sha256: '91776fe0f6cd7483d9d5e06162fdd1f8f0262c15ced269791b4d96a655e8a5a2',
    sizeBytes: 2019373888,
    required: false
  },
  'llama-3.2-3b-q8': {
    url: 'https://huggingface.co/NousResearch/Hermes-3-Llama-3.2-3B-GGUF/resolve/main/Hermes-3-Llama-3.2-3B.Q8_0.gguf',
    sha256: 'f0db8f3bc1f2479bedc72c2711a504e10f9c106f330517114f2844c67fb8230f',
    sizeBytes: 3421895488,
    required: false
  },
  'qwen2.5-coder-3b-q8': {
    url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/qwen2.5-coder-3b-instruct-q8_0.gguf',
    sha256: 'f648c25dfd5a0870c4ad76724a745124ab5667ff97b664534fcbe46089b75ab8',
    sizeBytes: 3616088512,
    required: false
  },
  'qwen2.5-3b-q4': {
    url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    sha256: '626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d',
    sizeBytes: 2104932768,
    required: false
  },
  'qwen2.5-3b-q5': {
    url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q5_k_m.gguf',
    sha256: '2c63dde5f2c9ab1fd64d47dee2d34dade6ba9ff62442d1d20b5342310c982081',
    sizeBytes: 2438740384,
    required: false
  },
  'qwen2.5-vl-7b-q4': {
    url: 'https://huggingface.co/unsloth/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf',
    sha256: 'd16776dcd9a28d42758c2958ed3a752aabf20a305252cd64ff2be72b4a78c503',
    sizeBytes: 4683072384,
    required: false
  },
  'llava-1.6': {
    url: 'https://huggingface.co/cjpais/llava-1.6-mistral-7b-gguf/resolve/main/llava-v1.6-mistral-7b.Q4_K_M.gguf',
    sha256: '4bd1bc95c4db74f8140ee520e76d1f83e063d3fde9c3723eaa4a4776785a7aa6',
    sizeBytes: 4368439552,
    required: false
  },
  // ── Función "razonamiento"/"análisis" para laptop — pedido explícito del
  // usuario tras notar que Breeze no tenía equivalente a lo que Storm cubre
  // con qwen2.5-7b-q5 (Razonamiento) y gemma-2-9b-q4/qwen2.5-14b-q3
  // (Análisis/Análisis profundo). Fuente y sha256 confirmados contra la API
  // de Hugging Face (lfs.oid), igual que el resto del catálogo. Ver
  // DECISIONS.md → "Modelos de razonamiento/análisis para Breeze (laptop)".
  'phi-4-mini-reasoning': {
    url: 'https://huggingface.co/bartowski/microsoft_Phi-4-mini-reasoning-GGUF/resolve/main/microsoft_Phi-4-mini-reasoning-Q4_K_M.gguf',
    sha256: 'ce8becd58f350d8ae0ec3bbb201ab36f750ffab17ab6238f39292d12ab68ea06',
    sizeBytes: 2491874848,
    required: false
  },
  'qwen3-8b': {
    url: 'https://huggingface.co/bartowski/Qwen_Qwen3-8B-GGUF/resolve/main/Qwen_Qwen3-8B-Q4_K_M.gguf',
    sha256: '54fffa050078e984116639c83dfb64b5aa6d4cd474e018b076777c632bbccccd',
    sizeBytes: 5027784224,
    required: false
  },
  // ── Proyectores de visión (ver nota en EXTRA_MODELS) ──
  // llava: sha256 confirmado por partida doble — la API de HF (lfs.sha256) y
  // el hash calculado sobre el archivo que ya está en la máquina de
  // desarrollo, donde el pipeline de visión funciona de punta a punta.
  // Coinciden, así que la URL sirve exactamente el mismo archivo probado.
  'llava-1.6-mmproj': {
    url: 'https://huggingface.co/cjpais/llava-1.6-mistral-7b-gguf/resolve/main/mmproj-model-f16.gguf',
    sha256: '00205ee8a0d7a381900cd031e43105f86aa0d8c07bf329851e85c71a26632d16',
    sizeBytes: 624451168,
    required: false
  },
  // qwen: se toma el mmproj de unsloth a propósito — los pesos de
  // `qwen2.5-vl-7b-q4` de arriba también son de unsloth, y proyector y pesos
  // tienen que venir de la misma cuantización/repo para ser compatibles. El
  // nombre de destino (`mmproj-Qwen_...-f16.gguf`) conserva la convención de
  // nombres que ya usaba el archivo local; el downloader guarda con el nombre
  // de EXTRA_MODELS, no con el de la URL.
  'qwen2.5-vl-7b-q4-mmproj': {
    url: 'https://huggingface.co/unsloth/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/mmproj-F16.gguf',
    sha256: '987dd0733033fb5dd9b124d1ca926ae865572e432384eee7618b2eec3e735e17',
    sizeBytes: 1354163040,
    required: false
  }
};

function resolveCatalogPath(modelId) {
  if (EXTRA_MODELS[modelId]) return EXTRA_MODELS[modelId].resolvePath();
  return resolveModelPath(modelId);
}

function getAllModelIds() {
  return [...getKnownModelIds(), ...Object.keys(EXTRA_MODELS)];
}

function getDownloadInfo(modelId) {
  return DOWNLOAD_INFO[modelId] || { url: null, sha256: null, sizeBytes: null, required: false };
}

// ─── Modelos que no participan de ningún alias de capability.matrix.js (no
// pasan por el router automático, son solo selección manual o legacy) — se
// clasifican a mano acá. 'both' = visible/descargable en cualquier perfil,
// nunca se oculta nada por precaución (mejor mostrar de más que esconder un
// modelo que el usuario ya bajó).
const UNMATRIXED_PROFILE_TAGS = {
  'llama-3.2-3b-q4': 'laptop',    // dedicado a generateTitleFromText en laptop (títulos) — no es un 4to modelo general, confirmado con el usuario, ver DECISIONS.md
  'llama-3.2-3b-q8': 'laptop',    // selección manual, ver MODEL_PROFILES.laptop en frontend/modules/models.js
  'qwen-coder-14b-q4': 'desktop', // 14B, solo viable con VRAM de desktop
  'phi-4-mini-reasoning': 'laptop', // selección manual, función "Razonamiento" en laptop
  'qwen3-8b': 'laptop',              // selección manual, función "Análisis" en laptop
};

// A qué perfil de hardware pertenece un modelo — usado por el panel de
// Configuración → Modelos para mostrar solo lo relevante a la máquina activa.
function getModelProfile(modelId) {
  if (modelId === 'whisper-large-v3' || modelId === 'whisper-cli') return 'both'; // transcripción no depende del perfil de chat
  if (UNMATRIXED_PROFILE_TAGS[modelId]) return UNMATRIXED_PROFILE_TAGS[modelId];

  // Un acompañante (hoy: mmproj) hereda el perfil de su modelo padre en vez de
  // clasificarse solo. Si no, caería en el 'both' de más abajo y "Descargar
  // todos" en una laptop encolaría el proyector de 1.3 GB del modelo de visión
  // de desktop, que ni siquiera se muestra en el panel filtrado. Y si el padre
  // cambia de perfil algún día, el acompañante lo sigue sin tocar nada.
  const parent = Object.keys(COMPANION_MODELS).find((p) => COMPANION_MODELS[p].includes(modelId));
  if (parent) return getModelProfile(parent);

  const inDesktop = getAvailableModelIds('desktop').includes(modelId);
  const inLaptop = getAvailableModelIds('laptop').includes(modelId);
  if (inDesktop && inLaptop) return 'both';
  if (inDesktop) return 'desktop';
  if (inLaptop) return 'laptop';
  return 'both'; // desconocido — no ocultar, mejor de más que de menos
}

// ─── Los únicos modelos que bloquean el primer arranque: el modelo de chat
// "general-fast" del perfil activo (mismo alias que ya usa el model router
// para conversación rápida — hermes-q4 en desktop, qwen2.5-3b-q4 en laptop)
// + Whisper, que es igual para los dos perfiles. Todo lo demás queda para el
// panel de descarga manual, sin bloquear nada.
function getRequiredModelIdsForProfile(profile = 'desktop') {
  const chatModelId = resolveCapability('general-fast', profile).modelId;
  // whisper-cli: el ejecutable, junto con whisper-large-v3 (el modelo) —
  // ambos requeridos para que la transcripción funcione en un clon nuevo del
  // proyecto sin pasos manuales. Ver DECISIONS.md.
  return [chatModelId, 'whisper-large-v3', 'whisper-cli'];
}

// Compatibilidad hacia atrás — cualquier caller que no pase perfil sigue
// obteniendo el comportamiento de siempre (desktop).
function getRequiredModelIds(profile = 'desktop') {
  return getRequiredModelIdsForProfile(profile);
}

function isRequiredForProfile(modelId, profile = 'desktop') {
  return getRequiredModelIdsForProfile(profile).includes(modelId);
}

// Nombre para mostrar cuando el modelId solo no se entiende. El panel de
// Modelos lista el modelId crudo, que para los modelos de chat está bien
// (`hermes-q4` es el nombre real), pero "llava-1.6-mmproj" no le dice nada a
// nadie que no sepa qué es un proyector multimodal — y es justamente el
// archivo que un usuario nuevo tiene que reconocer para que el análisis de
// imágenes funcione.
// Primera redacción: "llava-1.6 — proyector de visión". Se leía como si fuera
// otra descarga DE llava-1.6, y al lado del modelo real (4,1 GB) un archivo de
// 595 MB con el mismo nombre parecía un error. Lo reportó el usuario apenas lo
// vio en pantalla. La etiqueta tiene que dejar claro las dos cosas de una:
// que es un complemento, y que no sustituye al modelo.
const MODEL_LABELS = {
  'llava-1.6-mmproj': 'Complemento de visión para llava-1.6 (se suma al modelo, no lo reemplaza)',
  'qwen2.5-vl-7b-q4-mmproj': 'Complemento de visión para qwen2.5-vl-7b-q4 (se suma al modelo, no lo reemplaza)'
};

// Modelos que solo sirven para analizar imágenes. Se agrupan aparte para que
// el panel los muestre al final, separados de los de chat: son opcionales, y
// además son TRES pasos distintos que un usuario nuevo confunde fácil (los
// pesos, el complemento de visión, y el registro en Ollama). Mezclados entre
// los modelos generales parecían más de lo mismo.
const VISION_MODEL_IDS = new Set([
  'llava-1.6', 'llava-1.6-mmproj',
  'qwen2.5-vl-7b-q4', 'qwen2.5-vl-7b-q4-mmproj'
]);

function getCatalogEntry(modelId, profile = 'desktop') {
  const info = getDownloadInfo(modelId);
  return {
    modelId,
    label: MODEL_LABELS[modelId] || modelId,
    group: VISION_MODEL_IDS.has(modelId) ? 'vision' : 'general',
    filename: path.basename(resolveCatalogPath(modelId)),
    path: resolveCatalogPath(modelId),
    required: isRequiredForProfile(modelId, profile),
    sizeBytes: info.sizeBytes,
    hasSource: !!info.url,
    profile: getModelProfile(modelId)
  };
}

// profile es opcional a propósito — sin él, `required` cae al comportamiento
// desktop de siempre. Pásalo para que el panel filtre por la máquina activa.
function getCatalog(profile = 'desktop') {
  return getAllModelIds().map((id) => getCatalogEntry(id, profile));
}

module.exports = {
  getCatalog,
  getCatalogEntry,
  getCompanionModelIds,
  getDownloadInfo,
  getRequiredModelIds,
  getRequiredModelIdsForProfile,
  isRequiredForProfile,
  getModelProfile,
  resolveCatalogPath,
  getAllModelIds
};
