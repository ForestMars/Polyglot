// src/services/ReconciliationEngine.ts
// Protocol core. Evaluates state correctness and enforces multi-plane invariants
// at the causal boundary. No knowledge of React, DOM, sidebars, or UI state.

import { ChatResource, DeletionRecord } from '../types/sync';
import { PolyglotDatabase } from './db';
import { strictlyDominates } from '../utils/ordering';
import { CoherenceClock } from './CoherenceClock';

export interface ReconciliationResult {
  resourcesApplied: number;
  deletionsApplied: number;
}

export class ReconciliationEngine {
  constructor(private db: PolyglotDatabase) {}

  async reconcileBoundary(
    incomingResources: ChatResource[],
    incomingDeletions: DeletionRecord[]
  ): Promise<ReconciliationResult> {
    const clock = CoherenceClock.getInstance();
    let resourcesApplied = 0;
    let deletionsApplied = 0;

    // 1. Control plane first.
    // Incoming deletion records establish causal horizons. These must be
    // evaluated before data plane mutations so the horizon is in place
    // when each resource is tested.
    for (const remoteDel of incomingDeletions) {
      clock.observe(remoteDel.deletedAtLamport);

      const localRes = await this.db.getResource(remoteDel.resourceId);
      const localDel = await this.db.getDeletionRecord(remoteDel.resourceId);

      if (localDel) {
        // Both sides deleted the same resource. saveDeletionRecord retains
        // the earlier horizon — this is not a conflict, it's convergence.
        await this.db.saveDeletionRecord(remoteDel);
        continue;
      }

      if (localRes) {
        // Local resource exists. Accept the remote deletion only if the local
        // resource did not causally participate after the deletion (Definition 7).
        if (strictlyDominates(localRes.lastMutationLamport, remoteDel.deletedAtLamport)) {
          // Local mutation post-dates deletion: local wins, deletion discarded.
          continue;
        }
        // No causal participation after deletion: accept.
        await this.db.saveDeletionRecord(remoteDel);
        await this.db.deleteResource(remoteDel.resourceId);
        deletionsApplied++;
      } else {
        // Topologically unknown resource. Record the deletion so any future
        // data plane broadcast for this id is correctly handled (Invariant 5,
        // retention requirement makes null unambiguous).
        await this.db.saveDeletionRecord(remoteDel);
        deletionsApplied++;
      }
    }

    // 2. Data plane.
    // Process incoming resource mutations. Invariant 5 is enforced here:
    // a local deletion record discards the incoming update unless the update
    // strictly dominates the deletion horizon.
    for (const remoteRes of incomingResources) {
      clock.observe(remoteRes.lastMutationLamport);

      const localDel = await this.db.getDeletionRecord(remoteRes.id);
      const localRes = await this.db.getResource(remoteRes.id);

      if (localDel) {
        if (strictlyDominates(remoteRes.lastMutationLamport, localDel.deletedAtLamport)) {
          // Remote resource causally participated after local deletion: restore.
          await this.db.removeDeletionRecord(remoteRes.id);
          await this.db.saveResource(remoteRes);
          resourcesApplied++;
        }
        // else: discard. Remote does not dominate the deletion horizon.
        continue;
      }

      if (!localRes || strictlyDominates(remoteRes.lastMutationLamport, localRes.lastMutationLamport)) {
        await this.db.saveResource(remoteRes);
        resourcesApplied++;
      }
    }

    return { resourcesApplied, deletionsApplied };
  }
}