const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const {
    Document,
    Packer,
    Paragraph,
    TextRun
} = require('docx');
const { OUTPUTS_DIR } = require('../config/appPaths');

const DOCUMENTS_DIR = path.join(OUTPUTS_DIR, 'documents');

const ALLOWED_FORMATS = new Set(['txt', 'pdf', 'docx']);
const MAX_TITLE_LENGTH = 70;
const DOCUMENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

function ensureDocumentsDir() {
    if (!fs.existsSync(DOCUMENTS_DIR)) {
        fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
    }
}

function sanitizeFilename(name = 'documento') {
    return String(name)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
        .slice(0, MAX_TITLE_LENGTH)
        .replace(/^-|-$/g, '') || 'documento';
}

function cleanDocumentTitle(title = '') {
    const clean = String(title || '')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return clean.slice(0, MAX_TITLE_LENGTH) || 'Documento Tempest';
}

function normalizeFormat(format = 'txt') {
    const cleanFormat = String(format || 'txt').toLowerCase().trim();
    return ALLOWED_FORMATS.has(cleanFormat) ? cleanFormat : 'txt';
}

function removeRepeatedTailLines(text) {
    const lines = String(text || '').split('\n');
    const cleaned = [];

    let lastLine = '';
    let repeatCount = 0;

    for (const line of lines) {
        const cleanLine = line.trim().toLowerCase();

        if (cleanLine && cleanLine === lastLine) {
            repeatCount++;
        } else {
            repeatCount = 1;
            lastLine = cleanLine;
        }

        if (repeatCount <= 3) {
            cleaned.push(line);
        }
    }

    return cleaned.join('\n');
}

function removeExtensionSpam(text) {
    return String(text || '')
        .replace(/(\btxt\b\s*){5,}/gi, '')
        .replace(/(\bpdf\b\s*){5,}/gi, '')
        .replace(/(\bdocx\b\s*){5,}/gi, '')
        .replace(/(\bword\b\s*){5,}/gi, '');
}

function removeDuplicateParagraphs(text) {
    const paragraphs = String(text || '')
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(Boolean);

    const seen = new Set();
    const result = [];

    for (const paragraph of paragraphs) {
        const key = paragraph
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .slice(0, 220);

        if (seen.has(key)) continue;

        seen.add(key);
        result.push(paragraph);
    }

    return result.join('\n\n');
}

function removeExtensionSpam(text) {
    return String(text || '')
        .replace(/(\btxt\b\s*){2,}/gi, '')
        .replace(/(\bpdf\b\s*){2,}/gi, '')
        .replace(/(\bdocx\b\s*){2,}/gi, '')
        .replace(/(\bword\b\s*){2,}/gi, '');
}

function removeRepeatedParagraphs(text) {
    const paragraphs = String(text || '')
        .split(/\n{1,}/)
        .map(p => p.trim())
        .filter(Boolean);

    const seen = new Set();
    const result = [];

    for (const paragraph of paragraphs) {
        const key = paragraph
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/\btxt\b/g, '')
            .replace(/\bpdf\b/g, '')
            .replace(/\bdocx\b/g, '')
            .trim()
            .slice(0, 260);

        if (seen.has(key)) continue;

        seen.add(key);
        result.push(paragraph);
    }

    return result.join('\n\n');
}

function cutAfterRepeatedContent(text) {
    const cleanText = String(text || '').trim();

    const repeatedMarkers = [
        'CONTENIDO FINAL DEL DOCUMENTO:',
        'Contenido:',
        'Título:',
        'Subtítulo:'
    ];

    let result = cleanText;

    for (const marker of repeatedMarkers) {
        const firstIndex = result.indexOf(marker);
        const secondIndex = firstIndex >= 0 ? result.indexOf(marker, firstIndex + marker.length) : -1;

        if (firstIndex >= 0 && secondIndex > firstIndex) {
            result = result.slice(0, secondIndex).trim();
        }
    }

    return result;
}

