/**
 * @module SyncTypes
 * @description Canonical synchronization and protocol type definitions. 
 * 
 * Contains no dependencies on React, DOM, or app-specific APIs. All sub-systems 
 * within the core replication protocol communicate exclusively via these unified structures.
 */

export interface ClockTuple {
  /** The monotonic Lamport sequence counter. */
  lamport: number;
  /** Unique tracking identifier of the creating or updating client node. */
  deviceId: string;
}

export interface Message {
  /** Unique structural identifier for the message block. */
  id: string;
  /** Functional classification defining message origin. */
  role: 'user' | 'assistant';
  /** The localized plain text string body content. */
  content: string;
  /** Temporal index designating local creation context. */
  timestamp: Date;
  /** Structural visibility shield bypass flag. */
  isPrivate?: boolean;
}

/**
 * The canonical replicated protocol resource object type.
 * 
 * Extends the application's underlying chat domains so that the engine core and 
 * the presentation interface interact over a shared type configuration rather than 
 * maintaining two detached, parallel domain mappings.
 */
export interface ChatResource {
  /** Unique object index matching system tracking boundaries. */
  id: string;
  /** Human readable conversation description text string. */
  title: string;
  /** Ordered historical message timeline payload elements. */
  messages: Message[];
  /** Temporal creation stamp context. */
  createdAt: Date;
  /** System mutation tracking index timestamp. */
  updatedAt: Date;
  /** Secondary local modifier lifecycle tracking state timestamp. */
  lastModified: Date;
  /** 
   * The load-bearing canonical Lamport ordering field tuple. Do not alias.
   * All outbound resource writes must explicitly register a value onto this field using 
   * `CoherenceClock.tick()`.
   */
  lastMutationLamport: ClockTuple;  // @QUESTION: Rename this field (back) to 'clock'? 
  /** Specific execution engine model targeted (uninterpreted by protocol core). */
  model?: string;
  /** Third-party backend structural platform service router (uninterpreted by protocol core). */
  provider?: string;
  /** Current active configuration state execution module text (uninterpreted by protocol core). */
  currentModel?: string;
  /** Soft visibility toggle filtering archival list views (uninterpreted by protocol core). */
  isArchived?: boolean;
}

/**
 * Control plane deletion tombstone. 
 * 
 * Maintained inside an isolated local store partition entirely structurally independent from 
 * standard `ChatResource` stores. Objects are immutable once written: the earliest registered deletion 
 * horizon firmly configures the causal boundary.
 */
export interface DeletionRecord {
  /** The underlying unique resource structural tracking index matching `polyglotDb` paths. */
  id: string;
  /** Causal chronological tracking horizon established by the initiating client. */
  deletedAtLamport: ClockTuple;
}

/**
 * System state metadata detailing tracking metrics across the persistence partition layers.
 */
export interface SyncMetadata {
  /** Static partition routing value identifying matching db metadata blocks. */
  key: 'sync_state';
  /** Generated unique UUID identifying the local runtime platform workspace instance. */
  deviceId: string;
  /** Highest sequence value observed or updated locally via clock events. */
  lamportCounter: number;
  /** ISO format server timestamp marking the completion profile of the last full sync pass. */
  lastSyncAt: string | null;
}

/**
 * Telemetry response metrics emitted by full network sync boundary operations.
 * 
 * Implies no DOM modifications or structural view logic updates; orchestrating callers 
 * assume responsibility for determining downstream behavior.
 */
export interface SyncResult {
  /** Designates whether the server delta pass completed successfully without crashes. */
  success: boolean;
  /** Metrics describing the volume of updated resource objects safely written locally. */
  syncedCount: number;
  /** Metrics describing the volume of localized records scrubbed under incoming deletion tombstones. */
  deletedCount: number;
  /** Evaluation metric indicating if the underlying local data cache was altered during sync processing. */
  changed: boolean;
  /** Descriptive failure overview context string populated upon crash events. */
  error?: string;
}

/**
 * Telemetry response metrics emitted by individual atomic conversation mutations.
 */
export interface ConversationSyncResult {
  /** Designates whether the write loop completed execution successfully without crashes. */
  success: boolean;
  /** Evaluation metric indicating if the target transaction was committed or discarded. */
  changed: boolean;
  /** Local context error text tracking data plane exceptions. */
  error?: string | null;
}