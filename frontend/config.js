// Detecta automáticamente si corre en Electron (file://) o en navegador
export const BASE_URL = window.location.protocol === 'file:'
  ? 'http://localhost:3005'
  : '';