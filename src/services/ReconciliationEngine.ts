/**
 * @module ReconciliationEngine
 * @description Protocol core engine. Evaluates state correctness and enforces multi-plane invariants
 * at the causal boundary. 
 * 
 * NB. This engine has no knowledge of React, DOM, sidebars, or UI state. It is strictly a pure data-plane 
 * and control-plane ordering coordinator.
 */

import { ChatResource, DeletionRecord } from '../types/sync';
import { PolyglotDatabase } from './db';
import { strictlyDominates } from '../utils/ordering'; // don't use wrapper. 
import { compareLamport } from '../utils/ordering'; // call function directly. 
import { CoherenceClock } from './CoherenceClock';

export interface ReconciliationResult {
  resourcesApplied: number;
  deletionsApplied: number;
}

/**
 * Orchestrates the synchronization boundaries by evaluating local state versus 
 * incoming state using Lamport clock causal dominate comparisons.
 */
export class ReconciliationEngine {
  constructor(private db: PolyglotDatabase) {}

  /**
   * Reconciles incoming remote resources and deletions against the local database instance.
   * 
   * This evaluation runs multi-plane updates across discrete execution phases:
   * 1. **Control plane processing:** Incoming deletion records establish causal horizons. 
   * These must be evaluated before data plane mutations so the horizon is in place when each 
   * resource is tested.
   * 2. **Data plane processing:** Process incoming resource mutations. Invariant 5 is 
   * enforced here: a local deletion record discards the incoming update
   * unconditionally. Per-device finality means this device's deletion decision
   * is not reopened by any subsequently received update, regardless of clock
   * value (other devices remain free to independently retain or restore the
   * resource in their own state.)
   * 
   * @param incomingResources - Collection of data plane mutations arriving from the network.
   * @param incomingDeletions - Collection of control plane deletion markers establishing horizons.
   * @returns A promise resolving to the structural results describing metrics applied.
   */
  async reconcileBoundary(
    incomingResources: ChatResource[],
    incomingDeletions: DeletionRecord[],
    serverResourceIds: Set<string> = new Set()
  ): Promise<ReconciliationResult> {
    const clock = CoherenceClock.getInstance();
    let resourcesApplied = 0;
    let deletionsApplied = 0;

    // Phase 1: Control plane first.
    for (const remoteDel of incomingDeletions) {
      clock.observe(remoteDel.deletedAtLamport);

      const localRes = await this.db.getResource(remoteDel.id);
      const localDel = await this.db.getDeletionRecord(remoteDel.id);
      
      if (localDel) {
      /* Both sides deleted the same resource. `saveDeletionRecord` retains
       * the earlier horizon; this is not a conflict, it's convergence.
       * Replace only if the incoming deletion is earlier!
       */
        if (compareLamport(localDel.deletedAtLamport, remoteDel.deletedAtLamport) > 0) {
          await this.db.saveDeletionRecord(remoteDel);
        }
        continue;
    }

      if (localRes) {
        /**
         * Local resource exists. Accept the remote deletion only if the local
         * resource did not causally participate after the deletion (Definition 7).
         */
        if (compareLamport(localRes.lastMutationLamport, remoteDel.deletedAtLamport) > 0) {
          /** Local mutation post-dates deletion: local wins, deletion discarded. */
          continue;
        }
        /** No causal participation after deletion: accept. */
        await this.db.saveDeletionRecord(remoteDel);
        await this.db.deleteResource(remoteDel.id, remoteDel);
        deletionsApplied++;
      } else {
        /**
         * Topologically unknown resource. Record the deletion so any future
         * data plane broadcast for this id is correctly handled (Invariant 5,
         * retention requirement makes null unambiguous).
         */
        await this.db.saveDeletionRecord(remoteDel);
        deletionsApplied++;
      }
    }

    // Phase 2: Data plane.
    for (const remoteRes of incomingResources) {
      clock.observe(remoteRes.lastMutationLamport);

      const localDel = await this.db.getDeletionRecord(remoteRes.id);
      const localRes = await this.db.getResource(remoteRes.id);

      if (localDel) {
        /**
         * Invariant 5 (per-device finality): once this device has recorded
         * a deletion for this resource, that decision is terminal and is
         * not reopened by any subsequently received data-plane update,
         * regardless of clock value. Other devices remain free to
         * independently retain or restore the resource in their own state.
         */
        continue;
      }

      if (!localRes || strictlyDominates(remoteRes.lastMutationLamport, localRes.lastMutationLamport) >0) {
        await this.db.saveResource(remoteRes);
        resourcesApplied++;
      }
    }

    // Phase 3: Distributed Garbage Collection plane.
    /** 
     * Phase 3 should only execute its garbage collection sweep if it receives an actual, 
     * populated tracking set from the server signifying an active GC sync window.
     */
    if (serverResourceIds.size > 0) {
      const allDeletions = await this.db.getAllDeletionRecords();
      const serverResourceIds = new Set(incomingResources.map(r => r.id));

      for (const localDel of allDeletions) {
        if (!serverResourceIds.has(record.id) && !serverIds.has(record.id)) {
          await this.db.removeDeletionRecord(record.id);
        }
      }
    }

    return { resourcesApplied, deletionsApplied };
  }
}