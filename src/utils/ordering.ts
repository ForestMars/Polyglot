// src/utils/ordering.ts
// Lamport clock ordering. Pure functions. No imports beyond protocol types.

import { ClockTuple } from '../types/sync';

// Total order on ClockTuples: lexicographic on (lamport, deviceId).
export function compareLamport(a: ClockTuple, b: ClockTuple): number {
  if (a.lamport > b.lamport) return 1;
  if (a.lamport < b.lamport) return -1;  // fix: alternate had b.b (typo)
  if (a.deviceId > b.deviceId) return 1;
  if (a.deviceId < b.deviceId) return -1;
  return 0;
}

// τ_a ≻ τ_b
export function strictlyDominates(a: ClockTuple, b: ClockTuple): boolean {
  return compareLamport(a, b) === 1;
}

// Returns the earlier of two ClockTuples.
// Used by saveDeletionRecord to retain the binding causal horizon
// when concurrent deletions arrive.
export function earlier(a: ClockTuple, b: ClockTuple): ClockTuple {
  return compareLamport(a, b) <= 0 ? a : b;
}
