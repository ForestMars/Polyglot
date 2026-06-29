// src/services/db.ts
// Storage adapter. Owns three IndexedDB object stores:
//   chats     — live resource state (data plane)
//   deletions — causal horizons (control plane), structurally separate
//   metadata  — device identity, Lamport counter, sync timestamps
//
// Requires: npm install idb

import { openDB, IDBPDatabase } from 'idb';
import { ChatResource, DeletionRecord, SyncMetadata } from '../types/sync';
import { compareLamport } from '../utils/ordering';

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

  private async ensureReady(): Promise<IDBPDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // --- Data plane: chats store ---

  async getAllResources(): Promise<ChatResource[]> {
    const database = await this.ensureReady();
    const resources = await database.getAll("chats");
    return (resources || []) as ChatResource[];
  }

  /**
   * Single-resource lookup by id. Returns null if no resource with this id
   * exists, which is the only correct meaning of null per Invariant 6 — a
   * resource that was deleted retains a record in the deletions store, not
   * here, so this method never needs to disambiguate "deleted" from "unknown."
   */
  async getResource(id: string): Promise<ChatResource | null> {
    const database = await this.ensureReady();
    const resource = await database.get("chats", id);
    return (resource as ChatResource) || null;
  }

  async loadConversation(id: string): Promise<ChatResource | null> {
    return this.getResource(id);
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
    const tx = database.transaction(["chats", "metadata"], "readwrite");
    
    // 1. Save the resource content
    await tx.objectStore("chats").put(resource);
    
    // 2. Co-commit the clock metadata inside the same atomic transaction
    const clock = CoherenceClock.getInstance();
    const meta = (await tx.objectStore("metadata").get("sync_state")) || { key: "sync_state", deviceId: clock.getDeviceId() };
    meta.lastLamport = Math.max(meta.lastLamport || 0, clock.currentLocal().lamport);
    await tx.objectStore("metadata").put(meta);
    
    await tx.done;
  }


  /**
   * Removes a resource from the data plane store and writes its deletion
   * record to the control plane store in a single transaction. The two
   * writes must not be separable: a resource removed without a
   * corresponding record is indistinguishable, on next read, from a
   * resource that was never created (Invariant 5/6 distinction).
   */
  async deleteResource(id: string, record: DeletionRecord): Promise<void> {
    const database = await this.ensureReady();
    const tx = database.transaction(["chats", "deletions"], "readwrite");
    await tx.objectStore("chats").delete(id);
    await tx.objectStore("deletions").put(record);
    await tx.done;
  }

  // --- Control plane: deletions store ---

  async getAllDeletionRecords(): Promise<DeletionRecord[]> {
    const database = await this.ensureReady();
    const deletions = await database.getAll("deletions");
    return (deletions || []) as DeletionRecord[];
  }

  /**
   * Single-record lookup by resource id. Returns null if this resource was
   * never deleted locally — the complement of getResource returning null,
   * together giving an unambiguous three-way read: active, deleted, or
   * never seen.
   */
  async getDeletionRecord(id: string): Promise<DeletionRecord | null> {
    const database = await this.ensureReady();
    const record = await database.get("deletions", id);
    return (record as DeletionRecord) || null;
  }

  /**
   * Writes a deletion record directly. Used by ReconciliationEngine when a
   * remote deletion is accepted, or when both sides agree a resource is
   * deleted and the record is being reconciled rather than originated.
   * Does not touch the chats store — callers that also need the resource
   * removed call deleteResource instead, or remove it separately.
   */
  async saveDeletionRecord(record: DeletionRecord): Promise<void> {
    const database = await this.ensureReady();
    await database.put("deletions", record);
  }

  /**
   * Removes a deletion record without restoring the resource. Used when a
   * remote update is found to causally dominate a local deletion horizon —
   * the caller is responsible for then saving the restored resource.
   */
  async removeDeletionRecord(id: string): Promise<void> {
    const database = await this.ensureReady();
    await database.delete("deletions", id);
  }

  /** @deprecated retained for backward compatibility, use trackDeletion's
   * callers migrating to saveDeletionRecord. Will be removed once no
   * call sites remain. */
  async trackDeletion(record: DeletionRecord): Promise<void> {
    await this.saveDeletionRecord(record);
  }

  // --- Metadata store ---

  async getSyncMetadata(): Promise<SyncMetadata | null> {
    const database = await this.ensureReady();
    const meta = await database.get("metadata", "sync_state");
    return (meta as SyncMetadata) || null;
  }

  async saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
    const database = await this.ensureReady();
    await database.put("metadata", { key: "sync_state", ...metadata });
  }
}

export const polyglotDb = new PolyglotDatabase();