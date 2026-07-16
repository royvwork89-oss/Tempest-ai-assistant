const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  selectFolder: (defaultPath) => ipcRenderer.invoke('select-folder', defaultPath),
  openTranscriptionsFolder: () => ipcRenderer.invoke('open-transcriptions-folder')
});