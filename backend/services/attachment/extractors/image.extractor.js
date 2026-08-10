const { recognizeImage } = require('../ocr/ocr.service');
const { describeImage, isVisionAvailable, getVisionModel, getMissingVisionRequirement } = require('../vision.service');
const { computeBackgroundVariance, classifyImage } = require('../image.classifier');
const { fuseImageAnalysis } = require('../image.fusion');
// ─── Extractor de imágenes — orquestador del pipeline ────────────────────────

/**
 * Orquesta el pipeline de análisis de una imagen adjunta. Encadena cada
 * etapa y le pasa a la siguiente el resultado COMPLETO de la anterior, sin
 * interpretar ni recortar sus campos — cada etapa es dueña de su propio
 * contrato (ver DECISIONS.md → "Pipeline de imágenes: etapas separadas,
 * fusión sin LLM"):
 *
 *   1. Clasificación de confianza/palabras/varianza → image.classifier.js
 *   2. OCR                                          → ocr.service.js
 *   3. Modelo de visión (si la categoría lo pide)    → vision.service.js
 *   4. Fusión determinista (sin LLM)                 → image.fusion.js
 *
 * Categorías (`image.classifier.js`):
 *   - 'document' → solo OCR, no se llama al modelo de visión.
 *   - 'hybrid'   → OCR + visión, fusionados por reglas.
 *   - 'visual'   → solo visión, el OCR no aportaba nada confiable.
 *
 * Antes la decisión de usar o no visión era binaria (solo confianza OCR) y
 * dejaba pasar imágenes sin analizar de verdad; y cuando sí usaba OCR+visión
 * juntos, la fusión pasaba por dentro del prompt del modelo (un `hint`
 * opaco, no inspeccionable). Ver DECISIONS.md para el detalle completo.
 *
 * Sigue el contrato estándar de extractores de attachment.service.js:
 * { name, type, content, truncated, original? }
 *
 * @param {object} file — objeto multer (diskStorage)
 * @returns {Promise<{ name, type, content, truncated, meta }>}
 */
// Qué decirle al usuario cuando la imagen no se pudo analizar.
//
// Primera versión: un texto largo con las instrucciones completas (ruta del
// panel, los tres pasos) metido acá, esperando que el modelo de chat lo
// repitiera. Mal enfoque, por dos razones que se vieron enseguida: este texto
// llega como CONTENIDO del adjunto y el modelo lo parafrasea antes de
// mostrarlo — un modelo de 3B resume y se come justo la parte accionable — y
// además un hipervínculo no sobrevive a esa paráfrasis de ninguna forma.
//
// Ahora la división es clara: acá queda una frase corta y honesta, lo único
// que el modelo necesita saber para no inventar una descripción; y el aviso
// completo (con el enlace de descarga de Ollama) lo dibuja el frontend como
// una tarjeta, sin que ningún modelo lo toque. La señal para eso es
// `visionUnavailable` en meta, que viaja hasta el frontend en el evento
// [DONE]. Ver DECISIONS.md.
const VISION_SETUP_HINT =
  'El análisis de imágenes no está disponible en esta instalación.';

const VISION_FAILED_HINT =
  'El análisis de imágenes está habilitado pero esta vez no pudo completarse.';

