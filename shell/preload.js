// Fase 1 — mínimo necesario
// En Fase 2 se expondrá aquí la API para diálogos nativos de carpetas
// via contextBridge.exposeInMainWorld(...)
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true
});