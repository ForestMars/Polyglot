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
// import { StorageService } from './storage';
import { indexedDbStorage } from './indexedDbStorage';
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
  private storageService: any; // Changed this to match what you're actually using
  private settingsService: SettingsService;
  private state: ConversationState;
  private listeners: Set<(state: ConversationState) => void>;
  private isInitialized = false;
  private conversationCache: Map<string, Conversation> = new Map();
  private loadingConversations: Set<string> = new Set();
  private cacheEnabled: boolean = true;
  private sessionMessages: Map<string, Message[]> = new Map(); // NEW: Store private messages by conversation ID

  constructor() {
    // Fixed: assign to storageService, not storage
    this.storageService = indexedDbStorage;  // Use the instance directly, don't call 'new'
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
        console.log('[StateManager] Detected conversations-updated event, reloading conversations from storage...');
        await this.loadConversations();
      });
    }
  }

  /**
   * Initialize the state manager
   */
  async initialize(cacheEnabled: boolean = true): Promise<void> {
    if (this.isInitialized) return;
    
    this.cacheEnabled = cacheEnabled;
    console.log(`[StateManager] Cache ${this.cacheEnabled ? 'enabled' : 'disabled'}`);

    try {
      this.setState({ isLoading: true, error: null });
      
      // Initialize storage
      await this.storageService.initialize();
      
      // Load settings
      const settings = await this.settingsService.loadSettings();
      
      // Load conversations
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

  /**
   * Get current state
   */
  getState(): Readonly<ConversationState> {
    return { ...this.state };
  }

  /**
   * Toggle cache on/off
   */
  toggleCache(): void {
    this.cacheEnabled = !this.cacheEnabled;
    if (!this.cacheEnabled) {
      this.conversationCache.clear();
      console.log('[StateManager] Cache disabled and cleared');
    } else {
      console.log('[StateManager] Cache enabled');
    }
  }

  /**
   * Check if cache is enabled
   */
  isCacheEnabled(): boolean {
    return this.cacheEnabled;
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
      // Immediately reload the conversation list from Dexie to ensure sidebar is up-to-date
      await this.loadConversations();
      // Set the new conversation as current
      this.setState({
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
    if (this.cacheEnabled && this.conversationCache.has(id)) {
      const cached = this.conversationCache.get(id)!;
      console.log(`[StateManager] Cache HIT for conversation ${id}`);
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
      if (this.cacheEnabled) {
        this.conversationCache.set(id, conversation);
        console.log(`[StateManager] Cached conversation ${id}`);
      }
      
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

    // Check for isPrivate flag and exit immediately if true.
    // The message will not be added to the in-memory state or persisted,
    // which prevents it from appearing in the UI sidebar.
    if (message.isPrivate) {
        console.log(`[StateManager] 🚨 Private message detected. Not adding to conversation state: ${this.state.currentConversation.id}`);
        // We still need to call setState to ensure the UI updates/unloads loading state
        // even though the message list won't change.
        this.setState({ lastUpdated: new Date() });
        return; 
    }

    try {
      // Create a deep copy of the current conversation
      const currentConv = JSON.parse(JSON.stringify(this.state.currentConversation));
      
      // Add the message using ConversationUtils
      const updatedConversation = ConversationUtils.addMessage(
        currentConv,
        message
      );
      
      // Ensure we have the latest timestamps
      updatedConversation.lastModified = new Date();
      
      // Save to storage
      console.log('Saving conversation to storage...');
      await this.storageService.saveConversation(updatedConversation);
      console.log('Conversation saved to storage');
      
      // Update cache
      if (this.cacheEnabled) {
        this.conversationCache.set(updatedConversation.id, updatedConversation);
        console.log(`[StateManager] Cached updated conversation ${updatedConversation.id}`);
      }
      
      // Update the conversations list
      const updatedConversations = this.state.conversations.map(conv => 
        conv.id === updatedConversation.id ? updatedConversation : conv
      );
      
      // If this is a new conversation, add it to the list
      if (!updatedConversations.some(conv => conv.id === updatedConversation.id)) {
        updatedConversations.unshift(updatedConversation);
      }
      
      // Update state in a single call to prevent race conditions
      this.setState({
        currentConversation: updatedConversation,
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
      
      // Update cache
      if (this.cacheEnabled) {
        this.conversationCache.set(updatedConversation.id, updatedConversation);
        console.log(`[StateManager] Cached model switch for conversation ${updatedConversation.id}`);
      }
    } catch (error) {
      console.error('Failed to switch model:', error);
      throw error;
    }
  }

  /**
   * Update conversation metadata (title, etc.)
   */
  async updateConversationMetadata(conversationId: string, updates: Partial<Pick<Conversation, 'title'>>): Promise<Conversation> {
    try {
      const conversation = this.state.conversations.find(conv => conv.id === conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      const updatedConversation = {
        ...conversation,
        ...updates,
        lastModified: new Date()
      };
      
      // Update current conversation if it's the one being updated
      if (this.state.currentConversation?.id === conversationId) {
        this.setState({
          currentConversation: updatedConversation,
          lastUpdated: new Date()
        });
      }
      
      // Update in conversations list
      const updatedConversations = this.state.conversations.map(conv =>
        conv.id === conversationId ? updatedConversation : conv
      );
      this.setState({ conversations: updatedConversations });
      
      // Save to storage
      await this.storageService.saveConversation(updatedConversation);
      
      // Update cache
      if (this.cacheEnabled) {
        this.conversationCache.set(conversationId, updatedConversation);
        console.log(`[StateManager] Cached metadata update for conversation ${conversationId}`);
      }
      
      return updatedConversation;
    } catch (error) {
      console.error('Failed to update conversation metadata:', error);
      throw error;
    }
  }

  /**
   * Archive/unarchive conversation
   */
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
      
      await this.storageService.saveConversation(updatedConversation);
      
      const updatedConversations = this.state.conversations.map(c => 
        c.id === conversationId ? updatedConversation : c
      );
      
      let currentConversation = this.state.currentConversation;
      if (updatedConversation.isArchived && currentConversation?.id === conversationId) {
        currentConversation = updatedConversations.find(c => !c.isArchived) || null;
      }
      
      this.setState({ 
        conversations: updatedConversations, 
        currentConversation,
        lastUpdated: new Date() 
      });
    } catch (error) {
      console.error('Failed to toggle archive status:', error);
      throw error;
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      // Clear from cache first to prevent any race conditions
      if (this.cacheEnabled) {
        console.log(`[StateManager] Pre-emptively clearing conversation ${conversationId} from cache`);
        this.conversationCache.delete(conversationId);
      }
      
      // Remove from storage
      await this.storageService.deleteConversation(conversationId);
      
      // Update state
      const updatedConversations = this.state.conversations.filter(
        c => c.id !== conversationId
      );
      
      // Clear current conversation if it was deleted
      let currentConversation = this.state.currentConversation;
      if (currentConversation?.id === conversationId) {
        currentConversation = updatedConversations[0] || null;
        
        // If we're deleting the current conversation, clear it immediately
        // to prevent auto-save from restoring it
        this.setState({
          currentConversation: null,
          lastUpdated: new Date()
        });
      }
      
      // Update state with the filtered conversations
      this.setState({
        conversations: updatedConversations,
        currentConversation,
        lastUpdated: new Date()
      });
      
      console.log(`[StateManager] Successfully deleted conversation ${conversationId}`);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      // Ensure cache is cleared even if storage operation fails
      if (this.cacheEnabled) {
        this.conversationCache.delete(conversationId);
      }
      throw error;
    }
  }

  /**
   * Search conversations
   */
  async searchConversations(filters: ConversationFilters): Promise<Conversation[]> {
    try {
      console.log(`[StateManager] Searching conversations with filters:`, {
        searchQuery: filters.searchQuery,
        provider: filters.provider,
        model: filters.model,
        showArchived: filters.showArchived,
        dateRange: filters.dateRange ? 'set' : 'not set'
      });
      
      // Always load fresh conversations from storage to ensure we have the latest data
      const showArchived = filters.showArchived !== undefined ? 
        filters.showArchived : 
        (await this.settingsService.loadSettings()).showArchivedChats || false;
      
      console.log(`[StateManager] Loading conversations with showArchived=${showArchived}`);
      
      // Get conversations from storage with the correct archived filter
      let results = await this.storageService.listConversations(showArchived);
      
      // Apply additional filters
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        results = results.filter(conv => 
          conv.title.toLowerCase().includes(query) ||
          conv.messages.some(msg => msg.content.toLowerCase().includes(query))
        );
      }
      
      if (filters.provider) {
        results = results.filter(c => c.provider === filters.provider);
      }
      
      if (filters.model) {
        results = results.filter(c => c.currentModel === filters.model);
      }
      
      // No need to filter by showArchived here since we already did it in listConversations
      
      if (filters.dateRange) {
        results = results.filter(c => 
          c.lastModified >= filters.dateRange!.start && 
          c.lastModified <= filters.dateRange!.end
        );
      }
      
      console.log(`[StateManager] Found ${results.length} conversations matching filters`);
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
      
      // Get current settings to check if we should show archived conversations
      const settings = await this.settingsService.loadSettings();
      const showArchived = settings.showArchivedChats || false;
      
      console.log(`[StateManager] Loading conversations (showArchived: ${showArchived})`);
      
      // Always clear the cache before loading fresh data
      if (this.cacheEnabled) {
        const previousCacheSize = this.conversationCache.size;
        this.conversationCache.clear();
        console.log(`[StateManager] Cleared conversation cache (was ${previousCacheSize} items)`);
      }
      
      // Load fresh conversations from storage, respecting the showArchived setting
      const conversations = await this.storageService.listConversations(showArchived);
      console.log(`[StateManager] Loaded ${conversations.length} conversations from storage`);
      
      // Update cache with the fresh data
      if (this.cacheEnabled) {
        conversations.forEach(conv => {
          this.conversationCache.set(conv.id, conv);
        });
        console.log(`[StateManager] Cached ${this.conversationCache.size} conversations`);
      }
      
      // Update state with the loaded conversations
      this.setState({ 
        conversations,
        isLoading: false,
        lastUpdated: new Date()
      });
      
    } catch (error) {
      console.error('Failed to load conversations:', error);
      // On error, clear the cache to prevent stale data
      if (this.cacheEnabled) {
        this.conversationCache.clear();
      }
      
      this.setState({ 
        conversations: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load conversations',
        lastUpdated: new Date()
      });
    }
  }

  /**
   * Update state and notify listeners
   */
  private setState(updates: Partial<ConversationState>): void {
    const prevConvs = this.state.conversations?.map(c => c.id) || [];
    this.state = { ...this.state, ...updates };
    const newConvs = this.state.conversations?.map(c => c.id) || [];
    console.log('[StateManager] setState called. Previous conv IDs:', prevConvs, 'New conv IDs:', newConvs, 'Current:', this.state.currentConversation?.id);
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
    this.listeners.clear();
  }
}