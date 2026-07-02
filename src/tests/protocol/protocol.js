/**
 * protocol.js
 * * Reference implementation of the Eventual Coherence protocol engine
 * configured specifically for deterministic evaluation environments.
 * Removes environment runtime abstractions (DOM, IndexedDB) to expose
 * pure causal consistency state transitions.
 */

/**
 * Computes a total order over Lamport clock coordinates.
 * Evaluates sequence components first, using alphanumeric device 
 * identifiers as an absolute tie-breaker.
 * * @param {Object} a - Left clock tuple { lamport, deviceId }
 * @param {Object} b - Right clock tuple { lamport, deviceId }
 * @returns {number} Negative if a < b, positive if a > b, 0 if identical
 */
function compareLamport(a, b) {
  if (a.lamport !== b.lamport) return a.lamport - b.lamport;
  if (a.deviceId < b.deviceId) return -1;
  if (a.deviceId > b.deviceId) return 1;
  return 0;
}

/**
 * Asserts causal dominance under Definition 7 (Causal Participation).
 * Validates whether a candidate operational event strictly succeeds a 
 * baseline structural horizon according to the total ordering rule.
 */
function causallyParticipates(candidateClock, baselineClock) {
  return compareLamport(candidateClock, baselineClock) > 0;
}

/**
 * Monotonic Lamport Sequence Counter.
 * Guarantees local event ordering and causal tracking across distributed boundaries.
 */
class CoherenceClock {
  constructor(deviceId, initialCounter = 0) {
    this.deviceId = deviceId;
    this.counter = initialCounter;
  }

  /**
   * Monotonically advances the counter chain to seal a new localized mutation.
   */
  tick() {
    this.counter += 1;
    return { lamport: this.counter, deviceId: this.deviceId };
  }

  /**
   * Evaluates external sequence terms to advance the localized tracking horizon
   * past known remote events (Definition 2 Receive Rule).
   */
  observe(remote) {
    if (remote.lamport > this.counter) {
      this.counter = remote.lamport;
    }
  }

  currentLocal() {
    return { lamport: this.counter, deviceId: this.deviceId };
  }

  getCounter() { return this.counter; }
  getDeviceId() { return this.deviceId; }
}

/**
 * Logical Node Client Framework.
 * Direct implementation of Section 3 Client State Machines and Data Sync Boundaries.
 */
class Device {
  constructor(deviceId, server) {
    this.deviceId = deviceId;
    this.server = server;
    this.clock = new CoherenceClock(deviceId);
    this.chats = new Map();
    this.deletionRecords = new Map();
    this.log = [];
  }

  _logEvent(msg) {
    this.log.push(`[${this.deviceId}] ${msg}`);
  }

  /**
   * Section 3.1: Executes local creation mutations.
   * Immediately updates structural topologies and pushes states to the core plane.
   */
  createConversation(id, title = 'New Conversation') {
    const clock = this.clock.tick();
    const resource = { id, title, messages: [], clock, isDeleted: false };
    this.chats.set(id, resource);
    this._logEvent(`CREATE(${id}) @ L=${clock.lamport}`);
    this.server.receiveCreate(resource, this);
    return resource;
  }

  /**
   * Section 3.3: Instantiates control-plane tombstones.
   * Generates a structural deletion record tracking the exact causal point of destruction.
   */
  deleteConversation(id) {
    const conv = this.chats.get(id);
    if (!conv) return null;
    const clock = this.clock.tick();
    conv.isDeleted = true;
    conv.deletedAtLamport = clock;
    conv.clock = clock;
    this.chats.set(id, conv);
    const record = { id, deletedAtLamport: clock };
    this.deletionRecords.set(id, record);
    this._logEvent(`DELETE(${id}) @ L=${clock.lamport}`);
    this.server.receiveDelete(record, this);
    return conv;
  }

  /**
   * Section 3.2: Handles structural messaging additions.
   * Enforces Invariant 5 (Local Deletion Finality) locally to protect 
   * finalized tombstones from regression via down-funnel updates.
   */
  addMessage(conversationId, content) {
    const conv = this.chats.get(conversationId);
    if (!conv || conv.isDeleted) {
      this._logEvent(`UPDATE(${conversationId}) DISCARDED — local deletion finality`);
      return false;
    }
    const clock = this.clock.tick();
    conv.messages.push({ id: `msg-${clock.lamport}`, content, clock });
    conv.clock = clock;
    this.chats.set(conversationId, conv);
    this._logEvent(`UPDATE(${conversationId}) @ L=${clock.lamport}`);
    this.server.receiveUpdate(conv, this);
    return true;
  }

