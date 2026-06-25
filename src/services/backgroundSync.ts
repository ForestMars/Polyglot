// src/services/backgroundSync.ts
// Network adapter + application service for sync operations.
// Returns SyncResult — never touches the DOM. Callers decide what to do
// with the result. window.dispatchEvent belongs in the presentation layer.

import { ChatResource, DeletionRecord, SyncResult } from '../types/sync';
import { CoherenceClock } from './CoherenceClock';
import { polyglotDb } from './db';
import { ReconciliationEngine } from './ReconciliationEngine';

const SYNC_URL = 'http://localhost:4001';

const reconciliationEngine = new ReconciliationEngine(polyglotDb);

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

// Must be called once before any sync or push operation.
// Restores device identity and Lamport counter from the metadata store.
export async function initializeSync(): Promise<void> {
  await polyglotDb.init();
  let meta = await polyglotDb.getSyncMetadata();
  if (!meta) {
    // Secure fallback for environments accessing via non-localhost IP addresses over HTTP
    const deviceId = `device_${
      typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    }`;
    meta = { id: 'sync_state', deviceId, lamportCounter: 0, lastSyncAt: null };
    await polyglotDb.saveSyncMetadata(meta);
  }
  await CoherenceClock.initialize(meta.deviceId, meta.lamportCounter ?? 0);
  console.log(`[sync] Initialized. Device: ${meta.deviceId}, clock: ${meta.lamportCounter}`);
}

async function persistClockState(): Promise<void> {
  const clock = CoherenceClock.getInstance();
  const meta = await polyglotDb.getSyncMetadata();
  if (meta) {
    await polyglotDb.saveSyncMetadata({ ...meta, lamportCounter: clock.getCounter() });
  }
}

// ---------------------------------------------------------------------------
// Control plane: epoch-boundary reconciliation
// ---------------------------------------------------------------------------

export async function syncWithServer(): Promise<SyncResult> {
  try {
    const localResources = await polyglotDb.getAllResources();
    const localDeletions = await polyglotDb.getAllDeletionRecords();

    const response = await fetch(`${SYNC_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chats: localResources.map(r => ({
          ...r,
          // Translate ClockTuple → server's [number, string] tuple format
          updatedAtLamport: [r.lastMutationLamport.lamport, r.lastMutationLamport.deviceId],
        })),
        deletionRecords: localDeletions.map(d => ({
          id: d.resourceId,
          deletedAtLamport: [d.deletedAtLamport.lamport, d.deletedAtLamport.deviceId],
        })),
      }),
    });

    if (!response.ok) throw new Error(`Server sync failed: ${response.status}`);

    const { missing, deletions } = await response.json();

    // Translate server response back to protocol types.
    const incomingResources: ChatResource[] = (missing || []).map((c: any) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
      lastModified: new Date(c.lastModified || c.updatedAt),
      messages: (c.messages || []).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
      lastMutationLamport: c.updatedAtLamport
        ? { lamport: c.updatedAtLamport[0], deviceId: c.updatedAtLamport[1] }
        : { lamport: 0, deviceId: 'server' },
    }));

    const incomingDeletions: DeletionRecord[] = (deletions || []).map((d: any) => ({
      resourceId: d.id,
      deletedAtLamport: {
        lamport: d.deletedAtLamport[0],
        deviceId: d.deletedAtLamport[1],
      },
    }));

    const { resourcesApplied, deletionsApplied } =
      await reconciliationEngine.reconcileBoundary(incomingResources, incomingDeletions);

    const meta = await polyglotDb.getSyncMetadata();
    if (meta) {
      await polyglotDb.saveSyncMetadata({ ...meta, lastSyncAt: new Date().toISOString() });
    }
    await persistClockState();

    return {
      success: true,
      syncedCount: resourcesApplied,
      deletedCount: deletionsApplied,
      changed: resourcesApplied > 0 || deletionsApplied > 0,
    };
  } catch (error) {
    console.error('[sync] syncWithServer failed:', error);
    return {
      success: false,
      syncedCount: 0,
      deletedCount: 0,
      changed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ---------------------------------------------------------------------------
// Data plane: real-time push
// ---------------------------------------------------------------------------

export async function pushResource(resource: ChatResource): Promise<boolean> {
  const tau = CoherenceClock.getInstance().tick();
  const stamped = {
    ...resource,
    lastMutationLamport: tau,
    updatedAtLamport: [tau.lamport, tau.deviceId],
  };
  try {
    const response = await fetch(`${SYNC_URL}/pushChats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chats: [stamped] }),
    });
    await persistClockState();
    return response.ok;
  } catch {
    return false;
  }
}

export async function pushDeletion(record: DeletionRecord): Promise<boolean> {
  try {
    const response = await fetch(`${SYNC_URL}/deleteChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: record.resourceId,
        lamport: [record.deletedAtLamport.lamport, record.deletedAtLamport.deviceId],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Convenience Hybrid Exports
// ---------------------------------------------------------------------------

// 1. Standalone function structure for App.tsx invocation
export async function backgroundSync(): Promise<SyncResult> {
  return syncWithServer();
}

// 2. Intercept and wrap push properties to fulfill the object contract expected by conversationSync.ts
backgroundSync.pushResource = async function(resource: ChatResource) {
  const success = await pushResource(resource);
  return {
    success,
    syncedCount: success ? 1 : 0,
    deletedCount: 0,
    changed: success, // Prevents 'Cannot read properties of undefined (reading changed)' crash
  };
};

backgroundSync.pushDeletion = async function(record: DeletionRecord) {
  const success = await pushDeletion(record);
  return {
    success,
    syncedCount: 0,
    deletedCount: success ? 1 : 0,
    changed: success,
  };
};

backgroundSync.syncWithServer = syncWithServer;

// 3. Keep alternative name active for fallback compatibility
export async function backgroundSyncWithServer(): Promise<SyncResult> {
  return syncWithServer();
}