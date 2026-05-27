const CODE_EXTENSIONS = new Set([
    'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'cs',
    'php', 'rb', 'go', 'rs', 'sh', 'bash', 'sql', 'json', 'yaml',
    'yml', 'toml', 'env', 'ini', 'xml', 'html', 'css', 'scss', 'md'
]);

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
    'generame un dif', 'generame un diff'function detectMode({ rawMessage, files, configMode }) {
  console.log('[detectMode] rawMessage:', rawMessage);genera un dif', 'hazme un diff', 'hazme un dif'
];

const READ_TRIGGERS = [
    'resume', 'resumen', 'analiza', 'analisis', 'que dice', 'que contiene',
    'lee ', 'leer', 'revisa', 'revision', 'extrae', 'extraccion',
    'traduce', 'traduccion', 'interpreta'
];

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

/**
 * Detecta el modo de respuesta según el mensaje y los archivos adjuntos.
 * @param {Object} params
 * @param {string} params.rawMessage
 * @param {Array}  params.files        — array de objetos multer (req.files)
 * @param {string} params.configMode   — override manual desde el frontend
 * @returns {{ mode: 'coder'|'explain'|'general', variant: 'strict'|'hybrid'|null, reason: string }}
 */
function detectMode({ rawMessage = '', files = [], configMode = null } = {}) {

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
    const hasText = text.length > 0 && text !== DEFAULT_MESSAGE;
    const codeFiles = hasFiles ? files.filter(f => isCodeFile(f.originalname)) : [];
    const hasCodeFiles = codeFiles.length > 0;

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