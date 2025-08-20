import { Conversation, Message, ModelChange } from '@/types/conversation';
import { StorageService } from './storage';
import { ConversationUtils } from './conversationUtils';
import { SettingsService, AppSettings } from './settingsService';

export interface ConversationState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date;
}

export interface ConversationFilters {
  searchQuery: string;
  provider: string;
  model: string;
  showArchived: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export class ConversationStateManager {
  private storageService: StorageService;
  private settingsService: SettingsService;
  private state: ConversationState;
  private listeners: Set<(state: ConversationState) => void>;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private conversationCache: Map<string, Conversation> = new Map();
  private loadingConversations: Set<string> = new Set();

  constructor() {
    this.storageService = new StorageService();
    this.settingsService = new SettingsService();
    this.state = {
      conversations: [],
      currentConversation: null,
      isLoading: false,
      error: null,
      lastUpdated: new Date()
    };
    this.listeners = new Set();
  }

  /**
   * Initialize the state manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.setState({ isLoading: true, error: null });
      
      // Initialize storage
      await this.storageService.initialize();
      
      // Load settings
      const settings = await this.settingsService.loadSettings();
      
      // Load conversations
      await this.loadConversations();
      
      // Set up auto-save
      this.setupAutoSave(settings.autoSaveInterval);
      
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

  /**
   * Get current state
   */
  getState(): Readonly<ConversationState> {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: ConversationState) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Create new conversation
   */
  async createConversation(provider: string, model: string): Promise<Conversation> {
    try {
      const conversation = ConversationUtils.createConversation(provider, model);
      
      // Save to storage
      await this.storageService.saveConversation(conversation);
      
      // Update state
      this.setState({
        conversations: [conversation, ...this.state.conversations],
        currentConversation: conversation,
        lastUpdated: new Date()
      });
      
      return conversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }

  /**
   * Load conversation by ID
   */
  async loadConversation(id: string): Promise<Conversation> {
    // Check if already loading this conversation
    if (this.loadingConversations.has(id)) {
      throw new Error('Conversation is already being loaded');
    }

    // Check cache first
    if (this.conversationCache.has(id)) {
      const cached = this.conversationCache.get(id)!;
      this.setState({
        currentConversation: cached,
        lastUpdated: new Date()
      });
      return cached;
    }

    try {
      this.loadingConversations.add(id);
      
      const conversation = await this.storageService.loadConversation(id);
      
      // Update cache
      this.conversationCache.set(id, conversation);
      
      // Update state
      this.setState({
        currentConversation: conversation,
        lastUpdated: new Date()
      });
      
      return conversation;
    } catch (error) {
      console.error('Failed to load conversation:', error);
      throw error;
    } finally {
      this.loadingConversations.delete(id);
    }
  }

  /**
   * Add message to current conversation
   */
  async addMessage(message: Message): Promise<void> {
    if (!this.state.currentConversation) {
      throw new Error('No active conversation');
    }

    try {
      const updatedConversation = ConversationUtils.addMessage(
        this.state.currentConversation,
        message
      );
      
      // Save to storage first
      await this.storageService.saveConversation(updatedConversation);
      
      // Update cache
      this.conversationCache.set(updatedConversation.id, updatedConversation);
      
      // Update state
      this.setState({
        currentConversation: updatedConversation,
        lastUpdated: new Date()
      });
      
      // Update in conversations list
      const updatedConversations = this.state.conversations.map(conv =>
        conv.id === updatedConversation.id ? updatedConversation : conv
      );
      
      this.setState({ 
        conversations: updatedConversations,
        lastUpdated: new Date()
      });
      
      console.log(`[ConversationStateManager] Added message to conversation ${updatedConversation.id}`);
    } catch (error) {
      console.error('Failed to add message:', error);
      throw error;
    }
  }

  /**
   * Switch model in current conversation
   */
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
      
      // Update state
      this.setState({
        currentConversation: updatedConversation,
        lastUpdated: new Date()
      });
      
      // Update in conversations list
      const updatedConversations = this.state.conversations.map(conv =>
        conv.id === updatedConversation.id ? updatedConversation : conv
      );
      
      this.setState({ conversations: updatedConversations });
      
      // Save immediately
      await this.storageService.saveConversation(updatedConversation);
    } catch (error) {
      console.error('Failed to switch model:', error);
      throw error;
    }
  }

