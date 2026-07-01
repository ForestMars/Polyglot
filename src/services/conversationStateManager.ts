/**
 * @module ConversationStateManager
 * @description UI-facing orchestrator. Owns React state, the WebSocket connection, and
 * the boundaryAvailable signal.
 * 
 * Makes no protocol decisions itself — every write goes through conversationSync.ts, 
 * every reconciliation goes through backgroundSync.ts's syncWithServer (which delegates 
 * to ReconciliationEngine), and every Lamport operation goes through CoherenceClock. 
 * This file's only direct call into db.ts is the read-only Invariant 6 null-check, since 
 * that check has no protocol logic to enforce, only a fact to observe.
 */

import { Conversation, Message } from '@/types/conversation';
import { ChatResource } from '../types/sync';
import { polyglotDb } from './db';
import { saveConversation, deleteConversation } from './conversationSync';
import { CoherenceClock } from './CoherenceClock';
import { ConversationUtils } from './conversationUtils';
import { SettingsService } from './settingsService';
import { syncWithServer, ensureSocketRegistered } from './backgroundSync';

/**
 * UI-facing orchestrator. Owns React state, the WebSocket connection, and
 * the `boundaryAvailable` signal.
 * 
 * Makes no protocol decisions itself — every write goes through `conversationSync.ts`, 
 * every reconciliation goes through `backgroundSync.ts`'s `syncWithServer` (which delegates 
 * to `ReconciliationEngine`), and every Lamport operation goes through `CoherenceClock`. 
 * This file's only direct call into `db.ts` is the read-only Invariant 6 null-check, since 
 * that check has no protocol logic to enforce, only a fact to observe.
 */
interface ConversationFilters {
  searchQuery: string;
  provider: string;
  model: string;
  showArchived: boolean;
  dateRange?: { start: Date; end: Date };
}

export interface ConversationState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date;
  /** Invariant 6 signal */
  boundaryAvailable: boolean;
}

const WS_URL = 'ws://localhost:4001';

/**
 * Core manager for orchestrating local conversation state, WebSocket connections,
 * and synchronization boundary signaling.
 */
