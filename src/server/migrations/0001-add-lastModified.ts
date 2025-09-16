// packages/polyglot-app/src/migrations/0001-add-lastModified.ts
import type Dexie from 'dexie';
import type { Conversation } from '../../types/conversation';

export const id = '0001';
export const description = 'Ensure all conversations have lastModified Date and normalize message timestamps';

export async function up(db: Dexie): Promise<void> {
  // Note: operate within a transaction for atomicity
  await db.transaction('rw', (db as any).conversations, async () => {
    const convs: Conversation[] = await (db as any).conversations.toArray();
    const patched = convs.map(conv => {
      const now = new Date();
      return {
        ...conv,
        createdAt: conv.createdAt ? new Date(conv.createdAt) : now,
        lastModified: conv.lastModified ? new Date(conv.lastModified) : now,
        messages: (conv.messages || []).map(m => ({
          ...m,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
        }))
      } as Conversation;
    });
    if (patched.length) await (db as any).conversations.bulkPut(patched);
  });
}

export async function down(db: Dexie): Promise<void> {
  // Down migration: remove lastModified field (restore to previous shape)
  // WARNING: destructive down migrations are risky; prefer non-destructive changes.
  await db.transaction('rw', (db as any).conversations, async () => {
    const convs: any[] = await (db as any).conversations.toArray();
    const reverted = convs.map(c => {
      // Delete the lastModified property to revert to pre-migration shape
      const { lastModified, ...rest } = c;
      // messages timestamps remain as-is in this example; if you want to revert them,
      // you must store previous state (more complex). Down migrations should be
      // conservative when irreversible.
      return rest;
    });
    if (reverted.length) await (db as any).conversations.bulkPut(reverted);
  });
}
