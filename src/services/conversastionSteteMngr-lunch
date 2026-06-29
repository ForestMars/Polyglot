// src/services/conversationStateManager.ts (lunch version) 
// Orchestrates local operation execution, real-time data plane synchronization,
// and control plane reconciliation at synchronization boundaries.
//
// Protocol invariants enforced here:
//   Invariant 5 (Local Deletion Finality): deleteConversation() uses a soft
//     delete — the IndexedDB record is retained as a deletion record.
//   Invariant 6 (Data Plane Non-Origination): the WebSocket broadcast handler
//     does NOT apply broadcast content to local storage when no local record
//     exists. Instead it calls signalBoundaryAvailable().
//
// The synchronization boundary (onSynchronizationBoundary) implements §3.4:
//   Case 1 — local deletion is unconditionally re-asserted.
//   Case 2 — lexicographic Lamport tuple dominance decides participation.
//   Case 3 — standard last-write-wins for records with no deletion record.

import { Conversation, Message, ModelChange, lamportDominates, LamportTuple } from '@/types/conversation';
import { indexedDbStorage, getDeviceId, getLamport, incrementLamport, advanceLamportTo } from './indexedDbStorage';
import { ConversationUtils } from './conversationUtils';
import { SettingsService } from './settingsService';

export interface ConversationState {
  conversations:       Conversation[];
  currentConversation: Conversation | null;
  isLoading:           boolean;
  error:               string | null;
  lastUpdated:         Date;
  boundaryAvailable:   boolean;  // Invariant 6 signal
}

interface ConversationFilters {
  searchQuery:  string;
  provider:     string;
  model:        string;
  showArchived: boolean;
  dateRange?:   { start: Date; end: Date };
}

const SERVER_BASE = 'http://localhost:4001';
const WS_URL      = 'ws://localhost:4001';

export class ConversationStateManager {
  private storageService = indexedDbStorage;
  private settingsService = new SettingsService();
  private state: ConversationState = {
    conversations:       [],
    currentConversation: null,
    isLoading:           false,
    error:               null,
    lastUpdated:         new Date(),
    boundaryAvailable:   false,
  };
  private listeners:   Set<(s: ConversationState) => void> = new Set();
  private isInitialized = false;
  private cacheEnabled  = true;
  private conversationCache: Map<string, Conversation> = new Map();
  private loadingConversations: Set<string> = new Set();
  private ws: WebSocket | null = null;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBoundaryLamport = 0;

