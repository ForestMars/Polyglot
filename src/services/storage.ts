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
      
      // Load only the metadata for each conversation
      const conversations: Conversation[] = [];
      for (const conversationId of index.conversationIds) {
        try {
          const conversationFile = `${this.conversationsDir}/${conversationId}.json`;
          const data = await this.readFile(conversationFile);
          const conversation = JSON.parse(data);
          
          // Only keep the metadata we need for the list view
          conversations.push({
            id: conversation.id,
            title: conversation.title || 'New Conversation',
            provider: conversation.provider,
            model: conversation.model,
            isArchived: conversation.isArchived || false,
            createdAt: new Date(conversation.createdAt),
            lastModified: new Date(conversation.lastModified),
            // Initialize empty arrays for the rest to maintain type safety
            messages: [],
            modelHistory: []
          });
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

  /**
   * Export localStorage data to downloadable files
   */
  async exportToFiles(): Promise<void> {
    try {
      // Export conversations
      const conversations = await this.listConversations();
      const conversationsData = JSON.stringify(conversations, null, 2);
      this.downloadFile('conversations.json', conversationsData);
      
      // Export settings (from localStorage)
      const settings = localStorage.getItem('polyglut_settings');
      if (settings) {
        this.downloadFile('settings.json', settings);
      }
      
      // Export storage index
      const indexData = await this.readFile(this.indexFile);
      this.downloadFile('storage-index.json', indexData);
      
      console.log('Data exported as downloadable files successfully');
    } catch (error) {
      console.error('Failed to export data to files:', error);
      throw new Error('Failed to export data to files');
    }
  }

  /**
   * Import data from uploaded files
   */
  async importFromFiles(files: FileList): Promise<void> {
    try {
      for (const file of Array.from(files)) {
        const content = await this.readUploadedFile(file);
        
        if (file.name === 'conversations.json') {
          const conversations = JSON.parse(content);
          // Clear existing conversations and import new ones
          for (const conversation of conversations) {
            await this.saveConversation(conversation);
          }
        } else if (file.name === 'settings.json') {
          const settings = JSON.parse(content);
          // Validate and import settings
          if (this.validateSettings(settings)) {
            localStorage.setItem('polyglut_settings', JSON.stringify(settings));
          }
        } else if (file.name === 'storage-index.json') {
          const index = JSON.parse(content);
          if (this.validateStorageIndex(index)) {
            await this.writeFile(this.indexFile, JSON.stringify(index, null, 2));
          }
        }
      }
      
      console.log('Data imported from files successfully');
    } catch (error) {
      console.error('Failed to import data from files:', error);
      throw new Error('Failed to import data from files');
    }
  }

  /**
   * Download a file to the user's system
   */
  private downloadFile(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Read content from an uploaded file
   */
  private readUploadedFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Validate settings data structure
   */
  private validateSettings(settings: any): boolean {
    // Basic validation - check if it has expected properties
    const requiredKeys = ['theme', 'sidebarCollapsed', 'showTimestamps'];
    return requiredKeys.every(key => key in settings);
  }

  /**
   * Validate storage index data structure
   */
  private validateStorageIndex(index: any): boolean {
    // Basic validation - check if it has expected properties
    return index && Array.isArray(index.conversationIds);
  }

  /**
   * Get data directory path
   */
  getDataDirectory(): string {
    return './data';
  }

  /**
   * List available export files
   */
  async listExportFiles(): Promise<string[]> {
    try {
      // In a real implementation, this would scan the data/ directory
      // For now, we'll return the expected files
      return [
        './data/conversations.json',
        './data/settings.json', 
        './data/storage-index.json'
      ];
    } catch (error) {
      console.error('Failed to list export files:', error);
      return [];
    }
  }
}
