// src/services/backgroundSync.ts
import { ChatResource, DeletionRecord, SyncResult, ClockTuple } from '../types/sync';
import { CoherenceClock, ClockSnapshot } from './CoherenceClock';
import { polyglotDb, SyncMetadata } from './db';
import { ReconciliationEngine } from './ReconciliationEngine';

const SYNC_URL = 'http://localhost:4001';
const reconciliationEngine = new ReconciliationEngine(polyglotDb);

let initPromise: Promise<void> | null = null;
const registeredSockets = new WeakSet<WebSocket>();

function parseServerClockTuple(rawTuple: any, resourceId: string): ClockTuple {
  if (Array.isArray(rawTuple) && typeof rawTuple[0] === 'number' && typeof rawTuple[1] === 'string') {
    return { lamport: rawTuple[0], deviceId: rawTuple[1] };
  }
  if (rawTuple && typeof rawTuple.lamport === 'number' && typeof rawTuple.deviceId === 'string') {
    return { lamport: rawTuple.lamport, deviceId: rawTuple.deviceId };
  }
  throw new TypeError(
    `[Protocol Violation] Resource '${resourceId}' arrived with missing or malformed clock tuple metadata.`
  );
}

export async function initializeSync(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await polyglotDb.init();
      let meta = await polyglotDb.getSyncMetadata();

      if (!meta) {
        const generatedId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        meta = {
          key: 'sync_state',
          deviceId: generatedId,
          localCounter: 0,
          observedCounter: 0,
          lastSyncAt: new Date(0).toISOString(),
        };
        await polyglotDb.saveSyncMetadata(meta);
      }

      await CoherenceClock.initialize(meta.deviceId, meta.localCounter, meta.observedCounter);
      console.log(`[sync] Protocol Core initialized. Identity: ${meta.deviceId}`);
    } catch (error) {
      initPromise = null;
      console.error('[sync] Critical initialization failure:', error);
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Single Causal Boundary Entry Point (POST /sync)
 * Flushes all local tracking states and processes all incoming changes inside a unified transaction loop.
 */
export async function syncWithServer(): Promise<SyncResult> {
  await initializeSync();

  try {
    console.log('[sync] Executing unified synchronization boundary pass...');

    // Gather outbound state payloads
    const outboundResources = await polyglotDb.listConversations(true); 
    const outboundDeletions = await polyglotDb.listDeletions();
    const clockSnapshot = CoherenceClock.getInstance().snapshot();

    // Consolidated protocol boundary push/pull
    const response = await fetch(`${SYNC_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: clockSnapshot.deviceId,
        clientClock: clockSnapshot,
        // Map local format to wire protocol validation layout
        chats: outboundResources.map(r => ({
          id: r.id,
          title: r.title,
          provider: r.provider,
          currentModel: r.currentModel,
          isArchived: r.isArchived,
          messages: r.messages,
          lastModified: typeof r.lastModified?.toISOString === 'function' ? r.lastModified.toISOString() : new Date(r.lastModified).toISOString(),
          updatedAtLamport: r.lastMutationLamport ? [r.lastMutationLamport.lamport, r.lastMutationLamport.deviceId] : [0, clockSnapshot.deviceId]
        })),
        deletions: outboundDeletions.map(d => ({
          id: d.resourceId || d.id, 
          lamport: d.deletedAtLamport ? [d.deletedAtLamport.lamport, d.deletedAtLamport.deviceId] : [0, clockSnapshot.deviceId]
        })),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(no body)');
      console.error('[sync] 400 response body:', errorBody);
      throw new Error(`Server sync endpoint rejected transaction with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const incomingResources: ChatResource[] = [];
    const incomingDeletions: DeletionRecord[] = [];

    // Fault-isolated payload parsing
    for (const c of data.missing || []) {
      try {
        incomingResources.push({
          id: c.id,
          title: c.title,
          provider: c.provider,
          currentModel: c.currentModel,
          isArchived: !!c.isArchived,
          messages: c.messages || [],
          lastModified: new Date(c.lastModified || Date.now()),
          lastMutationLamport: parseServerClockTuple(c.updatedAtLamport, c.id),
        });
      } catch (err) {
        console.error(`[sync] Skipping malformed resource entity [ID: ${c?.id}]:`, err);
      }
    }

    for (const d of data.deletions || []) {
      try {
        incomingDeletions.push({
          id: d.chatId,
          resourceId: d.chatId,
          deletedAtLamport: parseServerClockTuple(d.lamport, d.chatId),
        });
      } catch (err) {
        console.error(`[sync] Skipping malformed deletion control entry [ID: ${d?.chatId}]:`, err);
      }
    }

    // Converge via Protocol Engine
    const { resourcesApplied, deletionsApplied } = await reconciliationEngine.reconcileBoundary(
      incomingResources,
      incomingDeletions
    );

    // Save operational tracking states safely
    const meta = await polyglotDb.getSyncMetadata();
    if (meta) {
      await polyglotDb.saveSyncMetadata({
        ...meta,
        lastSyncAt: new Date().toISOString(),
      });
    }
    await persistClockState();

    return {
      success: true,
      syncedCount: resourcesApplied,
      deletedCount: deletionsApplied,
      changed: resourcesApplied > 0 || deletionsApplied > 0,
    };
  } catch (error) {
    console.error('[sync] Synchronization cycle failed:', error);
    return {
      success: false,
      syncedCount: 0,
      deletedCount: 0,
      changed: false,
      error: error instanceof Error ? error.message : 'Unknown exception',
    };
  }
}

/**
 * Channel WebSocket traffic directly through the ReconciliationEngine.
 */
export function ensureSocketRegistered(ws: WebSocket, onSyncComplete: () => Promise<void>): void {
  if (registeredSockets.has(ws)) return;

  ws.addEventListener('message', async (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload && payload.id && payload.clock) {
        
        // Map to standard data plane entity safely
        const singleResource: ChatResource = {
          id: payload.id,
          title: payload.title || 'Untitled Chat',
          provider: payload.provider || 'unknown',
          currentModel: payload.currentModel || 'unknown',
          isArchived: !!payload.isArchived,
          messages: payload.messages || [],
          lastModified: new Date(payload.lastModified || Date.now()),
          lastMutationLamport: parseServerClockTuple(payload.clock, payload.id),
        };

        // Funnel cleanly into standard reconciliation pipeline
        const { resourcesApplied } = await reconciliationEngine.reconcileBoundary(
          [singleResource],
          []
        );

        await persistClockState();

        if (resourcesApplied > 0) {
          await onSyncComplete();
        }
      }
    } catch (err) {
      console.warn('[sync] Real-time data path filtering encountered parsing error:', err);
    }
  });

  registeredSockets.add(ws);
}