async function extractImage(file) {
  const { originalname, mimetype, size, path: filePath } = file;
  const sizeKB = (size / 1024).toFixed(1);

  console.log(`[image.extractor] OCR iniciado: ${originalname}`);

  try {
    const [ocr, variance] = await Promise.all([
      recognizeImage(filePath),
      computeBackgroundVariance(filePath)
    ]);

    const category = classifyImage({ confidence: ocr.confidence, wordCount: ocr.wordCount, variance });
    console.log(
      `[image.extractor] OCR completo: ${originalname} | confianza: ${ocr.confidence}% | ` +
      `palabras: ${ocr.wordCount} | varianza: ${variance.toFixed(1)} | cached: ${ocr.cached} | categoría: ${category}`
    );

    let vision = null;
    let visionAttempted = false;
    let visionMissing = null;

    if (category === 'hybrid' || category === 'visual') {
      const visionAvailable = await isVisionAvailable();
      if (visionAvailable) {
        visionAttempted = true;
        console.log(`[image.extractor] Categoría "${category}" — analizando con ${getVisionModel()}`);
        try {
          vision = await describeImage(filePath);
          if (!vision?.description) vision = null;
        } catch (vErr) {
          console.warn(`[image.extractor] Vision fallback falló: ${vErr.message}`);
          vision = null;
        }
      } else {
        // Cuál de los tres requisitos falta. El usuario no hace lo mismo en
        // cada caso (instalar Ollama / descargar archivos / apretar registrar),
        // así que un "no disponible" genérico lo dejaría igual de trabado.
        visionMissing = await getMissingVisionRequirement();
        console.warn(`[image.extractor] Visión no disponible (falta: ${visionMissing || 'desconocido'}) — ${originalname}`);
      }
    }

    // La categoría pedía visión (hybrid/visual) pero no hubo forma de
    // conseguirla (Ollama no disponible, o describeImage() falló/vacío) —
    // no hay nada real para fusionar. Mismo criterio que el resto del
    // pipeline: un placeholder honesto en vez de dejar que algo más adelante
    // le pida a un modelo que adivine sin datos (ver DECISIONS.md, bug del
    // fallback ciego al pipeline de texto).
    if ((category === 'hybrid' || category === 'visual') && !vision) {
      return {
        name: originalname,
        type: 'image',
        content:
          `[Imagen adjunta: ${originalname} | Tamaño: ${sizeKB} KB | Tipo: ${mimetype}]\n` +
          `[OCR procesado pero no se detectó texto legible con suficiente confianza (confianza: ${ocr.confidence}%). ` +
          `${visionAttempted ? VISION_FAILED_HINT : VISION_SETUP_HINT} ` +
          `Mientras tanto, si querés, describí la imagen con tus palabras y te ayudo con eso.]`,
        truncated: false,
        meta: {
          confidence: ocr.confidence, wordCount: ocr.wordCount, variance, category, cached: ocr.cached,
          ocrAttempted: true, visionAttempted,
          // La imagen NECESITABA visión y no la hubo. Distinto de "falló el
          // intento": acá el usuario puede hacer algo al respecto (instalar
          // Ollama, configurar el modelo), y el frontend le muestra cómo.
          visionUnavailable: !visionAttempted, visionMissing
        }
      };
    }

    const { content: fusedContent, ocrTokens, ocrTokensOmitted } = fuseImageAnalysis({ category, ocr, vision });

    // ocrTokens/ocrTokensOmitted (solo en categoría 'hybrid') no se agregan
    // al content que ve el usuario — quedan en meta para log/depuración. Ver
    // nota en image.fusion.js: ese bloque se pensó como contexto para un
    // modelo, no como texto para mostrar tal cual en el chat.
    if (category === 'hybrid' && ocrTokens?.length) {
      console.log(
        `[image.extractor] OCR tokens (hybrid, no mostrados en chat): ${ocrTokens.join(', ')}` +
        `${ocrTokensOmitted > 0 ? ` (+${ocrTokensOmitted} omitidos)` : ''}`
      );
    }

    const header = category === 'document'
      ? `OCR confianza: ${ocr.confidence}%`
      : category === 'visual'
        ? `Análisis visual: ${vision.model}`
        : `Análisis visual: ${vision.model} (híbrido, fusión con OCR)`;

    return {
      name: originalname,
      type: 'image',
      content: `[Imagen adjunta: ${originalname} | Tamaño: ${sizeKB} KB | ${header}]\n\n${fusedContent}`,
      truncated: !!vision?.truncated,
      meta: {
        confidence: ocr.confidence, wordCount: ocr.wordCount, variance, category, cached: ocr.cached,
        ocrAttempted: true, visionUsed: !!vision, visionModel: vision?.model || null, truncated: !!vision?.truncated,
        ocrTokens: ocrTokens || null, ocrTokensOmitted: ocrTokensOmitted || 0
      }
    };

  } catch (err) {
    console.error(`[image.extractor] Error OCR: ${originalname}`, err.message);

    // BUG ENCONTRADO EN PRUEBAS: cuando OCR falla ACÁ (timeout u otro error),
    // el catch devolvía directo un placeholder de error, sin intentar visión
    // — aunque `describeImage()` no depende para nada de que el OCR haya
    // funcionado. Resultado real: un screenshot con OCR_TIMEOUT terminaba
    // sin NINGÚN análisis (ni texto ni descripción), contradiciendo el
    // diseño documentado ("hybrid y visual pasan siempre por
    // describeImage()" — ver DECISIONS.md) porque ese diseño asume que se
    // llega a clasificar, y un timeout de OCR aborta el pipeline ANTES de
    // clasificar (sin `ocr.confidence`/`wordCount` no hay cómo llamar a
    // `classifyImage()`). Sin datos de OCR no podemos elegir entre
    // 'document'/'hybrid'/'visual', pero eso no debería significar "sin
    // análisis" si hay visión disponible — mejor una descripción visual
    // sola que nada.
    let vision = null;
    let visionAttempted = false;
    try {
      if (await isVisionAvailable()) {
        visionAttempted = true;
        console.log(`[image.extractor] OCR falló — intentando visión como último recurso: ${originalname}`);
        vision = await describeImage(filePath);
        if (!vision?.description) vision = null;
      }
    } catch (vErr) {
      console.warn(`[image.extractor] Vision fallback (tras error de OCR) también falló: ${vErr.message}`);
      vision = null;
    }

    if (vision) {
      return {
        name: originalname,
        type: 'image',
        content:
          `[Imagen adjunta: ${originalname} | Tamaño: ${sizeKB} KB | Análisis visual: ${vision.model} ` +
          `(OCR no disponible: ${err.message})]\n\n${vision.description}`,
        truncated: !!vision.truncated,
        meta: {
          ocrAttempted: true, error: err.message,
          visionAttempted, visionUsed: true, visionModel: vision.model, truncated: !!vision.truncated
        }
      };
    }

    // Ni OCR ni visión — mismo placeholder honesto de siempre, pero ahora
    // indicando si visión se llegó a intentar o directamente no estaba
    // disponible (mismo criterio que el resto del pipeline).
    return {
      name: originalname,
      type: 'image',
      content:
        `[Imagen adjunta: ${originalname} | Tamaño: ${sizeKB} KB | Tipo: ${mimetype}]\n` +
        `[Error al procesar OCR: ${err.message}. ` +
        `${visionAttempted ? VISION_FAILED_HINT : VISION_SETUP_HINT} ` +
        `Mientras tanto, si querés, describí la imagen con tus palabras y te ayudo con eso.]`,
      truncated: false,
      meta: { ocrAttempted: true, error: err.message, visionAttempted, visionUnavailable: !visionAttempted }
    };
  }
}

module.exports = { extractImage };
