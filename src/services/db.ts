// src/services/db.ts
// Storage adapter. Owns three IndexedDB object stores:
//   chatResources   — live resource state (data plane)
//   deletionRecords — causal horizons (control plane), structurally separate
//   metadata        — device identity, Lamport counter, sync timestamps
//
// Requires: npm install idb

import { openDB, IDBPDatabase } from 'idb';
import { ChatResource, DeletionRecord, SyncMetadata } from '../types/sync';
import { CoherenceClock } from './CoherenceClock';
import { compareLamport, earlier } from '../utils/ordering';

export class PolyglotDatabase {
  private db: IDBPDatabase | null = null;

  async init(): Promise<void> {
    this.db = await openDB('polyglot_coherence_v1', 1, {
      upgrade(db) {
        db.createObjectStore('chatResources', { keyPath: 'id' });
        db.createObjectStore('deletionRecords', { keyPath: 'resourceId' });
        db.createObjectStore('metadata', { keyPath: 'id' });
      },
    });
  }

  // ---------------------------------------------------------------------------
  // chatResources
  // ---------------------------------------------------------------------------

  async getResource(id: string): Promise<ChatResource | undefined> {
    return this.db!.get('chatResources', id);
  }

  async getAllResources(): Promise<ChatResource[]> {
    return this.db!.getAll('chatResources');
  }

  async saveResource(resource: ChatResource): Promise<void> {
    await this.db!.put('chatResources', resource);
  }

  async deleteResource(id: string): Promise<void> {
    await this.db!.delete('chatResources', id);
  }

  // ---------------------------------------------------------------------------
  // deletionRecords
  // ---------------------------------------------------------------------------

  async getDeletionRecord(resourceId: string): Promise<DeletionRecord | undefined> {
    return this.db!.get('deletionRecords', resourceId);
  }

  async getAllDeletionRecords(): Promise<DeletionRecord[]> {
    return this.db!.getAll('deletionRecords');
  }

  // Deletion records are logically immutable: the earliest deletion establishes
  // the binding causal horizon. Under concurrent deletes from two devices we
  // retain whichever happened first. We never throw — concurrent deletes are
  // a legitimate protocol event, not a violation.
  async saveDeletionRecord(record: DeletionRecord): Promise<void> {
    const existing = await this.getDeletionRecord(record.resourceId);
    if (existing) {
      const binding = earlier(existing.deletedAtLamport, record.deletedAtLamport);
      if (compareLamport(binding, existing.deletedAtLamport) === 0) {
        return; // Existing record is already the earlier horizon; nothing to do.
      }
      // Incoming is earlier; replace.
    }
    await this.db!.put('deletionRecords', record);
  }

  // Register a local delete: tick the clock, write the deletion record,
  // remove the resource. Returns the record for server propagation.
  async registerLocalDelete(resourceId: string): Promise<DeletionRecord> {
    const tau = CoherenceClock.getInstance().tick();
    const record: DeletionRecord = { resourceId, deletedAtLamport: tau };
    await this.saveDeletionRecord(record);
    await this.deleteResource(resourceId);
    return record;
  }

  async removeDeletionRecord(resourceId: string): Promise<void> {
    await this.db!.delete('deletionRecords', resourceId);
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  // Returns resources that have no deletion record. N+1 for now — acceptable
  // at prototype scale; replace with an index join when needed.
  async getVisibleChats(): Promise<ChatResource[]> {
    const resources = await this.getAllResources();
    const visible: ChatResource[] = [];
    for (const res of resources) {
      const deletion = await this.getDeletionRecord(res.id);
      if (!deletion) visible.push(res);
    }
    return visible;
  }

  async listConversations(showArchived: boolean = false): Promise<ChatResource[]> {
    const visible = await this.getVisibleChats();
    const filtered = showArchived ? visible : visible.filter(c => !c.isArchived);
    return filtered.sort(
      (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  }

  async loadConversation(id: string): Promise<ChatResource> {
    const resource = await this.getResource(id);
    if (!resource) throw new Error(`Conversation not found: ${id}`);
    const deletion = await this.getDeletionRecord(id);
    if (deletion) throw new Error(`Conversation ${id} has been deleted`);
    return resource;
  }

  // ---------------------------------------------------------------------------
  // metadata
  // ---------------------------------------------------------------------------

  async getSyncMetadata(): Promise<SyncMetadata | undefined> {
    return this.db!.get('metadata', 'sync_state');
  }

  async saveSyncMetadata(meta: SyncMetadata): Promise<void> {
    await this.db!.put('metadata', meta);
  }
}

export const polyglotDb = new PolyglotDatabase();