'use strict';

const path = require('path');

// ─── Raíz única de datos escribibles — separada de dónde está INSTALADA la
// app. En Electron empaquetado, shell/main.js setea APP_DATA_DIR =
// app.getPath('userData') antes de requerir server.js (mismo patrón que ya
// usa con MODELS_DIR). Sin esto, el backend escribía dentro de su propia
// carpeta de instalación (backend/data, backend/uploads, backend/outputs) —
// funciona en desarrollo y en instalaciones por-usuario, pero rompe con
// EPERM si el usuario instala en una carpeta protegida como Program Files
// (ver DECISIONS.md → "Instalador — EPERM al escribir dentro de Program Files").
//
// En desarrollo (APP_DATA_DIR sin definir) el fallback es backend/ tal cual
// — cero cambio de comportamiento para quien corre `npm start` en el repo.
const APP_DATA_DIR = process.env.APP_DATA_DIR
  ? path.resolve(process.env.APP_DATA_DIR)
  : path.join(__dirname, '..');

const DATA_DIR    = path.join(APP_DATA_DIR, 'data');
const UPLOADS_DIR = path.join(APP_DATA_DIR, 'uploads');
const OUTPUTS_DIR = path.join(APP_DATA_DIR, 'outputs');
const LOGS_DIR    = path.join(APP_DATA_DIR, 'logs');

module.exports = { APP_DATA_DIR, DATA_DIR, UPLOADS_DIR, OUTPUTS_DIR, LOGS_DIR };