export async function persistClockState(): Promise<void> {
  try {
    const snapshot = CoherenceClock.getInstance().snapshot();
    const meta = await polyglotDb.getSyncMetadata();
    if (meta) {
      await polyglotDb.saveSyncMetadata({
        ...meta,
        localCounter: snapshot.localCounter,
        observedCounter: snapshot.observedCounter,
      });
    }
  } catch (err) {
    console.error('[sync] Clock transaction storage persistence failure:', err);
  }
}

/**
 * Fast-path outbound pipeline. Pushes local mutations and clocks to the server
 * immediately to ensure real-time propagation, without triggering an inbound pull
 * that could clobber hot local state.
 */
export async function flushOutboundMutations(): Promise<void> {
  await initializeSync();

  try {
    const outboundResources = await polyglotDb.listConversations(true);
    const outboundDeletions = await polyglotDb.listDeletions();
    const clockSnapshot = CoherenceClock.getInstance().snapshot();

    await fetch(`${SYNC_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: clockSnapshot.deviceId,
        clientClock: clockSnapshot,
        chats: outboundResources.map(r => ({
          id: r.id,
          title: r.title,
          provider: r.provider,
          currentModel: r.currentModel,
          isArchived: r.isArchived,
          messages: r.messages,
          lastModified: typeof r.lastModified?.toISOString === 'function' ? r.lastModified.toISOString() : new Date(r.lastModified).toISOString(),
          updatedAtLamport: r.lastMutationLamport ? [r.lastMutationLamport.lamport, r.lastMutationLamport.deviceId] : [0, clockSnapshot.deviceId]
        })),
        deletions: outboundDeletions.map(d => ({
          chatId: d.resourceId || d.id,
          lamport: d.deletedAtLamport ? [d.deletedAtLamport.lamport, d.deletedAtLamport.deviceId] : [0, clockSnapshot.deviceId]
        })),
      }),
    });
  } catch (err) {
    console.warn('[sync] Safe-path outbound flush delayed:', err);
  }
}