function cleanDocumentLabels(text) {
    return String(text || '')
        .replace(/^CONTENIDO FINAL DEL DOCUMENTO:\s*/i, '')
        .replace(/^Contenido final del documento:\s*/i, '')
        .replace(/^Formato:\s*(txt|pdf|docx|word)\s*/im, '')
        .replace(/\s+(txt|pdf|docx)\s*$/i, '')
        .trim();
}

function removeExtensionSpam(text) {
    return String(text || '')
        .replace(/(\btxt\b\s*){2,}/gi, '')
        .replace(/(\bpdf\b\s*){2,}/gi, '')
        .replace(/(\bdocx\b\s*){2,}/gi, '')
        .replace(/(\bword\b\s*){2,}/gi, '');
}

function removeRepeatedParagraphs(text) {
    const paragraphs = String(text || '')
        .split(/\n{1,}/)
        .map(p => p.trim())
        .filter(Boolean);

    const seen = new Set();
    const result = [];

    for (const paragraph of paragraphs) {
        const key = paragraph
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/\btxt\b/g, '')
            .replace(/\bpdf\b/g, '')
            .replace(/\bdocx\b/g, '')
            .replace(/\bword\b/g, '')
            .trim()
            .slice(0, 280);

        if (seen.has(key)) continue;

        seen.add(key);
        result.push(paragraph);
    }

    return result.join('\n\n');
}

function removeInstructionEcho(text) {
    const lines = String(text || '').split('\n');

    return lines
        .filter(line => {
            const clean = line.trim().toLowerCase();

            if (!clean) return true;

            if (clean.startsWith('genera un documento')) return false;
            if (clean.startsWith('reglas:')) return false;
            if (clean.startsWith('formato de respuesta:')) return false;
            if (clean.startsWith('petición del usuario:')) return false;
            if (clean.startsWith('el documento debe')) return false;
            if (clean.includes('no debe usar markdown')) return false;
            if (clean.includes('no debe tener bloques de código')) return false;
            if (clean.includes('no debe repetir')) return false;
            if (clean.includes('no debe tener una palabra')) return false;
            if (clean.includes('debe estar en formato')) return false;

            return true;
        })
        .join('\n');
}

function normalizeContent(content = '') {
    let text = String(content || '')
        .replace(/```[\s\S]*?```/g, match => {
            return match
                .replace(/^```[a-zA-Z0-9_-]*\n?/, '')
                .replace(/```$/, '');
        })
        .replace(/\r\n/g, '\n')
        .replace(/<\|.*?\|>/g, '')
        .trim();

    text = removeInstructionEcho(text);
    text = removeExtensionSpam(text);
    text = removeRepeatedParagraphs(text);

    return text.trim();
}

function buildDocumentPrompt({ prompt, format }) {
    return `
Genera un documento en formato ${format.toUpperCase()} a partir de esta petición:

${prompt}

REGLAS:
- Escribe en español correcto.
- Usa acentos y puntuación correctamente.
- No copies esta petición.
- No repitas instrucciones.
- No repitas párrafos.
- No escribas la palabra "${format}" al final.
- No uses markdown.
- No uses bloques de código.
- No digas "aquí tienes".
- No expliques el proceso.
- El documento debe tener título, subtítulo y contenido.
- Separa las ideas en párrafos claros.

FORMATO DE RESPUESTA:
Título: [título claro]
Subtítulo: [subtítulo breve]
Contenido:
[párrafos separados con líneas en blanco]
`.trim();
}

function splitTextIntoParagraphs(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/(Título:)/gi, '\n$1')
        .replace(/(Subtítulo:)/gi, '\n$1')
        .replace(/(Contenido:)/gi, '\n$1\n')
        .split(/\n{1,}/)
        .map(line => line.trim())
        .filter(Boolean);
}

