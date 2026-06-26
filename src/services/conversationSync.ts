// src/services/conversationSync.ts
//
// Coordinator: single call site for any operation that touches both local
// storage and the sync layer. Replaces the direct fetch calls that were
// previously embedded in indexedDbStorage.saveConversation and
// indexedDbStorage.deleteConversation.
//
// Usage (replaces old storage.saveConversation / storage.deleteConversation):
//
//   import { saveConversation, deleteConversation } from './conversationSync';
//   await saveConversation(chat);
//   await deleteConversation(id);

// src/services/conversationSync.ts
import { ChatResource, ConversationSyncResult } from '../types/sync';
import { CoherenceClock } from './CoherenceClock';
import { polyglotDb } from './db';

/**
 * Protocol Coordinator implementation for processing updates to conversation entities.
 * Guarantees a fully formed ConversationSyncResult to prevent upstream contract violations.
 */
export async function saveConversation(resource: ChatResource): Promise<ConversationSyncResult> {
  try {
    // Write state down to underlying engine without shortcut truncations
    await polyglotDb.saveResource(resource);
    
    return {
      success: true,
      changed: true,
      error: null
    };
  } catch (error) {
    console.error("[SyncCoordinator] Global save processing encountered exception:", error);
    return {
      success: false,
      changed: false,
      error: error instanceof Error ? error.message : "Persistence layer write mutation rejected"
    };
  }
}

/**
 * Removes an isolated target conversation from active client local storage allocations.
 */
export async function deleteConversation(conversationId: string): Promise<ConversationSyncResult> {
  try {
    const tau = CoherenceClock.getInstance().tick();
    const record: DeletionRecord = {
      resourceId: conversationId,
      deletedAtLamport: tau,
    };
    await polyglotDb.deleteResource(conversationId, record);
    
    return {
      success: true,
      changed: true,
      error: null
    };
  } catch (error) {
    console.error("[SyncCoordinator] Global deletion processing encountered exception:", error);
    return {
      success: false,
      changed: false,
      error: error instanceof Error ? error.message : "Persistence layer delete mutation rejected"
    };
  }
}