import { deleteChat, deleteProject, renameChat, renameProject } from '../api.js';
import { setActiveChat } from '../chatState.js';
import {
  setPendingDelete,
  setPendingBulkDelete,
  getPendingDelete,
  getPendingBulkDelete,
  clearSelection
} from './sidebar.js';
import { openProjectConfigModal } from './projectConfig.js';

function validateName(name) {
  if (!name || !name.trim()) return 'El nombre no puede estar vacío.';
  if (name.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres.';
  if (/[\\/:*?"<>|]/.test(name)) return 'El nombre contiene caracteres no permitidos: \\ / : * ? " < > |';
  if (/^\./.test(name.trim())) return 'El nombre no puede empezar con un punto.';
  if (name.trim().length > 60) return 'El nombre es demasiado largo (máximo 60 caracteres).';
  return null;
}

export function initModals(deps) {
  const {
    deleteConfirmModal,
    newProjectModal,
    newProjectNameInput,
    cancelDeleteBtn,
    confirmDeleteBtn,
    cancelNewProjectBtn,
    confirmNewProjectBtn,
    chatBox,
    fileInput,
    addFileBtn,
    toolMenuPanel,
    userInput,
    loadSidebar,
    getSidebarDeps,
    initAttachments,
    renderWelcomeScreen,
    setPendingAutoRename
  } = deps;

  // ── Modal confirmar eliminar ───────────────────────────────
  cancelDeleteBtn.onclick = () => {
    setPendingDelete(null);
    setPendingBulkDelete(null);
    deleteConfirmModal.classList.add('hidden');
  };

  confirmDeleteBtn.onclick = async () => {
    const bulk = getPendingBulkDelete();
    if (bulk) {
      for (const chatId of bulk.chatIds) {
        await deleteChat(chatId, bulk.projectId);
      }
      setPendingBulkDelete(null);
      clearSelection();
      deleteConfirmModal.classList.add('hidden');
      renderWelcomeScreen();
      initAttachments({
        fileInput,
        addFileBtn,
        attachmentPreview: document.getElementById('attachmentPreview'),
        chatBox,
        toolMenuPanel
      });
      await loadSidebar(getSidebarDeps());
      return;
    }

    const pending = getPendingDelete();
    if (!pending) return;

    if (pending.type === 'chat') await deleteChat(pending.id, pending.projectId);
    if (pending.type === 'project') await deleteProject(pending.id);

    setPendingDelete(null);
    deleteConfirmModal.classList.add('hidden');
    renderWelcomeScreen();
    await loadSidebar(getSidebarDeps());
  };

  // ── Modal nuevo proyecto ──────────────────────────────────
  document.getElementById('newProjectBtn').onclick = () => {
    newProjectNameInput.value = '';
    newProjectModal.classList.remove('hidden');
    newProjectNameInput.focus();
  };

  cancelNewProjectBtn.onclick = () => newProjectModal.classList.add('hidden');

  newProjectNameInput.addEventListener('input', () => {
    newProjectNameInput.setCustomValidity('');
  });

  confirmNewProjectBtn.onclick = async () => {
    const projectName = newProjectNameInput.value.trim();

    const invalidChars = /[\\/:*?"<>|]/;
    if (!projectName) {
      newProjectNameInput.setCustomValidity('El nombre no puede estar vacío.');
      newProjectNameInput.reportValidity();
      return;
    }
    if (projectName.length < 2) {
      newProjectNameInput.setCustomValidity('Mínimo 2 caracteres.');
      newProjectNameInput.reportValidity();
      return;
    }
    if (invalidChars.test(projectName)) {
      newProjectNameInput.setCustomValidity('Caracteres no permitidos: \\ / : * ? " < > |');
      newProjectNameInput.reportValidity();
      return;
    }
    if (projectName.length > 60) {
      newProjectNameInput.setCustomValidity('Máximo 60 caracteres.');
      newProjectNameInput.reportValidity();
      return;
    }
    newProjectNameInput.setCustomValidity('');

    const { createProject } = await import('../api.js');
    await createProject(projectName);

    setActiveChat({ projectId: projectName, chatId: null, mode: 'landing' });
    setPendingAutoRename(null);
    newProjectModal.classList.add('hidden');
    renderWelcomeScreen();
    await loadSidebar(getSidebarDeps());
    openProjectConfigModal(projectName);
  };
}

export function openRenameModal({ type, id, projectId, onLoadSidebar }) {
  const modal     = document.getElementById('renameModal');
  const label     = document.getElementById('renameModalLabel');
  const input     = document.getElementById('renameModalInput');
  const cancelBtn = document.getElementById('cancelRenameBtn');
  const confirmBtn = document.getElementById('confirmRenameBtn');

  label.textContent = type === 'project' ? 'Nuevo nombre del proyecto' : 'Nuevo nombre del chat';
  input.value = id;
  modal.classList.remove('hidden');
  input.focus();
  input.select();

  const newCancel  = cancelBtn.cloneNode(true);
  const newConfirm = confirmBtn.cloneNode(true);
  cancelBtn.replaceWith(newCancel);
  confirmBtn.replaceWith(newConfirm);

  const close = () => modal.classList.add('hidden');

  newCancel.onclick = close;

  newConfirm.onclick = async () => {
    const newName = input.value.trim();
    if (!newName || newName === id) { close(); return; }

    const error = validateName(newName);
    if (error) {
      const errorEl = modal.querySelector('.rename-modal-error') || (() => {
        const el = document.createElement('p');
        el.className = 'rename-modal-error';
        input.insertAdjacentElement('afterend', el);
        return el;
      })();
      errorEl.textContent = error;
      return;
    }

    const errorEl = modal.querySelector('.rename-modal-error');
    if (errorEl) errorEl.remove();

    if (type === 'chat') await renameChat(id, newName, projectId);
    if (type === 'project') await renameProject(id, newName);
    close();
    await onLoadSidebar();
  };

  input.onkeydown = async (e) => {
    if (e.key === 'Enter') newConfirm.onclick();
    if (e.key === 'Escape') close();
  };
}