  /**
   * Real-Time Broadcast Receiver (Appendix I.2).
   * Processes active changes propagating over the hot WebSocket data plane.
   */
  receiveBroadcast(resource) {
    // Definition 2 Receive Rule: Advance the local tracking ceiling unconditionally
    this.clock.observe(resource.clock);

    const local = this.chats.get(resource.id);
    const localDel = this.deletionRecords.get(resource.id);

    // Invariant 6: Data Plane Non-Origination Check
    if (!local && !localDel) {
      this._logEvent(
        `BROADCAST(${resource.id}) @ L=${resource.clock.lamport} — ` +
        `no topological record, signaling boundary available`
      );
      return 'BOUNDARY_AVAILABLE';
    }

    // Invariant 5: Local Deletion Finality Override
    if (local && local.isDeleted) {
      this._logEvent(
        `BROADCAST(${resource.id}) — discarded, local deletion finality`
      );
      return 'DISCARDED';
    }

    // Standard LWW Concurrency Evaluation Path
    if (local && compareLamport(resource.clock, local.clock) > 0) {
      this.chats.set(resource.id, { ...resource });
      this._logEvent(
        `BROADCAST(${resource.id}) applied @ L=${resource.clock.lamport}`
      );
      return 'APPLIED';
    }

    this._logEvent(
      `BROADCAST(${resource.id}) — stale, not applied`
    );
    return 'STALE';
  }

  /**
   * Section 3.4 / Appendix I.4: Structural Reconciliation Engine.
   * Synchronizes total system state at boundary connection windows.
   */
  crossSynchronizationBoundary() {
    this._logEvent(`--- SYNC BOUNDARY ---`);

    // Boundary Phase 1: Harmonize clock frames with core metrics
    this.clock.observe({ lamport: this.server.getLamport(), deviceId: '__server__' });

    // Boundary Phase 2: Pull total environment profiles
    const serverResources = this.server.getAllResources();
    const serverDeletions = this.server.getAllDeletionRecords();

    let resourcesApplied = 0;
    let deletionsAccepted = 0;

    // Boundary Phase 3: Run multi-case causal alignment matrix
    for (const serverRes of serverResources) {
      const local = this.chats.get(serverRes.id);
      const localDel = this.deletionRecords.get(serverRes.id);
      const serverDel = serverDeletions.get(serverRes.id);

      // Case 1: Unconditional Local Deletion Re-Assertion
      if (local && local.isDeleted) {
        this._logEvent(
          `RECONCILE Case 1: ${serverRes.id} locally deleted, re-asserting`
        );
        this.server.receiveDelete({ id: serverRes.id, deletedAtLamport: local.deletedAtLamport }, this);
        continue;
      }

      // Case 2: Control Plane Deletion Presence — Causal Participation Check
      if (serverDel) {
        this.clock.observe(serverDel.deletedAtLamport);
        const participated = local && causallyParticipates(local.clock, serverDel.deletedAtLamport);
        
        if (!participated) {
          // Local changes lack causal inheritance; process full eviction
          this._logEvent(
            `RECONCILE Case 2: ${serverRes.id} — no participation ` +
            `(local L=${local ? local.clock.lamport : 'null'}, ` +
            `del L=${serverDel.deletedAtLamport.lamport}), defaulting to deleted`
          );
          this.chats.delete(serverRes.id);
          this.deletionRecords.set(serverRes.id, serverDel);
          deletionsAccepted++;
        } else {
          // Local changes strictly outdate destruction horizon; re-verify existence
          this._logEvent(
            `RECONCILE Case 2: ${serverRes.id} — participation confirmed ` +
            `(local L=${local.clock.lamport} > del L=${serverDel.deletedAtLamport.lamport}), retaining`
          );
          this.server.receiveUpdate(local, this);
          resourcesApplied++;
        }
        continue;
      }

      // Case 3: Standard Last-Write-Wins Structural Integration
      if (!local || compareLamport(serverRes.clock, local.clock) > 0) {
        this._logEvent(
          `RECONCILE Case 3: ${serverRes.id} — LWW merge ` +
          `(server L=${serverRes.clock.lamport})`
        );
        this.chats.set(serverRes.id, { ...serverRes });
        resourcesApplied++;
      }
    }

    // Boundary Phase 4: Reconcile un-shared localized tracking spaces
    for (const [id, res] of this.chats) {
      if (!res.isDeleted && !serverResources.find(r => r.id === id)) {
        this._logEvent(`RECONCILE Step 4: pushing local-only ${id}`);
        this.server.receiveCreate(res, this);
      }
    }

    this._logEvent(
      `SYNC BOUNDARY COMPLETE: ${resourcesApplied} applied, ${deletionsAccepted} deletions accepted`
    );
    return { resourcesApplied, deletionsAccepted };
  }

