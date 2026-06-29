// src/types/sync.ts
// Canonical protocol types. No imports from React, DOM, or platform APIs.
// Everything in the protocol core speaks these types.

export interface ClockTuple {
  lamport: number;
  deviceId: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isPrivate?: boolean;
}

// The canonical resource type. Extends the app's chat fields so the protocol
// core and the presentation layer share a single type rather than mapping
// between two parallel hierarchies.
//
// clock: the load-bearing Lamport field. Named consistently with db.ts.
//   Replaces the former lastMutationLamport (object form, was unused by db.ts)
//   and updatedAtLamport (array form cast as any in backgroundSync.ts).
//   All writes must stamp this field via CoherenceClock.tick().
export interface ChatResource {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  lastModified: Date;
  clock: ClockTuple;         // canonical Lamport field — do not alias
  // App-specific metadata — protocol core carries but does not interpret these.
  model?: string;
  provider?: string;
  currentModel?: string;
  isArchived?: boolean;
}

// Lives in its own store. Structurally separate from ChatResource.
// Immutable once written: the earliest deletion establishes the binding
// causal horizon. The id field is the keyPath for the deletions store in db.ts.
export interface DeletionRecord {
  id: string;                   // keyPath — aligns with db.ts deletions store
  deletedAtLamport: ClockTuple;
}

export interface SyncMetadata {
  key: 'sync_state';            // keyPath for the metadata store in db.ts
  deviceId: string;
  lamportCounter: number;
  lastSyncAt: string | null;
}

// Returned by all sync operations. No DOM side effects — callers decide what to do.
export interface SyncResult {
  success: boolean;
  syncedCount: number;
  deletedCount: number;
  changed: boolean;
  error?: string;
}

export interface ConversationSyncResult {
  success: boolean;
  changed: boolean;
  error?: string | null;
}