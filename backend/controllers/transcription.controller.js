const { processAudioTranscription } = require('../services/transcription.service');

async function transcribeAudio(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: 'No se recibió ningún archivo de audio'
      });
    }

    const transcription = await processAudioTranscription(req.file.path, {
      mode: req.body.mode || 'plain',
      format: req.body.format || 'txt'
    });

    return res.json({
      ok: true,
      transcription
    });
  } catch (error) {
    console.error('Error al transcribir audio:', error);

    // Mismo mensaje que chat y documentos para el caso de un modelo/binario
    // requerido que no está en disco — ver transcription.service.js.
    const userFacingError = error.code === 'MODEL_NOT_DOWNLOADED'
      ? `El modelo "${error.modelId || ''}" todavía no está descargado. Andá a Configuración → Modelos para descargarlo.`
      : 'Error al transcribir el audio';

    return res.status(500).json({
      ok: false,
      error: userFacingError
    });
  }
}

module.exports = {
  transcribeAudio
};