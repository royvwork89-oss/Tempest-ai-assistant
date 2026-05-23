import { transcribeAudio, generateTitle, listChats, renameChat } from '../api.js';
import { addMessage, addDocumentCard, showErrorToast, addErrorMessage } from '../ui.js';
import { setActiveChat } from '../chatState.js';

export function initTranscription(deps) {
  const {
    transcriptionBtn,
    transcriptionModal,
    transcriptionAudioInput,
    transcriptionMode,
    transcriptionFormat,
    cancelTranscriptionBtn,
    processTranscriptionBtn,
    toolMenuPanel,
    chatBox,
    typing,
    sendBtn,
    userInput,
    loadSidebar,
    getSidebarDeps,
    ensureGeneralChatExists,
    makeUniqueChatTitle,
    getPendingAutoRename,
    setPendingAutoRename
  } = deps;

  transcriptionBtn.addEventListener('click', () => {
    toolMenuPanel.classList.add('hidden');
    transcriptionModal.classList.remove('hidden');
  });

  cancelTranscriptionBtn.addEventListener('click', () => transcriptionModal.classList.add('hidden'));

  processTranscriptionBtn.addEventListener('click', async () => {
    const file = transcriptionAudioInput.files[0];

    if (!file) {
      showErrorToast('Selecciona un archivo de audio antes de continuar.');
      return;
    }

    const selectedMode = transcriptionMode.value;
    const selectedFormat = transcriptionFormat.value;

    transcriptionModal.classList.add('hidden');
    await ensureGeneralChatExists();

    const transcriptionTitlePrompt = [
      'Transcripción de audio',
      `Archivo: ${file.name}`,
      `Formato: ${selectedFormat.toUpperCase()}`,
      `Modo: ${selectedMode === 'timestamps' ? 'Con divisiones de tiempo' : 'Texto corrido'}`
    ].join('\n');

    addMessage(
      chatBox,
      'Tempest',
      `🎙️ Estoy transcribiendo el audio.\n\nArchivo: ${file.name}\nFormato: ${selectedFormat.toUpperCase()}\nModo: ${selectedMode === 'timestamps' ? 'Con divisiones de tiempo' : 'Texto corrido'}\n\nEsto puede tardar según la duración del audio.`
    );

    typing.textContent = 'Transcribiendo audio...';
    sendBtn.disabled = true;
    transcriptionBtn.disabled = true;
    userInput.disabled = true;

    try {
      const data = await transcribeAudio(file, {
        mode: selectedMode,
        format: selectedFormat
      });

      if (!data.ok) {
        throw new Error(data.error || 'Error en transcripción');
      }

      addMessage(chatBox, 'Tempest', '✅ Transcripción finalizada. Ya generé el documento.');

      const transcription = data.transcription;
      const filename = transcription.fileUrl.split('/').pop();

      addDocumentCard(chatBox, {
        title: 'Transcripción de audio',
        format: transcription.format,
        filename,
        fileUrl: transcription.fileUrl,
        downloadUrl: transcription.fileUrl,
        previewText: [
          `Archivo generado: ${filename}`,
          `Formato: ${String(transcription.format || '').toUpperCase()}`,
          `Modo: ${transcription.mode === 'timestamps' ? 'Con divisiones de tiempo' : 'Texto corrido'}`,
          '',
          transcription.message || 'Transcripción finalizada correctamente.'
        ].join('\n')
      });

      const pendingAutoRename = getPendingAutoRename();
      if (pendingAutoRename) {
        const renameTarget = { ...pendingAutoRename };

        const titleData = await generateTitle(transcriptionTitlePrompt, renameTarget.type);

        if (titleData.ok && titleData.title) {
          const chatsData = await listChats(renameTarget.projectId);
          const existingChats = Array.isArray(chatsData.chats)
            ? chatsData.chats.filter(c => c !== renameTarget.chatId)
            : [];

          const uniqueTitle = makeUniqueChatTitle(titleData.title, existingChats);

          await renameChat(renameTarget.chatId, uniqueTitle, renameTarget.projectId);

          setActiveChat({
            projectId: renameTarget.projectId,
            chatId: uniqueTitle,
            mode: renameTarget.projectId === 'general' ? 'chat' : 'project'
          });

          setPendingAutoRename(null);
          await loadSidebar(getSidebarDeps());
        }
      }

    } catch (error) {
      console.error(error);
      showErrorToast('Error al procesar el audio. Revisa que LocalAI/Whisper esté activo.');
      addErrorMessage(chatBox, 'No pude procesar el audio. Verifica que el archivo sea válido y que Whisper esté funcionando.');
    } finally {
      typing.textContent = '';
      sendBtn.disabled = false;
      transcriptionBtn.disabled = false;
      userInput.disabled = false;
      transcriptionAudioInput.value = '';
      userInput.focus();
    }
  });
}