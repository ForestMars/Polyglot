
import { indexedDbStorage } from './indexedDbStorage';

// Call this at app startup to sync IndexedDB with server
export async function runClientMigrations() {
  try {
    // 1. Load all local conversations from IndexedDB
    const localConvos = await indexedDbStorage.listConversations();
    // 2. POST to /sync endpoint with local conversations
    const res = await fetch('http://localhost:4001/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chats: localConvos })
    });
    const { missing } = await res.json();
    // 3. Insert any missing server conversations into IndexedDB
    if (Array.isArray(missing) && missing.length > 0) {
      for (const convo of missing) {
        await indexedDbStorage.saveConversation(convo);
      }
      console.log(`[sync] Added ${missing.length} missing server conversations to IndexedDB`);
    }
    console.log('[sync] Client/server chat sync complete');
  } catch (err) {
    console.error('[sync] Failed to sync chats with server:', err);
  }
}
