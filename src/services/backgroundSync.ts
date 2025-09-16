// src/services/backgroundSync.ts
import { indexedDbStorage } from './indexedDbStorage';

// Helper to merge messages by id, preferring latest lastModified
function mergeMessages(localMsgs: any[], serverMsgs: any[]) {
  const byId = new Map();
  for (const m of localMsgs) byId.set(m.id, m);
  for (const m of serverMsgs) {
    const serverTime = new Date(m.lastModified || m.timestamp).getTime();
    const local = byId.get(m.id);
    const localTime = local ? new Date(local.lastModified || local.timestamp).getTime() : 0;
    if (!local || serverTime > localTime) {
      byId.set(m.id, m);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export async function backgroundSyncWithServer() {
  // Ensure IndexedDB is fully initialized
  await indexedDbStorage.ready;

  console.log('[sync] Starting background sync with server...');
  const db = indexedDbStorage.getDb();

  // 1. Get lastSyncedAt from meta store
  let lastSyncedAt: Date | null = null;
  try {
    const meta = await indexedDbStorage.getMeta('lastSyncedAt');
    lastSyncedAt = meta?.value ? new Date(meta.value) : null;
  } catch (err) {
    console.warn('[sync] Could not read lastSyncedAt, proceeding as first sync', err);
  }

  console.log('[sync] lastSyncedAt:', lastSyncedAt);

  // 2. Collect local changes to push
  let localChanges: any[] = [];
  try {
    localChanges = await db.conversations
      .where('lastModified')
      .above(lastSyncedAt ? lastSyncedAt.getTime() : 0)
      .toArray();
  } catch (err) {
    console.error('[sync] Failed to read local conversations:', err);
  }

  console.log('[sync] Local changes to push:', localChanges);

  // 3. Push local changes
  try {
    await fetch('http://localhost:4001/pushChats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chats: localChanges })
    });
    console.log('[sync] Successfully pushed local changes to server.');
  } catch (err) {
    console.error('[sync] Failed to push local changes:', err);
  }

  // 4. Fetch server-side deltas
  try {
    const res = await fetch('http://localhost:4001/fetchChats');
    const serverConvs = await res.json();
    console.log('[sync] Server conversations fetched:', serverConvs);

    if (Array.isArray(serverConvs) && serverConvs.length > 0) {
      await db.transaction('rw', db.conversations, db.meta, async () => {
        console.log('[sync] Merging server conversations into Dexie...');
        for (const sc of serverConvs) {
          const local = await db.conversations.get(sc.id);
          console.log(`[sync] Merging conversation ${sc.id}:`, { local, server: sc });

          if (!local) {
            await db.conversations.put(sc);
            console.log(`[sync] Inserted new conversation from server:`, sc);
          } else {
            const mergedMessages = mergeMessages(local.messages, sc.messages);
            const chosen = new Date(sc.lastModified) > new Date(local.lastModified) ? sc : local;
            chosen.messages = mergedMessages;
            chosen.lastModified = new Date(
              Math.max(
                new Date(sc.lastModified).getTime(),
                new Date(local.lastModified).getTime()
              )
            );
            await db.conversations.put(chosen);
            console.log(`[sync] Updated conversation after merge:`, chosen);
          }
        }

        // Update lastSyncedAt safely
        await indexedDbStorage.setMeta('lastSyncedAt', new Date().toISOString());
        console.log('[sync] Updated lastSyncedAt in meta table.');
      });
    } else {
      await indexedDbStorage.setMeta('lastSyncedAt', new Date().toISOString());
      console.log('[sync] Updated lastSyncedAt (no new server convs).');
    }

    // 5. Notify UI
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event('conversations-updated', { bubbles: true }));
      console.log('[sync] Dispatched conversations-updated event');
    }

    console.log('[sync] Background sync complete');
  } catch (err) {
    console.error('[sync] Failed to fetch or merge server conversations:', err);
  }
}
