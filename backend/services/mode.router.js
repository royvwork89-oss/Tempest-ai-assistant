const CODE_EXTENSIONS = new Set([
    'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'cs',
    'php', 'rb', 'go', 'rs', 'sh', 'bash', 'sql', 'json', 'yaml',
    'yml', 'toml', 'env', 'ini', 'xml', 'html', 'css', 'scss', 'md'
]);

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif']);

const EXPLAIN_TRIGGERS = [
    'explicame', 'explica', 'que es', 'que son', 'como funciona',
    'como funcionan', 'cuentame', 'describeme', 'describe',
    'en que consiste', 'para que sirve', 'para que sirven',
    'que significa', 'defineme', 'define ', 'por que', 'diferencia entre',
    'concepto', 'teoria', 'que hace', 'como se usa', 'como se usan'
];

const CODER_STRICT_TRIGGERS = [
    'implementa', 'implementame', 'crea', 'genera', 'haz ', 'dame el codigo',
    'dame los archivos', 'escribe', 'construye', 'desarrolla', 'programa',
    'refactoriza', 'corrige', 'arregla', 'agrega', 'añade', 'modifica',
    'actualiza', 'endpoint', 'ruta ', 'función', 'funcion', 'clase ',
    'componente', 'archivo ', 'archivos '
];

const PATCH_TRIGGERS = [
    'solo el cambio', 'solo los cambios', 'en formato patch', 'en formato diff',
    'dame el diff', 'dame el patch', 'patch de', 'diff de',
    'sin repetir el archivo', 'sin reescribir', 'cambio puntual',
    'cambio quirurgico', 'cambio quirúrgico', 'edita solo', 'modifica solo',
    'generame un dif', 'generame un diff', 'dame un diff', 'dame un dif',
    'genera un diff', 'genera un dif', 'hazme un diff', 'hazme un dif'
];

const READ_TRIGGERS = [
    'resume', 'resumen', 'analiza', 'analisis', 'que dice', 'que contiene',
    'lee ', 'leer', 'revisa', 'revision', 'extrae', 'extraccion',
    'traduce', 'traduccion', 'interpreta'
];

// Verbos de modificación de archivo existente (sin frase mágica de patch).
// Subconjunto de CODER_STRICT_TRIGGERS — acá importa la intención de EDITAR
// algo que ya existe, no de crear código nuevo.
const MODIFY_VERBS = [
    'corrige', 'corrigeme', 'arregla', 'arreglame', 'modifica', 'modificame',
    'actualiza', 'actualizame', 'soluciona', 'solucioname', 'repara', 'reparame'
];

// Detecta mención de un archivo existente por nombre + extensión de código
// (ej. "archivo.js", "utils.py"). Reusa el mismo criterio de extensión que
// CODE_EXTENSIONS, en forma de regex para buscarlo dentro del texto libre.
const FILE_MENTION_REGEX = /\b[\w-]+\.(js|ts|jsx|tsx|py|java|c|cpp|h|cs|php|rb|go|rs|sh|bash|sql|json|yaml|yml|toml|html|css|scss)\b/;

