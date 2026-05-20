// backend/controllers/context.controller.js
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { loadIndex, saveIndex, loadSettings, getProjectDataPath } = require('../services/context/context.service');
const { extractText } = require('../services/attachment.service');

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
    const index = loadIndex(projectId);
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
    if (!tempFiles.length) return res.status(400).json({ ok: false, error: 'Sin archivos' });

    const index = loadIndex(projectId);
    const projectDataPath = getProjectDataPath(projectId);
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
        try { fs.unlinkSync(file.path); } catch (_) {}
        continue;
      }

      const contentRef = `files/${id}.txt`;
      const metaRef    = `files/${id}.meta.json`;

      fs.writeFileSync(path.join(projectDataPath, 'context', contentRef), content, 'utf-8');
      fs.writeFileSync(path.join(projectDataPath, 'context', metaRef), JSON.stringify({
        originalName: file.originalname,
        mimetype:     file.mimetype,
        sizeBytes:    file.size,
      }, null, 2));

      const item = {
        id,
        source:               'upload',
        name:                 file.originalname,
        relPath:              file.originalname,
        enabled:              true,
        alwaysInclude:        false,
        includeWhenMentioned: true,
        priority:             'normal',
        hash:                 `sha256:${hash}`,
        mtimeMs:              Date.now(),
        sizeBytes:            file.size,
        contentRef,
        metaRef,
        lastUsedAtMs:         null,
        embeddingId:          null,
      };

      index.items.push(item);
      added.push(item);

      try { fs.unlinkSync(file.path); } catch (_) {}
    }

    saveIndex(projectId, index);
    res.json({ ok: true, added });

  } catch (err) {
    console.error('[ContextCtrl] uploadFiles error:', err);
    // Limpiar temporales si algo falló
    for (const f of tempFiles) {
      try { fs.unlinkSync(f.path); } catch (_) {}
    }
    res.status(500).json({ ok: false, error: err.message });
  }
}

// PATCH /project/:projectId/context/item/:id
async function updateItem(req, res) {
  try {
    const { projectId, id } = req.params;
    const allowed = ['enabled', 'alwaysInclude', 'includeWhenMentioned', 'priority'];
    const index = loadIndex(projectId);
    const item  = index.items.find(i => i.id === id);
    if (!item) return res.status(404).json({ ok: false, error: 'Item no encontrado' });

    for (const key of allowed) {
      if (key in req.body) item[key] = req.body[key];
    }

    saveIndex(projectId, index);
    res.json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// DELETE /project/:projectId/context/item/:id
async function deleteItem(req, res) {
  try {
    const { projectId, id } = req.params;
    const projectDataPath = getProjectDataPath(projectId);
    const index = loadIndex(projectId);
    const idx   = index.items.findIndex(i => i.id === id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Item no encontrado' });

    const item = index.items[idx];

    if (item.source === 'upload') {
      for (const ref of [item.contentRef, item.metaRef]) {
        if (!ref) continue;
        try { fs.unlinkSync(path.join(projectDataPath, 'context', ref)); } catch (_) {}
      }
    }

    index.items.splice(idx, 1);
    saveIndex(projectId, index);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// GET /project/:projectId/settings
async function getSettings(req, res) {
  try {
    const { projectId } = req.params;
    const settings = loadSettings(projectId);
    res.json({ ok: true, settings });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// PATCH /project/:projectId/settings
async function updateSettings(req, res) {
  try {
    const { projectId } = req.params;
    const projectDataPath = getProjectDataPath(projectId);
    const settingsPath = path.join(projectDataPath, 'projectSettings.json');
    const current = loadSettings(projectId);

    if (req.body.prompts)      current.prompts      = { ...current.prompts,      ...req.body.prompts };
    if (req.body.contextRules) current.contextRules = { ...current.contextRules, ...req.body.contextRules };

    fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2));
    res.json({ ok: true, settings: current });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// POST /project/:projectId/context/snapshot
async function createSnapshot(req, res) {
  try {
    const { projectId } = req.params;
    const { snapshotRoot, maxFiles, maxChars } = req.body;

    if (!snapshotRoot || typeof snapshotRoot !== 'string') {
      return res.status(400).json({ ok: false, error: 'snapshotRoot es requerido' });
    }

    const projectDataPath = getProjectDataPath(projectId);
    const { generateSnapshot } = require('../services/context/snapshot.service');

    const result = await generateSnapshot(projectDataPath, snapshotRoot.trim(), {
      maxFiles: maxFiles || 50,
      maxChars:  maxChars  || 120000,
    });

    // Registrar archivos del snapshot en el index (source='snapshot')
    // Solo agrega los que no existen aún — idempotente
    const { loadManifest } = require('../services/context/snapshot.service');
    const manifest = loadManifest(projectDataPath);
    if (manifest) {
      const index = loadIndex(projectId);
      const existingRelPaths = new Set(
        index.items.filter(i => i.source === 'snapshot').map(i => i.relPath)
      );

      for (const [relPath, meta] of Object.entries(manifest.files)) {
        if (existingRelPaths.has(relPath)) continue;

        const id = makeId(index);
        index.items.push({
          id,
          source:               'snapshot',
          name:                 relPath.split('/').pop(),
          relPath,
          enabled:              true,
          alwaysInclude:        false,
          includeWhenMentioned: true,
          priority:             'normal',
          hash:                 meta.hash,
          mtimeMs:              meta.mtimeMs,
          sizeBytes:            meta.sizeBytes,
          contentRef:           null,
          metaRef:              null,
          lastUsedAtMs:         null,
          embeddingId:          null,
        });
      }

      // Limpiar items snapshot cuyos archivos ya no existen en el manifest
      index.items = index.items.filter(i =>
        i.source !== 'snapshot' || manifest.files[i.relPath]
      );

      saveIndex(projectId, index);
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
    const projectDataPath = getProjectDataPath(projectId);
    const { loadManifest } = require('../services/context/snapshot.service');
    const manifest = loadManifest(projectDataPath);

    if (!manifest) {
      return res.json({ ok: true, hasSnapshot: false });
    }

    res.json({
      ok:          true,
      hasSnapshot: true,
      generatedAt: manifest.generatedAt,
      totalFiles:  manifest.totalFiles,
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
    const { filepath, searchContent, replaceContent } = req.body;

    if (!filepath || searchContent === undefined || replaceContent === undefined) {
      return res.status(400).json({ ok: false, error: 'filepath, searchContent y replaceContent son requeridos' });
    }

    // Obtener snapshotRoot del manifest
    const projectDataPath = getProjectDataPath(projectId);
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
      projectRoot:     manifest.snapshotRoot,
      projectDataPath,
    });

    res.json({ ok: true, ...result });

  } catch (err) {
    console.error('[ContextCtrl] applyPatch error:', err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
}

module.exports = { listItems, uploadFiles, updateItem, deleteItem, getSettings, updateSettings, createSnapshot, getSnapshotStatus, applyPatch };