  /**
   * Archive/unarchive conversation
   */
  async toggleArchive(conversationId: string): Promise<void> {
    try {
      const conversation = this.state.conversations.find(c => c.id === conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (conversation.isArchived) {
        await this.storageService.unarchiveConversation(conversationId);
      } else {
        await this.storageService.archiveConversation(conversationId);
      }
      
      // Reload conversations to get updated state
      await this.loadConversations();
    } catch (error) {
      console.error('Failed to toggle archive:', error);
      throw error;
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      await this.storageService.deleteConversation(conversationId);
      
      // Remove from state
      const updatedConversations = this.state.conversations.filter(
        c => c.id !== conversationId
      );
      
      // Clear current conversation if it was deleted
      let currentConversation = this.state.currentConversation;
      if (currentConversation?.id === conversationId) {
        currentConversation = updatedConversations[0] || null;
      }
      
      this.setState({
        conversations: updatedConversations,
        currentConversation,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw error;
    }
  }

  /**
   * Search conversations
   */
  async searchConversations(filters: ConversationFilters): Promise<Conversation[]> {
    try {
      let results = this.state.conversations;
      
      // Apply filters
      if (filters.searchQuery) {
        results = await this.storageService.searchConversations(filters.searchQuery);
      }
      
      if (filters.provider) {
        results = results.filter(c => c.provider === filters.provider);
      }
      
      if (filters.model) {
        results = results.filter(c => c.currentModel === filters.model);
      }
      
      if (filters.showArchived !== undefined) {
        results = results.filter(c => c.isArchived === filters.showArchived);
      }
      
      if (filters.dateRange) {
        results = results.filter(c => 
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

  /**
   * Get conversation statistics
   */
  getConversationStats(): {
    total: number;
    active: number;
    archived: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
  } {
    const stats = {
      total: this.state.conversations.length,
      active: this.state.conversations.filter(c => !c.isArchived).length,
      archived: this.state.conversations.filter(c => c.isArchived).length,
      byProvider: {} as Record<string, number>,
      byModel: {} as Record<string, number>
    };

    this.state.conversations.forEach(conv => {
      // Count by provider
      stats.byProvider[conv.provider] = (stats.byProvider[conv.provider] || 0) + 1;
      
      // Count by model
      stats.byModel[conv.currentModel] = (stats.byModel[conv.currentModel] || 0) + 1;
    });

    return stats;
  }

  /**
   * Export conversation data
   */
  async exportConversation(conversationId: string): Promise<string> {
    try {
      const conversation = await this.storageService.loadConversation(conversationId);
      return JSON.stringify(conversation, null, 2);
    } catch (error) {
      console.error('Failed to export conversation:', error);
      throw error;
    }
  }

  /**
   * Import conversation data
   */
  async importConversation(jsonData: string): Promise<Conversation> {
    try {
      const conversation = JSON.parse(jsonData);
      
      // Validate conversation data
      if (!ConversationUtils.validateConversation(conversation)) {
        throw new Error('Invalid conversation format');
      }
      
      // Generate new ID to avoid conflicts
      conversation.id = ConversationUtils.generateId();
      conversation.createdAt = new Date();
      conversation.lastModified = new Date();
      
      // Save imported conversation
      await this.storageService.saveConversation(conversation);
      
      // Update state
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

  /**
   * Clean up old conversations
   */
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

  /**
   * Load conversations from storage
   */
  private async loadConversations(): Promise<void> {
    try {
      this.setState({ isLoading: true, error: null });
      
      // Clear existing conversations
      this.conversationCache.clear();
      
      // Load conversations from storage
      const conversations = await this.storageService.listConversations();
      
      // Update cache with conversation metadata
      conversations.forEach(conv => {
        this.conversationCache.set(conv.id, conv);
      });
      
      // Update state with the loaded conversations
      this.setState({ 
        conversations,
        isLoading: false,
        lastUpdated: new Date()
      });
      
    } catch (error) {
      console.error('Failed to load conversations:', error);
      this.setState({ 
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load conversations',
        lastUpdated: new Date()
      });
    }
  }

  /**
   * Set up auto-save functionality
   */
  private setupAutoSave(intervalSeconds: number): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(async () => {
      if (this.state.currentConversation) {
        try {
          await this.storageService.autoSaveConversation(this.state.currentConversation);
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    }, intervalSeconds * 1000);
  }

  /**
   * Update state and notify listeners
   */
  private setState(updates: Partial<ConversationState>): void {
    this.state = { ...this.state, ...updates };
    
    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    this.listeners.clear();
  }
}
