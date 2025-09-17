// src/services/indexedDbStorage.ts - Fixed version with proper date conversion

import Dexie, { Table } from 'dexie';

// Define your interfaces - Updated to match what your conversation manager expects
export interface Chat {
  id?: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  lastModified: Date;
  model?: string;
  provider?: string;
  currentModel?: string;
  isArchived?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AppMeta {
  id: string;
  lastSync?: Date;
  version?: string;
  [key: string]: any;
}

// Database class
export class PolyglotDatabase extends Dexie {
  chats!: Table<Chat, string>;
  meta!: Table<AppMeta, string>;

  constructor() {
    super('PolyglotDB');
    
    // Define schemas - CRITICAL: Make sure all object stores are defined here
    this.version(1).stores({
      chats: '++id, title, createdAt, updatedAt, lastModified, model, provider, currentModel, isArchived',
      meta: 'id, lastSync, version'
    });

    // Add upgrade hooks if you need to migrate data
    this.version(1).upgrade(async (trans) => {
      console.log('Initializing database v1...');
      // Initialize default meta if needed
      await trans.table('meta').put({
        id: 'app',
        version: '1.0.0',
        lastSync: null
      });
    });
  }
}

// Create singleton instance
export const db = new PolyglotDatabase();

// Database operations with proper error handling and date conversion
export class IndexedDbStorage {
  private db: PolyglotDatabase;

  constructor(database: PolyglotDatabase) {
    this.db = database;
  }

  // Helper method to convert string dates back to Date objects
  private convertDatesToObjects(chat: any): Chat {
    return {
      ...chat,
      createdAt: new Date(chat.createdAt),
      updatedAt: new Date(chat.updatedAt),
      lastModified: new Date(chat.lastModified || chat.updatedAt || Date.now()),
      isArchived: chat.isArchived || false,
      currentModel: chat.currentModel || chat.model,
      messages: (chat.messages || []).map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    };
  }

  // Helper method to prepare chat for storage (ensure dates are properly set)
  private prepareChatForStorage(chat: Chat): Chat {
    const now = new Date();
    return {
      ...chat,
      id: chat.id || crypto.randomUUID(),
      createdAt: chat.createdAt || now,
      updatedAt: now,
      lastModified: now,
      isArchived: chat.isArchived || false,
      currentModel: chat.currentModel || chat.model || 'unknown',
      messages: (chat.messages || []).map(msg => ({
        ...msg,
        id: msg.id || crypto.randomUUID(),
        timestamp: msg.timestamp || now
      }))
    };
  }

  // Initialize and validate database
  async initialize(): Promise<void> {
    try {
      // Force database to open and validate schema
      await this.db.open();
      
      // Verify that all expected tables exist
      const tableNames = this.db.tables.map(table => table.name);
      const expectedTables = ['chats', 'meta'];
      
      for (const expectedTable of expectedTables) {
        if (!tableNames.includes(expectedTable)) {
          throw new Error(`Missing expected table: ${expectedTable}`);
        }
      }
      
      console.log('Database initialized successfully with tables:', tableNames);
    } catch (error) {
      console.error('Database initialization failed:', error);
      
      // If there's a schema mismatch, delete and recreate the database
      if (error.name === 'VersionError' || error.name === 'NotFoundError') {
        console.log('Schema mismatch detected, recreating database...');
        await this.resetDatabase();
      } else {
        throw error;
      }
    }
  }

  // Reset database by deleting and recreating
  private async resetDatabase(): Promise<void> {
    try {
      await this.db.delete();
      console.log('Database deleted');
      
      // Recreate the database
      this.db = new PolyglotDatabase();
      await this.db.open();
      
      console.log('Database recreated successfully');
    } catch (error) {
      console.error('Failed to reset database:', error);
      throw error;
    }
  }

  // Safe metadata operations
  async getMeta(id: string = 'app'): Promise<AppMeta | null> {
    try {
      const meta = await this.db.meta.get(id);
      if (meta && meta.lastSync) {
        meta.lastSync = new Date(meta.lastSync);
      }
      return meta || null;
    } catch (error) {
      console.error('Failed to get meta:', error);
      return null;
    }
  }