  hasResource(id) {
    const r = this.chats.get(id);
    return r && !r.isDeleted;
  }

  isDeleted(id) {
    const r = this.chats.get(id);
    return (r && r.isDeleted) || this.deletionRecords.has(id);
  }

  getResource(id) { return this.chats.get(id); }
  getMessages(id) { return this.chats.get(id)?.messages ?? []; }
}

/**
 * Central Coordination Layer.
 * Emulates the centralized data store and out-of-band message propagation.
 */
class Server {
  constructor() {
    this.resources = new Map();
    this.deletionRecords = new Map();
    this.lamport = 0;
    this.connectedDevices = new Set();
    this.log = [];
  }

  connect(device) { this.connectedDevices.add(device); }

  _advanceLamport(incoming) {
    this.lamport = Math.max(this.lamport, incoming) + 1;
  }

  _log(msg) { this.log.push(`[SERVER] ${msg}`); }

  getLamport() { return this.lamport; }
  getAllResources() { return Array.from(this.resources.values()); }
  getAllDeletionRecords() { return this.deletionRecords; }

  receiveCreate(resource, sender) {
    this._advanceLamport(resource.clock.lamport);
    if (!this.resources.has(resource.id)) {
      this.resources.set(resource.id, { ...resource });
      this._log(`CREATE(${resource.id}) accepted @ L=${this.lamport}`);
    }
  }

  /**
   * Section 3.2: Processes upsert logic over live elements.
   * Restores deleted targets while strictly preserving historical tombstone markers
   * to uphold Invariant 7 (deletedAtLamport preservation).
   */
  receiveUpdate(resource, sender) {
    this._advanceLamport(resource.clock.lamport);
    const existing = this.resources.get(resource.id);

    if (!existing) {
      this.resources.set(resource.id, { ...resource });
      this._broadcastExcept(resource, sender);
      this._log(`UPDATE(${resource.id}) — new resource, stored @ L=${this.lamport}`);
      return;
    }

    // Handles active object data planes restoration
    const wasDeleted = existing.isDeleted;
    if (wasDeleted) {
      const preserved = existing.deletedAtLamport;
      existing.isDeleted = false;
      existing.deletedAtLamport = preserved; // Retain origin deletion signature
      this._log(
        `UPDATE(${resource.id}) UPSERT — restored, deletedAtLamport=${JSON.stringify(preserved)} preserved`
      );
    }

    if (compareLamport(resource.clock, existing.clock) > 0) {
      existing.messages = resource.messages;
      existing.clock = resource.clock;
      this.resources.set(resource.id, existing);
      this._broadcastExcept(existing, sender);
      this._log(`UPDATE(${resource.id}) applied @ L=${resource.clock.lamport}`);
    }
  }

  /**
   * Section 3.3: Commits control plane deletions.
   * Retains the earliest chronological deletion horizon if multiple operations conflict.
   * Explicitly avoids real-time data plane broadcasting per specification criteria.
   */
  receiveDelete(record, sender) {
    this._advanceLamport(record.deletedAtLamport.lamport);
    const existing = this.resources.get(record.id);
    if (!existing) return;

    const currentDel = this.deletionRecords.get(record.id);
    if (!currentDel || compareLamport(record.deletedAtLamport, currentDel.deletedAtLamport) < 0) {
      this.deletionRecords.set(record.id, { ...record });
    }

    existing.isDeleted = true;
    existing.deletedAtLamport = record.deletedAtLamport;
    this.resources.set(record.id, existing);
    this._log(
      `DELETE(${record.id}) recorded @ L=${record.deletedAtLamport.lamport} — not broadcast`
    );
  }

  _broadcastExcept(resource, sender) {
    for (const device of this.connectedDevices) {
      if (device !== sender) {
        device.receiveBroadcast(resource);
      }
    }
  }
}

module.exports = { Device, Server, CoherenceClock, compareLamport, causallyParticipates };