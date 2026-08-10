const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { detectSilencePoints } = require('./transcription/vad.detector');
const { UPLOADS_DIR, OUTPUTS_DIR } = require('../config/appPaths');

// Rutas del motor whisper.cpp standalone — binario estático que viene con la
// instalación, no dato escribible, así que sigue relativo a __dirname.
const WHISPER_BIN = path.join(__dirname, '../../whisper-bin/whisper-cli.exe');
const WHISPER_MODEL = path.join(process.env.MODELS_DIR, 'whisper', 'ggml-large-v3.bin');

// Antes: se invocaba 'ffmpeg'/'ffprobe' por nombre, dependiendo de que ya
// estuvieran instalados y en el PATH del sistema — a diferencia de Whisper,
// nunca venían empaquetados con Tempest. En una instalación limpia (sin
// ffmpeg preinstalado, el caso normal para casi cualquier usuario de
// Windows) la transcripción fallaba por completo con `spawn ffprobe ENOENT`,
// con un mensaje que encima apuntaba a "Whisper" en vez de a la causa real.
// Encontrado en pruebas de v3.0.0 (Punto 4 del checklist de laptop). Fix:
// mismo patrón que WHISPER_BIN — binarios propios en `ffmpeg-bin/`,
// empaquetados automáticamente con el resto de la app (no están en la lista
// de exclusiones de `files` en package.json, a diferencia de
// `models-localai/`). Ver DECISIONS.md.
const FFMPEG_BIN = path.join(__dirname, '../../ffmpeg-bin/ffmpeg.exe');
const FFPROBE_BIN = path.join(__dirname, '../../ffmpeg-bin/ffprobe.exe');
const WHISPER_LANG = 'es';
const CHUNK_SECONDS = 60; // 1 minuto
const OVERLAP_SECONDS = 5;
const chunksBaseDir = path.join(UPLOADS_DIR, 'chunks');
const outputsDir = path.join(OUTPUTS_DIR, 'transcriptions');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun } = require('docx');

async function getAudioDuration(audioPath) {
  const { stdout } = await execFileAsync(FFPROBE_BIN, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath
  ]);

  return Number(stdout.trim());
}

/**
 * Crea fragmentos de audio usando VAD (corte por silencio real).
 * Fallback automático a corte por tiempo fijo si VAD no detecta silencios.
 * Devuelve array de { path, startTime } para timestamps precisos.
 */
async function createChunks(audioPath, sessionDir) {
  await fsp.mkdir(sessionDir, { recursive: true });

  const duration = await getAudioDuration(audioPath);

  // Intentar corte por silencio real
  const silencePoints = await detectSilencePoints(audioPath, duration);

  // Construir segmentos: lista de { start, end }
  let segments;

  if (silencePoints.length > 0) {
    console.log('[VAD] Usando corte por silencio real');
    const boundaries = [0, ...silencePoints, duration];
    segments = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      segments.push({ start: boundaries[i], end: boundaries[i + 1] });
    }
  } else {
    console.log('[VAD] Sin silencios detectados — fallback a corte por tiempo fijo');
    segments = [];
    let start = 0;
    while (start < duration) {
      const end = Math.min(start + CHUNK_SECONDS + OVERLAP_SECONDS, duration);
      segments.push({ start, end });
      start += CHUNK_SECONDS;
    }
  }

  const chunks = [];

  for (let i = 0; i < segments.length; i++) {
    const { start, end } = segments[i];
    const length = end - start;
    if (length <= 0) continue;

    const outputPath = path.join(
      sessionDir,
      `chunk-${String(i + 1).padStart(3, '0')}.wav`
    );

    await execFileAsync(FFMPEG_BIN, [
      '-y',
      '-ss', String(start),
      '-i', audioPath,
      '-t', String(length),
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'pcm_s16le',
      outputPath
    ]);

    // Guardar startTime real para timestamps precisos
    chunks.push({ path: outputPath, startTime: start });
  }

  return chunks;
}

/**
 * Transcribe un chunk WAV usando whisper.cpp standalone via execFile.
 * Motor reemplazable — mismo patrón que ffmpeg.
 * @param {string|{path:string, startTime:number}} chunkPath
 * @returns {Promise<string>}
 */
