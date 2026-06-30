// src/services/conversationSync.ts
import { ChatResource, ConversationSyncResult, DeletionRecord } from '../types/sync';
import { CoherenceClock } from './CoherenceClock';
import { polyglotDb } from './db';

/**
 * Protocol Coordinator implementation for processing updates to conversation entities.
 * Stamps the resource with a fresh monotonically increasing Lamport clock tick
 * before persistence to guarantee local modifications dominate historical states.
 */
export async function saveConversation(resource: ChatResource): Promise<ConversationSyncResult> {
  try {
    // 1. Advance the clock and stamp the resource data plane mutation
    const tau = CoherenceClock.getInstance().tick();
    const stampedResource: ChatResource = {
      ...resource,
      lastMutationLamport: tau,
      lastModified: new Date()
    };

    // 2. Write the stamped state down to underlying database engine
    await polyglotDb.saveResource(stampedResource);
    
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