  constructor() {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('conversations-updated', async () => {
        await this.loadConversations();
      });
    }
  }

  // ── Initialisation ───────────────────────────────────────────────────────

  async initialize(cacheEnabled = true): Promise<void> {
    if (this.isInitialized) return;
    this.cacheEnabled = cacheEnabled;

    try {
      this.setState({ isLoading: true, error: null });
      await this.storageService.initialize();
      await this.loadConversations();

      // Connect to the real-time data plane broadcast channel.
      this.connectWebSocket();

      // Cross a synchronization boundary on startup to pull control plane state.
      await this.onSynchronizationBoundary();

      this.isInitialized = true;
      this.setState({ isLoading: false });
    } catch (err) {
      console.error('[CSM] initialize failed:', err);
      this.setState({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Initialization failed',
      });
    }
  }

  // ── WebSocket — real-time data plane (§3.2 receive handler) ─────────────

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

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'conversationUpdated') {
            await this.handleBroadcast(msg.data as Conversation);
          }
        } catch (err) {
          console.warn('[CSM] WS message parse error:', err);
        }
      };

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
   * Receive handler for real-time data plane broadcasts (§3.2).
   *
   * Invariant 5: if localConv exists and isDeleted=true → discard.
   * Invariant 6: if localConv is null (no record at all) → signal boundary
   *   available; do NOT materialise the resource from a data plane event.
   */
  private async handleBroadcast(broadcast: Conversation): Promise<void> {
    // Advance local Lamport clock unconditionally per Definition 2.
    await advanceLamportTo(broadcast.lamport);

    const localConv = await this.storageService.getChat(broadcast.id);

    if (!localConv) {
      // Invariant 6: unknown resource — signal boundary available.
      this.signalBoundaryAvailable();
      return;
    }

    if (localConv.isDeleted) {
      // Invariant 5: locally deleted — discard broadcast.
      return;
    }

    if (broadcast.lamport > localConv.lamport) {
      await this.storageService.installFromServer(broadcast);
      await this.loadConversations();
    }
  }

  /**
   * Signal that a synchronization boundary is available (Invariant 6).
   * Surfaces as a badge / notification in the UI via state.boundaryAvailable.
   */
  signalBoundaryAvailable(): void {
    if (!this.state.boundaryAvailable) {
      console.log('[CSM] Boundary available — new resource detected via data plane broadcast.');
      this.setState({ boundaryAvailable: true });
    }
  }

  // ── Synchronization boundary (§3.4) ─────────────────────────────────────

  /**
   * Cross a synchronization boundary: pull server control plane state and
   * reconcile local state using three-case algorithm from §3.4.
   *
   * Case 1 (unconditional): locally deleted resource → re-assert deletion.
   * Case 2: resource carries a deletion record → lexicographic participation check.
   * Case 3: no deletion record → standard Lamport-ordered LWW merge.
   */
  async onSynchronizationBoundary(): Promise<void> {
    try {
      console.log('[CSM] Crossing synchronization boundary.');

      // Step 1: Advance Lamport clock from server.
      const serverLamportRes = await fetch(`${SERVER_BASE}/lamport`);
      if (serverLamportRes.ok) {
        const { lamport: serverLamport } = await serverLamportRes.json();
        await advanceLamportTo(serverLamport);
      }

      // Step 2: Fetch current server resource set.
      const res = await fetch(`${SERVER_BASE}/fetchChats`);
      if (!res.ok) throw new Error(`fetchChats returned ${res.status}`);
      const serverConversations: Conversation[] = await res.json();
      const serverIds = new Set(serverConversations.map((c) => c.id));

      const deviceId = getDeviceId();

      // Step 3: Reconcile each server resource.
      for (const serverConv of serverConversations) {
        const localConv = await this.storageService.getChat(serverConv.id);

        // ── Case 1: Local deletion is unconditional and final ──────────────
        if (localConv?.isDeleted) {
          // Re-assert deletion to server in case an upsert temporarily restored it.
          await this.storageService.pushDeletionToServer(
            localConv.id,
            localConv.deletedAtLamport!,
            localConv.deletedBy!,
          );
          continue;
        }

        // ── Case 2: Server resource carries a deletion record ──────────────
        if (serverConv.deletedAtLamport !== undefined) {
          const τ_local: LamportTuple = {
            l: localConv?.lamport ?? -1,
            d: localConv?.deviceId ?? '',
          };
          const τ_delete: LamportTuple = {
            l: serverConv.deletedAtLamport,
            d: serverConv.deletedBy ?? '',
          };

          const participated = localConv !== undefined && lamportDominates(τ_local, τ_delete);

          if (!participated) {
            // No strict lexicographic dominance: accept deletion, purge local record.
            await this.storageService.purgeLocal(serverConv.id);
          } else {
            // Active causal participation: retain local version and push to server.
            await this.storageService.pushToServer(localConv);
          }
          continue;
        }

        // ── Case 3: No deletion record — standard LWW ─────────────────────
        if (!localConv || serverConv.lamport > localConv.lamport) {
          await this.storageService.installFromServer(serverConv);
        }
      }

      // Step 4: Push local-only resources that the server doesn't have.
      const localAll = await this.storageService.getChats();
      const localOnly = localAll.filter(
        (c) => !c.isDeleted && !serverIds.has(c.id) && c.lamport > this.lastBoundaryLamport,
      );
      if (localOnly.length > 0) {
        await fetch(`${SERVER_BASE}/pushChats`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ chats: localOnly }),
        });
      }

      this.lastBoundaryLamport = await getLamport();
      await this.loadConversations();

      // Clear the boundary-available signal now that we've crossed.
      this.setState({ boundaryAvailable: false });
      console.log('[CSM] Synchronization boundary complete. Lamport:', this.lastBoundaryLamport);
    } catch (err) {
      console.error('[CSM] onSynchronizationBoundary failed:', err);
    }
  }

  // ── State access ─────────────────────────────────────────────────────────

  getState(): Readonly<ConversationState> { return { ...this.state }; }

  subscribe(listener: (s: ConversationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  toggleCache(): void {
    this.cacheEnabled = !this.cacheEnabled;
    if (!this.cacheEnabled) this.conversationCache.clear();
  }

  isCacheEnabled(): boolean { return this.cacheEnabled; }

  // ── Conversation operations ───────────────────────────────────────────────

  async createConversation(provider: string, model: string): Promise<Conversation> {
    try {
      const lamport = await incrementLamport();
      const base = ConversationUtils.createConversation(provider, model);
      const conv: Conversation = {
        ...base,
        lamport,
        deviceId:  getDeviceId(),
        isDeleted: false,
      };
      await this.storageService.saveConversation(conv);
      await this.loadConversations();
      this.setState({ currentConversation: conv, lastUpdated: new Date() });
      return conv;
    } catch (err) {
      console.error('[CSM] createConversation failed:', err);
      throw err;
    }
  }

  async loadConversation(id: string): Promise<Conversation> {
    if (this.loadingConversations.has(id)) throw new Error('Already loading');
    if (this.cacheEnabled && this.conversationCache.has(id)) {
      const cached = this.conversationCache.get(id)!;
      this.setState({ currentConversation: cached, lastUpdated: new Date() });
      return cached;
    }
    try {
      this.loadingConversations.add(id);
      const conv = await this.storageService.loadConversation(id);
      if (this.cacheEnabled) this.conversationCache.set(id, conv);
      this.setState({ currentConversation: conv, lastUpdated: new Date() });
      return conv;
    } finally {
      this.loadingConversations.delete(id);
    }
  }

  /**
   * Add a message (data plane UPDATE).
   * Stamps the message and conversation with the incremented Lamport counter.
   * Invariant 5: if the conversation is deleted, the update is silently discarded.
   */
  async addMessage(message: Message): Promise<void> {
    if (!this.state.currentConversation) throw new Error('No active conversation');

    // Invariant 5: Local Deletion Finality.
    if (this.state.currentConversation.isDeleted) {
      console.log('[CSM] addMessage: conversation is deleted — discarding silently.');
      return;
    }

    if (message.isPrivate) {
      this.setState({ lastUpdated: new Date() });
      return;
    }

    try {
      const lamport = await incrementLamport();
      const stampedMsg: Message = { ...message, lamport };
      const current = JSON.parse(JSON.stringify(this.state.currentConversation)) as Conversation;
      const updated = ConversationUtils.addMessage(current, stampedMsg);
      updated.lamport   = lamport;
      updated.deviceId  = getDeviceId();
      updated.lastModified = new Date();

      await this.storageService.saveConversation(updated);
      if (this.cacheEnabled) this.conversationCache.set(updated.id, updated);

      const updatedList = this.state.conversations.map((c) =>
        c.id === updated.id ? updated : c
      );
      if (!updatedList.some((c) => c.id === updated.id)) updatedList.unshift(updated);

      this.setState({ currentConversation: updated, conversations: updatedList, lastUpdated: new Date() });
    } catch (err) {
      console.error('[CSM] addMessage failed:', err);
      throw err;
    }
  }

  /**
   * Soft-delete a conversation (control plane DELETE per §3.1).
   *
   * The IndexedDB record is NOT removed — it is marked isDeleted=true with
   * a Lamport timestamp (Invariant 5).  The UI removes it from the visible
   * list by filtering on isDeleted in listConversations().
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      if (this.cacheEnabled) this.conversationCache.delete(conversationId);
      // Soft delete in storage — record is retained with isDeleted=true.
      await this.storageService.deleteConversation(conversationId);

      // Remove from the in-memory list so it disappears from the sidebar.
      const updatedList = this.state.conversations.filter((c) => c.id !== conversationId);
      let current = this.state.currentConversation;
      if (current?.id === conversationId) {
        this.setState({ currentConversation: null });
        current = updatedList[0] ?? null;
      }
      this.setState({ conversations: updatedList, currentConversation: current, lastUpdated: new Date() });
    } catch (err) {
      console.error('[CSM] deleteConversation failed:', err);
      if (this.cacheEnabled) this.conversationCache.delete(conversationId);
      throw err;
    }
  }

  async switchModel(newModel: string): Promise<void> {
    if (!this.state.currentConversation) throw new Error('No active conversation');
    try {
      const updated = ConversationUtils.recordModelChange(
        this.state.currentConversation,
        this.state.currentConversation.currentModel,
        newModel,
      );
      this.setState({ currentConversation: updated });
      const updatedList = this.state.conversations.map((c) =>
        c.id === updated.id ? updated : c
      );
      this.setState({ conversations: updatedList });
      await this.storageService.saveConversation(updated);
      if (this.cacheEnabled) this.conversationCache.set(updated.id, updated);
    } catch (err) {
      console.error('[CSM] switchModel failed:', err);
      throw err;
    }
  }

  async updateConversationMetadata(
    id: string,
    updates: Partial<Pick<Conversation, 'title'>>,
  ): Promise<Conversation> {
    const conv = this.state.conversations.find((c) => c.id === id);
    if (!conv) throw new Error(`Conversation not found: ${id}`);
    const updated = { ...conv, ...updates, lastModified: new Date() };
    if (this.state.currentConversation?.id === id) {
      this.setState({ currentConversation: updated });
    }
    const updatedList = this.state.conversations.map((c) => c.id === id ? updated : c);
    this.setState({ conversations: updatedList });
    await this.storageService.saveConversation(updated);
    if (this.cacheEnabled) this.conversationCache.set(id, updated);
    return updated;
  }

  async toggleArchive(id: string): Promise<void> {
    const conv = this.state.conversations.find((c) => c.id === id);
    if (!conv) throw new Error('Conversation not found');
    const updated = { ...conv, isArchived: !conv.isArchived, lastModified: new Date() };
    if (this.cacheEnabled) this.conversationCache.set(id, updated);
    await this.storageService.saveConversation(updated);
    const updatedList = this.state.conversations.map((c) => c.id === id ? updated : c);
    let current = this.state.currentConversation;
    if (updated.isArchived && current?.id === id) {
      current = updatedList.find((c) => !c.isArchived) ?? null;
    }
    this.setState({ conversations: updatedList, currentConversation: current, lastUpdated: new Date() });
  }

  async searchConversations(filters: ConversationFilters): Promise<Conversation[]> {
    try {
      const settings = await this.settingsService.loadSettings();
      const showArchived = filters.showArchived ?? settings.showArchivedChats ?? false;
      let results = await this.storageService.listConversations(showArchived);
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        results = results.filter(
          (c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)),
        );
      }
      if (filters.provider) results = results.filter((c) => c.provider === filters.provider);
      if (filters.model)    results = results.filter((c) => c.currentModel === filters.model);
      if (filters.dateRange) {
        results = results.filter(
          (c) => c.lastModified >= filters.dateRange!.start && c.lastModified <= filters.dateRange!.end,
        );
      }
      return results;
    } catch (err) {
      console.error('[CSM] searchConversations failed:', err);
      return [];
    }
  }

  getConversationStats() {
    return {
      total:      this.state.conversations.length,
      active:     this.state.conversations.filter((c) => !c.isArchived).length,
      archived:   this.state.conversations.filter((c) =>  c.isArchived).length,
      byProvider: this.state.conversations.reduce((acc, c) => {
        acc[c.provider] = (acc[c.provider] ?? 0) + 1; return acc;
      }, {} as Record<string, number>),
      byModel: this.state.conversations.reduce((acc, c) => {
        acc[c.currentModel] = (acc[c.currentModel] ?? 0) + 1; return acc;
      }, {} as Record<string, number>),
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async loadConversations(): Promise<void> {
    try {
      this.setState({ isLoading: true, error: null });
      const settings = await this.settingsService.loadSettings();
      const showArchived = settings.showArchivedChats ?? false;
      if (this.cacheEnabled) this.conversationCache.clear();
      const convs = await this.storageService.listConversations(showArchived);
      if (this.cacheEnabled) convs.forEach((c) => this.conversationCache.set(c.id, c));
      this.setState({ conversations: convs, isLoading: false, lastUpdated: new Date() });
    } catch (err) {
      console.error('[CSM] loadConversations failed:', err);
      if (this.cacheEnabled) this.conversationCache.clear();
      this.setState({
        conversations: [],
        isLoading:     false,
        error:         err instanceof Error ? err.message : 'Failed to load conversations',
        lastUpdated:   new Date(),
      });
    }
  }

  private setState(updates: Partial<ConversationState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach((l) => { try { l(this.state); } catch (e) { console.error(e); } });
  }

  destroy(): void {
    this.ws?.close();
    if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
    this.listeners.clear();
  }
}