async function transcribeChunk(chunkPath) {
  const filePath = typeof chunkPath === 'object' ? chunkPath.path : chunkPath;

  // whisper-cli genera un archivo .txt junto al WAV si usamos -otxt
  // Usamos -of para controlar el nombre exacto del output
  const outputBase = filePath.replace(/\.wav$/i, '');

  await execFileAsync(WHISPER_BIN, [
    '-m', WHISPER_MODEL,
    '-f', filePath,
    '-l', WHISPER_LANG,
    '--no-prints',
    '-otxt',
    '-of', outputBase
  ], { maxBuffer: 10 * 1024 * 1024 });

  // Leer el .txt generado por whisper
  const txtPath = outputBase + '.txt';
  const text = await fsp.readFile(txtPath, 'utf8');

  // Limpiar el archivo .txt temporal
  await fsp.rm(txtPath, { force: true }).catch(() => {});

  return text.trim();
}

function formatTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return [hrs, mins, secs]
    .map(unit => String(unit).padStart(2, '0'))
    .join(':');
}

/**
 * @param {Array<{ text: string, startTime: number }>} parts
 */
function mergeTranscriptionsWithTimestamps(parts) {
  return parts
    .map(({ text, startTime }) => {
      const cleanText = text.trim();

      if (!cleanText) return '';

      const timestamp = formatTimestamp(startTime);
      return `[${timestamp}]\n${cleanText}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

function mergeTranscriptionsPlain(parts) {
  const joinedText = parts
    .map(text => text.trim())
    .filter(Boolean)
    .join(' ');

  return cleanTranscriptText(joinedText);
}

function cleanTranscriptText(text) {
  return text
    // Quita espacios al inicio de cada línea (artefacto de whisper)
    .replace(/^ +/gm, '')

    // Colapsa múltiples saltos de línea en uno solo
    .replace(/\n{2,}/g, '\n')

    // Convierte saltos de línea simples en espacio (une líneas del mismo fragmento)
    .replace(/\n/g, ' ')

    // Limpia espacios múltiples
    .replace(/\s+/g, ' ')

    // Agrega espacio después de punto, coma, pregunta, exclamación si falta
    .replace(/([.,!?¿¡])(?=\S)/g, '$1 ')

    // Quita espacios antes de signos
    .replace(/\s+([.,!?;:])/g, '$1')

    // Separa párrafos después de cierre de oración
    .replace(/([.!?])\s+/g, '$1\n\n')

    // Limpieza final
    .trim();
}

async function createPdfFile(outputPath, text) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    doc.fontSize(18).text('Transcripción', { align: 'center' });
    doc.moveDown();

    doc.fontSize(11).text(text, {
      align: 'left',
      lineGap: 4
    });

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function createWordFile(outputPath, text) {
  const paragraphs = text.split('\n').map(line =>
    new Paragraph({
      children: [
        new TextRun({
          text: line || ' ',
          size: 22
        })
      ]
    })
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'Transcripción',
                bold: true,
                size: 32
              })
            ]
          }),
          ...paragraphs
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  await fsp.writeFile(outputPath, buffer);
}

async function processAudioTranscription(audioPath, options = {}) {
  const mode = options.mode || 'plain';
  const format = options.format || 'txt';

  const sessionName = `session-${Date.now()}`;
  const sessionDir = path.join(chunksBaseDir, sessionName);

  try {
    // Whisper (binario + modelo) son "requeridos" — el instalador los baja
    // solos en el primer arranque, así que en el caso normal esto nunca
    // dispara. Pero si esa descarga falló, el error de antes era un ENOENT
    // crudo de `execFile` señalando "whisper-cli.exe" o el .bin — nada le
    // decía al usuario que existe un panel donde reintentarlo. Mismo criterio
    // que ya se aplicó al chat (modelo de texto) y a documentos (este mismo
    // v3.0.0): chequeo explícito antes de arrancar, no esperar a que un
    // proceso externo tire un error para recién ahí explicar qué pasó.
    const missing = [];
    if (!fs.existsSync(WHISPER_BIN)) missing.push('whisper-cli');
    if (!fs.existsSync(WHISPER_MODEL)) missing.push('whisper-large-v3');
    if (missing.length) {
      const err = new Error(`Whisper no está instalado (falta: ${missing.join(', ')})`);
      err.code = 'MODEL_NOT_DOWNLOADED';
      err.modelId = missing.join(', ');
      throw err;
    }

    await fsp.mkdir(outputsDir, { recursive: true });

    console.log('Dividiendo audio en fragmentos...');
    const chunks = await createChunks(audioPath, sessionDir);

    const transcriptions = [];
    let lastChunkError = null;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Transcribiendo fragmento ${i + 1} de ${chunks.length}...`);

      try {
        const text = await transcribeChunk(chunk);

        const cleanText = Buffer
          .from(text, 'utf8')
          .toString('utf8')
          .trim();

        transcriptions.push({ text: cleanText, startTime: chunk.startTime });
      } catch (err) {
        // Antes: se atrapaba, se logueaba solo en consola, y se seguía con
        // texto vacío para ese fragmento — sin ninguna señal más allá del
        // log. Si TODOS los fragmentos fallaban (ej. whisper-cli.exe
        // faltante), el resultado era un archivo vacío reportado como
        // "Transcripción finalizada correctamente" — mismo patrón de error
        // real silenciado que el bug de streaming del chat (ver
        // DECISIONS.md). Se sigue tolerando que UN fragmento puntual falle
        // sin frenar todo (audio largo, un segmento corrupto no debería
        // tirar la transcripción entera) — lo que cambia es que ahora, si
        // NINGÚN fragmento produjo texto, se trata como falla real más
        // abajo en vez de devolver éxito con contenido vacío.
        console.error(`Error en fragmento ${i + 1}:`, err.response?.data || err.message || err);
        lastChunkError = err;
        transcriptions.push({ text: '', startTime: chunk.startTime });
      }
    }

    const hasAnyText = transcriptions.some(t => t.text);
    if (chunks.length > 0 && !hasAnyText) {
      const cause = lastChunkError?.message || lastChunkError?.code || 'motivo desconocido';
      throw new Error(`No se pudo transcribir ningún fragmento del audio (${cause})`);
    }

    const finalTextWithTimestamps = mergeTranscriptionsWithTimestamps(transcriptions);
    const finalTextPlain = mergeTranscriptionsPlain(transcriptions.map(p => p.text));

    const selectedText =
      mode === 'timestamps'
        ? finalTextWithTimestamps
        : finalTextPlain;

    const timestamp = Date.now();
    let outputPath;

    if (format === 'txt') {
      outputPath = path.join(
        outputsDir,
        `transcription-${timestamp}-${mode}.txt`
      );

      await fsp.writeFile(outputPath, selectedText, 'utf8');
    }

    if (format === 'pdf') {
      outputPath = path.join(
        outputsDir,
        `transcription-${timestamp}-${mode}.pdf`
      );

      await createPdfFile(outputPath, selectedText);
    }

    if (format === 'docx') {
      outputPath = path.join(
        outputsDir,
        `transcription-${timestamp}-${mode}.docx`
      );

      await createWordFile(outputPath, selectedText);
    }

    if (!outputPath) {
      throw new Error(`Formato no soportado: ${format}`);
    }

    function toPublicUrl(filePath) {
      const relative = filePath.split('outputs')[1].replace(/\\/g, '/');
      return `http://localhost:3005/outputs${relative}`;
    }

    console.log('Archivo de transcripción generado:', outputPath);

    return {
      fileUrl: toPublicUrl(outputPath),
      filePath: outputPath,
      mode,
      format,
      message: 'Transcripción finalizada correctamente.'
    };

  } catch (error) {
    console.error('Error en processAudioTranscription:', error.response?.data || error);
    throw error;
  } finally {
    await fsp.rm(audioPath, { force: true }).catch(() => { });
    await fsp.rm(sessionDir, { recursive: true, force: true }).catch(() => { });
  }
}

module.exports = {
  processAudioTranscription
};