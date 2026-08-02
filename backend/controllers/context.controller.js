// backend/controllers/context.controller.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadIndex, saveIndex, loadSettings, getProjectDataPath } = require('../services/context/context.service');
const { extractText } = require('../services/attachment.service');
const { spawn } = require('child_process');

function makeId(index) {
  const nums = index.items
    .map(i => parseInt(i.id.replace('f_', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `f_${String(next).padStart(3, '0')}`;
}

// GET /project/:projectId/context/items
async function listItems(req, res) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || 'local-user';
    const index = loadIndex(projectId, userId);
    res.json({ ok: true, items: index.items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// POST /project/:projectId/context/upload
async function uploadFiles(req, res) {
  const tempFiles = req.files || [];
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || 'local-user';
    if (!tempFiles.length) return res.status(400).json({ ok: false, error: 'Sin archivos' });

    const index = loadIndex(projectId, userId);
    const projectDataPath = getProjectDataPath(projectId, userId);
    const filesDir = path.join(projectDataPath, 'context', 'files');
    fs.mkdirSync(filesDir, { recursive: true });

    const added = [];

    for (const file of tempFiles) {
      const id = makeId(index);

      // Reutiliza extractText de attachment.service — misma firma que adjuntos de chat
      let content = '';
      try {
        const extracted = await extractText(file);
        content = extracted.content || '';
      } catch (err) {
        console.warn(`[ContextCtrl] No se pudo extraer texto de ${file.originalname}:`, err.message);
      }

      const hash = crypto.createHash('sha256').update(content).digest('hex');

      // Deduplicación por hash
      const duplicate = index.items.find(i => i.hash === `sha256:${hash}` && i.source === 'upload');
      if (duplicate) {
        console.log(`[ContextCtrl] Duplicado detectado: ${file.originalname} → mismo hash que ${duplicate.name}`);
        try { fs.unlinkSync(file.path); } catch (_) { }
        continue;
      }

      const contentRef = `files/${id}.txt`;
      const metaRef = `files/${id}.meta.json`;

      fs.writeFileSync(path.join(projectDataPath, 'context', contentRef), content, 'utf-8');
      fs.writeFileSync(path.join(projectDataPath, 'context', metaRef), JSON.stringify({
        originalName: file.originalname,
        mimetype: file.mimetype,
        sizeBytes: file.size,
      }, null, 2));

      const item = {
        id,
        source: 'upload',
        name: file.originalname,
        relPath: file.originalname,
        enabled: true,
        alwaysInclude: false,
        includeWhenMentioned: true,
        priority: 'normal',
        hash: `sha256:${hash}`,
        mtimeMs: Date.now(),
        sizeBytes: file.size,
        contentRef,
        metaRef,
        lastUsedAtMs: null,
        embeddingId: null,
      };

      index.items.push(item);
      added.push(item);

      try { fs.unlinkSync(file.path); } catch (_) { }
    }

    saveIndex(projectId, index, userId);
    res.json({ ok: true, added });



  } catch (err) {
    console.error('[ContextCtrl] uploadFiles error:', err);
    // Limpiar temporales si algo falló
    for (const f of tempFiles) {
      try { fs.unlinkSync(f.path); } catch (_) { }
    }
    res.status(500).json({ ok: false, error: err.message });
  }
}

// PATCH /project/:projectId/context/item/:id
async function updateItem(req, res) {
  try {
    const { projectId, id } = req.params;
    const userId = req.user?.id || 'local-user';
    const allowed = ['enabled', 'alwaysInclude', 'includeWhenMentioned', 'priority'];
    const index = loadIndex(projectId, userId);
    const item = index.items.find(i => i.id === id);
    if (!item) return res.status(404).json({ ok: false, error: 'Item no encontrado' });

    for (const key of allowed) {
      if (key in req.body) item[key] = req.body[key];
    }

    saveIndex(projectId, index, userId);
    res.json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// DELETE /project/:projectId/context/item/:id
async function deleteItem(req, res) {
  try {
    const { projectId, id } = req.params;
    const userId = req.user?.id || 'local-user';
    const projectDataPath = getProjectDataPath(projectId, userId);
    const index = loadIndex(projectId, userId);
    const idx = index.items.findIndex(i => i.id === id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Item no encontrado' });

    const item = index.items[idx];

    if (item.source === 'upload') {
      for (const ref of [item.contentRef, item.metaRef]) {
        if (!ref) continue;
        try { fs.unlinkSync(path.join(projectDataPath, 'context', ref)); } catch (_) { }
      }
    }

    index.items.splice(idx, 1);
    saveIndex(projectId, index, userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// GET /project/:projectId/settings
async function getSettings(req, res) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || 'local-user';
    const settings = loadSettings(projectId, userId);
    res.json({ ok: true, settings });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// PATCH /project/:projectId/settings
async function updateSettings(req, res) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || 'local-user';
    const projectDataPath = getProjectDataPath(projectId, userId);
    const settingsPath = path.join(projectDataPath, 'projectSettings.json');
    const current = loadSettings(projectId, userId);

    if (req.body.prompts) current.prompts = { ...current.prompts, ...req.body.prompts };
    if (req.body.contextRules) current.contextRules = { ...current.contextRules, ...req.body.contextRules };
    if (req.body.preferences) current.preferences = { ...current.preferences, ...req.body.preferences };

    // linkedFolder: solo config editable acá. "path" y los campos de estado
    // (status/lastError/lastIndexed/contentHash/totalFiles/totalSizeBytes) son
    // propiedad de refreshLinkedFolder — evita que un PATCH genérico desincronice
    // el settings del manifest real en disco.
    if (req.body.linkedFolder) {
      const allowedLF = ['enabled', 'scanMode', 'maxDepth', 'maxFiles', 'maxFileSize', 'ignoreGlobs'];
      const patch = {};
      for (const key of allowedLF) {
        if (key in req.body.linkedFolder) patch[key] = req.body.linkedFolder[key];
      }
      current.linkedFolder = { ...current.linkedFolder, ...patch };
    }

    fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2));
    res.json({ ok: true, settings: current });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// POST /project/:projectId/context/linked-folder/refresh
// body opcional: { path, maxDepth, maxFiles, maxFileSize, ignoreGlobs }
// Sin "path" en el body, refresca la carpeta ya vinculada (settings.linkedFolder.path).
async function refreshLinkedFolder(req, res) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || 'local-user';
    const projectDataPath = getProjectDataPath(projectId, userId);
    const settingsPath = path.join(projectDataPath, 'projectSettings.json');
    const settings = loadSettings(projectId, userId);
    const current = settings.linkedFolder;

    const bodyPath = typeof req.body?.path === 'string' ? req.body.path.trim() : '';
    const folderPath = bodyPath || current.path;

    if (!folderPath) {
      return res.status(400).json({ ok: false, error: 'No hay carpeta vinculada. Enviá "path" para vincular una.' });
    }

    // Validación de la carpeta raíz — el containment check de archivos internos
    // (symlinks, etc.) vive en linked-folder.service.js
    const resolved = path.resolve(folderPath);
    let stat;
    try { stat = fs.statSync(resolved); } catch (_) {
      return res.status(400).json({ ok: false, error: `La ruta no existe: ${folderPath}` });
    }
    if (!stat.isDirectory()) {
      return res.status(400).json({ ok: false, error: `La ruta no es una carpeta: ${folderPath}` });
    }

    const scanOptions = {
      maxDepth:    req.body?.maxDepth    ?? current.maxDepth,
      maxFiles:    req.body?.maxFiles    ?? current.maxFiles,
      maxFileSize: req.body?.maxFileSize ?? current.maxFileSize,
      ignoreGlobs: req.body?.ignoreGlobs ?? current.ignoreGlobs,
    };

    const { generateLinkedFolderIndex, loadLinkedFolderManifest } = require('../services/context/linked-folder.service');

    let result;
    try {
      result = await generateLinkedFolderIndex(projectDataPath, resolved, scanOptions);
    } catch (err) {
      // Error de escaneo (permisos, ruta inválida a mitad de camino, etc.) — se persiste
      // para que la UI lo muestre, sin tocar lo que ya estaba indexado antes de este intento.
      settings.linkedFolder = { ...current, path: resolved, status: 'error', lastError: err.message };
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      return res.status(400).json({ ok: false, error: err.message });
    }

    const manifest = loadLinkedFolderManifest(projectDataPath);
    const index = loadIndex(projectId, userId);

    const existingByRelPath = new Map(
      index.items.filter(i => i.source === 'linked-folder').map(i => [i.relPath, i])
    );

    for (const [relPath, meta] of Object.entries(manifest.files)) {
      const prevItem = existingByRelPath.get(relPath);
      if (prevItem) {
        prevItem.enabled = true;
        prevItem.hash = meta.hash;
        prevItem.mtimeMs = meta.mtimeMs;
        prevItem.sizeBytes = meta.sizeBytes;
        continue;
      }
      const id = makeId(index);
      index.items.push({
        id,
        source: 'linked-folder',
        name: relPath.split('/').pop(),
        relPath,
        enabled: true,
        alwaysInclude: false,
        includeWhenMentioned: true,
        priority: 'normal',
        hash: meta.hash,
        mtimeMs: meta.mtimeMs,
        sizeBytes: meta.sizeBytes,
        contentRef: null,
        metaRef: null,
        lastUsedAtMs: null,
        embeddingId: null,
      });
    }

    // Archivos que salieron del manifest (borrados, excluidos por un ignoreGlob nuevo,
    // o desplazados por maxFiles) — se quitan del index para no ofrecer items huérfanos.
    index.items = index.items.filter(i => i.source !== 'linked-folder' || manifest.files[i.relPath]);

    saveIndex(projectId, index, userId);

    settings.linkedFolder = {
      ...current,
      path: resolved,
      enabled: true,
      maxDepth: scanOptions.maxDepth,
      maxFiles: scanOptions.maxFiles,
      maxFileSize: scanOptions.maxFileSize,
      ignoreGlobs: scanOptions.ignoreGlobs,
      lastIndexed: result.generatedAt,
      contentHash: result.contentHash,
      totalFiles: result.total,
      totalSizeBytes: result.totalSizeBytes,
      truncated: !!result.truncated,
      status: 'ok',
      lastError: null,
    };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[ContextCtrl] refreshLinkedFolder error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// POST /project/:projectId/context/linked-folder/toggle
async function toggleLinkedFolder(req, res) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || 'local-user';
    const { enabled } = req.body;
    const projectDataPath = getProjectDataPath(projectId, userId);
    const settingsPath = path.join(projectDataPath, 'projectSettings.json');
    const settings = loadSettings(projectId, userId);

    if (!settings.linkedFolder?.path) {
      return res.status(400).json({ ok: false, error: 'No hay carpeta vinculada' });
    }

    settings.linkedFolder.enabled = !!enabled;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const index = loadIndex(projectId, userId);
    index.items.forEach(item => {
      if (item.source === 'linked-folder') item.enabled = !!enabled;
    });
    saveIndex(projectId, index, userId);

    res.json({ ok: true, enabled: !!enabled });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// POST /project/:projectId/context/snapshot
async function createSnapshot(req, res) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || 'local-user';
    const { snapshotRoot, maxFiles, maxChars } = req.body;

    if (!snapshotRoot || typeof snapshotRoot !== 'string') {
      return res.status(400).json({ ok: false, error: 'snapshotRoot es requerido' });
    }

    const projectDataPath = getProjectDataPath(projectId, userId);
    const { generateSnapshot } = require('../services/context/snapshot.service');

    const result = await generateSnapshot(projectDataPath, snapshotRoot.trim(), {
      maxFiles: maxFiles || 50,
      maxChars: maxChars || 99999999,
    });

    // Registrar archivos del snapshot en el index (source='snapshot')
    // Solo agrega los que no existen aún — idempotente
    const { loadManifest } = require('../services/context/snapshot.service');
    const manifest = loadManifest(projectDataPath);
    if (manifest) {
      const index = loadIndex(projectId, userId);
      const existingRelPaths = new Set(
        index.items.filter(i => i.source === 'snapshot').map(i => i.relPath)
      );

      // Rehabilitar items snapshot existentes que estén desactivados
      index.items.forEach(item => {
        if (item.source === 'snapshot') item.enabled = true;
      });

      for (const [relPath, meta] of Object.entries(manifest.files)) {
        if (existingRelPaths.has(relPath)) continue;

        const id = makeId(index);
        index.items.push({
          id,
          source: 'snapshot',
          name: relPath.split('/').pop(),
          relPath,
          enabled: true,
          alwaysInclude: false,
          includeWhenMentioned: true,
          priority: 'normal',
          hash: meta.hash,
          mtimeMs: meta.mtimeMs,
          sizeBytes: meta.sizeBytes,
          contentRef: null,
          metaRef: null,
          lastUsedAtMs: null,
          embeddingId: null,
        });
      }

      // Limpiar items snapshot cuyos archivos ya no existen en el manifest
      index.items = index.items.filter(i =>
        i.source !== 'snapshot' || manifest.files[i.relPath]
      );

      saveIndex(projectId, index, userId);
      // Lanzar embeddings en child process con 8GB de heap
      try {
        const scriptPath = path.join(__dirname, '../scripts/generate-embeddings.js');
        const child = spawn('node', [scriptPath, projectId, userId], {
          detached: true,
          stdio: 'inherit',
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            GENERATE_EMBEDDINGS: '1',
          }
        });
        child.unref();
        console.log(`[snapshot] Embeddings generándose en background (PID: ${child.pid})`);
      } catch (err) {
        console.warn('[snapshot] No se pudo lanzar child process de embeddings:', err.message);
      }
    }

    res.json({ ok: true, ...result, generatedAt: manifest?.generatedAt });

  } catch (err) {
    console.error('[ContextCtrl] createSnapshot error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// GET /project/:projectId/context/snapshot/status
async function getSnapshotStatus(req, res) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || 'local-user';
    const projectDataPath = getProjectDataPath(projectId, userId);
    const { loadManifest } = require('../services/context/snapshot.service');
    const manifest = loadManifest(projectDataPath);

    if (!manifest) {
      return res.json({ ok: true, hasSnapshot: false });
    }

    res.json({
      ok: true,
      hasSnapshot: true,
      generatedAt: manifest.generatedAt,
      totalFiles: manifest.totalFiles,
      snapshotRoot: manifest.snapshotRoot,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// POST /project/:projectId/patch/apply
async function applyPatch(req, res) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || 'local-user';
    const { filepath, searchContent, replaceContent } = req.body;

    if (!filepath || searchContent === undefined || replaceContent === undefined) {
      return res.status(400).json({ ok: false, error: 'filepath, searchContent y replaceContent son requeridos' });
    }

    // Obtener snapshotRoot del manifest
    const projectDataPath = getProjectDataPath(projectId, userId);
    const { loadManifest } = require('../services/context/snapshot.service');
    const manifest = loadManifest(projectDataPath);

    if (!manifest?.snapshotRoot) {
      return res.status(400).json({ ok: false, error: 'El proyecto no tiene snapshot configurado. Genera uno primero.' });
    }

    const { applyPatch: doApply } = require('../services/patch/apply.service');
    const result = await doApply({
      filepath,
      searchContent,
      replaceContent,
      projectRoot: manifest.snapshotRoot,
      projectDataPath,
    });

    res.json({ ok: true, ...result });

  } catch (err) {
    console.error('[ContextCtrl] applyPatch error:', err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
}

// GET /project/:projectId/patch/applied
// Hashes de los patches ya aplicados en este proyecto. El frontend lo pide una
// vez al abrir un chat y marca los botones "Aplicar" correspondientes — sin
// esto, el estado "ya aplicado" se perdía al recargar y volver a apretar
// duplicaba el cambio en el archivo. Ver DECISIONS.md.
function getAppliedPatches(req, res) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || 'local-user';
    const { loadAppliedPatches } = require('../services/patch/apply.service');
    const applied = loadAppliedPatches(getProjectDataPath(projectId, userId));
    res.json({ ok: true, applied });
  } catch (err) {
    console.error('[ContextCtrl] getAppliedPatches error:', err.message);
    res.json({ ok: true, applied: {} }); // degradar sin romper el chat
  }
}



// POST /project/:projectId/context/snapshot/toggle
async function toggleSnapshot(req, res) {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || 'local-user';
    const { enabled } = req.body;
    const projectDataPath = getProjectDataPath(projectId, userId);
    const { loadManifest } = require('../services/context/snapshot.service');
    const manifest = loadManifest(projectDataPath);

    if (!manifest) {
      return res.status(400).json({ ok: false, error: 'No hay snapshot generado' });
    }

    // Actualizar enabled en todos los items snapshot del index
    const index = loadIndex(projectId, userId);
    index.items.forEach(item => {
      if (item.source === 'snapshot') item.enabled = !!enabled;
    });
    saveIndex(projectId, index, userId);

    res.json({ ok: true, enabled: !!enabled });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// GET /fs/browse?path=H:/
async function browsePath(req, res) {
  try {
    const requestedPath = req.query.path || '';

    // Si no hay path, devolver raíces del sistema
    if (!requestedPath) {
      // En Windows devolver letras de unidad comunes
      const roots = ['C:/', 'D:/', 'E:/', 'F:/', 'G:/', 'H:/'];
      const existing = roots.filter(r => {
        try { fs.accessSync(r); return true; } catch { return false; }
      });
      return res.json({ ok: true, path: '', entries: existing.map(r => ({ name: r, isDir: true })) });
    }

    const resolved = path.resolve(requestedPath);
    const stat = fs.statSync(resolved);

    if (!stat.isDirectory()) {
      return res.status(400).json({ ok: false, error: 'No es una carpeta' });
    }

    const entries = fs.readdirSync(resolved, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => ({ name: e.name, isDir: true }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ ok: true, path: resolved, entries });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
}

module.exports = { listItems, uploadFiles, updateItem, deleteItem, getSettings, updateSettings, createSnapshot, getSnapshotStatus, applyPatch, getAppliedPatches, toggleSnapshot, browsePath, refreshLinkedFolder, toggleLinkedFolder };