  async setMeta(meta: AppMeta): Promise<void> {
    try {
      await this.db.meta.put(meta);
    } catch (error) {
      console.error('Failed to set meta:', error);
      
      // If it's a NotFoundError, try to reinitialize the database
      if (error.name === 'NotFoundError') {
        console.log('Meta table not found, reinitializing database...');
        await this.initialize();
        // Retry the operation
        await this.db.meta.put(meta);
      } else {
        throw error;
      }
    }
  }

  // Chat operations with error handling and proper date conversion
  async getChats(): Promise<Chat[]> {
    try {
      const chats = await this.db.chats.orderBy('lastModified').reverse().toArray();
      return chats.map(chat => this.convertDatesToObjects(chat));
    } catch (error) {
      console.error('Failed to get chats:', error);
      return [];
    }
  }

  async getChat(id: string): Promise<Chat | null> {
    try {
      const chat = await this.db.chats.get(id);
      return chat ? this.convertDatesToObjects(chat) : null;
    } catch (error) {
      console.error('Failed to get chat:', error);
      return null;
    }
  }

  async saveChat(chat: Chat): Promise<string> {
    try {
      const preparedChat = this.prepareChatForStorage(chat);
      const chatId = await this.db.chats.put(preparedChat);
      return typeof chatId === 'string' ? chatId : String(chatId);
    } catch (error) {
      console.error('Failed to save chat:', error);
      throw error;
    }
  }

  async deleteChat(id: string): Promise<void> {
    try {
      await this.db.chats.delete(id);
    } catch (error) {
      console.error('Failed to delete chat:', error);
      throw error;
    }
  }

  // Methods that your conversation state manager expects
  async listConversations(showArchived: boolean = false): Promise<Chat[]> {
    try {
      let query = this.db.chats.orderBy('lastModified').reverse();
      const chats = await query.toArray();
      
      const convertedChats = chats.map(chat => this.convertDatesToObjects(chat));
      
      if (showArchived) {
        return convertedChats;
      } else {
        return convertedChats.filter(chat => !chat.isArchived);
      }
    } catch (error) {
      console.error('Failed to list conversations:', error);
      return [];
    }
  }

  async loadConversation(id: string): Promise<Chat> {
    try {
      const chat = await this.db.chats.get(id);
      if (!chat) {
        throw new Error(`Conversation not found: ${id}`);
      }
      return this.convertDatesToObjects(chat);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      throw error;
    }
  }

  async saveConversation(conversation: Chat): Promise<void> {
    try {
      const preparedConversation = this.prepareChatForStorage(conversation);
      await this.db.chats.put(preparedConversation);
    } catch (error) {
      console.error('Failed to save conversation:', error);
      throw error;
    }
  }

  async deleteConversation(id: string): Promise<void> {
    try {
      await this.db.chats.delete(id);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw error;
    }
  }

  // Add migration method
  async migrateFromLocalStorage(): Promise<void> {
    try {
      // Check if there's data in localStorage to migrate
      const localData = localStorage.getItem('polyglot-chats');
      if (!localData) return;

      const chats: Chat[] = JSON.parse(localData);
      console.log(`[migration] Found ${chats.length} chats in localStorage`);

      // Save to IndexedDB with proper date conversion
      for (const chat of chats) {
        await this.saveChat(chat);
      }

      // Clear localStorage after successful migration
      localStorage.removeItem('polyglot-chats');
      console.log('[migration] Successfully migrated chats from localStorage');
      
    } catch (error) {
      console.error('[migration] Failed to migrate from localStorage:', error);
    }
  }

  // Utility method to check if database is ready
  async isReady(): Promise<boolean> {
    try {
      await this.db.open();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Create and export storage instance
export const indexedDbStorage = new IndexedDbStorage(db);

// Create a ready promise that your App.tsx expects
export const ready = indexedDbStorage.initialize();

// Also export as storage for compatibility
export const storage = indexedDbStorage;

// Initialize database on module load
ready.catch(console.error);