import { Conversation, ModelChange, Message, UserSettings, ConversationMetadata, StorageIndex } from '../types/conversation';

export class StorageService {
  private baseDir: string;
  private conversationsDir: string;
  private settingsFile: string;
  private indexFile: string;

  constructor(baseDir: string = './data') {
    this.baseDir = baseDir;
    this.conversationsDir = `${baseDir}/conversations`;
    this.settingsFile = `${baseDir}/settings.json`;
    this.indexFile = `${this.conversationsDir}/index.json`;
  }

  /**
   * Initialize storage directories and files
   */
  async initialize(): Promise<void> {
    try {
      // Create base directory if it doesn't exist
      await this.ensureDirectoryExists(this.baseDir);
      
      // Create conversations directory
      await this.ensureDirectoryExists(this.conversationsDir);
      
      // Create index file if it doesn't exist
      await this.ensureIndexFile();
      
      // Create settings file if it doesn't exist
      await this.ensureSettingsFile();
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw new Error('Storage initialization failed');
    }
  }

  /**
   * Conversation CRUD Operations
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    try {
      // Update lastModified timestamp
      conversation.lastModified = new Date();
      
      // Save conversation file
      const conversationFile = `${this.conversationsDir}/${conversation.id}.json`;
      await this.writeFile(conversationFile, JSON.stringify(conversation, null, 2));
      
      // Update index
      await this.updateConversationIndex(conversation);
    } catch (error) {
      console.error('Failed to save conversation:', error);
      throw new Error('Failed to save conversation');
    }
  }

  async loadConversation(id: string): Promise<Conversation> {
    try {
      const conversationFile = `${this.conversationsDir}/${id}.json`;
      const data = await this.readFile(conversationFile);
      const conversation = JSON.parse(data);
      
      // Convert date strings back to Date objects
      conversation.createdAt = new Date(conversation.createdAt);
      conversation.lastModified = new Date(conversation.lastModified);
      conversation.messages = conversation.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      conversation.modelHistory = conversation.modelHistory.map((change: any) => ({
        ...change,
        timestamp: new Date(change.timestamp)
      }));
      
      return conversation;
    } catch (error) {
      console.error('Failed to load conversation:', error);
      throw new Error('Failed to load conversation');
    }
  }

  async listConversations(): Promise<Conversation[]> {
    try {
      const indexData = await this.readFile(this.indexFile);
      const index = JSON.parse(indexData);
      
      // Load conversation metadata (without full message content)
      const conversations: Conversation[] = [];
      for (const conversationId of index.conversationIds) {
        try {
          const conversation = await this.loadConversation(conversationId);
          conversations.push(conversation);
        } catch (error) {
          console.warn(`Failed to load conversation ${conversationId}:`, error);
          // Continue loading other conversations
        }
      }
      
      // Sort by last modified (newest first)
      return conversations.sort((a, b) => 
        b.lastModified.getTime() - a.lastModified.getTime()
      );
    } catch (error) {
      console.error('Failed to list conversations:', error);
      return [];
    }
  }

  async deleteConversation(id: string): Promise<void> {
    try {
      // Remove conversation file
      const conversationFile = `${this.conversationsDir}/${id}.json`;
      await this.deleteFile(conversationFile);
      
      // Update index
      await this.removeFromConversationIndex(id);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw new Error('Failed to delete conversation');
    }
  }

  async archiveConversation(id: string): Promise<void> {
    try {
      const conversation = await this.loadConversation(id);
      conversation.isArchived = true;
      await this.saveConversation(conversation);
    } catch (error) {
      console.error('Failed to archive conversation:', error);
      throw new Error('Failed to archive conversation');
    }
  }

  async unarchiveConversation(id: string): Promise<void> {
    try {
      const conversation = await this.loadConversation(id);
      conversation.isArchived = false;
      await this.saveConversation(conversation);
    } catch (error) {
      console.error('Failed to unarchive conversation:', error);
      throw new Error('Failed to unarchive conversation');
    }
  }

  /**
   * Settings Operations
   */
  async saveSettings(settings: UserSettings): Promise<void> {
    try {
      await this.writeFile(this.settingsFile, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  async loadSettings(): Promise<UserSettings> {
    try {
      const data = await this.readFile(this.settingsFile);
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Return default settings
      return this.getDefaultSettings();
    }
  }

  /**
   * Utility Methods
   */
  private async ensureDirectoryExists(dir: string): Promise<void> {
    // This would use Node.js fs API in a real implementation
    // For now, we'll assume the directory exists or can be created
    console.log(`Ensuring directory exists: ${dir}`);
  }

  private async ensureIndexFile(): Promise<void> {
    try {
      await this.readFile(this.indexFile);
    } catch {
      // Create empty index file
      const index = { conversationIds: [] };
      await this.writeFile(this.indexFile, JSON.stringify(index, null, 2));
    }
  }

  private async ensureSettingsFile(): Promise<void> {
    try {
      await this.readFile(this.settingsFile);
    } catch {
      // Create default settings file
      const defaultSettings = this.getDefaultSettings();
      await this.writeFile(this.settingsFile, JSON.stringify(defaultSettings, null, 2));
    }
  }

  private async updateConversationIndex(conversation: Conversation): Promise<void> {
    try {
      const indexData = await this.readFile(this.indexFile);
      const index = JSON.parse(indexData);
      
      if (!index.conversationIds.includes(conversation.id)) {
        index.conversationIds.push(conversation.id);
        await this.writeFile(this.indexFile, JSON.stringify(index, null, 2));
      }
    } catch (error) {
      console.error('Failed to update conversation index:', error);
    }
  }

  private async removeFromConversationIndex(id: string): Promise<void> {
    try {
      const indexData = await this.readFile(this.indexFile);
      const index = JSON.parse(indexData);
      
      index.conversationIds = index.conversationIds.filter((cid: string) => cid !== id);
      await this.writeFile(this.indexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      console.error('Failed to remove from conversation index:', error);
    }
  }

  private getDefaultSettings(): UserSettings {
    return {
      selectedProvider: 'ollama',
      selectedModel: 'llama3.2',
      selectedApiKey: '',
      showArchivedChats: false,
      ollamaBaseUrl: 'http://localhost:11434'
    };
  }

  /**
   * File I/O Methods using Web Storage APIs
   */
  private async writeFile(path: string, content: string): Promise<void> {
    try {
      // Use localStorage for web environment
      const key = this.getStorageKey(path);
      localStorage.setItem(key, content);
    } catch (error) {
      console.error(`Failed to write file ${path}:`, error);
      throw new Error(`Failed to write file: ${error}`);
    }
  }

  private async readFile(path: string): Promise<string> {
    try {
      // Use localStorage for web environment
      const key = this.getStorageKey(path);
      const content = localStorage.getItem(key);
      if (content === null) {
        throw new Error('File not found');
      }
      return content;
    } catch (error) {
      console.error(`Failed to read file ${path}:`, error);
      throw new Error(`Failed to read file: ${error}`);
    }
  }

  private async deleteFile(path: string): Promise<void> {
    try {
      // Use localStorage for web environment
      const key = this.getStorageKey(path);
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to delete file ${path}:`, error);
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  private async ensureDirectoryExists(dir: string): Promise<void> {
    // In web environment, directories are virtual - just ensure storage is available
    try {
      // Test localStorage availability
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
    } catch (error) {
      throw new Error('Local storage is not available');
    }
  }

  /**
   * Convert file path to localStorage key
   */
  private getStorageKey(path: string): string {
    // Convert file path to a valid localStorage key
    return `polyglut_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * Auto-save functionality
   */
  async autoSaveConversation(conversation: Conversation): Promise<void> {
    try {
      await this.saveConversation(conversation);
    } catch (error) {
      console.error('Auto-save failed:', error);
      // Don't throw error for auto-save failures
    }
  }

  /**
   * Search and filter conversations
   */
  async searchConversations(query: string): Promise<Conversation[]> {
    try {
      const conversations = await this.listConversations();
      const lowerQuery = query.toLowerCase();
      
      return conversations.filter(conversation => 
        conversation.title.toLowerCase().includes(lowerQuery) ||
        conversation.messages.some(msg => 
          msg.content.toLowerCase().includes(lowerQuery)
        )
      );
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  async getConversationsByProvider(provider: string): Promise<Conversation[]> {
    try {
      const conversations = await this.listConversations();
      return conversations.filter(conversation => 
        conversation.provider === provider
      );
    } catch (error) {
      console.error('Filter by provider failed:', error);
      return [];
    }
  }

  async getConversationsByModel(model: string): Promise<Conversation[]> {
    try {
      const conversations = await this.listConversations();
      return conversations.filter(conversation => 
        conversation.currentModel === model
      );
    } catch (error) {
      console.error('Filter by model failed:', error);
      return [];
    }
  }
}
