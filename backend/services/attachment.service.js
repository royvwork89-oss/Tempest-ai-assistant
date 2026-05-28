const fs = require('fs');
const path = require('path');
const { extractPptx } = require('./attachment/extractors/pptx.extractor');
const { extractImage } = require('./attachment/extractors/image.extractor');
const { extractPdfOCR } = require('./attachment/extractors/pdf.ocr.extractor');
const { checkPoppler, isScannedPdf } = require('./attachment/ocr/rasterizers/pdf.rasterizer');

// Verificar Poppler al arrancar
checkPoppler().then(available => {
  console.log(`[attachment.service] Poppler disponible: ${available}`);
});

// ─── Configuración ────────────────────────────────────────────────────────────

const MAX_CHARS = 7500;

const ALLOWED_MIMETYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/typescript',
  'application/json',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp'
]);

const ALLOWED_EXTENSIONS = new Set([
  '.txt', '.md', '.html', '.css', '.js', '.ts', '.jsx', '.tsx',
  '.json', '.yaml', '.yml', '.xml', '.csv', '.py', '.java',
  '.c', '.cpp', '.h', '.cs', '.php', '.rb', '.go', '.rs',
  '.sh', '.bash', '.env', '.ini', '.toml', '.sql',
  '.pdf', '.docx', '.xlsx', '.pptx',
  '.png', '.jpg', '.jpeg', '.gif', '.webp'
]);

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.html', '.css', '.js', '.ts', '.jsx', '.tsx',
  '.json', '.yaml', '.yml', '.xml', '.csv', '.py', '.java',
  '.c', '.cpp', '.h', '.cs', '.php', '.rb', '.go', '.rs',
  '.sh', '.bash', '.env', '.ini', '.toml', '.sql'
]);

const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp',
  '.h', '.cs', '.php', '.rb', '.go', '.rs', '.sh', '.bash', '.sql'
]);

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp'
]);

// ─── Validación ───────────────────────────────────────────────────────────────

function isAllowedFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
    // Algunos sistemas reportan mimetypes genéricos para texto
    // aceptar si la extensión está en lista blanca de texto
    if (!TEXT_EXTENSIONS.has(ext)) return false;
  }

  // Magic bytes básicos para PDF
  if (ext === '.pdf') {
    try {
      const buf = Buffer.alloc(4);
      const fd = fs.openSync(file.path, 'r');
      fs.readSync(fd, buf, 0, 4, 0);
      fs.closeSync(fd);
      if (buf.toString('ascii') !== '%PDF') return false;
    } catch {
      return false;
    }
  }

  return true;
}

// ─── Truncado inteligente ─────────────────────────────────────────────────────

function truncateCode(text, maxChars) {
  if (text.length <= maxChars) return { text, truncated: false };

  const lines = text.split('\n');
  const total = text.length;
  const headLines = [];
  const tailLines = [];
  let headChars = 0;
  let tailChars = 0;
  const budget = Math.floor(maxChars * 0.6); // 60% cabecera
  const tailBudget = Math.floor(maxChars * 0.3); // 30% final

  // Cabecera: imports + primeras firmas
  for (const line of lines) {
    if (headChars + line.length > budget) break;
    headLines.push(line);
    headChars += line.length + 1;
  }

  // Final: últimas líneas (donde suelen vivir los bugs)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (tailChars + line.length > tailBudget) break;
    tailLines.unshift(line);
    tailChars += line.length + 1;
  }

  const result = [
    ...headLines,
    `\n[... TRUNCADO: se enviaron ~${maxChars} de ${total} caracteres. ` +
    `Di "continuar con el archivo" si necesitas más. ...]\n`,
    ...tailLines
  ].join('\n');

  return { text: result, truncated: true, original: total };
}

function truncateDocument(text, maxChars) {
  if (text.length <= maxChars) return { text, truncated: false };

  const total = text.length;
  const headBudget = Math.floor(maxChars * 0.65);
  const tailBudget = Math.floor(maxChars * 0.25);

  const head = text.slice(0, headBudget);
  const tail = text.slice(-tailBudget);

  const result =
    head +
    `\n\n[... TRUNCADO: se enviaron ~${maxChars} de ${total} caracteres. ` +
    `Di "continuar con el archivo" si necesitas más. ...]\n\n` +
    tail;

  return { text: result, truncated: true, original: total };
}

function smartTruncate(text, ext) {
  if (CODE_EXTENSIONS.has(ext)) return truncateCode(text, MAX_CHARS);
  return truncateDocument(text, MAX_CHARS);
}

// ─── Extracción de texto ──────────────────────────────────────────────────────

