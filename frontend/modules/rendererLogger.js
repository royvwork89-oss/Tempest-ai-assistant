// frontend/modules/rendererLogger.js
//
// Captura errores/warnings del renderer (esta parte de la app, la que corre
// en la ventana de Electron) y los manda al backend vía IPC para que queden
// persistidos en el mismo errors-YYYY-MM-DD.jsonl que ya usa
// backend/utils/logger.js — antes, un console.error()/console.warn() acá
// (chat.js, settings.js, etc. — ~30 llamadas repartidas en 11 archivos) solo
// se veía en DevTools; si no tumbaba la ventana entera, quedaba invisible
// para cualquiera que no tuviera DevTools abierto en el momento exacto del
// error. Ver DECISIONS.md → "Captura de errores del frontend/renderer".
//
// Self-inicializable a propósito (efecto secundario al importar el módulo,
// sin un init() aparte que alguien tenga que acordarse de llamar) — se
// importa PRIMERO en app.js, antes que cualquier otro módulo, para capturar
// también errores que puedan ocurrir durante la carga de los módulos
// siguientes.

function _serializeArg(arg) {
  if (arg instanceof Error) {
    return { name: arg.name, message: arg.message, stack: arg.stack };
  }
  if (typeof arg === 'object' && arg !== null) {
    try { return JSON.parse(JSON.stringify(arg)); } catch (_) { return String(arg); }
  }
  return arg;
}

function _send(level, args) {
  // Fuera de Electron (ej. abriendo frontend/index.html directo en un
  // navegador para debug) window.electronAPI no existe — no hay IPC a
  // dónde mandar nada, así que no hacemos nada más que lo que console.*
  // ya hace normalmente.
  if (!window.electronAPI?.logRendererError) return;
  try {
    window.electronAPI.logRendererError(level, args.map(_serializeArg));
  } catch (_) {
    // Nunca dejar que un fallo acá tumbe el flujo que originó el log.
  }
}

(function initRendererErrorLogging() {
  const _originalError = console.error.bind(console);
  const _originalWarn = console.warn.bind(console);

  console.error = (...args) => {
    _originalError(...args);
    _send('error', args);
  };

  console.warn = (...args) => {
    _originalWarn(...args);
    _send('warn', args);
  };

  // Errores que no pasan por console.error — excepciones no atrapadas en
  // código síncrono, y promesas rechazadas sin .catch(). Mismo criterio que
  // process.on('uncaughtException'/'unhandledRejection') del lado backend.
  window.addEventListener('error', (event) => {
    _send('error', [`[window.onerror] ${event.message} (${event.filename}:${event.lineno})`, _serializeArg(event.error)]);
  });

  window.addEventListener('unhandledrejection', (event) => {
    _send('error', ['[unhandledrejection]', _serializeArg(event.reason)]);
  });
})();
