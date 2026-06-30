// src/tests/ReconciliationEngine.gc.test.ts
//
// Tests for the distributed GC pass in ReconciliationEngine.reconcileBoundary.
// PolyglotDatabase is mocked so these tests run without IndexedDB.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReconciliationEngine } from '../services/ReconciliationEngine';
import { ChatResource, DeletionRecord, ClockTuple } from '../types/sync';
import { CoherenceClock } from '../services/CoherenceClock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clock(lamport: number, deviceId = 'device_a'): ClockTuple {
  return { lamport, deviceId };
}

function makeResource(id: string, lamport: number): ChatResource {
  return {
    id,
    title: `Chat ${id}`,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastModified: new Date(),
    clock: clock(lamport),
  };
}

function makeDeletionRecord(id: string, lamport: number): DeletionRecord {
  return { id, deletedAtLamport: clock(lamport) };
}

// ---------------------------------------------------------------------------
// Mock PolyglotDatabase
// ---------------------------------------------------------------------------

function makeMockDb(initialDeletions: DeletionRecord[] = [], initialResources: ChatResource[] = []) {
  const deletions = new Map(initialDeletions.map(d => [d.id, d]));
  const resources = new Map(initialResources.map(r => [r.id, r]));

  return {
    getResource: vi.fn(async (id: string) => resources.get(id) ?? null),
    getDeletionRecord: vi.fn(async (id: string) => deletions.get(id) ?? null),
    getAllDeletionRecords: vi.fn(async () => Array.from(deletions.values())),
    saveDeletionRecord: vi.fn(async (r: DeletionRecord) => { deletions.set(r.id, r); }),
    removeDeletionRecord: vi.fn(async (id: string) => { deletions.delete(id); }),
    saveResource: vi.fn(async (r: ChatResource) => { resources.set(r.id, r); }),
    deleteResource: vi.fn(async (id: string, record: DeletionRecord) => {
      resources.delete(id);
      deletions.set(id, record);
    }),
    // Expose internal state for assertions
    _deletions: deletions,
    _resources: resources,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  // Reset the CoherenceClock singleton between tests
  (CoherenceClock as any).instance = null;
  await CoherenceClock.initialize('device_a', 0);
});

// ---------------------------------------------------------------------------
// GC tests
// ---------------------------------------------------------------------------

describe('ReconciliationEngine — distributed GC', () => {

  it('purges a local deletion record when the server has no record of that resource', async () => {
    const deletedId = 'chat_deleted';
    const db = makeMockDb([makeDeletionRecord(deletedId, 5)]);
    const engine = new ReconciliationEngine(db as any);

    // Server returns an empty allIds set — it has no record of deletedId
    await engine.reconcileBoundary([], [], new Set());

    expect(db.removeDeletionRecord).toHaveBeenCalledWith(deletedId);
    expect(db._deletions.has(deletedId)).toBe(false);
  });

  it('retains a local deletion record when the server still has the resource', async () => {
    const deletedId = 'chat_still_on_server';
    const db = makeMockDb([makeDeletionRecord(deletedId, 5)]);
    const engine = new ReconciliationEngine(db as any);

    // Server still has this resource ID
    await engine.reconcileBoundary([], [], new Set([deletedId]));

    expect(db.removeDeletionRecord).not.toHaveBeenCalled();
    expect(db._deletions.has(deletedId)).toBe(true);
  });

  it('purges only the records absent from the server, leaving others intact', async () => {
    const purgeId = 'chat_gone';
    const keepId = 'chat_still_live';
    const db = makeMockDb([
      makeDeletionRecord(purgeId, 3),
      makeDeletionRecord(keepId, 4),
    ]);
    const engine = new ReconciliationEngine(db as any);

    await engine.reconcileBoundary([], [], new Set([keepId]));

    expect(db.removeDeletionRecord).toHaveBeenCalledWith(purgeId);
    expect(db.removeDeletionRecord).not.toHaveBeenCalledWith(keepId);
    expect(db._deletions.has(purgeId)).toBe(false);
    expect(db._deletions.has(keepId)).toBe(true);
  });

  it('purges nothing when all local deletion records are still present on the server', async () => {
    const db = makeMockDb([
      makeDeletionRecord('chat_a', 1),
      makeDeletionRecord('chat_b', 2),
    ]);
    const engine = new ReconciliationEngine(db as any);

    await engine.reconcileBoundary([], [], new Set(['chat_a', 'chat_b']));

    expect(db.removeDeletionRecord).not.toHaveBeenCalled();
  });

  it('purges all local deletion records when server returns empty allIds', async () => {
    const db = makeMockDb([
      makeDeletionRecord('chat_x', 10),
      makeDeletionRecord('chat_y', 11),
      makeDeletionRecord('chat_z', 12),
    ]);
    const engine = new ReconciliationEngine(db as any);

    await engine.reconcileBoundary([], [], new Set());

    expect(db.removeDeletionRecord).toHaveBeenCalledTimes(3);
    expect(db._deletions.size).toBe(0);
  });

  it('does not purge a deletion record that was just written by the control plane pass', async () => {
    // A remote deletion arrives for a resource the client has never seen.
    // The control plane pass writes a local deletion record for it.
    // The GC pass should not then immediately purge that record if the
    // server still has the resource in allIds.
    const id = 'chat_remote_deleted';
    const db = makeMockDb([], []);
    const engine = new ReconciliationEngine(db as any);

    const remoteDeletion = makeDeletionRecord(id, 7);

    // Server has the resource in allIds (not yet GC'd server-side)
    await engine.reconcileBoundary([], [remoteDeletion], new Set([id]));

    // Deletion record should have been written by the control plane pass
    expect(db.saveDeletionRecord).toHaveBeenCalledWith(remoteDeletion);
    // And NOT purged by the GC pass
    expect(db.removeDeletionRecord).not.toHaveBeenCalled();
    expect(db._deletions.has(id)).toBe(true);
  });

  it('GC runs after control and data plane passes complete', async () => {
    // Verify ordering: a resource incoming in the data plane pass whose
    // deletion record gets removed by restore should not then be re-purged
    // by GC. The restored resource's id will be in allIds so GC leaves it.
    const id = 'chat_restored';
    const localDel = makeDeletionRecord(id, 3);
    const db = makeMockDb([localDel], []);
    const engine = new ReconciliationEngine(db as any);

    const remoteResource = makeResource(id, 10); // dominates deletion at 3

    // Server still has this resource
    await engine.reconcileBoundary([remoteResource], [], new Set([id]));

    // Deletion record removed by data plane restore, not by GC
    expect(db.removeDeletionRecord).toHaveBeenCalledWith(id);
    expect(db.saveResource).toHaveBeenCalledWith(remoteResource);
    // Called exactly once (from restore path), not a second time from GC
    expect(db.removeDeletionRecord).toHaveBeenCalledTimes(1);
  });
});
