// src/services/backgroundSync.ts
import { ChatResource, DeletionRecord, SyncResult } from '../types/sync';
import { CoherenceClock } from './CoherenceClock';
import { polyglotDb } from './db';
import { ReconciliationEngine } from './ReconciliationEngine';

const SYNC_URL = 'http://localhost:4001';
const reconciliationEngine = new ReconciliationEngine(polyglotDb);

export async function initializeSync(): Promise<void> {
  await polyglotDb.init();
  let meta = await polyglotDb.getSyncMetadata();
  if (!meta) {
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

// Data plane methods must return SyncResult structures to meet orchestration expectations
export async function pushResource(resource: ChatResource): Promise<SyncResult> {
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
    return {
      success: response.ok,
      syncedCount: response.ok ? 1 : 0,
      deletedCount: 0,
      changed: response.ok,
    };
  } catch (error) {
    return {
      success: false,
      syncedCount: 0,
      deletedCount: 0,
      changed: false,
      error: error instanceof Error ? error.message : 'Fetch failed',
    };
  }
}

export async function pushDeletion(record: DeletionRecord): Promise<SyncResult> {
  try {
    const response = await fetch(`${SYNC_URL}/deleteChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: record.resourceId,
        lamport: [record.deletedAtLamport.lamport, record.deletedAtLamport.deviceId],
      }),
    });
    return {
      success: response.ok,
      syncedCount: 0,
      deletedCount: response.ok ? 1 : 0,
      changed: response.ok,
    };
  } catch (error) {
    return {
      success: false,
      syncedCount: 0,
      deletedCount: 0,
      changed: false,
      error: error instanceof Error ? error.message : 'Fetch failed',
    };
  }
}

// Namespace export mirror to capture object-destructuring imports
export const backgroundSync = {
  syncWithServer,
  pushResource,
  pushDeletion,
};