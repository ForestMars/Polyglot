import { indexedDbStorage } from './indexedDbStorage';

// Helper to merge messages by id, preferring latest lastModified
function mergeMessages(localMsgs: any[], serverMsgs: any[]) {
  const byId = new Map();
  for (const m of localMsgs) byId.set(m.id, m);
  for (const m of serverMsgs) {
    if (!byId.has(m.id) || new Date(byId.get(m.id).lastModified || byId.get(m.id).timestamp) < new Date(m.lastModified || m.timestamp)) {
      byId.set(m.id, m);
    }
  }
  return Array.from(byId.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function backgroundSyncWithServer() {
  await indexedDbStorage.ready;
  console.log('[sync] Starting background sync with server...');

  // 1. Get lastSyncedAt from meta
  const meta = await indexedDbStorage.getMeta('lastSyncedAt');
  const lastSyncedAt = meta?.value ? new Date(meta.value) : null;
  console.log('[sync] lastSyncedAt:', lastSyncedAt);

  // 2. Collect local changes to push
  const db = indexedDbStorage.getDb();
  const localChanges = await db.conversations
    .where('lastModified')
    .above(lastSyncedAt ? lastSyncedAt.getTime() : 0)
    .toArray();
  console.log('[sync] Local changes to push:', localChanges);

  // 3. Push local changes to server
  try {
    console.log('[sync] Pushing local changes to server...');
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
    console.log('[sync] Fetching server conversations...');
    const res = await fetch('http://localhost:4001/fetchChats');
    const serverConvs = await res.json();
    console.log('[sync] Server conversations fetched:', serverConvs);

    if (Array.isArray(serverConvs) && serverConvs.length > 0) {
      await db.transaction('rw', db.conversations, async () => {
        console.log('[sync] Merging server conversations into Dexie...');
        const toUpsert = [];

        for (const sc of serverConvs) {
          let local = await db.conversations.get(sc.id);
          console.log(`[sync] Merging conversation ${sc.id}:`, { local, server: sc });

          const mergedMessages = mergeMessages(local?.messages || [], sc.messages || []);
          const chosen = { ...sc };
          chosen.messages = mergedMessages;
          chosen.lastModified = new Date(
            Math.max(
              new Date(sc.lastModified).getTime(),
              local?.lastModified ? new Date(local.lastModified).getTime() : 0
            )
          );
          chosen.isArchived = chosen.isArchived ?? false;
          chosen.createdAt = new Date(sc.createdAt);
          chosen.id = sc.id;

          toUpsert.push(chosen);
        }

        await db.conversations.bulkPut(toUpsert);
        await indexedDbStorage.setMeta('lastSyncedAt', new Date().toISOString());
        console.log('[sync] Updated lastSyncedAt in meta table.');
      });
    } else {
      await indexedDbStorage.setMeta('lastSyncedAt', new Date().toISOString());
      console.log('[sync] Updated lastSyncedAt in meta table (no new server convs).');
    }

    // Notify UI
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      const evt = new Event('conversations-updated', { bubbles: true });
      window.dispatchEvent(evt);
      console.log('[sync] Dispatched conversations-updated event');
    }

    console.log('[sync] Background sync complete');
  } catch (err) {
    console.error('[sync] Failed to fetch server deltas:', err);
  }
}
