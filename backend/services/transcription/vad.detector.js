/**
 * VAD Detector — interfaz reemplazable
 *
 * Motor actual: ffmpeg silencedetect
 * Reemplazable por: @silero-vad, node-vad, u otro motor
 * sin tocar transcription.service.js
 *
 * Contrato de salida:
 *   detectSilencePoints(audioPath, duration) → Promise<number[]>
 *   Lista de timestamps (en segundos) donde conviene cortar.
 *   Si devuelve [] → el caller usa fallback por tiempo fijo.
 */

const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// Silencio detectado si dura >= SILENCE_DURATION segundos
// y el volumen cae por debajo de SILENCE_THRESHOLD dB
const SILENCE_DURATION = 0.8;   // segundos
const SILENCE_THRESHOLD = -35;  // dB (ajustar si el audio tiene ruido de fondo)

// Fragmentos resultantes: mínimo y máximo en segundos
const MIN_CHUNK_SECONDS = 20;
const MAX_CHUNK_SECONDS = 90;

/**
 * Extrae los puntos de corte por silencio usando ffmpeg silencedetect.
 * @param {string} audioPath
 * @param {number} duration  duración total del audio en segundos
 * @returns {Promise<number[]>} timestamps donde cortar (vacío = fallback)
 */
async function detectSilencePoints(audioPath, duration) {
  let stderr;

  try {
    // silencedetect escribe en stderr, no en stdout
    const result = await execFileAsync('ffmpeg', [
      '-i', audioPath,
      '-af', `silencedetect=noise=${SILENCE_THRESHOLD}dB:d=${SILENCE_DURATION}`,
      '-f', 'null',
      '-'
    ], { maxBuffer: 10 * 1024 * 1024 });

    stderr = result.stderr;
  } catch (err) {
    // ffmpeg siempre lanza error cuando el output es /dev/null
    // el resultado real está en err.stderr
    stderr = err.stderr || '';
  }

  const cutPoints = parseSilencePoints(stderr, duration);

  console.log(`[VAD] Detectados ${cutPoints.length} puntos de corte por silencio`);

  return cutPoints;
}

/**
 * Parsea la salida de silencedetect y elige los puntos de corte.
 * Filtra silencios demasiado juntos (< MIN_CHUNK_SECONDS desde el corte anterior)
 * y fuerza un corte si un fragmento supera MAX_CHUNK_SECONDS.
 */
function parseSilencePoints(stderr, duration) {
  // silence_end marca el momento donde termina el silencio (audio reanuda)
  // Es el mejor punto para cortar: el fragmento anterior ya terminó
  const silenceEndRegex = /silence_end:\s*([\d.]+)/g;
  const candidates = [];
  let match;

  while ((match = silenceEndRegex.exec(stderr)) !== null) {
    candidates.push(parseFloat(match[1]));
  }

  if (candidates.length === 0) {
    return [];
  }

  // Filtrar candidatos respetando MIN y MAX por fragmento
  const cutPoints = [];
  let lastCut = 0;

  for (const ts of candidates) {
    const sinceLastCut = ts - lastCut;

    if (sinceLastCut < MIN_CHUNK_SECONDS) continue;  // fragmento demasiado corto
    if (sinceLastCut > MAX_CHUNK_SECONDS) {
      // Forzar corte intermedio para no exceder el máximo
      const forcedCut = lastCut + MAX_CHUNK_SECONDS;
      cutPoints.push(forcedCut);
      lastCut = forcedCut;
    }

    cutPoints.push(ts);
    lastCut = ts;
  }

  // Si queda un tramo final muy largo, forzar corte
  if (duration - lastCut > MAX_CHUNK_SECONDS) {
    let forcedCut = lastCut + MAX_CHUNK_SECONDS;
    while (forcedCut < duration - MIN_CHUNK_SECONDS) {
      cutPoints.push(forcedCut);
      forcedCut += MAX_CHUNK_SECONDS;
    }
  }

  return cutPoints;
}

module.exports = { detectSilencePoints };