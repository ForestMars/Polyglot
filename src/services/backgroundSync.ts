// src/services/backgroundSync.ts
//
// Sync service implementing the eventual coherence architecture.
//
// Control plane (syncWithServer): runs at epoch boundaries. Sends full local
// state including deletion records. Receives missing chats and server-side
// deletion records. Applies Invariant 5 before writing anything locally.
//
// Data plane (pushChat, receiveUpdate): real-time propagation. Receive handler
// enforces Invariant 5: if local_storage.get(id) returns is_deleted=true,
// the incoming update is silently discarded regardless of content.
//
// Lamport clock: every write advances the local clock. Clock is persisted in
// IndexedDB meta so it survives page reloads.

import { storage, Chat } from './indexedDbStorage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LamportTuple extends Array<number | string> {
  0: number;   // logical time
  1: string;   // device id
}

export interface DeletionRecord {
  id: string;
  deletedAtLamport: LamportTuple;
}

interface SyncPayload {
  chats: Chat[];
  deletionRecords: DeletionRecord[];
}

interface SyncResponse {
  missing: Chat[];
  deletions: DeletionRecord[];
}

export interface SyncResult {
  success: boolean;
  syncedCount?: number;
  deletedCount?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Lamport helpers (client-side mirror of chatStore.js)
// ---------------------------------------------------------------------------

// τ_a ≻ τ_b
function dominates(tauA: LamportTuple, tauB: LamportTuple): boolean {
  if (!tauA || !tauB) return false;
  const [lA, dA] = tauA;
  const [lB, dB] = tauB;
  return lA > lB || (lA === lB && String(dA) > String(dB));
}

// ---------------------------------------------------------------------------
// BackgroundSyncService
// ---------------------------------------------------------------------------

export class BackgroundSyncService {
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Lamport clock state — persisted to IndexedDB meta between sessions.
  private lamportTime = 0;
  private deviceId: string = '';

  // Local deletion records: id → DeletionRecord.
  // Persisted to IndexedDB meta. This is the Invariant 5 retention requirement:
  // a device that deletes r must retain {r.id, r.deletedAtLamport} and never
  // remove it via a data plane operation.
  private deletionRecords: Map<string, DeletionRecord> = new Map();

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (!this.initPromise) this.initPromise = this.initialize();
    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    try {
      console.log('[sync] Initializing...');
      await storage.initialize();

      // Restore Lamport clock and device ID from meta.
      const meta = await storage.getMeta('sync') || {};
      this.lamportTime = meta.lamportTime ?? 0;
      this.deviceId = meta.deviceId ?? this.generateDeviceId();

      // Restore deletion records from meta.
      const storedRecords: DeletionRecord[] = meta.deletionRecords ?? [];
      this.deletionRecords = new Map(storedRecords.map((r: DeletionRecord) => [r.id, r]));

      this.isInitialized = true;
      console.log(`[sync] Initialized. Device: ${this.deviceId}, clock: ${this.lamportTime}`);
    } catch (error) {
      console.error('[sync] Initialization failed:', error);
      this.isInitialized = false;
      this.initPromise = null;
      throw error;
    }
  }

  private generateDeviceId(): string {
    return `device_${crypto.randomUUID()}`;
  }

  // ---------------------------------------------------------------------------
  // Lamport clock
  // ---------------------------------------------------------------------------

  private tick(incomingTime?: number): LamportTuple {
    this.lamportTime = Math.max(this.lamportTime, incomingTime ?? 0) + 1;
    return [this.lamportTime, this.deviceId];
  }