async function extractText(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const name = file.originalname;

  // Imagen — OCR con Tesseract
  if (IMAGE_EXTENSIONS.has(ext)) {
    return extractImage(file);
  }

// PDF
  if (ext === '.pdf') {
    let raw = '';
    try {
      const PDFParser = require('pdf2json');

      raw = await new Promise((resolve, reject) => {
        const parser = new PDFParser(null, 1);
        parser.on('pdfParser_dataReady', () => resolve(parser.getRawTextContent()));
        parser.on('pdfParser_dataError', (err) => reject(new Error(err.parserError || 'Error al parsear PDF')));
        parser.loadPDF(file.path);
      });
    } catch (err) {
      console.warn(`[attachment.service] pdf2json falló en ${name}: ${err.message}`);
    }

    // Si el PDF es escaneado (poco o ningún texto), intentar OCR
    if (isScannedPdf(raw)) {
      const popplerOk = await checkPoppler();
      if (popplerOk) {
        console.log(`[attachment.service] PDF escaneado detectado — usando OCR: ${name}`);
        return extractPdfOCR(file, raw);
      }
      // Poppler no disponible — devolver lo que haya
      console.warn(`[attachment.service] PDF escaneado pero Poppler no disponible: ${name}`);
      return {
        name,
        type: 'pdf',
        content:
          `[PDF escaneado: ${name}]\n` +
          `[No se puede extraer texto — instala Poppler para habilitar OCR en PDFs escaneados.]`,
        truncated: false
      };
    }

    // PDF con texto normal — flujo original
    const { text, truncated, original } = truncateDocument(raw, MAX_CHARS);
    return { name, type: 'pdf', content: text, truncated, original };
  }

  // DOCX
  if (ext === '.docx') {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: file.path });
      const raw = result.value || '';
      const { text, truncated, original } = truncateDocument(raw, MAX_CHARS);

      return { name, type: 'docx', content: text, truncated, original };
    } catch (err) {
      return {
        name,
        type: 'docx',
        content: `[Error al extraer texto del DOCX: ${name}. ${err.message}]`,
        truncated: false
      };
    }
  }

  // XLSX
if (ext === '.xlsx') {
  try {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(file.path);
    let raw = '';

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) {
        raw += `[Hoja: ${sheetName}]\n${csv}\n\n`;
      }
    });

    const { text, truncated, original } = truncateDocument(raw, MAX_CHARS);
    return { name, type: 'xlsx', content: text, truncated, original };

  } catch (err) {
    return {
      name,
      type: 'xlsx',
      content: `[Error al extraer texto del Excel: ${name}. ${err.message}]`,
      truncated: false
    };
  }
}

// PPTX
  if (ext === '.pptx') {
    return extractPptx(file, { includeNotes: true }, (raw) =>
      truncateDocument(raw, MAX_CHARS)
    );
  }

  // Texto plano / código
  if (TEXT_EXTENSIONS.has(ext)) {
    try {
      const raw = fs.readFileSync(file.path, 'utf-8');
      const { text, truncated, original } = smartTruncate(raw, ext);

      return { name, type: 'text', content: text, truncated, original };
    } catch (err) {
      return {
        name,
        type: 'text',
        content: `[Error al leer el archivo: ${name}. ${err.message}]`,
        truncated: false
      };
    }
  }

  // Tipo no soportado (no debería llegar aquí si isAllowedFile funciona)
  return {
    name,
    type: 'unsupported',
    content: `[Archivo no soportado: ${name}]`,
    truncated: false
  };
}

// ─── Construcción del bloque de contexto ─────────────────────────────────────

async function buildAttachmentContext(files) {
  if (!Array.isArray(files) || files.length === 0) return null;

  const validFiles = files.filter(isAllowedFile);

  if (validFiles.length === 0) return null;

  const extractions = await Promise.all(validFiles.map(extractText));

  const blocks = extractions.map((item, i) =>
    `[Archivo ${i + 1}: ${item.name}]\n${item.content}`
  );

  return (
    `--- ARCHIVOS ADJUNTOS ---\n\n` +
    blocks.join('\n\n') +
    `\n\n--- FIN DE ARCHIVOS ---`
  );
}

// ─── Referencia limpia para chatHistory ──────────────────────────────────────
// Devuelve solo nombres, sin el contenido, para guardar en chatHistory

function getAttachmentNames(files) {
  if (!Array.isArray(files) || files.length === 0) return [];
  return files.filter(isAllowedFile).map(f => f.originalname);
}

// ─── Limpieza de archivos temporales ─────────────────────────────────────────

function cleanupFiles(files) {
  if (!Array.isArray(files)) return;

  files.forEach(file => {
    try {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (err) {
      console.warn(`[attachment.service] No se pudo borrar: ${file.path}`, err.message);
    }
  });
}

// ─── Job escoba (Capa B) ──────────────────────────────────────────────────────
// Llama esto desde server.js con setInterval

function startCleanupJob(attachmentsDir, maxAgeHours = 24) {
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  return () => {
    try {
      if (!fs.existsSync(attachmentsDir)) return;

      const files = fs.readdirSync(attachmentsDir);
      const now = Date.now();
      let count = 0;

      files.forEach(filename => {
        const filePath = path.join(attachmentsDir, filename);
        try {
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
            count++;
          }
        } catch {
          // archivo ya borrado o sin permisos, ignorar
        }
      });

      if (count > 0) {
        console.log(`[attachment.service] Escoba: ${count} archivo(s) eliminado(s) de uploads/attachments/`);
      }
    } catch (err) {
      console.warn('[attachment.service] Error en job escoba:', err.message);
    }
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  isAllowedFile,
  extractText,
  buildAttachmentContext,
  getAttachmentNames,
  cleanupFiles,
  startCleanupJob
};