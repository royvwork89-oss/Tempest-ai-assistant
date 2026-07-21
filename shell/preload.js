const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  selectFolder: (defaultPath) => ipcRenderer.invoke('select-folder', defaultPath),
  openTranscriptionsFolder: () => ipcRenderer.invoke('open-transcriptions-folder'),
  openModelsFolder: () => ipcRenderer.invoke('open-models-folder'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update')
});