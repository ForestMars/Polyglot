// src/services/backgroundSync.ts
import { indexedDbStorage } from './indexedDbStorage';
import { Conversation } from '../types/conversation';

const CHAT_STORE_URL = '/chatStore.json'; // adjust path if needed

/**
 * Fetch all conversations from the server.
 */
async function fetchServerChats(): Promise<Conversation[]> {
  try {
    const res = await fetch(CHAT_STORE_URL);
    if (!res.ok) throw new Error(`Failed to fetch chats: ${res.statusText}`);
    const data: Conversation[] = await res.json();
    // Normalize dates
    return data.map(conv => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      lastModified: new Date(conv.lastModified),
      messages: (conv.messages || []).map(m => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }))
    }));
  } catch (err) {
    console.error('[Sync] Error fetching server chats:', err);
    return [];
  }
}

/**
 * Merge server conversations into IndexedDB.
 * Inserts new conversations and updates existing ones.
 */
export async function backgroundSyncWithServer(): Promise<void> {
  try {
    // Wait for Dexie DB to be ready
    await indexedDbStorage.ready;

    const serverChats = await fetchServerChats();
    const db = indexedDbStorage.getDb();

    await db.transaction('rw', db.conversations, db.meta, async () => {
      for (const serverConv of serverChats) {
        const localConv = await db.conversations.get(serverConv.id);
        if (!localConv) {
          // insert new conversation
          await db.conversations.put(serverConv);
          console.log(`[Sync] Inserted new conversation from server: ${serverConv.id}`);
        } else {
          // optionally: merge messages / update lastModified if server is newer
          if (serverConv.lastModified > localConv.lastModified) {
            await db.conversations.put(serverConv);
            console.log(`[Sync] Updated conversation from server: ${serverConv.id}`);
          }
        }
      }
      // update last sync timestamp
      await indexedDbStorage.setMeta('lastServerSync', new Date());
    });

    console.log('[Sync] Background sync with server complete');
  } catch (err) {
    console.error('[Sync] Failed to sync with server:', err);
  }
}

/**
 * Optional: run background sync on idle.
 */
export function scheduleBackgroundSync(): void {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => backgroundSyncWithServer());
  } else {
    // fallback
    setTimeout(() => backgroundSyncWithServer(), 2000);
  }
}
