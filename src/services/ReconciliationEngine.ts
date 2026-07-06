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
        if (compareLamport(remoteRes.lastMutationLamport, localDel.deletedAtLamport) > 0) {
          /** Remote resource causally participated after local deletion: restore. */
          await this.db.removeDeletionRecord(remoteRes.id);
          await this.db.saveResource(remoteRes);
          resourcesApplied++;
        }
        /** Remote does not dominate the deletion horizon: discard incoming payload. */
        continue;
      }

      if (!localRes || strictlyDominates(remoteRes.lastMutationLamport, localRes.lastMutationLamport) >0) {
        await this.db.saveResource(remoteRes);
        resourcesApplied++;
      }
    }

    /* / 3. Distributed Garbage Collection plane.
    const allLocalDeletions = await this.db.getAllDeletionRecords();
    for (const localDel of allLocalDeletions) {
      if (!serverResourceIds.has(localDel.id)) {
        await this.db.removeDeletionRecord(localDel.id);
      }
    }
    */

    return { resourcesApplied, deletionsApplied };
  }
}