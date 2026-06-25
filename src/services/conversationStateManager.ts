// src/services/conversationStateManager.ts
// Presentation adapter. This is the only layer that dispatches DOM events.
// Protocol operations return ConversationSyncResult; this class reads .changed
// and decides whether to fire 'conversations-updated'.
import { Conversation, Message, ModelChange } from '@/types/conversation';
import { ChatResource, ConversationSyncResult } from '../types/sync';
import { polyglotDb } from './db';
import { saveConversation, deleteConversation } from './conversationSync';
import { ConversationUtils } from './conversationUtils';
import { SettingsService } from './settingsService';

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
}

export class ConversationStateManager {
  private settingsService: SettingsService;
  private state: ConversationState;
  private listeners: Set<(state: ConversationState) => void>;
  private isInitialized = false;
  private conversationCache: Map<string, Conversation> = new Map();
  private loadingConversations: Set<string> = new Set();
  private cacheEnabled: boolean = true;

  constructor() {
    this.settingsService = new SettingsService();
    this.state = {
      conversations: [],
      currentConversation: null,
      isLoading: false,
      error: null,
      lastUpdated: new Date(),
    };
    this.listeners = new Set();

    // Listen for sync results dispatched by App.tsx after backgroundSyncWithServer.
    if (typeof window !== 'undefined') {
      window.addEventListener('conversations-updated', async () => {
        console.log('[StateManager] conversations-updated received, reloading...');
        await this.loadConversations();
      });
    }
  }

