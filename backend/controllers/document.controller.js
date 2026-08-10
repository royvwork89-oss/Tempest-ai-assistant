const fs = require('fs');
const path = require('path');
const { generateTitleFromText, resolveModelPath } = require('../services/localai.service');
const llamaProvider = require('../services/localai/llama.provider');
// Misma fuente única de verdad que ya usa chat.controller.js
// (getHardwareProfile: readHardwareProfile) — lee el perfil persistido en
// cada request, NUNCA el que manda el frontend en config.hardwareProfile.
// Ver bug real de abajo.
const { getHardwareProfile: readHardwareProfile } = require('../services/settings.service');

const {
  buildDocumentPrompt,
  createDocumentFile,
  getDocumentPath,
  documentExists,
  normalizeFormat
} = require('../services/document.service');

function getFallbackDocumentModel(hardwareProfile = 'laptop') {
  if (hardwareProfile === 'desktop') return 'hermes-q5';
  return 'qwen2.5-3b-q4';
}

// BUG REAL, encontrado en pruebas de v3.0.0: esta función le pegaba por HTTP a
// `127.0.0.1:8080/v1/chat/completions` — un servidor LocalAI que ya no existe
// en este proyecto (quedó de una versión anterior a la migración a
// node-llama-cpp embebido; lo único que corre en Docker hoy es SearXNG, en
// otro puerto). Resultado real: generar un documento por chat fallaba SIEMPRE,
// para cualquier usuario, con cualquier modelo, con "Error interno al generar
// documento" — sin relación con si el modelo estaba o no descargado. Ver
// DECISIONS.md.
//
// Fix: mismo motor en proceso que ya usa el resto de la app
// (localai.service.js → llama.provider.js), en vez de un servidor HTTP que no
// existe. Se verifica el .gguf en disco ANTES de intentar cargarlo (en vez de
// esperar a que node-llama-cpp tire un error y tener que adivinar su forma)
// para poder dar el mismo mensaje de "modelo no descargado" que ya usa el
// chat normal.
async function generateDocumentContent({ prompt, format, model }) {
  const documentPrompt = buildDocumentPrompt({
    prompt,
    format
  });

  const modelPath = resolveModelPath(model);
  if (!fs.existsSync(modelPath)) {
    const err = new Error(`Modelo "${model}" no descargado en ${modelPath}`);
    err.code = 'MODEL_NOT_DOWNLOADED';
    err.modelId = model;
    throw err;
  }

  if (modelPath !== llamaProvider.getActiveModel()) {
    await llamaProvider.switchModel(modelPath);
  }

  const reply = await llamaProvider.generate([
    {
      role: 'system',
      content: [
        'Eres un redactor profesional de documentos en español.',
        'Escribe documentos claros, limpios y bien formateados.',
        'Usa ortografía correcta, acentos correctos y puntuación correcta.',
        'Usa párrafos separados con líneas en blanco.',
        'No repitas instrucciones.',
        'No copies literalmente la petición del usuario.',
        'No uses markdown.',
        'No uses bloques de código.',
        'No agregues palabras sueltas al final.',
        'Responde solo con el contenido final del documento.'
      ].join('\n')
    },
    {
      role: 'user',
      content: documentPrompt
    }
  ], {
    temperature: 0,
    maxTokens: 900
  });

  return reply || '';
}

async function generateDocument(req, res) {
  try {
    const {
      prompt,
      format = 'txt',
      config = {}
    } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'La instrucción del documento está vacía'
      });
    }

    const finalFormat = normalizeFormat(format);

    // BUG REAL, encontrado probando el fix de arriba en la app real: dos
    // problemas separados hacían que esto SIEMPRE terminara cargando
    // hermes-q4 (8B), un modelo demasiado grande para la VRAM de esta
    // laptop, con "InsufficientMemoryError: A context size of 4096 is too
    // large for the available VRAM".
    //
    // 1. `config.primaryModel` casi siempre es el string literal `"auto"` —
    //    es el valor por defecto que manda el frontend para "que decida el
    //    router". chat.controller.js SÍ contempla ese caso (`resolvedModel
    //    === 'auto'` → resuelve con resolveCapability/hardwareProfile), pero
    //    acá `"auto" || fallback` nunca cae al fallback porque el string
    //    "auto" es truthy — se le pasaba "auto" tal cual a
    //    `resolveModelPath()`, que no lo reconoce y cae a un default propio
    //    (hermes-q4, ver `[llama] Modelo desconocido: "auto"` en el log).
    //
    // 2. `config.hardwareProfile` es el mismo campo inerte ya documentado en
    //    ROADMAP.md ("Log [CONFIG] con hardwareProfile inerte") — lo manda el
    //    frontend en el payload pero no refleja el perfil real activo
    //    (`getHardwareProfile()`, backend). Si se llegara a usar para elegir
    //    el modelo de fallback, se corre el mismo riesgo: perfil equivocado →
    //    modelo demasiado grande para el hardware real.
    //
    // Fix: tratar "auto" (o vacío) como "sin preferencia" y resolver el
    // fallback con el perfil real del backend, no el del payload.
    const hasExplicitModel = config.primaryModel && config.primaryModel !== 'auto';
    const selectedModel = hasExplicitModel
      ? config.primaryModel
      : getFallbackDocumentModel(readHardwareProfile());

    console.log('MODELO DOCUMENTO USADO:', selectedModel);

    const content = await generateDocumentContent({
      prompt,
      format: finalFormat,
      model: selectedModel
    });

    const generatedTitle = await generateTitleFromText(
      prompt,
      'document',
      selectedModel
    );

    const documentFile = await createDocumentFile({
      title: generatedTitle || 'Documento Tempest',
      content,
      format: finalFormat
    });

    return res.json({
      ok: true,
      document: documentFile
    });

  } catch (error) {
    console.error('Error generando documento:', error);

    // Mismo mensaje que ya usa el chat normal (chat.controller.js) para el
    // caso de modelo no descargado — consistencia entre las dos funciones que
    // dependen de un .gguf que el usuario todavía no bajó.
    const userFacingError = error.code === 'MODEL_NOT_DOWNLOADED'
      ? `El modelo "${error.modelId || ''}" todavía no está descargado. Andá a Configuración → Modelos para descargarlo.`
      : 'Error interno al generar documento';

    return res.status(500).json({
      ok: false,
      error: userFacingError
    });
  }
}

function viewDocument(req, res) {
  try {
    const { filename } = req.params;

    if (!documentExists(filename)) {
      return res.status(404).send('Documento no encontrado');
    }

    const filePath = getDocumentPath(filename);
    const ext = path.extname(filename).toLowerCase();

    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      return res.sendFile(filePath);
    }

    if (ext === '.txt') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.sendFile(filePath);
    }

    if (ext === '.docx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      return res.sendFile(filePath);
    }

    return res.sendFile(filePath);

  } catch (error) {
    console.error('Error mostrando documento:', error);
    return res.status(500).send('Error mostrando documento');
  }
}

function downloadDocument(req, res) {
  try {
    const { filename } = req.params;

    if (!documentExists(filename)) {
      return res.status(404).send('Documento no encontrado');
    }

    const filePath = getDocumentPath(filename);

    return res.download(filePath, filename);

  } catch (error) {
    console.error('Error descargando documento:', error);
    return res.status(500).send('Error descargando documento');
  }
}

module.exports = {
  generateDocument,
  viewDocument,
  downloadDocument
};