let attachedFiles = [];

export function getAttachedFiles() {
  return attachedFiles;
}

export function clearAttachedFiles() {
  attachedFiles = [];
}

export function initAttachments({ fileInput, addFileBtn, attachmentPreview, chatBox, toolMenuPanel }) {

  // Botón añadir archivo
  addFileBtn.addEventListener('click', () => {
    toolMenuPanel.classList.add('hidden');
    fileInput.click();
  });

  // Selección desde input
  fileInput.addEventListener('change', () => {
    addFiles(Array.from(fileInput.files), attachmentPreview);
    fileInput.value = '';
  });

  // Drag & drop sobre el chat
  chatBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    chatBox.classList.add('drag-over');
  });

  chatBox.addEventListener('dragleave', () => {
    chatBox.classList.remove('drag-over');
  });

  chatBox.addEventListener('drop', (e) => {
    e.preventDefault();
    chatBox.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) addFiles(files, attachmentPreview);
  });

  // Drag & drop sobre el input-wrapper también
  const inputWrapper = attachmentPreview.closest('.input-wrapper');
  if (inputWrapper) {
    inputWrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      inputWrapper.classList.add('drag-over');
    });
    inputWrapper.addEventListener('dragleave', () => {
      inputWrapper.classList.remove('drag-over');
    });
    inputWrapper.addEventListener('drop', (e) => {
      e.preventDefault();
      inputWrapper.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) addFiles(files, attachmentPreview);
    });
  }
}

function addFiles(files, attachmentPreview) {
  files.forEach(file => {
    if (attachedFiles.some(f => f.name === file.name && f.size === file.size)) return;
    attachedFiles.push(file);
    renderChip(file, attachmentPreview);
  });

  if (attachedFiles.length > 0) {
    attachmentPreview.classList.remove('hidden');
  }
}

function removeFile(file, chip, attachmentPreview) {
  attachedFiles = attachedFiles.filter(f => f !== file);
  chip.remove();
  if (attachedFiles.length === 0) {
    attachmentPreview.classList.add('hidden');
  }
}

const OCR_RISKY_TYPES = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.docx']);

function isOcrRisky(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  return OCR_RISKY_TYPES.has(ext);
}

function renderChip(file, attachmentPreview) {
  const chip = document.createElement('div');
  chip.className = 'attachment-chip';

  const isImage = file.type.startsWith('image/');

  if (isImage) {
    const img = document.createElement('img');
    img.className = 'attachment-chip-img';
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);
    chip.appendChild(img);
  } else {
    const icon = document.createElement('div');
    icon.className = 'attachment-chip-icon';
    icon.textContent = getFileExtension(file.name);
    chip.appendChild(icon);
  }

  const name = document.createElement('span');
  name.className = 'attachment-chip-name';
  name.textContent = file.name.length > 20
    ? file.name.slice(0, 18) + '…'
    : file.name;
  chip.appendChild(name);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'attachment-chip-remove';
  removeBtn.textContent = '×';
  removeBtn.onclick = (e) => {
    e.stopPropagation();
    removeFile(file, chip, attachmentPreview);
  };
  chip.appendChild(removeBtn);

  if (isOcrRisky(file)) {
    const warn = document.createElement('span');
    warn.className = 'attachment-chip-warn';
    warn.title = 'Este archivo requiere OCR — el resultado puede ser parcial si es escaneado';
    warn.textContent = '⚠';
    chip.appendChild(warn);
  }

  attachmentPreview.appendChild(chip);
}

function getFileExtension(filename) {
  const ext = filename.split('.').pop().toUpperCase();
  return ext.length <= 4 ? ext : 'FILE';
}