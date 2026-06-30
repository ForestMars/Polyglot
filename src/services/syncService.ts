// src/services/syncService.ts
import { mapToWire, mapFromWire } from '../utils/syncUtils';

async function fetchSyncPayload(payload: ReturnType<typeof mapToWire>) {
  const response = await fetch(`${SYNC_URL}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Server sync failed: ${response.status}`);
  return response.json();
}

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