const fs = require('fs');
const path = require('path');

const DEFAULT_USER_ID = 'local-user';
const DEFAULT_PROJECT_ID = 'tempest';
const DEFAULT_CHAT_ID = 'default';

const MAX_WORKING_MEMORY = 12;

const dataPath = path.join(__dirname, '../data');
const usersPath = path.join(dataPath, 'users');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      writeJson(filePath, fallback);
      return fallback;
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`Error al leer JSON: ${filePath}`, error);
    return fallback;
  }
}

function writeJson(filePath, data) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error al guardar JSON: ${filePath}`, error);
  }
}

function getPaths(options = {}) {
  const userId = options.userId || DEFAULT_USER_ID;
  const projectId = options.projectId || DEFAULT_PROJECT_ID;
  const chatId = options.chatId || DEFAULT_CHAT_ID;

  const userPath = path.join(usersPath, userId);
  const projectPath = path.join(userPath, 'projects', projectId);
  const chatsPath = path.join(projectPath, 'chats');

  return {
    userId,
    projectId,
    chatId,
    userPath,
    projectPath,
    projectDir: projectPath,
    projectsDir: path.join(userPath, 'projects'),
    chatsPath,
    chatsDir: chatsPath,
    profileFile: path.join(userPath, 'profile.json'),
    projectMemoryFile: path.join(projectPath, 'projectMemory.json'),
    chatFile: path.join(chatsPath, `${chatId}.json`)
  };
}

function getInitialProfile() {
  return {
    name: '',
    previousNames: [],
    birthPlace: '',
    nationality: '',
    likes: [],
    goals: [],
    preferences: [],
    currentProject: ''
  };
}

function getInitialProjectMemory() {
  return {
    projectId: DEFAULT_PROJECT_ID,
    name: 'Tempest',
    facts: [],
    goals: [],
    currentTasks: [],
    decisions: [],
    summary: ''
  };
}

function getInitialChatMemory() {
  return {
    chatId: DEFAULT_CHAT_ID,
    title: 'Nuevo chat',
    chatHistory: [],
    workingMemory: []
  };
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function capitalizeText(value) {
  const clean = normalizeText(value).toLowerCase();

  return clean.replace(/\b[a-záéíóúñ]/gi, char => char.toUpperCase());
}

function addUnique(array, value) {
  const cleanValue = normalizeText(value);

  if (!cleanValue) return array;

  const exists = array.some(
    item => item.toLowerCase() === cleanValue.toLowerCase()
  );

  if (!exists) {
    array.push(cleanValue);
  }

  return array;
}

function loadProfile(options = {}) {
  const paths = getPaths(options);
  return readJson(paths.profileFile, getInitialProfile());
}

function saveProfile(profile, options = {}) {
  const paths = getPaths(options);
  writeJson(paths.profileFile, profile);
  return profile;
}

function loadProjectMemory(options = {}) {
  const paths = getPaths(options);
  return readJson(paths.projectMemoryFile, getInitialProjectMemory());
}

function saveProjectMemory(projectMemory, options = {}) {
  const paths = getPaths(options);
  writeJson(paths.projectMemoryFile, projectMemory);
  return projectMemory;
}

function loadChatMemory(options = {}) {
  const paths = getPaths(options);
  return readJson(paths.chatFile, {
    ...getInitialChatMemory(),
    chatId: paths.chatId
  });
}

function saveChatMemory(chatMemory, options = {}) {
  const paths = getPaths(options);
  writeJson(paths.chatFile, chatMemory);
  return chatMemory;
}

function addChatHistoryMessage(role, content, options = {}) {
  const chatMemory = loadChatMemory(options);

  chatMemory.chatHistory = Array.isArray(chatMemory.chatHistory)
    ? chatMemory.chatHistory
    : [];

  chatMemory.chatHistory.push({
    role,
    content,
    timestamp: new Date().toISOString()
  });

  saveChatMemory(chatMemory, options);
}

function getChatHistory(options = {}) {
  const chatMemory = loadChatMemory(options);

  return Array.isArray(chatMemory.chatHistory)
    ? chatMemory.chatHistory
    : [];
}

function clearChatHistory(options = {}) {
  const chatMemory = loadChatMemory(options);

  chatMemory.chatHistory = [];
  saveChatMemory(chatMemory, options);
}

function loadMemory(options = {}) {
  return {
    profile: loadProfile(options),
    projectMemory: loadProjectMemory(options),
    chatMemory: loadChatMemory(options)
  };
}

function saveMemory(memory, options = {}) {
  if (memory.profile) saveProfile(memory.profile, options);
  if (memory.projectMemory) saveProjectMemory(memory.projectMemory, options);
  if (memory.chatMemory) saveChatMemory(memory.chatMemory, options);

  return loadMemory(options);
}

function isImportantMessage(content) {
  const text = content.toLowerCase();

  // No guardar preguntas como memoria
  if (text.includes('?') || text.includes('¿')) return false;

  return (
    text.includes('me llamo') ||
    text.includes('mi nombre') ||
    text.includes('soy de') ||
    text.includes('nací en') ||
    text.includes('naci en') ||
    text.includes('mi nacionalidad es') ||
    (text.includes('tengo') && text.includes('años')) ||
    text.includes('me gusta') ||
    text.includes('quiero aprender') ||
    text.includes('quiero') ||
    text.includes('estoy trabajando en') ||
    text.includes('trabajo en') ||
    text.includes('prefiero')
  );
}

function isGarbage(text) {
  const cleanText = text.toLowerCase();

  return (
    cleanText.includes('://') ||
    cleanText.length < 5 ||
    cleanText.trim() === '//' ||
    cleanText.includes('<|')
  );
}

function addMessage(role, content, options = {}) {
  const chatMemory = loadChatMemory(options);

  // 🧠 SOLO guardar mensajes importantes del usuario
  if (role === 'user') {
    if (!isImportantMessage(content)) return;

    chatMemory.workingMemory.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
  }

  // ❌ NO guardar respuestas del assistant
  // Evita que el modelo contamine la memoria con cosas inventadas.

  if (chatMemory.workingMemory.length > MAX_WORKING_MEMORY) {
    chatMemory.workingMemory =
      chatMemory.workingMemory.slice(-MAX_WORKING_MEMORY);
  }

  saveChatMemory(chatMemory, options);
}

function getWorkingMemory(options = {}) {
  return loadChatMemory(options).workingMemory;
}

function clearWorkingMemory(options = {}) {
  const chatMemory = loadChatMemory(options);
  chatMemory.workingMemory = [];
  saveChatMemory(chatMemory, options);
}

function updateProfile(newData, options = {}) {
  const profile = loadProfile(options);

  const updatedProfile = {
    ...profile,
    ...newData
  };

  return saveProfile(updatedProfile, options);
}

function updateProjectMemory(newData, options = {}) {
  const projectMemory = loadProjectMemory(options);

  const updatedProjectMemory = {
    ...projectMemory,
    ...newData
  };

  return saveProjectMemory(updatedProjectMemory, options);
}

function updateSummary(newSummary, options = {}) {
  const projectMemory = loadProjectMemory(options);
  projectMemory.summary = newSummary;
  saveProjectMemory(projectMemory, options);
  return projectMemory.summary;
}

function getFullMemory(options = {}) {
  const memory = loadMemory(options);

  return {
    profile: memory.profile,
    projectMemory: memory.projectMemory,
    chatMemory: memory.chatMemory,

    // Compatibilidad temporal con tu localai.service.js actual
    workingMemory: memory.chatMemory.workingMemory,
    summary: memory.projectMemory.summary || ''
  };
}

function getUserData(options = {}) {
  return loadProfile(options);
}

function getHistory(options = {}) {
  const chatMemory = loadChatMemory(options);

  return chatMemory.workingMemory.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

function isTestOrExampleMessage(text) {
  const lowerText = text.toLowerCase();

  return (
    lowerText.includes('ejemplo') ||
    lowerText.includes('por ejemplo') ||
    lowerText.includes('supongamos') ||
    lowerText.includes('imagina que') ||
    lowerText.includes('para pruebas') ||
    lowerText.includes('de prueba') ||
    lowerText.includes('usa el nombre') ||
    lowerText.includes('ponle el nombre')
  );
}

function detectUserData(message, options = {}) {
  const text = normalizeText(message);

  if (!text || isTestOrExampleMessage(text)) {
    return;
  }

  const profile = loadProfile(options);
  const projectMemory = loadProjectMemory(options);

  const dislikePatterns = [
    /no me gusta\s+(.+)/i,
    /ya no me gusta\s+(.+)/i,
    /no es cierto que me gusta\s+(.+)/i
  ];

  for (const pattern of dislikePatterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      const value = normalizeText(match[1])
        .replace(/^la\s+|^el\s+|^los\s+|^las\s+/i, '');

      profile.likes = Array.isArray(profile.likes) ? profile.likes : [];

      profile.likes = profile.likes.filter(
        item => item.toLowerCase() !== value.toLowerCase()
      );

      saveProfile(profile, options);
      return;
    }
  }

  const namePatterns = [
    /me llamo\s+([a-záéíóúñ]+)/i,
    /mi nombre es\s+([a-záéíóúñ]+)/i
  ];

  const birthPlacePatterns = [
    /nac[ií]\s+en\s+([a-záéíóúñ\s]+)/i,
    /soy\s+de\s+([a-záéíóúñ\s]+)/i
  ];

  const nationalityPatterns = [
    /mi nacionalidad es\s+([a-záéíóúñ\s]+)/i,
    /soy\s+(mexicano|mexicana|español|española|argentino|argentina|colombiano|colombiana|chileno|chilena|peruano|peruana)/i
  ];

  const likePatterns = [
    /me gusta\s+(.+)/i,
    /me gustan\s+(.+)/i
  ];

  const goalPatterns = [
    /quiero aprender\s+(.+)/i,
    /quiero\s+(.+)/i,
    /mi objetivo es\s+(.+)/i
  ];

  const preferencePatterns = [
    /prefiero\s+(.+)/i,
    /me gusta que respondas\s+(.+)/i
  ];

  const currentProjectPatterns = [
    /estoy trabajando en\s+(.+)/i,
    /trabajo en\s+(.+)/i,
    /mi proyecto actual es\s+(.+)/i
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      const extractedName = capitalizeText(match[1]);

      if (profile.name && profile.name !== extractedName) {
        profile.previousNames = Array.isArray(profile.previousNames)
          ? profile.previousNames
          : [];

        addUnique(profile.previousNames, profile.name);
      }

      profile.name = extractedName;
      break;
    }
  }

  for (const pattern of birthPlacePatterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      profile.birthPlace = capitalizeText(match[1]);
      break;
    }
  }

  for (const pattern of nationalityPatterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      profile.nationality = capitalizeText(match[1]);
      break;
    }
  }

  for (const pattern of likePatterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      profile.likes = Array.isArray(profile.likes) ? profile.likes : [];
      addUnique(profile.likes, match[1]);
      break;
    }
  }

  for (const pattern of goalPatterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      profile.goals = Array.isArray(profile.goals) ? profile.goals : [];
      addUnique(profile.goals, match[1]);
      break;
    }
  }

  for (const pattern of preferencePatterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      profile.preferences = Array.isArray(profile.preferences)
        ? profile.preferences
        : [];

      addUnique(profile.preferences, match[1]);
      break;
    }
  }

  for (const pattern of currentProjectPatterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      profile.currentProject = normalizeText(match[1]);

      projectMemory.currentTasks = Array.isArray(projectMemory.currentTasks)
        ? projectMemory.currentTasks
        : [];

      addUnique(projectMemory.currentTasks, match[1]);
      break;
    }
  }

  saveProfile(profile, options);
  saveProjectMemory(projectMemory, options);
}

function listChats(options = {}) {
  const paths = getPaths(options);
  const fs = require('fs');

  if (!fs.existsSync(paths.chatsDir)) return [];

  return fs.readdirSync(paths.chatsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => {
      const chatId = file.replace('.json', '');
      const chatMemory = loadChatMemory({ ...options, chatId });
      return { chatId, title: chatMemory.title || chatId };
    });
}

function createChat(chatId, options = {}) {
  const newOptions = { ...options, chatId };
  const chatMemory = getInitialChatMemory();

  chatMemory.chatId = chatId;
  chatMemory.title = chatId; // título inicial = chatId hasta que autoRename lo actualice

  saveChatMemory(chatMemory, newOptions);

  return chatId;
}

function deleteChat(chatId, options = {}) {
  const paths = getPaths({ ...options, chatId });
  const fs = require('fs');

  if (fs.existsSync(paths.chatFile)) {
    fs.unlinkSync(paths.chatFile);
  }
}

function listProjects(options = {}) {
  const paths = getPaths(options);
  const fs = require('fs');

  const projectsDir = paths.projectsDir;

  if (!fs.existsSync(projectsDir)) return [];

  return fs.readdirSync(projectsDir);
}

function createProject(projectId, options = {}) {
  const paths = getPaths({ ...options, projectId });
  const fs = require('fs');

  if (!fs.existsSync(paths.projectDir)) {
    fs.mkdirSync(paths.projectDir, { recursive: true });
  }

  // crear memoria del proyecto
  writeJson(paths.projectMemoryFile, {
    ...getInitialProjectMemory(),
    projectId,
    name: projectId
  });

  // crear primer chat automáticamente
  createChat('default', { ...options, projectId });

  return projectId;
}

function deleteProject(projectId, options = {}) {
  const paths = getPaths({ ...options, projectId });
  const fs = require('fs');

  if (fs.existsSync(paths.projectDir)) {
    fs.rmSync(paths.projectDir, { recursive: true, force: true });
  }
}

function renameChat(chatId, newTitle, options = {}) {
  const paths = getPaths({ ...options, chatId });

  if (!fs.existsSync(paths.chatFile)) {
    throw new Error('El chat no existe');
  }

  // chatId es inmutable — solo se actualiza el título visible dentro del JSON.
  // El archivo en disco sigue llamándose {chatId}.json para siempre.
  const chatMemory = loadChatMemory({ ...options, chatId });
  chatMemory.title = newTitle;
  saveChatMemory(chatMemory, { ...options, chatId });

  return chatId;
}

function renameProject(oldProjectId, newProjectId, options = {}) {
  const oldPaths = getPaths({ ...options, projectId: oldProjectId });
  const newPaths = getPaths({ ...options, projectId: newProjectId });

  if (!fs.existsSync(oldPaths.projectDir)) {
    throw new Error('El proyecto no existe');
  }

  if (fs.existsSync(newPaths.projectDir)) {
    throw new Error('Ya existe un proyecto con ese nombre');
  }

  ensureDir(path.dirname(newPaths.projectDir));
  fs.renameSync(oldPaths.projectDir, newPaths.projectDir);

  const projectMemory = loadProjectMemory({ ...options, projectId: newProjectId });
  projectMemory.projectId = newProjectId;
  projectMemory.name = newProjectId;
  saveProjectMemory(projectMemory, { ...options, projectId: newProjectId });

  return newProjectId;
}

module.exports = {
  DEFAULT_USER_ID,
  DEFAULT_PROJECT_ID,
  DEFAULT_CHAT_ID,

  loadMemory,
  saveMemory,

  loadProfile,
  saveProfile,
  loadProjectMemory,
  saveProjectMemory,
  loadChatMemory,
  saveChatMemory,

  addMessage,
  getWorkingMemory,
  updateProfile,
  updateProjectMemory,
  updateSummary,
  clearWorkingMemory,
  getFullMemory,
  detectUserData,
  getUserData,
  getHistory,
  addChatHistoryMessage,
  getChatHistory,
  clearChatHistory,
  listChats,
  createChat,
  deleteChat,
  listProjects,
  createProject,
  deleteProject,
  renameChat,
  renameProject

};