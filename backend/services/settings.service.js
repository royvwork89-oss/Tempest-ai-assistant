'use strict';

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config/appPaths');

// ─── Settings persistentes de la app (hoy solo hardwareProfile, pensado para
// sumar más claves acá si hace falta) — vive en DATA_DIR, la misma raíz que
// ya usan users.json/search-config.json, así que sigue el mismo patrón: en
// Electron empaquetado resuelve a app.getPath('userData') (vía APP_DATA_DIR
// en appPaths.js), sobrevive actualizaciones/reinstalaciones porque nunca
// está dentro de la carpeta de instalación. En desarrollo cae en backend/data.
//
// Por qué un archivo nuevo y no reusar search-config.json: ese archivo ya
// tiene su propio schema (providers, perfiles de búsqueda) documentado en
// DECISIONS.md — mezclar hardwareProfile ahí hubiera acoplado dos conceptos
// sin relación. Un archivo chico y de propósito único es más fácil de leer
// y de extender después.
const SETTINGS_PATH = path.join(DATA_DIR, 'app-settings.json');

const VALID_PROFILES = ['laptop', 'desktop'];

function _readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    return {}; // no existe todavía (primer arranque) o está corrupto — no romper por esto
  }
}

function _writeSettings(patch) {
  const next = { ..._readSettings(), ...patch };
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
  return next;
}

// ─── Orden de resolución del perfil activo:
//   1. app-settings.json (lo que eligió el usuario en Configuración, o lo que
//      escribió el instalador en el primer setup)
//   2. process.env.HARDWARE_PROFILE (compatibilidad con el .env que ya usa
//      el desktop de Roy hoy — no se rompe nada en esa máquina con este cambio)
//   3. 'desktop' — default conservador si no hay nada configurado
function getHardwareProfile() {
  const saved = _readSettings().hardwareProfile;
  if (VALID_PROFILES.includes(saved)) return saved;

  const fromEnv = process.env.HARDWARE_PROFILE;
  if (VALID_PROFILES.includes(fromEnv)) return fromEnv;

  return 'desktop';
}

// true solo si el usuario (o el instalador) ya eligió explícitamente un
// perfil — útil si en el futuro se quiere mostrar un aviso de "primera vez"
// en la UI en vez de asumir 'desktop' en silencio.
function hasHardwareProfileSet() {
  return VALID_PROFILES.includes(_readSettings().hardwareProfile);
}

function setHardwareProfile(profile) {
  if (!VALID_PROFILES.includes(profile)) {
    throw new Error(`Perfil de hardware inválido: "${profile}" (válidos: ${VALID_PROFILES.join(', ')})`);
  }
  _writeSettings({ hardwareProfile: profile });
  return profile;
}

// NOTA: getLogQuestionText/setLogQuestionText/getLogResponseText/
// setLogResponseText vivieron acá como switch GLOBAL — se eliminaron y se
// reemplazaron por consentimiento POR USUARIO: un único campo
// `allowPersonalDataLog` en users.json (ver auth.service.js's
// `getUserLogConsent`/`setUserLogConsent`), gestionado desde Servicios →
// Búsqueda web, junto al selector de usuario, en vez de Preferencias. Ver
// DECISIONS.md → "Trace de ejecución por request — consentimiento de log por
// usuario".

module.exports = {
  VALID_PROFILES,
  getHardwareProfile,
  setHardwareProfile,
  hasHardwareProfileSet
};
