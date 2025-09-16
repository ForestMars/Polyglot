// src/services/indexedDbStorage.ts
import Dexie, { Table } from 'dexie';
import { Conversation, UserSettings } from '../types/conversation';

interface AppDatabaseSchema {
  conversations: Table<Conversation, string>;
  settings: Table<UserSettings, number>;
  meta: Table<{ key: string; value: any }, string>;
}

class AppDatabase extends Dexie implements AppDatabaseSchema {
  public conversations!: Table<Conversation, string>;
  public settings!: Table<UserSettings, number>;
  public meta!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('PolyglotDB');

    // Main schema for version 1
    this.version(1).stores({
      conversations: 'id, title, createdAt, lastModified, isArchived',
      settings: '++id',
      meta: 'key',
    });

    // Ensure future upgrades can safely add stores
    this.on('blocked', () => console.warn('[IndexedDB] DB upgrade blocked'));
    this.on('versionchange', () => this.close());
  }
}

export class IndexedDbStorageService {
  private db: AppDatabase;
  public ready: Promise<void>;

  constructor() {
    this.db = new AppDatabase();
    this.ready = this.initialize();
  }

  public getDb(): AppDatabase {
    return this.db;
  }

  private async initialize(): Promise<void> {
    try {
      await this.db.open();

      // Check if meta store exists; create if missing
      if (!this.db.tables.find(t => t.name === 'meta')) {
        console.warn('[IndexedDB] Meta store missing; recreating DB with meta store');
        this.db.close();
        await Dexie.delete('PolyglotDB');
        this.db = new AppDatabase();
        await this.db.open();
      }

      console.log('[IndexedDB] Database opened');
    } catch (err) {
      console.error('[IndexedDB] Failed to open database:', err);
      throw new Error('Failed to initialize database');
    }
  }

  // ---------------- Meta ----------------
  public async getMeta(key: string): Promise<any> {
    await this.ready;
    return this.db.meta.get(key);
  }

  public async setMeta(key: string, value: any): Promise<void> {
    await this.ready;
    await this.db.meta.put({ key, value });
  }

  // ---------------- Conversations ----------------
  public async saveConversation(conversation: Conversation): Promise<void> {
    await this.ready;
    const now = new Date();
    const toSave: Conversation = {
      ...conversation,
      createdAt: conversation.createdAt ? new Date(conversation.createdAt) : now,
      lastModified: now,
      messages: (conversation.messages || []).map(msg => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      })),
    };
    await this.db.conversations.put(toSave);
  }

  public async loadConversation(id: string): Promise<Conversation> {
    await this.ready;
    const conv = await this.db.conversations.get(id);
    if (!conv) throw new Error(`Conversation not found: ${id}`);
    return conv;
  }

  public async listConversations(opts?: { includeArchived?: boolean; page?: number; limit?: number }): Promise<Conversation[]> {
    await this.ready;
    const includeArchived = opts?.includeArchived ?? false;
    const page = opts?.page;
    const limit = opts?.limit;

    const collection = includeArchived ? this.db.conversations : this.db.conversations.where('isArchived').equals(false);
    const arr = await collection.sortBy('lastModified');
    const sorted = arr.reverse();
    if (page && limit) {
      const start = (page - 1) * limit;
      return sorted.slice(start, start + limit);
    }
    return sorted;
  }

  public async countConversations(includeArchived: boolean = false): Promise<number> {
    await this.ready;
    return includeArchived
      ? this.db.conversations.count()
      : this.db.conversations.where('isArchived').equals(false).count();
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

  // ---------------- Settings ----------------
  public async saveSettings(settings: UserSettings): Promise<void> {
    await this.ready;
    await this.db.settings.put(settings, 1);
  }

  public async loadSettings(): Promise<UserSettings> {
    await this.ready;
    const settings = await this.db.settings.get(1);
    return settings ?? this.getDefaultSettings();
  }

  private getDefaultSettings(): UserSettings {
    return {
      selectedProvider: 'ollama',
      selectedModel: 'llama3.2',
      selectedApiKey: '',
      showArchivedChats: false,
      ollamaBaseUrl: 'http://localhost:11434',
    };
  }

  // ---------------- Migration ----------------
  public async migrateFromLocalStorage(): Promise<{ migrated: number; total: number }> {
    await this.ready;

    const MIGRATED_FLAG = 'migrated_to_indexeddb';
    const migratedMeta = await this.getMeta(MIGRATED_FLAG);
    if (migratedMeta?.value === true) return { migrated: 0, total: 0 };

    const count = await this.db.conversations.count();
    if (count > 0) {
      await this.setMeta(MIGRATED_FLAG, true);
      return { migrated: 0, total: 0 };
    }

    // Collect localStorage conversations
    const CONVERSATION_PREFIX = 'conversation_';
    const SETTINGS_KEY = 'user_settings';
    const conversationKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CONVERSATION_PREFIX)) conversationKeys.push(key);
    }

    const toInsert: Conversation[] = [];
    for (const key of conversationKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        parsed.createdAt = parsed.createdAt ? new Date(parsed.createdAt) : new Date();
        parsed.lastModified = parsed.lastModified ? new Date(parsed.lastModified) : new Date();
        parsed.messages = (parsed.messages || []).map((m: any) => ({
          ...m,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        }));
        if (!parsed.id) parsed.id = key.replace(CONVERSATION_PREFIX, '') || `${Date.now()}`;
        toInsert.push(parsed as Conversation);
      } catch (err) {
        console.error(`[IndexedDB] Error parsing conversation ${key}:`, err);
      }
    }

    // Migrate settings
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
          ollamaBaseUrl: parsedSettings.ollamaBaseUrl ?? 'http://localhost:11434',
        };
      } catch (err) {
        console.error('[IndexedDB] Error parsing settings:', err);
      }
    }

    await this.db.transaction('rw', this.db.conversations, this.db.settings, this.db.meta, async () => {
      if (toInsert.length > 0) await this.db.conversations.bulkPut(toInsert);
      if (settingsToSave) await this.db.settings.put(settingsToSave, 1);
      await this.setMeta(MIGRATED_FLAG, true);
    });

    return { migrated: toInsert.length, total: conversationKeys.length };
  }

  // ---------------- Utilities ----------------
  public async clearDatabase(): Promise<void> {
    await this.ready;
    await this.db.transaction('rw', this.db.conversations, this.db.settings, async () => {
      await this.db.conversations.clear();
      await this.db.settings.clear();
    });
  }
}

export const indexedDbStorage = new IndexedDbStorageService();
