import { Conversation, UserSettings } from '../types/conversation';
import Dexie, { type Table } from 'dexie';

// Define the database schema
interface Database {
  conversations: Table<Conversation, string>; // string is the type of the primary key
  settings: Table<UserSettings, number>; // Using number as key since we'll only store one settings object
}

class AppDatabase extends Dexie {
  public conversations!: Table<Conversation, string>;
  public settings!: Table<UserSettings, number>;

  constructor() {
    super('PolyglutDB');
    
    // Define the database schema
    this.version(1).stores({
      conversations: 'id, title, createdAt, lastModified, isArchived',
      settings: '++id'
    });
  }
}

export class IndexedDbStorageService {
  private db: AppDatabase;

  constructor() {
    this.db = new AppDatabase();
  }

  async initialize(): Promise<void> {
    // Ensure the database is open
    await this.db.open().catch(err => {
      console.error('Failed to open database:', err);
      throw new Error('Failed to initialize database');
    });
  }

  // Conversation CRUD Operations
  async saveConversation(conversation: Conversation): Promise<void> {
    const now = new Date();
    const dataToSave = {
      ...conversation,
      lastModified: now,
      createdAt: conversation.createdAt || now,
    };

    try {
      await this.db.conversations.put(dataToSave);
      console.log(`[IndexedDB] Saved conversation ${conversation.id}`);
    } catch (error) {
      console.error('[IndexedDB] Error saving conversation:', error);
      throw error;
    }
  }

  async loadConversation(id: string): Promise<Conversation> {
    try {
      const conversation = await this.db.conversations.get(id);
      if (!conversation) {
        throw new Error(`Conversation not found: ${id}`);
      }
      return conversation;
    } catch (error) {
      console.error(`[IndexedDB] Error loading conversation ${id}:`, error);
      throw error;
    }
  }

  async listConversations(includeArchived: boolean = false): Promise<Conversation[]> {
    try {
      let query = this.db.conversations.orderBy('lastModified').reverse();
      
      if (!includeArchived) {
        query = query.filter(conv => !conv.isArchived);
      }
      
      return await query.toArray();
    } catch (error) {
      console.error('[IndexedDB] Error listing conversations:', error);
      throw error;
    }
  }

  async deleteConversation(id: string): Promise<void> {
    try {
      await this.db.conversations.delete(id);
      console.log(`[IndexedDB] Deleted conversation ${id}`);
    } catch (error) {
      console.error(`[IndexedDB] Error deleting conversation ${id}:`, error);
      throw error;
    }
  }

  async archiveConversation(id: string): Promise<void> {
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

  async unarchiveConversation(id: string): Promise<void> {
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

  // Settings Operations
  async saveSettings(settings: UserSettings): Promise<void> {
    try {
      // We'll always use ID 1 for settings
      await this.db.settings.put(settings, 1);
    } catch (error) {
      console.error('[IndexedDB] Error saving settings:', error);
      throw error;
    }
  }

  async loadSettings(): Promise<UserSettings> {
    try {
      const settings = await this.db.settings.get(1);
      if (!settings) {
        return this.getDefaultSettings();
      }
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
      ollamaBaseUrl: 'http://localhost:11434',
    };
  }

  // Migration from localStorage to IndexedDB (one-time operation)
  async migrateFromLocalStorage(): Promise<{ migrated: number; total: number }> {
    if (typeof window === 'undefined') {
      return { migrated: 0, total: 0 };
    }

    const CONVERSATION_PREFIX = 'conversation_';
    const SETTINGS_KEY = 'user_settings';
    
    // Check if we've already migrated
    const hasMigrated = localStorage.getItem('migrated_to_indexeddb');
    if (hasMigrated) {
      return { migrated: 0, total: 0 };
    }

    try {
      // Migrate conversations
      const conversationKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CONVERSATION_PREFIX)) {
          conversationKeys.push(key);
        }
      }

      let migratedCount = 0;
      for (const key of conversationKeys) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const conversation = JSON.parse(data);
            // Convert string dates to Date objects
            conversation.createdAt = new Date(conversation.createdAt);
            conversation.lastModified = new Date(conversation.lastModified);
            conversation.messages = conversation.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }));
            
            await this.saveConversation(conversation);
            migratedCount++;
          }
        } catch (error) {
          console.error(`Error migrating conversation ${key}:`, error);
        }
      }

      // Migrate settings
      const settingsData = localStorage.getItem(SETTINGS_KEY);
      if (settingsData) {
        try {
          const settings = JSON.parse(settingsData);
          await this.saveSettings(settings);
        } catch (error) {
          console.error('Error migrating settings:', error);
        }
      }

      // Mark migration as complete
      localStorage.setItem('migrated_to_indexeddb', 'true');
      
      return { migrated: migratedCount, total: conversationKeys.length };
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const indexedDbStorage = new IndexedDbStorageService();
