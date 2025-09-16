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

  const meta = await indexedDbStorage.getMeta('lastSyncedAt');
  const lastSyncedAt = meta?.value ? new Date(meta.value) : null;
  console.log('[sync] lastSyncedAt:', lastSyncedAt);

  const db = indexedDbStorage.getDb();

  // 1. Push local changes
  const localChanges = await db.conversations
    .where('lastModified')
    .above(lastSyncedAt ? lastSyncedAt.getTime() : 0)
    .toArray();
  console.log('[sync] Local changes to push:', localChanges);

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

  // 2. Fetch server-side conversations
  try {
    console.log('[sync] Fetching server conversations...');
    const res = await fetch(`http://localhost:4001/fetchChats`);
    const serverConvs = await res.json();
    console.log('[sync] Server conversations fetched:', serverConvs);

    if (Array.isArray(serverConvs) && serverConvs.length > 0) {
      await db.transaction('rw', db.conversations, async () => {
        console.log('[sync] Merging server conversations into Dexie...');
        for (const sc of serverConvs) {
          // Normalize server conversation before inserting
          const normalized = {
            ...sc,
            isArchived: sc.isArchived ?? false,
            createdAt: sc.createdAt ? new Date(sc.createdAt) : new Date(),
            lastModified: sc.lastModified ? new Date(sc.lastModified) : new Date(),
            messages: (sc.messages || []).map(m => ({
              ...m,
              timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
            }))
          };

          const local = await db.conversations.get(normalized.id);
          console.log(`[sync] Merging conversation ${normalized.id}:`, { local, server: normalized });

          if (!local) {
            await db.conversations.put(normalized);
            console.log(`[sync] Inserted new conversation from server:`, normalized);
          } else {
            const mergedMessages = mergeMessages(local.messages, normalized.messages);
            const chosen = (new Date(normalized.lastModified) > new Date(local.lastModified)) ? normalized : local;
            chosen.messages = mergedMessages;
            chosen.isArchived = chosen.isArchived ?? false;
            chosen.lastModified = new Date(Math.max(new Date(normalized.lastModified).getTime(), new Date(local.lastModified).getTime()));
            await db.conversations.put(chosen);
            console.log(`[sync] Updated conversation after merge:`, chosen);
          }
        }
        await indexedDbStorage.setMeta('lastSyncedAt', (new Date()).toISOString());
        console.log('[sync] Updated lastSyncedAt in meta table.');
      });
    } else {
      await indexedDbStorage.setMeta('lastSyncedAt', (new Date()).toISOString());
      console.log('[sync] Updated lastSyncedAt in meta table (no new server convs).');
    }

    // Trigger UI reload
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
