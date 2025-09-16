// src/services/indexedDbStorage.ts - Fixed version with proper schema management

import Dexie, { Table } from 'dexie';

// Define your interfaces
export interface Chat {
  id?: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  model?: string;
  provider?: string;
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
      chats: '++id, title, createdAt, updatedAt, model, provider',
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

// Database operations with proper error handling
export class IndexedDbStorage {
  private db: PolyglotDatabase;

  constructor(database: PolyglotDatabase) {
    this.db = database;
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

  // Chat operations with error handling
  async getChats(): Promise<Chat[]> {
    try {
      const chats = await this.db.chats.orderBy('updatedAt').reverse().toArray();
      return chats;
    } catch (error) {
      console.error('Failed to get chats:', error);
      return [];
    }
  }

  async saveChat(chat: Chat): Promise<string> {
    try {
      const chatId = await this.db.chats.put(chat);
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

  // Check if database is ready
  async isReady(): Promise<boolean> {
    try {
      await this.db.meta.limit(1).toArray();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Create and export storage instance
export const storage = new IndexedDbStorage(db);

// Initialize database on module load
storage.initialize().catch(console.error);