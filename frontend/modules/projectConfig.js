import {
  getProjectSettings,
  updateProjectSettings
} from '../api.js';

export async function openProjectConfigModal(projectId) {
  const modal     = document.getElementById('projectConfigModal');
  const nameEl    = document.getElementById('projectConfigName');
  const textarea  = document.getElementById('projectPromptTextarea');
  const modelSel  = document.getElementById('projectDefaultModel');
  const modeSel   = document.getElementById('projectDefaultMode');
  const saveBtn   = document.getElementById('saveProjectConfigBtn');
  const cancelBtn = document.getElementById('cancelProjectConfigBtn');

  nameEl.textContent = projectId;
  textarea.value = '';
  modal.classList.remove('hidden');

  try {
    const res = await getProjectSettings(projectId);
    if (res.ok) {
      textarea.value = res.settings?.prompts?.projectPromptText || '';
      const prefs = res.settings?.preferences || {};
      if (modelSel) modelSel.value = prefs.defaultModel || 'auto';
      if (modeSel)  modeSel.value  = prefs.defaultMode  || 'auto';
    }
  } catch (_) {}

  textarea.focus();

  const close = () => modal.classList.add('hidden');

  const newSave   = saveBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  saveBtn.replaceWith(newSave);
  cancelBtn.replaceWith(newCancel);

  newCancel.onclick = close;

  newSave.onclick = async () => {
    newSave.disabled = true;
    newSave.textContent = 'Guardando...';

    try {
      const res = await updateProjectSettings(projectId, {
        prompts: { projectPromptText: textarea.value.trim() },
        preferences: {
          defaultModel: modelSel ? modelSel.value : 'auto',
          defaultMode:  modeSel  ? modeSel.value  : 'auto'
        }
      });
      if (res.ok) close();
      else newSave.textContent = '✗ Error';
    } catch (_) {
      newSave.textContent = '✗ Error';
    } finally {
      newSave.disabled = false;
      if (newSave.textContent === 'Guardando...') newSave.textContent = 'Guardar';
    }
  };

  modal.onclick = (e) => { if (e.target === modal) close(); };
}