function normalize(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function isCodeFile(filename) {
    const ext = String(filename || '').split('.').pop().toLowerCase();
    return CODE_EXTENSIONS.has(ext);
}

function isImageFile(filename) {
    const ext = String(filename || '').split('.').pop().toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
}

function hasPatchTrigger(text) {
    return PATCH_TRIGGERS.some(t => text.includes(t));
}

function hasStrictCodeTrigger(text) {
    return CODER_STRICT_TRIGGERS.some(t => text.includes(t));
}

function hasExplainTrigger(text) {
    return EXPLAIN_TRIGGERS.some(t => text.includes(t));
}

function hasReadTrigger(text) {
    return READ_TRIGGERS.some(t => text.includes(t));
}

function hasModifyVerb(text) {
    return MODIFY_VERBS.some(v => text.includes(v));
}

function mentionsExistingFile(text) {
    return FILE_MENTION_REGEX.test(text);
}

/**
 * Detecta el modo de respuesta según el mensaje y los archivos adjuntos.
 * @param {Object} params
 * @param {string} params.rawMessage
 * @param {Array}  params.files        — array de objetos multer (req.files)
 * @param {string} params.configMode   — override manual desde el frontend
 * @param {boolean} params.hasProjectContext — true si el proyecto tiene snapshot o
 *        carpeta vinculada habilitados (hay contenido real para armar un patch)
 * @param {boolean} params.hasSemanticPatchMatch — true si chat.controller.js ya
 *        resolvió (vía resolvePatchIntent, embeddings) que el mensaje se relaciona
 *        con contenido real del snapshot por encima del umbral de confianza —
 *        "modo Proyecto": no hace falta verbo ni nombre de archivo explícito.
 * @returns {{ mode: 'coder'|'explain'|'general', variant: 'strict'|'hybrid'|null, reason: string }}
 */
function detectMode({ rawMessage = '', files = [], configMode = null, hasProjectContext = false, hasSemanticPatchMatch = false } = {}) {

    // 1. Override manual del frontend
    if (configMode && ['coder', 'explain', 'general', 'coder/patch'].includes(configMode)) {
        if (configMode === 'coder/patch') {
            return { mode: 'coder', variant: 'patch', reason: 'override manual patch' };
        }
        return { mode: configMode, variant: configMode === 'coder' ? 'strict' : null, reason: 'override manual' };
    }

    const DEFAULT_MESSAGE = 'analiza los archivos adjuntos.';
    const text = normalize(rawMessage);
    const hasFiles = files.length > 0;

    // 1b. Patch trigger — prioridad sobre strict
    if (hasPatchTrigger(text)) {
        return { mode: 'coder', variant: 'patch', reason: 'patch trigger explícito' };
    }

    // 1c. Modo Proyecto — intención de edición detectada por relevancia
    // semántica del snapshot (sin verbo ni nombre de archivo explícito). Esto
    // es lo que permite pedidos puramente funcionales como "quiero que el
    // botón Copiar también copie el Markdown". Si chat.controller.js no
    // encontró relación semántica clara, este flag viene en false y el
    // mensaje sigue el flujo normal — nunca fuerza patch a ciegas.
    if (hasSemanticPatchMatch) {
        return { mode: 'coder', variant: 'patch', reason: 'intención de edición detectada por relevancia semántica del snapshot' };
    }

    // 1d. Edición implícita de archivo existente por texto — sin frase mágica
    // ni embeddings, solo verbo de modificación + nombre de archivo mencionado.
    // Queda como red de respaldo cuando el proyecto todavía no tiene
    // embeddings generados (snapshot recién creado, en background).
    if (hasProjectContext && hasModifyVerb(text) && mentionsExistingFile(text)) {
        return { mode: 'coder', variant: 'patch', reason: 'edición de archivo existente detectada automáticamente (texto)' };
    }

    const hasText = text.length > 0 && text !== DEFAULT_MESSAGE;
    const codeFiles  = hasFiles ? files.filter(f => isCodeFile(f.originalname))  : [];
    const imageFiles = hasFiles ? files.filter(f => isImageFile(f.originalname)) : [];
    const hasCodeFiles  = codeFiles.length > 0;
    const hasImageFiles = imageFiles.length > 0;

    // 1e. Solo imágenes (sin texto o sin código) — modo visual
    if (hasImageFiles && !hasCodeFiles) {
        return { mode: 'visual', variant: null, reason: 'adjunto de imagen sin código' };
    }

    // 2. Sin texto + adjuntos
    if (!hasText && hasFiles) {
        if (hasCodeFiles) {
            return { mode: 'coder', variant: 'strict', reason: 'adjunto de código sin texto' };
        }
        return { mode: 'explain', variant: null, reason: 'adjunto no-código sin texto' };
    }

    // 3. Adjuntos + verbo técnico
    if (hasFiles && hasStrictCodeTrigger(text)) {
        return { mode: 'coder', variant: 'strict', reason: 'adjunto + verbo técnico' };
    }

    // 4. Adjuntos + verbo de lectura
    if (hasFiles && hasReadTrigger(text)) {
        return { mode: 'explain', variant: null, reason: 'adjunto + verbo de lectura' };
    }

    // 5. Trigger mixto: código explícito + explicación
    if (hasStrictCodeTrigger(text) && hasExplainTrigger(text)) {
        return { mode: 'coder', variant: 'hybrid', reason: 'trigger mixto: explicación + código explícito' };
    }

    // 6. Explicación fuerte + tecnología mencionada (sin código explícito)
    if (hasExplainTrigger(text)) {
        return { mode: 'explain', variant: null, reason: 'trigger de explicación' };
    }

    // 7. Solo código
    if (hasStrictCodeTrigger(text)) {
        return { mode: 'coder', variant: 'strict', reason: 'trigger de código' };
    }

    // 8. Default
    return { mode: 'general', variant: null, reason: 'default' };
}

module.exports = { detectMode };