  async initialize(cacheEnabled: boolean = true): Promise<void> {
    if (this.isInitialized) return;
    this.cacheEnabled = cacheEnabled;
    try {
      this.setState({ isLoading: true, error: null });
      await this.settingsService.loadSettings();
      await this.loadConversations();
      this.isInitialized = true;
      this.setState({ isLoading: false });
    } catch (error) {
      console.error('[StateManager] Initialization failed:', error);
      this.setState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Initialization failed',
      });
    }
  }

  // DOM event dispatch — lives here and only here
  private notifyUI(): void {
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new Event('conversations-updated'));
      } catch (e) {
        console.warn('[StateManager] Failed to dispatch conversations-updated:', e);
      }
    }
  }

  // Fire event if a sync result indicates state changed.
  handleSyncResult(result: ConversationSyncResult | { changed: boolean }): void {
    if (result.changed) this.notifyUI();
  }

  // Public API
  getState(): Readonly<ConversationState> {
    return { ...this.state };
  }

  subscribe(listener: (state: ConversationState) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  toggleCache(): void {
    this.cacheEnabled = !this.cacheEnabled;
    if (!this.cacheEnabled) this.conversationCache.clear();
  }

  isCacheEnabled(): boolean {
    return this.cacheEnabled;
  }

  // Write operations — delegate to conversationSync, react to result
  async createConversation(provider: string, model: string): Promise<Conversation> {
    const conversation = ConversationUtils.createConversation(provider, model);
    const result = await saveConversation(conversation as unknown as ChatResource);
    if (result.changed) {
      await this.loadConversations();
      this.notifyUI();
    }
    this.setState({ currentConversation: conversation, lastUpdated: new Date() });
    return conversation;
  }

  async addMessage(message: Message): Promise<void> {
    if (!this.state.currentConversation) throw new Error('No active conversation');

    if (message.isPrivate) {
      this.setState({ lastUpdated: new Date() });
      return;
    }

    const currentConv = JSON.parse(JSON.stringify(this.state.currentConversation));
    const updatedConversation = ConversationUtils.addMessage(currentConv, message);
    updatedConversation.lastModified = new Date();

    const result = await saveConversation(updatedConversation as unknown as ChatResource);

    if (this.cacheEnabled) this.conversationCache.set(updatedConversation.id, updatedConversation);

    const updatedConversations = this.state.conversations.map(c =>
      c.id === updatedConversation.id ? updatedConversation : c
    );
    if (!updatedConversations.some(c => c.id === updatedConversation.id)) {
      updatedConversations.unshift(updatedConversation);
    }

    this.setState({
      currentConversation: updatedConversation,
      conversations: updatedConversations,
      lastUpdated: new Date(),
    });

    if (result.changed) this.notifyUI();
  }

  async switchModel(newModel: string): Promise<void> {
    if (!this.state.currentConversation) throw new Error('No active conversation');

    const updatedConversation = ConversationUtils.recordModelChange(
      this.state.currentConversation,
      this.state.currentConversation.currentModel,
      newModel
    );

    this.setState({ currentConversation: updatedConversation, lastUpdated: new Date() });
    this.setState({
      conversations: this.state.conversations.map(c =>
        c.id === updatedConversation.id ? updatedConversation : c
      ),
    });

    const result = await saveConversation(updatedConversation as unknown as ChatResource);
    if (this.cacheEnabled) this.conversationCache.set(updatedConversation.id, updatedConversation);
    if (result.changed) this.notifyUI();
  }

  async updateConversationMetadata(
    conversationId: string,
    updates: Partial<Pick<Conversation, 'title'>>
  ): Promise<Conversation> {
    const conversation = this.state.conversations.find(c => c.id === conversationId);
    if (!conversation) throw new Error(`Conversation not found: ${conversationId}`);

    const updated = { ...conversation, ...updates, lastModified: new Date() };

    if (this.state.currentConversation?.id === conversationId) {
      this.setState({ currentConversation: updated, lastUpdated: new Date() });
    }
    this.setState({
      conversations: this.state.conversations.map(c => c.id === conversationId ? updated : c),
    });

    const result = await saveConversation(updated as unknown as ChatResource);
    if (this.cacheEnabled) this.conversationCache.set(conversationId, updated);
    if (result.changed) this.notifyUI();
    return updated;
  }

  async toggleArchive(conversationId: string): Promise<void> {
    const conversation = this.state.conversations.find(c => c.id === conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const updated = { ...conversation, isArchived: !conversation.isArchived, lastModified: new Date() };
    if (this.cacheEnabled) this.conversationCache.set(conversationId, updated);

    const result = await saveConversation(updated as unknown as ChatResource);

    const updatedConversations = this.state.conversations.map(c =>
      c.id === conversationId ? updated : c
    );
    let currentConversation = this.state.currentConversation;
    if (updated.isArchived && currentConversation?.id === conversationId) {
      currentConversation = updatedConversations.find(c => !c.isArchived) || null;
    }

    this.setState({ conversations: updatedConversations, currentConversation, lastUpdated: new Date() });
    if (result.changed) this.notifyUI();
  }

  async deleteConversation(conversationId: string): Promise<void> {
    if (this.cacheEnabled) this.conversationCache.delete(conversationId);

    if (this.state.currentConversation?.id === conversationId) {
      this.setState({ currentConversation: null, lastUpdated: new Date() });
    }

    const result = await deleteConversation(conversationId);

    const updatedConversations = this.state.conversations.filter(c => c.id !== conversationId);
    const currentConversation = this.state.currentConversation?.id === conversationId
      ? updatedConversations[0] || null
      : this.state.currentConversation;

    this.setState({ conversations: updatedConversations, currentConversation, lastUpdated: new Date() });

    if (result.changed) this.notifyUI();
  }

  // Read operations — go directly to db
  async loadConversation(id: string): Promise<Conversation> {
    if (this.loadingConversations.has(id)) throw new Error('Already loading');

    if (this.cacheEnabled && this.conversationCache.has(id)) {
      const cached = this.conversationCache.get(id)!;
      this.setState({ currentConversation: cached, lastUpdated: new Date() });
      return cached;
    }

    try {
      this.loadingConversations.add(id);
      const conversation = await polyglotDb.loadConversation(id) as unknown as Conversation;
      if (this.cacheEnabled) this.conversationCache.set(id, conversation);
      this.setState({ currentConversation: conversation, lastUpdated: new Date() });
      return conversation;
    } finally {
      this.loadingConversations.delete(id);
    }
  }

  async searchConversations(filters: ConversationFilters): Promise<Conversation[]> {
    const settings = await this.settingsService.loadSettings();
    const showArchived = filters.showArchived ?? (settings.showArchivedChats || false);
    let results = await polyglotDb.listConversations(showArchived) as unknown as Conversation[];

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      results = results.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m: Message) => m.content.toLowerCase().includes(q))
      );
    }
    if (filters.provider) results = results.filter(c => c.provider === filters.provider);
    if (filters.model) results = results.filter(c => c.currentModel === filters.model);
    if (filters.dateRange) {
      results = results.filter(c =>
        c.lastModified >= filters.dateRange!.start &&
        c.lastModified <= filters.dateRange!.end
      );
    }
    return results;
  }

  getConversationStats() {
    const convs = this.state.conversations;
    return {
      total: convs.length,
      active: convs.filter(c => !c.isArchived).length,
      archived: convs.filter(c => c.isArchived).length,
      byProvider: convs.reduce((acc, c) => ({ ...acc, [c.provider]: (acc[c.provider] || 0) + 1 }), {} as Record<string, number>),
      byModel: convs.reduce((acc, c) => ({ ...acc, [c.currentModel]: (acc[c.currentModel] || 0) + 1 }), {} as Record<string, number>),
    };
  }

  async exportConversation(conversationId: string): Promise<string> {
    const conversation = await polyglotDb.loadConversation(conversationId);
    return JSON.stringify(conversation, null, 2);
  }

  async importConversation(jsonData: string): Promise<Conversation> {
    const conversation = JSON.parse(jsonData);
    if (!ConversationUtils.validateConversation(conversation)) throw new Error('Invalid format');
    conversation.id = ConversationUtils.generateId();
    conversation.createdAt = new Date();
    conversation.lastModified = new Date();
    const result = await saveConversation(conversation as unknown as ChatResource);
    this.setState({ conversations: [conversation, ...this.state.conversations], lastUpdated: new Date() });
    if (result.changed) this.notifyUI();
    return conversation;
  }

  async cleanupOldConversations(maxAge: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
    const old = this.state.conversations.filter(c => c.lastModified < cutoffDate && c.isArchived);
    let count = 0;
    for (const conv of old) {
      try { await this.deleteConversation(conv.id); count++; } catch {}
    }
    return count;
  }

  // Internal
  private async loadConversations(): Promise<void> {
    try {
      this.setState({ isLoading: true, error: null });
      const settings = await this.settingsService.loadSettings();
      const showArchived = settings.showArchivedChats || false;

      if (this.cacheEnabled) this.conversationCache.clear();

      const conversations = await polyglotDb.listConversations(showArchived) as unknown as Conversation[];
      if (this.cacheEnabled) conversations.forEach(c => this.conversationCache.set(c.id, c));

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

  private setState(updates: Partial<ConversationState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(listener => {
      try { listener(this.state); } catch (e) { console.error('[StateManager] Listener error:', e); }
    });
  }

  destroy(): void {
    this.listeners.clear();
  }
}