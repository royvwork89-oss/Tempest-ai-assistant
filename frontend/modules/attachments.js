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

  // Pegar (Ctrl+V) archivos o imágenes del portapapeles. Se escucha en el
  // documento y no solo en el input porque el evento llega al elemento con
  // foco, que puede ser el cuerpo de la página si el usuario no escribió nada
  // todavía. Los campos de otros paneles se descartan más abajo.
  document.addEventListener('paste', (e) => {
    const target = e.target;
    if (target instanceof HTMLElement) {
      const dentroDelChat =
        (inputWrapper && inputWrapper.contains(target)) || chatBox.contains(target);
      const esCampoDeTexto = target.matches('input, textarea, [contenteditable="true"]');
      // Pegar dentro de un campo de otro panel (configuración, modales) no
      // debe adjuntar nada al chat.
      if (esCampoDeTexto && !dentroDelChat) return;
    }

    const clipboard = e.clipboardData;
    if (!clipboard) return;

    let files = Array.from(clipboard.files || []);
    if (files.length === 0 && clipboard.items) {
      files = Array.from(clipboard.items)
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter(Boolean);
    }

    // Sin archivos es un pegado de texto normal: no se toca.
    if (files.length === 0) return;

    e.preventDefault();
    addFiles(files.map(nombrarSiEsGenerico), attachmentPreview);
  });
}

// Una imagen copiada del portapapeles (una captura de pantalla, por ejemplo)
// llega sin nombre propio: el navegador la entrega como "image.png" o vacía.
// addFiles() descarta duplicados por nombre y tamaño, así que dos capturas
// distintas del mismo tamaño se anularían entre sí. Se les pone la fecha y la
// hora para que cada una sea un archivo distinto. Un archivo copiado del
// explorador sí trae su nombre real y se deja intacto.
function nombrarSiEsGenerico(file, indice) {
  const sinNombrePropio = !file.name || /^(image|blob)\b/i.test(file.name);
  if (!sinNombrePropio) return file;

  const extension = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const ahora = new Date();
  const dosDigitos = (n) => String(n).padStart(2, '0');
  const sello =
    `${ahora.getFullYear()}${dosDigitos(ahora.getMonth() + 1)}${dosDigitos(ahora.getDate())}` +
    `-${dosDigitos(ahora.getHours())}${dosDigitos(ahora.getMinutes())}${dosDigitos(ahora.getSeconds())}`;
  const sufijo = indice > 0 ? `-${indice + 1}` : '';

  try {
    return new File([file], `pegado-${sello}${sufijo}.${extension}`, {
      type: file.type,
      lastModified: Date.now(),
    });
  } catch {
    // Si el entorno no deja construir un File, se usa el original.
    return file;
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