  private async persistClockState(): Promise<void> {
    try {
      const meta = await storage.getMeta('sync') || {};
      await storage.setMeta({
        ...meta,
        id: 'sync',
        lamportTime: this.lamportTime,
        deviceId: this.deviceId,
        deletionRecords: Array.from(this.deletionRecords.values()),
      });
    } catch (error) {
      console.error('[sync] Failed to persist clock state:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Deletion record management (Invariant 5)
  // ---------------------------------------------------------------------------

  // Register a local deletion. Returns the deletion record.
  async recordLocalDeletion(chatId: string): Promise<DeletionRecord> {
    await this.ensureInitialized();
    const tau = this.tick();
    const record: DeletionRecord = { id: chatId, deletedAtLamport: tau };
    this.deletionRecords.set(chatId, record);
    await this.persistClockState();
    return record;
  }

  // Receive handler: enforce Invariant 5 before writing any incoming update.
  // Returns true if the update was accepted, false if discarded.
  private async receiveUpdate(incoming: Chat): Promise<boolean> {
    // Check local deletion record first.
    const deletionRecord = this.deletionRecords.get(incoming.id);
    if (deletionRecord) {
      // Resource is locally deleted. Discard unless the incoming update causally
      // dominates the deletion (Definition 7 / Sub-case 4a).
      const tauIncoming = (incoming as any).updatedAtLamport as LamportTuple | undefined;
      if (!tauIncoming || !dominates(tauIncoming, deletionRecord.deletedAtLamport)) {
        // τ_local ⊀ τ_delete — discard (Invariant 5).
        return false;
      }
      // Incoming causally dominates: remove local deletion record and accept.
      this.deletionRecords.delete(incoming.id);
      await this.persistClockState();
    }

    // Check IndexedDB — handles the topologically unknown resource case.
    // If local_storage.get returns null, device has never seen this resource
    // (Invariant 5's retention requirement makes null unambiguous).
    // Accept it as a new resource.
    const existing = await storage.getChat(incoming.id);
    const incomingTime = (incoming as any).updatedAtLamport?.[0] as number | undefined;
    this.tick(incomingTime);

    await storage.saveChat({
      ...incoming,
      createdAt: new Date(incoming.createdAt),
      updatedAt: new Date(incoming.updatedAt),
      messages: (incoming.messages || []).map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    });

    return true;
  }

  // Apply a deletion record received from the server or another device.
  private async receiveDeletion(record: DeletionRecord): Promise<void> {
    // If we already have this deletion, nothing to do.
    if (this.deletionRecords.has(record.id)) return;

    this.deletionRecords.set(record.id, record);

    // Advance clock to account for the incoming deletion timestamp.
    this.tick(record.deletedAtLamport[0]);

    // Remove from local storage if present.
    try {
      await storage.deleteChat(record.id);
    } catch {
      // Not present locally — that's fine; Invariant 5 still holds because
      // the deletion record is now registered.
    }

    await this.persistClockState();
  }

  // ---------------------------------------------------------------------------
  // Control plane: epoch-boundary sync (Section 3.4)
  // ---------------------------------------------------------------------------

  async syncWithServer(): Promise<SyncResult> {
    try {
      await this.ensureInitialized();
      console.log('[sync] Starting control plane sync...');

      const localChats = await storage.getChats();
      const payload: SyncPayload = {
        chats: localChats.map(c => ({
          ...c,
          updatedAtLamport: (c as any).updatedAtLamport ?? this.tick(),
        })),
        deletionRecords: Array.from(this.deletionRecords.values()),
      };

      const response = await fetch('http://localhost:4001/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server sync failed: ${response.status}`);
      }

      const { missing, deletions }: SyncResponse = await response.json();

      // Apply missing chats from server (receive handler enforces Invariant 5).
      let syncedCount = 0;
      for (const chat of missing) {
        const accepted = await this.receiveUpdate(chat);
        if (accepted) syncedCount++;
      }

      // Apply deletion records from server.
      let deletedCount = 0;
      for (const record of deletions) {
        await this.receiveDeletion(record);
        deletedCount++;
      }

      await this.updateLastSync();
      await this.persistClockState();

      console.log(`[sync] Sync complete: +${syncedCount} chats, -${deletedCount} deletions`);

      if (typeof window !== 'undefined' && (syncedCount > 0 || deletedCount > 0)) {
        try {
          window.dispatchEvent(new Event('conversations-updated'));
        } catch (e) {
          console.warn('[sync] Failed to dispatch conversations-updated event', e);
        }
      }

      return { success: true, syncedCount, deletedCount };
    } catch (error) {
      console.error('[sync] Sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown sync error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Data plane: real-time push (Section 3.1)
  // ---------------------------------------------------------------------------

  // Push a local update to the server. Stamps with local Lamport tuple.
  async pushChat(chat: Chat): Promise<boolean> {
    await this.ensureInitialized();

    const tau = this.tick();
    const stamped = { ...chat, updatedAtLamport: tau };

    try {
      const response = await fetch('http://localhost:4001/pushChats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chats: [stamped] }),
      });
      await this.persistClockState();
      return response.ok;
    } catch (error) {
      console.error('[sync] Push failed:', error);
      return false;
    }
  }

  // Push a local deletion to the server and register the deletion record.
  async pushDeletion(chatId: string): Promise<boolean> {
    await this.ensureInitialized();

    const record = await this.recordLocalDeletion(chatId);

    try {
      const response = await fetch('http://localhost:4001/deleteChat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, lamport: record.deletedAtLamport }),
      });
      return response.ok;
    } catch (error) {
      // Deletion record is already registered locally; server will get it at
      // the next sync boundary.
      console.warn('[sync] Push deletion failed, will retry at sync:', error);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Status / housekeeping
  // ---------------------------------------------------------------------------

  async getSyncStatus(): Promise<{ lastSync: Date | null; isReady: boolean; deviceId: string }> {
    try {
      await this.ensureInitialized();
      const meta = await storage.getMeta('app');
      return {
        lastSync: meta?.lastSync || null,
        isReady: this.isInitialized,
        deviceId: this.deviceId,
      };
    } catch {
      return { lastSync: null, isReady: false, deviceId: '' };
    }
  }

  private async updateLastSync(): Promise<void> {
    try {
      const meta = await storage.getMeta('app') || { id: 'app', version: '1.0.0' };
      await storage.setMeta({ ...meta, lastSync: new Date() });
    } catch (error) {
      console.error('[sync] Failed to update lastSync:', error);
    }
  }

  async reset(): Promise<void> {
    this.isInitialized = false;
    this.initPromise = null;
    this.lamportTime = 0;
    this.deletionRecords.clear();
    await storage.initialize();
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const backgroundSync = new BackgroundSyncService();

export async function backgroundSyncWithServer(): Promise<SyncResult> {
  return backgroundSync.syncWithServer();
}