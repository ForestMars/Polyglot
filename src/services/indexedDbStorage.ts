// src/services/indexedDbStorage.ts
// Compatibility shim. Re-exports the protocol types and delegates to db.ts.
// New code should import from db.ts and types/sync.ts directly.
// This file exists to avoid breaking any callers that haven't been updated yet.

export type { ChatResource as Chat, Message, ClockTuple } from '../types/sync';
export { polyglotDb as db, PolyglotDatabase } from './db';

import { polyglotDb } from './db';
import { ChatResource } from '../types/sync';

// Thin wrapper preserving the old IndexedDbStorage call surface.
class IndexedDbStorageShim {
  async initialize(): Promise<void> {
    await polyglotDb.init();
  }

  async getChats(): Promise<ChatResource[]> {
    return polyglotDb.getAllResources();
  }

  async getChat(id: string): Promise<ChatResource | null> {
    return (await polyglotDb.getResource(id)) ?? null;
  }

  async saveChat(chat: ChatResource): Promise<string> {
    await polyglotDb.saveResource(chat);
    return chat.id;
  }

  async deleteChat(id: string): Promise<void> {
    await polyglotDb.deleteResource(id);
  }

  async listConversations(showArchived: boolean = false): Promise<ChatResource[]> {
    return polyglotDb.listConversations(showArchived);
  }

  async loadConversation(id: string): Promise<ChatResource> {
    return polyglotDb.loadConversation(id);
  }

  async getMeta(id: string = 'app'): Promise<any> {
    return polyglotDb.getSyncMetadata();
  }

  async setMeta(meta: any): Promise<void> {
    await polyglotDb.saveSyncMetadata(meta);
  }

  async migrateFromLocalStorage(): Promise<void> {
    try {
      const raw = localStorage.getItem('polyglot-chats');
      if (!raw) return;
      const chats: ChatResource[] = JSON.parse(raw);
      for (const chat of chats) await polyglotDb.saveResource(chat);
      localStorage.removeItem('polyglot-chats');
      console.log('[migration] Migrated from localStorage');
    } catch (e) {
      console.error('[migration] Failed:', e);
    }
  }

  async isReady(): Promise<boolean> {
    try {
      await polyglotDb.init();
      return true;
    } catch {
      return false;
    }
  }
}

export const indexedDbStorage = new IndexedDbStorageShim();
export const storage = indexedDbStorage;