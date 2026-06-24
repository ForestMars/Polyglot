// src/services/conversationSync.ts
//
// Coordinator: single call site for any operation that touches both local
// storage and the sync layer. Replaces the direct fetch calls that were
// previously embedded in indexedDbStorage.saveConversation and
// indexedDbStorage.deleteConversation.
//
// Usage (replaces old storage.saveConversation / storage.deleteConversation):
//
//   import { saveConversation, deleteConversation } from './conversationSync';
//   await saveConversation(chat);
//   await deleteConversation(id);

import { storage, Chat } from './indexedDbStorage';
import { backgroundSync } from './backgroundSync';

// Save a conversation locally and propagate to server via data plane.
// If the chat has no non-private messages after filtering, delete it
// both locally and on the server (preserving the original behaviour).
export async function saveConversation(chat: Chat): Promise<void> {
  const filteredMessages = (chat.messages || []).filter(m => !m.isPrivate);

  if (filteredMessages.length === 0) {
    // Nothing to persist — treat as a delete if it previously existed.
    if (chat.id) {
      await deleteConversation(chat.id);
    }
    return;
  }

  const toSave: Chat = { ...chat, messages: filteredMessages };

  // Write locally first.
  await storage.saveChat(toSave);

  // Propagate to server with Lamport stamp. Fire-and-forget: local write
  // already succeeded; server will catch up at next sync boundary if push fails.
  backgroundSync.pushChat(toSave).catch(err =>
    console.warn('[conversationSync] Push failed, will retry at sync boundary:', err)
  );
}

// Delete a conversation locally and register a deletion record.
// The deletion record is what prevents the chat from being restored on next sync.
export async function deleteConversation(id: string): Promise<void> {
  // Write deletion record and push to server (backgroundSync handles both).
  // Do this before local delete so the record exists if anything throws.
  await backgroundSync.pushDeletion(id);

  // Remove from local IndexedDB.
  try {
    await storage.deleteChat(id);
  } catch (err) {
    // Already absent locally — deletion record is still registered, so
    // Invariant 5 holds. Log and continue.
    console.warn(`[conversationSync] Local delete failed for ${id} (may not exist):`, err);
  }

  // Notify UI.
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new Event('conversations-updated'));
    } catch (e) {
      console.warn('[conversationSync] Failed to dispatch conversations-updated:', e);
    }
  }
}