// src/services/indexedDbStorage.ts
import Dexie, { Table } from 'dexie';
import { Conversation, UserSettings } from '../types/conversation';

/**
 * Database schema interface
 */
interface AppDatabaseSchema {
  conversations: Table<Conversation, string>;
  settings: Table<UserSettings, number>;
  meta: Table<{ key: string; value: any }, string>;
}

/**
 * Dexie DB - versioning + stores
 */
class AppDatabase extends Dexie implements AppDatabaseSchema {
  public conversations!: Table<Conversation, string>;
  public settings!: Table<UserSettings, number>;
  public meta!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('PolyglotDB');

    this.version(1).stores({
      conversations: 'id, title, createdAt, lastModified, isArchived',
      settings: '++id',
      meta: 'key'
    });
  }
}

/**
 * Storage service wrapping Dexie
 */
export class IndexedDbStorageService {
  private db: AppDatabase;
  public ready: Promise<void>;

  constructor() {
    this.db = new AppDatabase();
    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.db.open();
      // Ensure meta/conversations/settings exist
      if (!this.db.tables.find(t => t.name === 'meta')) {
        throw new Error('Meta store missing after DB open');
      }
      console.log('[IndexedDB] Database opened successfully');
    } catch (err) {
      console.error('[IndexedDB] Failed to open database:', err);
      throw err;
    }
  }

  public getDb(): AppDatabase {
    return this.db;
  }

  /* ---------------------------
   * Meta helpers
   * --------------------------- */
  public async getMeta(key: string): Promise<any> {
    await this.ready;
    return this.db.meta.get(key);
  }

  public async setMeta(key: string, value: any): Promise<void> {
    await this.ready;
    try {
      await this.db.transaction('rw', this.db.meta, async () => {
        await this.db.meta.put({ key, value });
      });
    } catch (err) {
      console.error('[IndexedDB] Error writing meta:', err);
      throw err;
    }
  }

  /* ---------------------------
   * Conversations
   * --------------------------- */
  public async saveConversation(conversation: Conversation): Promise<void> {
    await this.ready;
    const now = new Date();
    const toSave: Conversation = {
      ...conversation,
      createdAt: conversation.createdAt ? new Date(conversation.createdAt) : now,
      lastModified: now,
      messages: (conversation.messages || []).map(msg => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
      }))
    };
    try {
      await this.db.conversations.put(toSave);
      console.log(`[IndexedDB] Saved conversation ${toSave.id}`);
    } catch (err) {
      console.error('[IndexedDB] Error saving conversation:', err);
      throw err;
    }
  }

  public async loadConversation(id: string): Promise<Conversation> {
    await this.ready;
    const conv = await this.db.conversations.get(id);
    if (!conv) throw new Error(`Conversation not found: ${id}`);
    return conv;
  }

  public async listConversations(opts?: {
    includeArchived?: boolean;
    page?: number;
    limit?: number;
  }): Promise<Conversation[]> {
    await this.ready;
    const includeArchived = opts?.includeArchived ?? false;
    const page = opts?.page;
    const limit = opts?.limit;

    let collection = includeArchived
      ? this.db.conversations.orderBy('lastModified')
      : this.db.conversations.where('isArchived').equals(false);

    const arr = await collection.toArray();
    const sorted = arr.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    if (page && limit) {
      return sorted.slice((page - 1) * limit, (page - 1) * limit + limit);
    }
    return sorted;
  }

  public async deleteConversation(id: string): Promise<void> {
    await this.ready;
    await this.db.conversations.delete(id);
  }

  public async archiveConversation(id: string): Promise<void> {
    await this.ready;
    await this.db.conversations.update(id, { isArchived: true, lastModified: new Date() });
  }

  public async unarchiveConversation(id: string): Promise<void> {
    await this.ready;
    await this.db.conversations.update(id, { isArchived: false, lastModified: new Date() });
  }

  /* ---------------------------
   * Settings
   * --------------------------- */
  public async saveSettings(settings: UserSettings): Promise<void> {
    await this.ready;
    await this.db.settings.put(settings, 1);
  }

  public async loadSettings(): Promise<UserSettings> {
    await this.ready;
    const settings = await this.db.settings.get(1);
    return settings || this.getDefaultSettings();
  }

  private getDefaultSettings(): UserSettings {
    return {
      selectedProvider: 'ollama',
      selectedModel: 'llama3.2',
      selectedApiKey: '',
      showArchivedChats: false,
      ollamaBaseUrl: 'http://localhost:11434'
    };
  }

  /* ---------------------------
   * Migration
   * --------------------------- */
  public async migrateFromLocalStorage(): Promise<{ migrated: number; total: number }> {
    await this.ready;
    // Only migrate if meta flag is not set
    const MIGRATED_FLAG = 'migrated_to_indexeddb';
    const migratedMeta = await this.getMeta(MIGRATED_FLAG);
    if (migratedMeta?.value === true) return { migrated: 0, total: 0 };

    const CONVERSATION_PREFIX = 'conversation_';
    const SETTINGS_KEY = 'user_settings';

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CONVERSATION_PREFIX)) keys.push(k);
    }

    const toInsert: Conversation[] = [];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      parsed.createdAt = parsed.createdAt ? new Date(parsed.createdAt) : new Date();
      parsed.lastModified = parsed.lastModified ? new Date(parsed.lastModified) : new Date();
      parsed.messages = (parsed.messages || []).map((m: any) => ({ ...m, timestamp: m.timestamp ? new Date(m.timestamp) : new Date() }));
      parsed.id = parsed.id || key.replace(CONVERSATION_PREFIX, '') || `${Date.now()}`;
      toInsert.push(parsed);
    }

    let settingsToSave: UserSettings | null = null;
    const rawSettings = localStorage.getItem(SETTINGS_KEY);
    if (rawSettings) {
      const parsedSettings = JSON.parse(rawSettings);
      settingsToSave = {
        selectedProvider: parsedSettings.selectedProvider ?? 'ollama',
        selectedModel: parsedSettings.selectedModel ?? 'llama3.2',
        selectedApiKey: parsedSettings.selectedApiKey ?? '',
        showArchivedChats: parsedSettings.showArchivedChats ?? false,
        ollamaBaseUrl: parsedSettings.ollamaBaseUrl ?? 'http://localhost:11434'
      };
    }

    try {
      await this.db.transaction('rw', this.db.conversations, this.db.settings, this.db.meta, async () => {
        if (toInsert.length > 0) await this.db.conversations.bulkPut(toInsert);
        if (settingsToSave) await this.db.settings.put(settingsToSave, 1);
        await this.db.meta.put({ key: MIGRATED_FLAG, value: true });
      });
      return { migrated: toInsert.length, total: keys.length };
    } catch (err) {
      console.error('[IndexedDB] Migration failed:', err);
      throw err;
    }
  }

  /* ---------------------------
   * Utilities
   * --------------------------- */
  public async clearDatabase(): Promise<void> {
    await this.ready;
    await this.db.transaction('rw', this.db.conversations, this.db.settings, this.db.meta, async () => {
      await this.db.conversations.clear();
      await this.db.settings.clear();
      await this.db.meta.clear();
    });
  }
}

export const indexedDbStorage = new IndexedDbStorageService();
