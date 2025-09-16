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

    // Initial schema: id is primary key; index on lastModified and isArchived
    // NOTE: Dexie store syntax: 'primaryKey, index1, index2'
    this.version(1).stores({
      conversations: 'id, title, createdAt, lastModified, isArchived',
      settings: '++id',
      meta: 'key'
    });

    // Example of future upgrade hook:
    // this.version(2).stores({...}).upgrade(async tx => { ... transform data ... });
  }
}

/**
 * Storage service wrapping Dexie with helpful operations.
 */
export class IndexedDbStorageService {
  private db: AppDatabase;
  public ready: Promise<void>;

  // Expose the Dexie instance for advanced use
  public getDb(): AppDatabase {
    return this.db;
  }

  constructor() {
    this.db = new AppDatabase();

    // Expose a ready promise so callers can await initialization
    this.ready = (async () => {
      try {
        await this.db.open();
        console.log('[IndexedDB] Database opened');
      } catch (err) {
        console.error('[IndexedDB] Failed to open DB:', err);
        // If open fails (e.g., corrupted DB), delete and retry
        await Dexie.delete('PolyglotDB');
        await this.db.open();
        console.log('[IndexedDB] Database recreated and opened');
      }
    })();
  }

  // Meta helpers
  public async getMeta(key: string): Promise<any> {
    await this.ready;
    return this.db.meta.get(key);
  }

  public async setMeta(key: string, value: any): Promise<void> {
    await this.ready;
    await this.db.meta.put({ key, value });
  }

  /**
   * Initialize (open) the DB. Returns once DB is open.
   */
  public async initialize(): Promise<void> {
    try {
      await this.db.open();
      // optional: warm-up / ensure indexes exist
      // await this.db.transaction('r', this.db.conversations, async () => { /* noop */ });
      console.log('[IndexedDB] Database opened');
    } catch (err) {
      console.error('[IndexedDB] Failed to open database:', err);
      throw new Error('Failed to initialize database');
    }
  }

  /* ---------------------------
   * Conversation CRUD
   * --------------------------- */

