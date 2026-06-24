// src/services/conversationStateManager.ts
interface ConversationFilters {
  searchQuery: string;
  provider: string;
  model: string;
  showArchived: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}
import { Conversation, Message, ModelChange } from '@/types/conversation';
import { indexedDbStorage } from './indexedDbStorage';
import { saveConversation, deleteConversation } from './conversationSync';
import { ConversationUtils } from './conversationUtils';
import { SettingsService, AppSettings } from './settingsService';

export interface ConversationState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date;
}

export class ConversationStateManager {
  private storageService: any;
  private settingsService: SettingsService;
  private state: ConversationState;
  private listeners: Set<(state: ConversationState) => void>;
  private isInitialized = false;
  private conversationCache: Map<string, Conversation> = new Map();
  private loadingConversations: Set<string> = new Set();
  private cacheEnabled: boolean = true;
  private sessionMessages: Map<string, Message[]> = new Map();

  constructor() {
    this.storageService = indexedDbStorage;
    this.settingsService = new SettingsService();
    this.state = {
      conversations: [],
      currentConversation: null,
      isLoading: false,
      error: null,
      lastUpdated: new Date()
    };
    this.listeners = new Set();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('conversations-updated', async () => {
        console.log('[StateManager] Detected conversations-updated event, reloading...');
        await this.loadConversations();
      });
    }
  }

  async initialize(cacheEnabled: boolean = true): Promise<void> {
    if (this.isInitialized) return;
    this.cacheEnabled = cacheEnabled;
    console.log(`[StateManager] Cache ${this.cacheEnabled ? 'enabled' : 'disabled'}`);
    try {
      this.setState({ isLoading: true, error: null });
      await this.storageService.initialize();
      await this.settingsService.loadSettings();
      await this.loadConversations();
      this.isInitialized = true;
      this.setState({ isLoading: false });
    } catch (error) {
      console.error('Failed to initialize conversation state manager:', error);
      this.setState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Initialization failed'
      });
    }
  }

  getState(): Readonly<ConversationState> {
    return { ...this.state };
  }

  toggleCache(): void {
    this.cacheEnabled = !this.cacheEnabled;
    if (!this.cacheEnabled) {
      this.conversationCache.clear();
      console.log('[StateManager] Cache disabled and cleared');
    } else {
      console.log('[StateManager] Cache enabled');
    }
  }

  isCacheEnabled(): boolean {
    return this.cacheEnabled;
  }

  subscribe(listener: (state: ConversationState) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  async createConversation(provider: string, model: string): Promise<Conversation> {
    try {
      const conversation = ConversationUtils.createConversation(provider, model);
      await saveConversation(conversation);
      await this.loadConversations();
      this.setState({ currentConversation: conversation, lastUpdated: new Date() });
      return conversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }

  async loadConversation(id: string): Promise<Conversation> {
    if (this.loadingConversations.has(id)) {
      throw new Error('Conversation is already being loaded');
    }
    if (this.cacheEnabled && this.conversationCache.has(id)) {
      const cached = this.conversationCache.get(id)!;
      console.log(`[StateManager] Cache HIT for conversation ${id}`);
      this.setState({ currentConversation: cached, lastUpdated: new Date() });
      return cached;
    }
    try {
      this.loadingConversations.add(id);
      const conversation = await this.storageService.loadConversation(id);
      if (this.cacheEnabled) {
        this.conversationCache.set(id, conversation);
      }
      this.setState({ currentConversation: conversation, lastUpdated: new Date() });
      return conversation;
    } catch (error) {
      console.error('Failed to load conversation:', error);
      throw error;
    } finally {
      this.loadingConversations.delete(id);
    }
  }

  async addMessage(message: Message): Promise<void> {
    if (!this.state.currentConversation) {
      throw new Error('No active conversation');
    }
    if (message.isPrivate) {
      console.log(`[StateManager] Private message detected, skipping: ${this.state.currentConversation.id}`);
      this.setState({ lastUpdated: new Date() });
      return;
    }
    try {
      const currentConv = JSON.parse(JSON.stringify(this.state.currentConversation));
      const updatedConversation = ConversationUtils.addMessage(currentConv, message);
      updatedConversation.lastModified = new Date();

      await saveConversation(updatedConversation);

      if (this.cacheEnabled) {
        this.conversationCache.set(updatedConversation.id, updatedConversation);
      }
      const updatedConversations = this.state.conversations.map(conv =>
        conv.id === updatedConversation.id ? updatedConversation : conv
      );
      if (!updatedConversations.some(conv => conv.id === updatedConversation.id)) {
        updatedConversations.unshift(updatedConversation);
      }
      this.setState({
        currentConversation: updatedConversation,
        conversations: updatedConversations,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('Failed to add message:', error);
      throw error;
    }
  }

  async switchModel(newModel: string): Promise<void> {
    if (!this.state.currentConversation) {
      throw new Error('No active conversation');
    }
    try {
      const updatedConversation = ConversationUtils.recordModelChange(
        this.state.currentConversation,
        this.state.currentConversation.currentModel,
        newModel
      );
      this.setState({ currentConversation: updatedConversation, lastUpdated: new Date() });
      const updatedConversations = this.state.conversations.map(conv =>
        conv.id === updatedConversation.id ? updatedConversation : conv
      );
      this.setState({ conversations: updatedConversations });
      await saveConversation(updatedConversation);
      if (this.cacheEnabled) {
        this.conversationCache.set(updatedConversation.id, updatedConversation);
      }
    } catch (error) {
      console.error('Failed to switch model:', error);
      throw error;
    }
  }

  async updateConversationMetadata(
    conversationId: string,
    updates: Partial<Pick<Conversation, 'title'>>
  ): Promise<Conversation> {
    try {
      const conversation = this.state.conversations.find(c => c.id === conversationId);
      if (!conversation) throw new Error(`Conversation not found: ${conversationId}`);

      const updatedConversation = { ...conversation, ...updates, lastModified: new Date() };

      if (this.state.currentConversation?.id === conversationId) {
        this.setState({ currentConversation: updatedConversation, lastUpdated: new Date() });
      }
      const updatedConversations = this.state.conversations.map(c =>
        c.id === conversationId ? updatedConversation : c
      );
      this.setState({ conversations: updatedConversations });
      await saveConversation(updatedConversation);
      if (this.cacheEnabled) {
        this.conversationCache.set(conversationId, updatedConversation);
      }
      return updatedConversation;
    } catch (error) {
      console.error('Failed to update conversation metadata:', error);
      throw error;
    }
  }

  async toggleArchive(conversationId: string): Promise<void> {
    try {
      const conversation = this.state.conversations.find(c => c.id === conversationId);
      if (!conversation) throw new Error('Conversation not found');

      const updatedConversation = {
        ...conversation,
        isArchived: !conversation.isArchived,
        lastModified: new Date()
      };
      if (this.cacheEnabled) {
        this.conversationCache.set(conversationId, updatedConversation);
      }
      await saveConversation(updatedConversation);
      const updatedConversations = this.state.conversations.map(c =>
        c.id === conversationId ? updatedConversation : c
      );
      let currentConversation = this.state.currentConversation;
      if (updatedConversation.isArchived && currentConversation?.id === conversationId) {
        currentConversation = updatedConversations.find(c => !c.isArchived) || null;
      }
      this.setState({ conversations: updatedConversations, currentConversation, lastUpdated: new Date() });
    } catch (error) {
      console.error('Failed to toggle archive status:', error);
      throw error;
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      if (this.cacheEnabled) {
        this.conversationCache.delete(conversationId);
      }

      // Route through coordinator: registers deletion record + pushes to server.
      await deleteConversation(conversationId);

      const updatedConversations = this.state.conversations.filter(
        c => c.id !== conversationId
      );
      let currentConversation = this.state.currentConversation;
      if (currentConversation?.id === conversationId) {
        this.setState({ currentConversation: null, lastUpdated: new Date() });
        currentConversation = updatedConversations[0] || null;
      }
      this.setState({ conversations: updatedConversations, currentConversation, lastUpdated: new Date() });
      console.log(`[StateManager] Deleted conversation ${conversationId}`);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      if (this.cacheEnabled) this.conversationCache.delete(conversationId);
      throw error;
    }
  }

  async searchConversations(filters: ConversationFilters): Promise<Conversation[]> {
    try {
      const settings = await this.settingsService.loadSettings();
      const showArchived = filters.showArchived !== undefined
        ? filters.showArchived
        : (settings.showArchivedChats || false);

      let results = await this.storageService.listConversations(showArchived);

      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        results = results.filter((conv: Conversation) =>
          conv.title.toLowerCase().includes(query) ||
          conv.messages.some((msg: Message) => msg.content.toLowerCase().includes(query))
        );
      }
      if (filters.provider) results = results.filter((c: Conversation) => c.provider === filters.provider);
      if (filters.model) results = results.filter((c: Conversation) => c.currentModel === filters.model);
      if (filters.dateRange) {
        results = results.filter((c: Conversation) =>
          c.lastModified >= filters.dateRange!.start &&
          c.lastModified <= filters.dateRange!.end
        );
      }
      return results;
    } catch (error) {
      console.error('Failed to search conversations:', error);
      return [];
    }
  }

  getConversationStats() {
    const stats = {
      total: this.state.conversations.length,
      active: this.state.conversations.filter(c => !c.isArchived).length,
      archived: this.state.conversations.filter(c => c.isArchived).length,
      byProvider: {} as Record<string, number>,
      byModel: {} as Record<string, number>
    };
    this.state.conversations.forEach(conv => {
      stats.byProvider[conv.provider] = (stats.byProvider[conv.provider] || 0) + 1;
      stats.byModel[conv.currentModel] = (stats.byModel[conv.currentModel] || 0) + 1;
    });
    return stats;
  }

  async exportConversation(conversationId: string): Promise<string> {
    try {
      const conversation = await this.storageService.loadConversation(conversationId);
      return JSON.stringify(conversation, null, 2);
    } catch (error) {
      console.error('Failed to export conversation:', error);
      throw error;
    }
  }

  async importConversation(jsonData: string): Promise<Conversation> {
    try {
      const conversation = JSON.parse(jsonData);
      if (!ConversationUtils.validateConversation(conversation)) {
        throw new Error('Invalid conversation format');
      }
      conversation.id = ConversationUtils.generateId();
      conversation.createdAt = new Date();
      conversation.lastModified = new Date();
      await saveConversation(conversation);
      this.setState({
        conversations: [conversation, ...this.state.conversations],
        lastUpdated: new Date()
      });
      return conversation;
    } catch (error) {
      console.error('Failed to import conversation:', error);
      throw error;
    }
  }

  async cleanupOldConversations(maxAge: number): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
      const oldConversations = this.state.conversations.filter(
        c => c.lastModified < cutoffDate && c.isArchived
      );
      let deletedCount = 0;
      for (const conv of oldConversations) {
        try {
          await this.deleteConversation(conv.id);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete old conversation ${conv.id}:`, error);
        }
      }
      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old conversations:', error);
      return 0;
    }
  }

  private async loadConversations(): Promise<void> {
    try {
      this.setState({ isLoading: true, error: null });
      const settings = await this.settingsService.loadSettings();
      const showArchived = settings.showArchivedChats || false;

      if (this.cacheEnabled) {
        this.conversationCache.clear();
      }

      const conversations = await this.storageService.listConversations(showArchived);
      console.log(`[StateManager] Loaded ${conversations.length} conversations`);

      if (this.cacheEnabled) {
        conversations.forEach((conv: Conversation) => this.conversationCache.set(conv.id, conv));
      }

      this.setState({ conversations, isLoading: false, lastUpdated: new Date() });
    } catch (error) {
      console.error('Failed to load conversations:', error);
      if (this.cacheEnabled) this.conversationCache.clear();
      this.setState({
        conversations: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load conversations',
        lastUpdated: new Date()
      });
    }
  }

  private setState(updates: Partial<ConversationState>): void {
    const prevConvs = this.state.conversations?.map(c => c.id) || [];
    this.state = { ...this.state, ...updates };
    const newConvs = this.state.conversations?.map(c => c.id) || [];
    console.log('[StateManager] setState. Prev:', prevConvs, 'New:', newConvs, 'Current:', this.state.currentConversation?.id);
    this.listeners.forEach(listener => {
      try { listener(this.state); } catch (error) { console.error('Error in state listener:', error); }
    });
  }

  destroy(): void {
    this.listeners.clear();
  }
}