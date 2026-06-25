// src/services/db.ts
// Storage adapter. Owns three IndexedDB object stores:
//   chatResources   — live resource state (data plane)
//   deletionRecords — causal horizons (control plane), structurally separate
//   metadata        — device identity, Lamport counter, sync timestamps
//
// Requires: npm install idb

// src/services/db.ts
import { openDB, IDBPDatabase } from 'idb';
import { ChatResource, DeletionRecord, SyncMetadata } from '../types/sync';
import { CoherenceClock } from './CoherenceClock';
import { compareLamport, earlier } from '../utils/ordering';

export class PolyglotDatabase {
  private db: IDBPDatabase | null = null;
  private initPromise: Promise<IDBPDatabase> | null = null;

  /**
   * Initializes the wrapped idb database instance.
   * Version bumped to 11 to force execution of the upgrade hook on existing v10 databases.
   */
  async init(): Promise<IDBPDatabase> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = openDB("PolyglotDB", 11, {
      upgrade(database, oldVersion, newVersion) {
        // Safe creation checks across any legacy version transition
        if (!database.objectStoreNames.contains("chats")) {
          database.createObjectStore("chats", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("metadata")) {
          database.createObjectStore("metadata", { keyPath: "key" });
        }
        if (!database.objectStoreNames.contains("deletions")) {
          database.createObjectStore("deletions", { keyPath: "id" });
        }
      },
    }).then((database) => {
      this.db = database;
      return database;
    });

    return this.initPromise;
  }

  /**
   * Internal lazy initialization guard to ensure execution safety when methods
   * are triggered during early React mounting steps before init() settles.
   */
  private async ensureReady(): Promise<IDBPDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  async getAllResources(): Promise<ChatResource[]> {
    const database = await this.ensureReady();
    const resources = await database.getAll("chats");
    return (resources || []) as ChatResource[];
  }

  async loadConversation(id: string): Promise<ChatResource | null> {
    const database = await this.ensureReady();
    const resource = await database.get("chats", id);
    return (resource as ChatResource) || null;
  }

  async getVisibleChats(): Promise<ChatResource[]> {
    const resources = await this.getAllResources();
    return resources.filter(c => !c.isArchived);
  }

  async listConversations(showArchived: boolean): Promise<ChatResource[]> {
    const resources = await this.getAllResources();
    return resources
      .filter(c => showArchived || !c.isArchived)
      .sort((a, b) => {
        if (a.clock && b.clock) {
          return compareLamport(b.clock, a.clock);
        }
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      });
  }

  async saveResource(resource: ChatResource): Promise<void> {
    const database = await this.ensureReady();
    await database.put("chats", resource);
  }

  async deleteResource(id: string): Promise<void> {
    const database = await this.ensureReady();
    await database.delete("chats", id);
  }

  // --- Extended Sync & Coherence Protocol Methods ---

  async getSyncMetadata(): Promise<SyncMetadata | null> {
    const database = await this.ensureReady();
    const meta = await database.get("metadata", "sync_state");
    return (meta as SyncMetadata) || null;
  }

  async saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
    const database = await this.ensureReady();
    await database.put("metadata", { key: "sync_state", ...metadata });
  }

  async getDeletionRecords(): Promise<DeletionRecord[]> {
    const database = await this.ensureReady();
    const deletions = await database.getAll("deletions");
    return (deletions || []) as DeletionRecord[];
  }

  async trackDeletion(record: DeletionRecord): Promise<void> {
    const database = await this.ensureReady();
    await database.put("deletions", record);
  }
}

export const polyglotDb = new PolyglotDatabase();