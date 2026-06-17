import { listChats, generateTitle, renameChat } from '../api.js';

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

export async function tryAutoRename({ getPendingAutoRename, setPendingAutoRename, loadSidebar, getSidebarDeps, titleText, usedModel = null }) {
  if (!getPendingAutoRename()) return;

  try {
    const renameTarget = { ...getPendingAutoRename() };
    const titleData = await generateTitle(titleText, renameTarget.type, usedModel);

    console.log('[autoRename] titleData:', JSON.stringify(titleData));
    console.log('[autoRename] iniciando rename para:', renameTarget.chatId, 'texto:', titleText?.slice(0, 50));

    if (!titleData.ok || !titleData.title) {
      setPendingAutoRename(null);
      return;
    }

    const chatsData = await listChats(renameTarget.projectId);
    const existingTitles = Array.isArray(chatsData.chats)
      ? chatsData.chats.filter(c => c.chatId !== renameTarget.chatId).map(c => c.title)
      : [];
    const uniqueTitle = makeUniqueChatTitle(titleData.title, existingTitles);
    await renameChat(renameTarget.chatId, uniqueTitle, renameTarget.projectId);

    // chatId nunca cambia — ya no se necesita actualizar chatState ni proteger contra colisión
    setPendingAutoRename(null);
    if (loadSidebar) {
      await loadSidebar(getSidebarDeps());
    }
  } catch (err) {
    console.error('[autoRename] Error al renombrar:', err.message);
  }
}