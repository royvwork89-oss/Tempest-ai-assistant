const path = require('path');
const fs = require('fs/promises');
const { recognizeImage, MIN_CONFIDENCE } = require('../ocr/ocr.service');
const { rasterizePdf, cleanupRasterDir, MAX_PAGES } = require('../ocr/rasterizers/pdf.rasterizer');

// ─── Extractor OCR para PDFs escaneados ──────────────────────────────────────

/**
 * Extrae texto de un PDF escaneado usando rasterización + OCR página por página.
 * Sigue el contrato estándar de extractores de attachment.service.js:
 * { name, type, content, truncated, meta }
 *
 * @param {object} file     — objeto multer (diskStorage)
 * @param {string} rawText  — texto ya extraído por pdf2json (puede estar vacío)
 * @returns {Promise<{ name, type, content, truncated, meta }>}
 */
async function extractPdfOCR(file, rawText = '') {
  const { originalname, size, path: filePath } = file;
  const sizeKB = (size / 1024).toFixed(1);

  // Directorio temporal único por request
  const outDir = path.join(
    path.dirname(filePath),
    `ocr_pdf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  );

  console.log(`[pdf.ocr.extractor] Iniciando OCR: ${originalname}`);

  let pagePngs = [];

  try {
    pagePngs = await rasterizePdf(filePath, outDir);

    if (pagePngs.length === 0) {
      return {
        name: originalname,
        type: 'pdf',
        content:
          `[PDF escaneado: ${originalname} | Tamaño: ${sizeKB} KB]\n` +
          `[No se pudieron rasterizar páginas — el archivo puede estar dañado.]`,
        truncated: false,
        meta: { scanned: true, pages: 0, ocrAttempted: true }
      };
    }

    // OCR página por página
    const pageResults = [];
    for (let i = 0; i < pagePngs.length; i++) {
      const imgPath = pagePngs[i];
      try {
        const { text, confidence } = await recognizeImage(imgPath);

        console.log(`[pdf.ocr.extractor] Página ${i + 1}/${pagePngs.length} | confianza: ${confidence}%`);

        if (confidence >= MIN_CONFIDENCE && text.length > 0) {
          pageResults.push(`--- Página ${i + 1} ---\n${text}`);
        } else {
          pageResults.push(`--- Página ${i + 1} --- [sin texto legible | confianza: ${confidence}%]`);
        }
      } catch (pageErr) {
        console.warn(`[pdf.ocr.extractor] Error en página ${i + 1}:`, pageErr.message);
        pageResults.push(`--- Página ${i + 1} --- [error al procesar: ${pageErr.message}]`);
      }
    }

    const totalPages = pagePngs.length;
    const truncated = totalPages >= MAX_PAGES;
    const ocrText = pageResults.join('\n\n');

    const header =
      `[PDF escaneado: ${originalname} | Tamaño: ${sizeKB} KB | ` +
      `Páginas OCR: ${totalPages}${truncated ? ` (primeras ${MAX_PAGES})` : ''}]\n\n`;

    const content = header + ocrText;

    return {
      name: originalname,
      type: 'pdf',
      content,
      truncated,
      meta: {
        scanned: true,
        pages: totalPages,
        truncated,
        ocrAttempted: true
      }
    };

  } catch (err) {
    console.error(`[pdf.ocr.extractor] Error:`, err.message);

    // Fallback — si hay texto de pdf2json aunque sea poco, usarlo
    if (rawText && rawText.trim().length > 0) {
      return {
        name: originalname,
        type: 'pdf',
        content:
          `[PDF: ${originalname} | Tamaño: ${sizeKB} KB]\n` +
          `[OCR falló (${err.message}). Texto parcial extraído:]\n\n${rawText.trim()}`,
        truncated: false,
        meta: { scanned: true, ocrAttempted: true, ocrError: err.message }
      };
    }

    return {
      name: originalname,
      type: 'pdf',
      content:
        `[PDF escaneado: ${originalname} | Tamaño: ${sizeKB} KB]\n` +
        `[Error al procesar OCR: ${err.message}. ` +
        `Si necesitas el contenido, describe la imagen con tus palabras.]`,
      truncated: false,
      meta: { scanned: true, ocrAttempted: true, ocrError: err.message }
    };

  } finally {
    // Limpieza siempre — incluso si OCR falló  
    await cleanupRasterDir(outDir);
  }
}

module.exports = { extractPdfOCR };