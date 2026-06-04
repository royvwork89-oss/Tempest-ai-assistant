const ADMIN_MODE = process.env.ADMIN_MODE === 'true';

let devModeEnabled = false;

function isAdmin() {
  return ADMIN_MODE;
}

function isDevModeEnabled() {
  return devModeEnabled;
}

function toggleDevMode(value) {
  if (!ADMIN_MODE) return false;
  devModeEnabled = typeof value === 'boolean' ? value : !devModeEnabled;
  return devModeEnabled;
}

module.exports = { isAdmin, isDevModeEnabled, toggleDevMode };