async function writeTxt({ filename, content }) {
    const filePath = path.join(DOCUMENTS_DIR, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
}

async function writePdf({ filename, title, content }) {
    const filePath = path.join(DOCUMENTS_DIR, filename);

    await new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'LETTER',
            margin: 54
        });

        const stream = fs.createWriteStream(filePath);

        stream.on('finish', resolve);
        stream.on('error', reject);

        doc.pipe(stream);

        doc
            .fontSize(20)
            .text(title, {
                align: 'center'
            });

        doc.moveDown(1.5);

        const paragraphs = splitTextIntoParagraphs(content);

        paragraphs.forEach(paragraph => {
            const isTitleLike =
                /^título:/i.test(paragraph) ||
                /^subtítulo:/i.test(paragraph) ||
                /^contenido:/i.test(paragraph);

            doc
                .fontSize(isTitleLike ? 13 : 11)
                .text(paragraph, {
                    align: 'left',
                    lineGap: 6
                });

            doc.moveDown(isTitleLike ? 1 : 0.9);
        });

        doc.end();
    });

    return filePath;
}

async function writeDocx({ filename, title, content }) {
    const filePath = path.join(DOCUMENTS_DIR, filename);

    const lines = splitTextIntoParagraphs(content);

    const paragraphs = [
        new Paragraph({
            children: [
                new TextRun({
                    text: title,
                    bold: true,
                    size: 36
                })
            ],
            spacing: {
                after: 500
            }
        })
    ];

    lines.forEach(line => {
        const isTitleLike =
            /^título:/i.test(line) ||
            /^subtítulo:/i.test(line) ||
            /^contenido:/i.test(line);

        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: line,
                        bold: isTitleLike,
                        size: isTitleLike ? 28 : 24
                    })
                ],
                spacing: {
                    before: isTitleLike ? 240 : 120,
                    after: isTitleLike ? 240 : 220,
                    line: 360
                }
            })
        );
    });

    const doc = new Document({
        sections: [
            {
                properties: {},
                children: paragraphs
            }
        ]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);

    return filePath;
}

async function createDocumentFile({ title, content, format }) {
    ensureDocumentsDir();

    const safeTitle = cleanDocumentTitle(title);
    const safeFormat = normalizeFormat(format);
    const safeContent = normalizeContent(content);

    const timestamp = Date.now();
    const baseName = sanitizeFilename(safeTitle);
    const filename = `${baseName}-${timestamp}.${safeFormat}`;

    let filePath;

    if (safeFormat === 'txt') {
        filePath = await writeTxt({
            filename,
            content: safeContent
        });
    }

    if (safeFormat === 'pdf') {
        filePath = await writePdf({
            filename,
            title: safeTitle,
            content: safeContent
        });
    }

    if (safeFormat === 'docx') {
        filePath = await writeDocx({
            filename,
            title: safeTitle,
            content: safeContent
        });
    }

    return {
        title: safeTitle,
        format: safeFormat,
        filename,
        filePath,
        fileUrl: `/documents/${filename}`,
        downloadUrl: `/documents/download/${filename}`,
        previewText: safeContent
    };
}

function getDocumentPath(filename) {
    const safeFilename = path.basename(filename);
    return path.join(DOCUMENTS_DIR, safeFilename);
}

function documentExists(filename) {
    return fs.existsSync(getDocumentPath(filename));
}

function cleanupOldDocuments() {
    ensureDocumentsDir();

    const now = Date.now();
    const files = fs.readdirSync(DOCUMENTS_DIR);

    files.forEach(filename => {
        const filePath = path.join(DOCUMENTS_DIR, filename);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > DOCUMENT_TTL_MS) {
            fs.unlinkSync(filePath);
            console.log(`Documento temporal eliminado: ${filename}`);
        }
    });
}

module.exports = {
    DOCUMENTS_DIR,
    buildDocumentPrompt,
    createDocumentFile,
    getDocumentPath,
    documentExists,
    cleanupOldDocuments,
    normalizeFormat
};