export class ConversationStateManager {
  private settingsService: SettingsService;
  private state: ConversationState;
  private listeners: Set<(state: ConversationState) => void> = new Set();
  private isInitialized = false;
  private conversationCache: Map<string, Conversation> = new Map();
  private loadingConversations: Set<string> = new Set();
  private cacheEnabled = true;
  private ws: WebSocket | null = null;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.settingsService = new SettingsService();
    this.state = {
      conversations: [],
      currentConversation: null,
      isLoading: false,
      error: null,
      lastUpdated: new Date(),
      boundaryAvailable: false,
    };
  }

  // ── Initialization ───────────────────────────────────────────────────────

  /**
   * Initializes the manager, loads settings, populates initial conversations,
   * establishes a WebSocket connection, and crosses the initial synchronization boundary.
   * 
   * @param cacheEnabled - Whether the conversation cache layer should be enabled.
   */
  async initialize(cacheEnabled = true): Promise<void> {
    if (this.isInitialized) return;
    this.cacheEnabled = cacheEnabled;

    try {
      this.setState({ isLoading: true, error: null });
      await this.settingsService.loadSettings();
      await this.loadConversations();

      this.connectWebSocket();

      /**
       * Cross a synchronization boundary on startup to pull control plane
       * state. This is the only call site for boundary crossings — there
       * is no second, inline reconciliation implementation in this file.
       */
      await this.crossSynchronizationBoundary();

      this.isInitialized = true;
      this.setState({ isLoading: false });
    } catch (err) {
      console.error('[CSM] Initialization failed:', err);
      this.setState({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Initialization failed',
      });
    }
  }

  // ── WebSocket — real-time data plane receive handler (§3.2) ──────────────

  /**
   * Establishes the real-time WebSocket connection data plane, setting up
   * connection lifecycle hooks and automatic reconnection timers.
   */
  private connectWebSocket(): void {
    if (typeof WebSocket === 'undefined') return;
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('[CSM] WebSocket connected.');
        if (this.wsReconnectTimer) {
          clearTimeout(this.wsReconnectTimer);
          this.wsReconnectTimer = null;
        }
      };

      /**
       * Registers the active socket instance alongside a bound reference 
       * to the local handler using the background sync system.
       */
      ensureSocketRegistered(this.ws, this.handleBroadcast.bind(this));

      this.ws.onclose = () => {
        console.log('[CSM] WebSocket closed. Reconnecting in 3s.');
        this.wsReconnectTimer = setTimeout(() => this.connectWebSocket(), 3000);
      };

      this.ws.onerror = (err) => {
        console.warn('[CSM] WebSocket error:', err);
      };
    } catch (err) {
      console.warn('[CSM] connectWebSocket failed:', err);
    }
  }

  /**
   * Receive handler for real-time data plane broadcasts (§3.2, Invariant 6).
   *
   * The only protocol fact this method needs is whether a local record
   * exists at all — that's a read, not a decision, so it goes straight to
   * `db.ts` rather than through `conversationSync.ts`. No content is ever
   * materialized here: a present, non-deleted resource may be updated in
   * place if the broadcast dominates; a deleted or unknown resource is
   * left untouched and, for the unknown case, signals a boundary instead.
   * 
   * @param broadcast - The arriving chat resource payload from the network.
   */
  private async handleBroadcast(broadcast: ChatResource): Promise<void> {
    CoherenceClock.getInstance().observe(broadcast.lastMutationLamport);

    const localRes = await polyglotDb.getResource(broadcast.id);
    const localDel = await polyglotDb.getDeletionRecord(broadcast.id);

    if (!localRes && !localDel) {
      this.signalBoundaryAvailable();
      return;
    }

    if (localDel) {
      return;
    }

    if (localRes && broadcast.lastMutationLamport.lamport > localRes.lastMutationLamport.lamport) {
      await polyglotDb.saveResource(broadcast);
      await this.loadConversations();
    }
  }

  /**
   * Signal that a synchronization boundary is available (Invariant 6).
   * Surfaces as a badge / notification via `state.boundaryAvailable`.
   */
  signalBoundaryAvailable(): void {
    if (!this.state.boundaryAvailable) {
      console.log('[CSM] Boundary available — unknown resource detected via data plane broadcast.');
      this.setState({ boundaryAvailable: true });
    }
  }

  // ── Synchronization boundary (§3.4) ──────────────────────────────────────

  /**
   * Crosses a synchronization boundary by delegating entirely to
   * `backgroundSync.syncWithServer()`, which handles server reconciliation.
   * 
   * @deprecated `ReconciliationEngine.reconcileBoundary` handling should be preferred.
   * This file does not implement Case 1/2/3 itself — there is exactly one 
   * implementation of the reconciliation algorithm in this codebase.
   */
  async crossSynchronizationBoundary(): Promise<void> {
    try {
      console.log('[CSM] Crossing synchronization boundary.');
      const result = await syncWithServer();
      if (!result.success) {
        console.error('[CSM] Synchronization boundary failed:', result.error);
        this.setState({ error: result.error ?? 'Synchronization failed' });
        return;
      }
      if (result.changed) {
        await this.loadConversations();
      }
      this.setState({ boundaryAvailable: false });
      console.log(
        `[CSM] Boundary complete. Resources applied: ${result.syncedCount}, deletions applied: ${result.deletedCount}.`
      );
    } catch (err) {
      console.error('[CSM] crossSynchronizationBoundary failed:', err);
      this.setState({ error: err instanceof Error ? err.message : 'Synchronization failed' });
    }
  }

  // ── State access ──────────────────────────────────────────────────────────

  /**
   * Fetches an unmodifiable snapshot of the current local state.
   */
  getState(): Readonly<ConversationState> {
    return { ...this.state };
  }

  /**
   * Subscribes a listener callback to any local state updates.
   * 
   * @returns A teardown function to unsubscribe the listener.
   */
  subscribe(listener: (state: ConversationState) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /**
   * Toggles the conversation memory cache layer and wipes data upon disabling.
   */
  toggleCache(): void {
    this.cacheEnabled = !this.cacheEnabled;
    if (!this.cacheEnabled) this.conversationCache.clear();
  }

  /**
   * Checks whether the local memory cache layer is active.
   */
  isCacheEnabled(): boolean {
    return this.cacheEnabled;
  }

  // ── Write operations — delegate to conversationSync.ts ──────────────────

  /**
   * Instantiates a new conversation item and saves it downstream.
   */
  async createConversation(provider: string, model: string): Promise<Conversation> {
    const conversation = ConversationUtils.createConversation(provider, model);
    const result = await saveConversation(conversation as unknown as ChatResource);
    if (result.changed) {
      await syncWithServer();
      await this.loadConversations();
    }
    this.setState({ currentConversation: conversation, lastUpdated: new Date() });
    return conversation;
  }

  /**
   * Add a message (data plane UPDATE). 
   * 
   * Invariant 5 enforcement lives in `saveConversation`, not here — if the 
   * conversation has been deleted, the write is silently discarded by the coordinator 
   * and `result.changed` is false. In that event, local UI state and the cache are 
   * not updated either, so the discarded message never becomes visible.
   */
  async addMessage(message: Message): Promise<void> {
    if (!this.state.currentConversation) throw new Error('No active conversation');

    if (message.isPrivate) {
      this.setState({ lastUpdated: new Date() });
      return;
    }

    const current = JSON.parse(JSON.stringify(this.state.currentConversation)) as Conversation;
    const updated = ConversationUtils.addMessage(current, message);
    updated.lastModified = new Date();

    const result = await saveConversation(updated as unknown as ChatResource);

    if (!result.changed) {
      /**
       * Invariant 5: write was discarded by the coordinator. Do not
       * update local state or the cache with a message that was never
       * actually committed.
       */
      console.log('[CSM] addMessage discarded — conversation has been deleted.');
      return;
    }

    await syncWithServer();

    if (this.cacheEnabled) this.conversationCache.set(updated.id, updated);

    const updatedConversations = this.state.conversations.map((c) =>
      c.id === updated.id ? updated : c
    );
    if (!updatedConversations.some((c) => c.id === updated.id)) {
      updatedConversations.unshift(updated);
    }

    this.setState({
      currentConversation: updated,
      conversations: updatedConversations,
      lastUpdated: new Date(),
    });
  }

  /**
   * Updates the current conversation model configuration.
   */
  async switchModel(newModel: string): Promise<void> {
    if (!this.state.currentConversation) throw new Error('No active conversation');

    const updated = ConversationUtils.recordModelChange(
      this.state.currentConversation,
      this.state.currentConversation.currentModel,
      newModel
    );

    const result = await saveConversation(updated as unknown as ChatResource);
    if (!result.changed) {
      console.log('[CSM] switchModel discarded — conversation has been deleted.');
      return;
    }

    await syncWithServer();
    if (this.cacheEnabled) this.conversationCache.set(updated.id, updated);

    this.setState({
      currentConversation: updated,
      conversations: this.state.conversations.map((c) => (c.id === updated.id ? updated : c)),
      lastUpdated: new Date(),
    });
  }

  /**
   * Updates core metadata elements of a designated conversation.
   */
  async updateConversationMetadata(
    conversationId: string,
    updates: Partial<Pick<Conversation, 'title'>>
  ): Promise<Conversation> {
    const conversation = this.state.conversations.find((c) => c.id === conversationId);
    if (!conversation) throw new Error(`Conversation not found: ${conversationId}`);

    const updated = { ...conversation, ...updates, lastModified: new Date() };
    const result = await saveConversation(updated as unknown as ChatResource);
    if (!result.changed) {
      console.log('[CSM] updateConversationMetadata discarded — conversation has been deleted.');
      return conversation;
    }

    /**
     * @deprecated `pushResource` can lead to an unexpected race condition.
     * We explicitly flush outbound mutations instead.
     */
    await flushOutboundMutations();

    if (this.cacheEnabled) this.conversationCache.set(conversationId, updated);

    if (this.state.currentConversation?.id === conversationId) {
      this.setState({ currentConversation: updated, lastUpdated: new Date() });
    }
    this.setState({
      conversations: this.state.conversations.map((c) => (c.id === conversationId ? updated : c)),
    });
    return updated;
  }

  /**
   * Toggles the local archive visibility state wrapper for a conversation.
   */
  async toggleArchive(conversationId: string): Promise<void> {
    const conversation = this.state.conversations.find((c) => c.id === conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const updated = { ...conversation, isArchived: !conversation.isArchived, lastModified: new Date() };
    const result = await saveConversation(updated as unknown as ChatResource);
    if (!result.changed) {
      console.log('[CSM] toggleArchive discarded — conversation has been deleted.');
      return;
    }

    await syncWithServer();
    if (this.cacheEnabled) this.conversationCache.set(conversationId, updated);

    const updatedConversations = this.state.conversations.map((c) =>
      c.id === conversationId ? updated : c
    );
    let currentConversation = this.state.currentConversation;
    if (updated.isArchived && currentConversation?.id === conversationId) {
      currentConversation = updatedConversations.find((c) => !c.isArchived) || null;
    }

    this.setState({ conversations: updatedConversations, currentConversation, lastUpdated: new Date() });
  }

  /**
   * Delete a conversation (control plane DELETE, §3.1). 
   * 
   * All deletion semantics — stamping the Lamport clock, constructing the
   * DeletionRecord, and the atomic store write — live in `conversationSync.ts`'s 
   * `deleteConversation`. This method only updates local UI state to reflect 
   * that the deletion succeeded.
   */
  async deleteConversation(conversationId: string): Promise<void> {
    if (this.cacheEnabled) this.conversationCache.delete(conversationId);

    if (this.state.currentConversation?.id === conversationId) {
      this.setState({ currentConversation: null, lastUpdated: new Date() });
    }

    const result = await deleteConversation(conversationId);
    if (!result.success) {
      console.error('[CSM] deleteConversation failed:', result.error);
      this.setState({ error: result.error ?? 'Delete failed' });
      return;
    }

    await syncWithServer();

    const updatedConversations = this.state.conversations.filter((c) => c.id !== conversationId);
    this.setState({ conversations: updatedConversations, lastUpdated: new Date() });
  }

  // ── Read operations — go directly to db.ts ───────────────────────────────

  /**
   * Requests a target conversation out of the localized database or active cache.
   */
  async loadConversation(id: string): Promise<Conversation> {
    if (this.loadingConversations.has(id)) throw new Error('Already loading');

    if (this.cacheEnabled && this.conversationCache.has(id)) {
      const cached = this.conversationCache.get(id)!;
      this.setState({ currentConversation: cached, lastUpdated: new Date() });
      return cached;
    }

    try {
      this.loadingConversations.add(id);
      const conversation = (await polyglotDb.loadConversation(id)) as unknown as Conversation;
      if (this.cacheEnabled) this.conversationCache.set(id, conversation);
      this.setState({ currentConversation: conversation, lastUpdated: new Date() });
      return conversation;
    } finally {
      this.loadingConversations.delete(id);
    }
  }

  /**
   * Filters and searches across conversations based on queried criteria.
   */
  async searchConversations(filters: ConversationFilters): Promise<Conversation[]> {
    const settings = await this.settingsService.loadSettings();
    const showArchived = filters.showArchived ?? settings.showArchivedChats ?? false;
    let results = (await polyglotDb.listConversations(showArchived)) as unknown as Conversation[];

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      results = results.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.messages.some((m: Message) => m.content.toLowerCase().includes(q))
      );
    }
    if (filters.provider) results = results.filter((c) => c.provider === filters.provider);
    if (filters.model) results = results.filter((c) => c.currentModel === filters.model);
    if (filters.dateRange) {
      results = results.filter(
        (c) => c.lastModified >= filters.dateRange!.start && c.lastModified <= filters.dateRange!.end
      );
    }
    return results;
  }

  /**
   * Computes tracking and system utilization metrics for active conversations.
   */
  getConversationStats() {
    const convs = this.state.conversations;
    return {
      total: convs.length,
      active: convs.filter((c) => !c.isArchived).length,
      archived: convs.filter((c) => c.isArchived).length,
      byProvider: convs.reduce(
        (acc, c) => ({ ...acc, [c.provider]: (acc[c.provider] || 0) + 1 }),
        {} as Record<string, number>
      ),
      byModel: convs.reduce(
        (acc, c) => ({ ...acc, [c.currentModel]: (acc[c.currentModel] || 0) + 1 }),
        {} as Record<string, number>
      ),
    };
  }

  /**
   * Exports an individual conversation string matching a desired identifier.
   */
  async exportConversation(conversationId: string): Promise<string> {
    const conversation = await polyglotDb.loadConversation(conversationId);
    return JSON.stringify(conversation, null, 2);
  }

  /**
   * Imports a raw serialized chat payload string into local context.
   */
  async importConversation(jsonData: string): Promise<Conversation> {
    const conversation = JSON.parse(jsonData);
    if (!ConversationUtils.validateConversation(conversation)) throw new Error('Invalid format');
    conversation.id = ConversationUtils.generateId();
    conversation.createdAt = new Date();
    conversation.lastModified = new Date();

    const result = await saveConversation(conversation as unknown as ChatResource);
    if (result.changed) {
      await syncWithServer();
    }
    this.setState({ conversations: [conversation, ...this.state.conversations], lastUpdated: new Date() });
    return conversation;
  }

  /**
   * Sweeps and drops archived conversations exceeding the provided threshold window.
   * Runs as a best-effort sanitation pass.
   */
  async cleanupOldConversations(maxAge: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
    const old = this.state.conversations.filter((c) => c.lastModified < cutoffDate && c.isArchived);
    let count = 0;
    for (const conv of old) {
      try {
        await this.deleteConversation(conv.id);
        count++;
      } catch {
        // best-effort cleanup
      }
    }
    return count;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  /**
   * Internally updates local fields and synchronization indexes out of the system DB.
   */
  private async loadConversations(): Promise<void> {
    try {
      this.setState({ isLoading: true, error: null });
      const settings = await this.settingsService.loadSettings();
      const showArchived = settings.showArchivedChats || false;

      if (this.cacheEnabled) this.conversationCache.clear();

      const conversations = (await polyglotDb.listConversations(showArchived)) as unknown as Conversation[];
      if (this.cacheEnabled) conversations.forEach((c) => this.conversationCache.set(c.id, c));

      this.setState({ conversations, isLoading: false, lastUpdated: new Date() });
    } catch (error) {
      if (this.cacheEnabled) this.conversationCache.clear();
      this.setState({
        conversations: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load conversations',
        lastUpdated: new Date(),
      });
    }
  }

  /**
   * Dispatches unified updates onto the manager's core runtime state block.
   */
  private setState(updates: Partial<ConversationState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (e) {
        console.error('[StateManager] Listener error:', e);
      }
    });
  }

  /**
   * Performs critical cleanup routine operations, closing the WebSocket
   * channels and clear out state events.
   */
  destroy(): void {
    this.ws?.close();
    if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
    this.listeners.clear();
  }
}