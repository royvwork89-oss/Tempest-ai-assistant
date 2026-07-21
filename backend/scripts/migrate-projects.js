// backend/scripts/migrate-projects.js
const fs   = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config/appPaths');

const PROJECTS_ROOT = path.join(DATA_DIR, 'users/local-user/projects');

function getDefaultSettings() {
  return {
    version: 1,
    prompts: { projectPromptText: '' },
    contextRules: {
      maxFilesPerRequest: 6,
      maxCharsTotal: 18000,
      defaultPolicy: 'always+mentioned',
      mentionMatch: 'name+relPath',
      ignoreGlobs: ['**/node_modules/**','**/.git/**','**/dist/**','**/build/**'],
      maxFileSizeBytes: 10485760,
      maxTotalFilesIndexed: 200,
    },
    fs: { enabled: false, roots: [] },
  };
}

function migrateProject(projectId) {
  const projectPath = path.join(PROJECTS_ROOT, projectId);
  const settingsPath = path.join(projectPath, 'projectSettings.json');
  const indexPath    = path.join(projectPath, 'context', 'index.json');
  const filesDir     = path.join(projectPath, 'context', 'files');

  fs.mkdirSync(filesDir, { recursive: true });

  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(getDefaultSettings(), null, 2));
    console.log(`  ✓ projectSettings.json creado`);
  } else {
    console.log(`  - projectSettings.json ya existe, omitido`);
  }

  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, JSON.stringify({ version: 1, items: [] }, null, 2));
    console.log(`  ✓ context/index.json creado`);
  } else {
    console.log(`  - context/index.json ya existe, omitido`);
  }
}

const projects = fs.readdirSync(PROJECTS_ROOT).filter(name => {
  return fs.statSync(path.join(PROJECTS_ROOT, name)).isDirectory();
});

console.log(`Migrando ${projects.length} proyecto(s)...\n`);
for (const p of projects) {
  console.log(`→ ${p}`);
  migrateProject(p);
}
console.log('\nMigración completa.');