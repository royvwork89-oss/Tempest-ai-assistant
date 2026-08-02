const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  selectFolder: (defaultPath) => ipcRenderer.invoke('select-folder', defaultPath),
  openTranscriptionsFolder: () => ipcRenderer.invoke('open-transcriptions-folder'),
  openModelsFolder: () => ipcRenderer.invoke('open-models-folder'),
  openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),
  openChatFolder: (chatId) => ipcRenderer.invoke('open-chat-folder', chatId),
  openProjectFolder: (projectId) => ipcRenderer.invoke('open-project-folder', projectId),
  // send() (fire-and-forget), no invoke() — el renderer no necesita esperar
  // respuesta para loguear un error, y usar invoke() acá agregaría latencia
  // a cada console.error/warn de la UI sin ningún beneficio. Ver
  // frontend/modules/rendererLogger.js.
  logRendererError: (level, args) => ipcRenderer.send('renderer-log', { level, args }),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update')
});