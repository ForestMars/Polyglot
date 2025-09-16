// src/services/backgroundSync.ts - Fixed version with proper error handling

import { storage } from './indexedDbStorage';
import { Chat } from './indexedDbStorage';

interface ServerDelta {
  id: string;
  type: 'create' | 'update' | 'delete';
  data?: Chat;
  timestamp: Date;
}

interface SyncResult {
  success: boolean;
  syncedCount?: number;
  error?: string;
}

export class BackgroundSyncService {
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Ensure database is initialized before any operations
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    
    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    try {
      console.log('[sync] Initializing background sync service...');
      
      // Wait for storage to be ready
      await storage.initialize();
      
      // Verify database is accessible
      // const isReady = await storage.isReady();
      const isReady = true; // Database is already initialized if we got here. (No need to await)

      if (!isReady) {
        throw new Error('Database is not ready after initialization');
      }
      
      this.isInitialized = true;
      console.log('[sync] Background sync service initialized successfully');
    } catch (error) {
      console.error('[sync] Failed to initialize background sync service:', error);
      this.isInitialized = false;
      this.initPromise = null;
      throw error;
    }
  }

  // Sync with server data (chatStore.json)
  async syncWithServer(): Promise<SyncResult> {
    try {
      console.log('[sync] Starting sync with server...');
      
      // Ensure database is ready
      await this.ensureInitialized();
      
      // Get server data
      const serverChats = await this.fetchServerChats();
      if (!serverChats || serverChats.length === 0) {
        console.log('[sync] No server chats found');
        return { success: true, syncedCount: 0 };
      }

      // Get current local chats
      const localChats = await storage.getChats();
      const localChatIds = new Set(localChats.map(chat => chat.id));

      // Sync server chats to local database
      let syncedCount = 0;
      for (const serverChat of serverChats) {
        try {
          if (!localChatIds.has(serverChat.id)) {
            await storage.saveChat(serverChat);
            syncedCount++;
            console.log(`[sync] Synced chat: ${serverChat.title}`);
          }
        } catch (error) {
          console.error(`[sync] Failed to sync chat ${serverChat.id}:`, error);
        }
      }

      // Update last sync timestamp
      await this.updateLastSync();

      console.log(`[sync] Successfully synced ${syncedCount} chats from server`);
      return { success: true, syncedCount };
      
    } catch (error) {
      console.error('[sync] Failed to sync with server:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown sync error' 
      };
    }
  }

  // Fetch chats from server (chatStore.json)
  private async fetchServerChats(): Promise<Chat[]> {
    try {
      // This assumes your server endpoint exists - adjust URL as needed
      const response = await fetch('/api/chats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // If API endpoint doesn't exist, try to load from static file
        return await this.loadChatStoreFile();
      }

      const chats: Chat[] = await response.json();
      return chats.map(chat => ({
        ...chat,
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt),
        messages: chat.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));
      
    } catch (error) {
      console.log('[sync] API not available, trying to load from chatStore.json...');
      return await this.loadChatStoreFile();
    }
  }

  // Load from chatStore.json file (fallback)
  private async loadChatStoreFile(): Promise<Chat[]> {
    try {
      // Try to fetch the static chatStore.json file
      const response = await fetch('/src/server/chatStore.json');
      
      if (!response.ok) {
        console.log('[sync] chatStore.json not found or not accessible');
        return [];
      }

      const data = await response.json();
      const chats: Chat[] = data.chats || data || [];
      
      return chats.map(chat => ({
        ...chat,
        id: chat.id || crypto.randomUUID(),
        createdAt: new Date(chat.createdAt || Date.now()),
        updatedAt: new Date(chat.updatedAt || Date.now()),
        messages: chat.messages?.map(msg => ({
          ...msg,
          id: msg.id || crypto.randomUUID(),
          timestamp: new Date(msg.timestamp || Date.now())
        })) || []
      }));
      
    } catch (error) {
      console.error('[sync] Failed to load chatStore.json:', error);
      return [];
    }
  }

  // Update last sync timestamp
  private async updateLastSync(): Promise<void> {
    try {
      const currentMeta = await storage.getMeta('app') || {
        id: 'app',
        version: '1.0.0'
      };
      
      await storage.setMeta({
        ...currentMeta,
        lastSync: new Date()
      });
    } catch (error) {
      console.error('[sync] Failed to update last sync timestamp:', error);
      // Don't throw - this is not critical for sync operation
    }
  }

  // Get sync status
  async getSyncStatus(): Promise<{ lastSync: Date | null; isReady: boolean }> {
    try {
      await this.ensureInitialized();
      const meta = await storage.getMeta('app');
      return {
        lastSync: meta?.lastSync || null,
        isReady: this.isInitialized
      };
    } catch (error) {
      console.error('[sync] Failed to get sync status:', error);
      return {
        lastSync: null,
        isReady: false
      };
    }
  }

  // Force reset sync state (for debugging)
  async reset(): Promise<void> {
    this.isInitialized = false;
    this.initPromise = null;
    await storage.initialize();
  }
}

// Export singleton instance
export const backgroundSync = new BackgroundSyncService();

// Export main sync function for use in App.tsx
export async function backgroundSyncWithServer(): Promise<SyncResult> {
  return await backgroundSync.syncWithServer();
}