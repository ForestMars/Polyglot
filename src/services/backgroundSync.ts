import { indexedDbStorage } from './indexedDbStorage';

// Helper to merge messages by id, preferring latest lastModified
function mergeMessages(localMsgs: any[], serverMsgs: any[]) {
  const byId = new Map();
  for (const m of localMsgs) byId.set(m.id, m);
  for (const m of serverMsgs) {
    if (!byId.has(m.id) || new Date(m.lastModified || m.timestamp) < new Date(m.lastModified || m.timestamp)) {
      byId.set(m.id, m);
    }
  }
  return Array.from(byId.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function backgroundSyncWithServer() {
  await indexedDbStorage.ready;
  // 1. Get lastSyncedAt from meta
  const meta = await indexedDbStorage.getMeta('lastSyncedAt');
  const lastSyncedAt = meta?.value ? new Date(meta.value) : null;

  // 2. Collect local changes to push (unsynced or lastModified > lastSyncedAt)
  const db = indexedDbStorage.getDb();
  const localChanges = await db.conversations
    .where('lastModified')
    .above(lastSyncedAt ? lastSyncedAt.getTime() : 0)
    .toArray();

  // 3. Push local changes to server
  try {
    await fetch('http://localhost:4001/pushChats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chats: localChanges })
    });
  } catch (err) {
    console.error('[sync] Failed to push local changes:', err);
  }

  // 4. Fetch server-side deltas since lastSyncedAt
  try {
    const res = await fetch(`http://localhost:4001/fetchChats`);
    const serverConvs = await res.json();
    if (Array.isArray(serverConvs) && serverConvs.length > 0) {
      await db.transaction('rw', db.conversations, async () => {
        for (const sc of serverConvs) {
          const local = await db.conversations.get(sc.id);
          if (!local) {
            await db.conversations.put(sc);
          } else {
            // merge messages by id
            const mergedMessages = mergeMessages(local.messages, sc.messages);
            const chosen = (new Date(sc.lastModified) > new Date(local.lastModified)) ? sc : local;
            chosen.messages = mergedMessages;
            chosen.lastModified = new Date(Math.max(new Date(sc.lastModified).getTime(), new Date(local.lastModified).getTime()));
            await db.conversations.put(chosen);
          }
        }
        await indexedDbStorage.setMeta('lastSyncedAt', (new Date()).toISOString());
      });
    } else {
      await indexedDbStorage.setMeta('lastSyncedAt', (new Date()).toISOString());
    }
    console.log('[sync] Background sync complete');
  } catch (err) {
    console.error('[sync] Failed to fetch server deltas:', err);
  }
}
