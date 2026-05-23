import { listChats, generateTitle, renameChat } from '../api.js';
import { setActiveChat } from '../chatState.js';

export function makeUniqueChatTitle(title, existingChats) {
  let cleanTitle = String(title || 'Nueva conversación')
    .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'Nueva conversación';

  if (!Array.isArray(existingChats) || !existingChats.includes(cleanTitle))
    return cleanTitle;

  let counter = 2;
  let uniqueTitle = `${cleanTitle} ${counter}`;
  while (existingChats.includes(uniqueTitle)) { counter++; uniqueTitle = `${cleanTitle} ${counter}`; }
  return uniqueTitle;
}

export async function tryAutoRename({ getPendingAutoRename, setPendingAutoRename, loadSidebar, getSidebarDeps, titleText }) {
  if (!getPendingAutoRename()) return;

  const renameTarget = { ...getPendingAutoRename() };
  const titleData = await generateTitle(titleText, renameTarget.type);

  if (titleData.ok && titleData.title) {
    const chatsData = await listChats(renameTarget.projectId);
    const existingChats = Array.isArray(chatsData.chats)
      ? chatsData.chats.filter(c => c !== renameTarget.chatId)
      : [];
    const uniqueTitle = makeUniqueChatTitle(titleData.title, existingChats);
    await renameChat(renameTarget.chatId, uniqueTitle, renameTarget.projectId);
    setActiveChat({
      projectId: renameTarget.projectId,
      chatId: uniqueTitle,
      mode: renameTarget.projectId === 'general' ? 'chat' : 'project'
    });
    setPendingAutoRename(null);
    await loadSidebar(getSidebarDeps());
  }
}