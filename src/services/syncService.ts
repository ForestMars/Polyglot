/**
 * @module SyncService
 * @description Core background synchronization service handler.
 * 
 * Manages outbound payload serialization, handles server-side delta exchanges, 
 * passes incoming payloads to the localized reconciliation engine, and handles post-sync 
 * housekeeping like updating metadata timestamps and persisting the Lamport logic clock state.
 */

import { mapToWire, mapFromWire } from '../utils/syncUtils';

/**
 * Dispatches a serialized local sync payload downstream to the server endpoints.
 * 
 * @param payload - The outbound wire-formatted resource and deletion structural records.
 * @returns The raw JSON payload mapping server side state updates back to the client.
 * @throws {Error} If the server responds with a non-200 HTTP status code.
 */
async function fetchSyncPayload(payload: ReturnType<typeof mapToWire>) {
  const response = await fetch(`${SYNC_URL}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Server sync failed: ${response.status}`);
  return response.json();
}

/**
 * Crosses a synchronization boundary by querying local tracking state, flushing 
 * outbound deltas, and processing returned server updates through the reconciliation engine.
 * 
 * @returns A promise resolving to a structured `SyncResult` summarizing the operation telemetry.
 */
export async function syncWithServer(): Promise<SyncResult> {
  try {
    await initializeSync();
    const localResources = await polyglotDb.getAllResources();
    const localDeletions = await polyglotDb.getAllDeletionRecords();

    const outboundPayload = mapToWire(localResources, localDeletions);
    const apiResponse = await fetchSyncPayload(outboundPayload);
    const incoming = mapFromWire(apiResponse.missing, apiResponse.deletions);

    const { resourcesApplied, deletionsApplied } = 
      await reconciliationEngine.reconcileBoundary(incoming.resources, incoming.deletions);

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