  /**
   * Save (insert or update) a conversation.
   * Updates createdAt/lastModified fields.
   */
  public async saveConversation(conversation: Conversation): Promise<void> {
    const now = new Date();
    const toSave: Conversation = {
      ...conversation,
      createdAt: conversation.createdAt ? new Date(conversation.createdAt) : now,
      lastModified: now,
      // ensure message timestamps are Date objects
      messages: (conversation.messages || []).map(msg => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
      }))
    };

    try {
      await this.db.conversations.put(toSave);
      console.log(`[IndexedDB] Saved conversation ${toSave.id}`);
    } catch (error) {
      console.error('[IndexedDB] Error saving conversation:', error);
      throw error;
    }
  }

  /**
   * Load a conversation by id. Throws if not found.
   */
  public async loadConversation(id: string): Promise<Conversation> {
    try {
      const conv = await this.db.conversations.get(id);
      if (!conv) throw new Error(`Conversation not found: ${id}`);
      return conv;
    } catch (error) {
      console.error(`[IndexedDB] Error loading conversation ${id}:`, error);
      throw error;
    }
  }

  /**
   * List conversations.
   * - includeArchived: whether to include archived conversations
   * - page / limit: optional pagination (1-based page). If omitted returns all.
   *
   * Returns conversations sorted by lastModified desc.
   */
  public async listConversations(opts?: {
    includeArchived?: boolean;
    page?: number;
    limit?: number;
  }): Promise<Conversation[]> {
    const includeArchived = opts?.includeArchived ?? false;
    const page = opts?.page;
    const limit = opts?.limit;

    try {
      if (includeArchived) {
        // orderBy 'lastModified' then reverse for descending
        if (page && limit) {
          // Dexie collection supports offset/limit after orderBy
          return await this.db.conversations
            .orderBy('lastModified')
            .reverse()
            .offset((page - 1) * limit)
            .limit(limit)
            .toArray();
        } else {
          return await this.db.conversations.orderBy('lastModified').reverse().toArray();
        }
      } else {
        // Use index on isArchived to avoid scanning all rows
        // sortBy returns an array sorted by the given property (ascending)
        // We'll reverse for descending lastModified
        const collection = this.db.conversations.where('isArchived').equals(false);

        // If pagination requested, it's simplest to fetch a slice after sort
        if (page && limit) {
          const arr = await collection.sortBy('lastModified'); // ascending
          const desc = arr.reverse();
          const start = (page - 1) * limit;
          return desc.slice(start, start + limit);
        } else {
          const arr = await collection.sortBy('lastModified');
          return arr.reverse();
        }
      }
    } catch (error) {
      console.error('[IndexedDB] Error listing conversations:', error);
      throw error;
    }
  }

  /**
   * Count conversations (optionally only non-archived).
   */
  public async countConversations(includeArchived: boolean = false): Promise<number> {
    try {
      if (includeArchived) {
        return await this.db.conversations.count();
      }
      return await this.db.conversations.where('isArchived').equals(false).count();
    } catch (error) {
      console.error('[IndexedDB] Error counting conversations:', error);
      throw error;
    }
  }

  /**
   * Delete a conversation by id.
   */
  public async deleteConversation(id: string): Promise<void> {
    try {
      await this.db.conversations.delete(id);
      console.log(`[IndexedDB] Deleted conversation ${id}`);
    } catch (error) {
      console.error(`[IndexedDB] Error deleting conversation ${id}:`, error);
      throw error;
    }
  }

  /**
   * Archive / unarchive helpers
   */
  public async archiveConversation(id: string): Promise<void> {
    try {
      await this.db.conversations.update(id, {
        isArchived: true,
        lastModified: new Date()
      });
    } catch (error) {
      console.error(`[IndexedDB] Error archiving conversation ${id}:`, error);
      throw error;
    }
  }

  public async unarchiveConversation(id: string): Promise<void> {
    try {
      await this.db.conversations.update(id, {
        isArchived: false,
        lastModified: new Date()
      });
    } catch (error) {
      console.error(`[IndexedDB] Error unarchiving conversation ${id}:`, error);
      throw error;
    }
  }

  /* ---------------------------
   * Settings
   * --------------------------- */

  /**
   * Save settings. Always store using key 1 so loadSettings can be simple.
   */
  public async saveSettings(settings: UserSettings): Promise<void> {
    try {
      await this.db.settings.put(settings, 1);
      console.log('[IndexedDB] Settings saved');
    } catch (error) {
      console.error('[IndexedDB] Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Load settings, or return defaults if not present.
   */
  public async loadSettings(): Promise<UserSettings> {
    try {
      const settings = await this.db.settings.get(1);
      if (!settings) return this.getDefaultSettings();
      return settings;
    } catch (error) {
      console.error('[IndexedDB] Error loading settings:', error);
      return this.getDefaultSettings();
    }
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
   * Migration from localStorage (one-time)
   * --------------------------- */

  /**
   * Migrate conversations and settings previously stored in localStorage.
   * Uses bulkPut to write all conversations in a single transaction for speed/atomicity.
   *
   * Returns: { migrated, total }
   */
  /**
   * One-time migration from localStorage to IndexedDB.
   * Only runs if meta flag is unset and Dexie is empty.
   * Sets flag in meta table after success.
   */
  public async migrateFromLocalStorage(): Promise<{ migrated: number; total: number }> {
    if (typeof window === 'undefined') {
      return { migrated: 0, total: 0 };
    }

    const CONVERSATION_PREFIX = 'conversation_';
    const SETTINGS_KEY = 'user_settings';
    const MIGRATED_FLAG = 'migrated_to_indexeddb';

    // Check meta table for migration flag
    const migratedMeta = await this.getMeta(MIGRATED_FLAG);
    if (migratedMeta && migratedMeta.value === true) {
      return { migrated: 0, total: 0 };
    }

    // If conversations already present, assume migrated
    const count = await this.db.conversations.count();
    if (count > 0) {
      await this.setMeta(MIGRATED_FLAG, true);
      return { migrated: 0, total: 0 };
    }

    // Now check localStorage keys synchronously
    const conversationKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CONVERSATION_PREFIX)) conversationKeys.push(key);
    }

    if (conversationKeys.length === 0 && !localStorage.getItem(SETTINGS_KEY)) {
      await this.setMeta(MIGRATED_FLAG, true);
      return { migrated: 0, total: 0 };
    }

    const toInsert: Conversation[] = [];
    for (const key of conversationKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        // Normalize dates -> Date objects
        parsed.createdAt = parsed.createdAt ? new Date(parsed.createdAt) : new Date();
        parsed.lastModified = parsed.lastModified ? new Date(parsed.lastModified) : new Date();
        parsed.messages = (parsed.messages || []).map((m: any) => ({
          ...m,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
        }));
        if (!parsed.id) {
          parsed.id = key.replace(CONVERSATION_PREFIX, '') || `${Date.now()}`;
        }
        toInsert.push(parsed as Conversation);
      } catch (err) {
        console.error(`[IndexedDB] Error parsing localStorage conversation ${key}:`, err);
      }
    }

    // Migrate settings if present
    let settingsToSave: UserSettings | null = null;
    const settingsRaw = localStorage.getItem(SETTINGS_KEY);
    if (settingsRaw) {
      try {
        const parsedSettings = JSON.parse(settingsRaw);
        settingsToSave = {
          selectedProvider: parsedSettings.selectedProvider ?? 'ollama',
          selectedModel: parsedSettings.selectedModel ?? 'llama3.2',
          selectedApiKey: parsedSettings.selectedApiKey ?? '',
          showArchivedChats: parsedSettings.showArchivedChats ?? false,
          ollamaBaseUrl: parsedSettings.ollamaBaseUrl ?? 'http://localhost:11434'
        };
      } catch (err) {
        console.error('[IndexedDB] Error parsing localStorage settings:', err);
      }
    }

    try {
      // Use a transaction to write conversations + settings atomically
      await this.db.transaction('rw', this.db.conversations, this.db.settings, this.db.meta, async () => {
        if (toInsert.length > 0) {
          await this.db.conversations.bulkPut(toInsert);
          console.log(`[IndexedDB] Migrated ${toInsert.length} conversations`);
        }
        if (settingsToSave) {
          await this.db.settings.put(settingsToSave, 1);
          console.log('[IndexedDB] Migrated settings');
        }
        // Mark migration complete in meta table
        await this.db.meta.put({ key: MIGRATED_FLAG, value: true });
      });
      return { migrated: toInsert.length, total: conversationKeys.length };
    } catch (error) {
      console.error('[IndexedDB] Migration failed:', error);
      throw error;
    }
  }

  /* ---------------------------
   * Utilities
   * --------------------------- */

  /**
   * Clear the database (dangerous - used for dev/testing)
   */
  public async clearDatabase(): Promise<void> {
    try {
      await this.db.transaction('rw', this.db.conversations, this.db.settings, async () => {
        await this.db.conversations.clear();
        await this.db.settings.clear();
      });
      console.log('[IndexedDB] Database cleared');
    } catch (err) {
      console.error('[IndexedDB] Error clearing DB:', err);
      throw err;
    }
  }
}

/**
 * Export a singleton instance for app-wide use.
 */
export const indexedDbStorage = new IndexedDbStorageService();
