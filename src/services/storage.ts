import { Conversation, ModelChange, Message, UserSettings, ConversationMetadata, StorageIndex } from '../types/conversation';
import { createLogger } from '../utils/logger';

const logger = createLogger('StorageService');

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
    const context = { 
      conversationId: conversation.id,
      messageCount: conversation.messages?.length || 0,
      title: conversation.title
    };
    
    try {
      logger.debug('Saving conversation', context);
      
      // Update lastModified timestamp
      conversation.lastModified = new Date();
      
      // Save conversation file
      const conversationFile = `${this.conversationsDir}/${conversation.id}.json`;
      const conversationData = JSON.stringify(conversation, null, 2);
      
      logger.debug('Writing conversation data', { 
        ...context, 
        dataLength: conversationData.length 
      });
      
      await this.writeFile(conversationFile, conversationData);
      
      logger.debug('Updating conversation index', context);
      await this.updateConversationIndex(conversation);
      
      logger.info('Successfully saved conversation', context);
    } catch (error) {
      logger.error('Failed to save conversation', error as Error, context);
      console.error('[StorageService] Failed to save conversation:', error);
      throw new Error(`Failed to save conversation: ${error.message}`);
    }
  }

  async loadConversation(id: string): Promise<Conversation> {
    try {
      console.log(`[StorageService] Loading conversation ${id}`);
      
      // Validate ID format
      if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Invalid conversation ID');
      }
      
      const conversationFile = `${this.conversationsDir}/${id}.json`;
      console.log(`[StorageService] Loading from file: ${conversationFile}`);
      
      // Read and parse the file
      const data = await this.readFile(conversationFile);
      if (!data) {
        throw new Error('Empty conversation data');
      }
      
      const conversation = JSON.parse(data);
      
      // Validate conversation structure
      if (!conversation.messages || !Array.isArray(conversation.messages)) {
        console.error('[StorageService] Invalid conversation format - missing messages array');
        conversation.messages = []; // Ensure messages is always an array
      }
      
      if (!conversation.id || conversation.id !== id) {
        console.warn(`[StorageService] Conversation ID mismatch: expected ${id}, got ${conversation.id}`);
        conversation.id = id; // Ensure ID consistency
      }
      
      // Convert date strings back to Date objects
      try {
        conversation.createdAt = new Date(conversation.createdAt || Date.now());
        conversation.lastModified = new Date(conversation.lastModified || Date.now());
        
        // Safely process messages
        conversation.messages = (conversation.messages || []).map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          content: msg.content || '',
          role: msg.role || 'user'
        }));
        
        // Safely process model history
        conversation.modelHistory = (conversation.modelHistory || []).map((change: any) => ({
          ...change,
          timestamp: change.timestamp ? new Date(change.timestamp) : new Date()
        }));
      } catch (dateError) {
        console.error('[StorageService] Error parsing dates:', dateError);
        // Ensure we still return a valid conversation even if date parsing fails
        conversation.createdAt = new Date(conversation.createdAt || Date.now());
        conversation.lastModified = new Date(conversation.lastModified || Date.now());
      }
      
      console.log(`[StorageService] Successfully loaded conversation ${id} with ${conversation.messages.length} messages`);
      return conversation;
      
    } catch (error) {
      console.error(`[StorageService] Failed to load conversation ${id}:`, error);
      console.error('[StorageService] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Try to recover by returning a new conversation with the given ID
      if (error.message.includes('not found') || error.message.includes('File not found')) {
        console.warn(`[StorageService] Creating new conversation for missing ID: ${id}`);
        return {
          id,
          title: 'New Conversation',
          messages: [],
          modelHistory: [],
          provider: 'default',
          currentModel: 'default',
          isArchived: false,
          createdAt: new Date(),
          lastModified: new Date()
        };
      }
      
      throw new Error(`Failed to load conversation: ${error.message}`);
    }
  }

  async listConversations(): Promise<Conversation[]> {
    try {
      // Ensure index file exists
      await this.ensureIndexFile();
      
      // Read index file
      const indexData = await this.readFile(this.indexFile);
      const index: StorageIndex = JSON.parse(indexData);
      
      if (!index.conversationIds || index.conversationIds.length === 0) {
        return [];
      }
      
      // Create lightweight conversation objects from metadata
      const conversations: Conversation[] = [];
      for (const conversationId of index.conversationIds) {
        try {
          const metadata = index.conversationMetadata?.[conversationId];
          if (!metadata) {
            console.warn(`Missing metadata for conversation ${conversationId}, loading full conversation`);
            const fullConversation = await this.loadConversation(conversationId);
            conversations.push(fullConversation);
            continue;
          }
          
          // Create lightweight conversation object from metadata
          const conversation: Conversation = {
            id: conversationId,
            title: metadata.title,
            provider: metadata.provider,
            currentModel: metadata.currentModel,
            isArchived: metadata.isArchived || false,
            createdAt: new Date(metadata.createdAt),
            lastModified: new Date(metadata.lastModified),
            messages: [], // Empty messages array for list view
            modelHistory: [] // Empty history for list view
          };
          
          conversations.push(conversation);
        } catch (error) {
          console.warn(`Failed to process conversation ${conversationId}:`, error);
          // Continue with other conversations
        }
      }
      
      // Sort by lastModified (newest first)
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
      // Try to read existing index file
      const data = await this.readFile(this.indexFile);
      const index = JSON.parse(data);
      
      // Validate and repair index structure if needed
      const needsRepair = !index.conversationIds || !Array.isArray(index.conversationIds);
      
      if (needsRepair) {
        console.warn('Index file has invalid structure, repairing...');
        const validIndex: StorageIndex = {
          version: 1,
          conversationIds: [],
          conversationMetadata: {},
          lastUpdated: new Date().toISOString()
        };
        await this.writeFile(this.indexFile, JSON.stringify(validIndex, null, 2));
      }
    } catch (error) {
      // Create new index file with proper structure
      console.log('Creating new index file...');
      const newIndex: StorageIndex = {
        version: 1,
        conversationIds: [],
        conversationMetadata: {},
        lastUpdated: new Date().toISOString()
      };
      await this.writeFile(this.indexFile, JSON.stringify(newIndex, null, 2));
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
      // Ensure index file exists
      await this.ensureIndexFile();
      
      // Read current index
      const indexData = await this.readFile(this.indexFile);
      const index: StorageIndex = JSON.parse(indexData);
      
      // Initialize arrays if they don't exist
      if (!index.conversationIds) {
        index.conversationIds = [];
      }
      if (!index.conversationMetadata) {
        index.conversationMetadata = {};
      }
      
      // Add or update conversation in index
      if (!index.conversationIds.includes(conversation.id)) {
        // New conversation - add to beginning of array
        index.conversationIds.unshift(conversation.id);
      } else {
        // Existing conversation - move to beginning of array
        index.conversationIds = [
          conversation.id,
          ...index.conversationIds.filter(id => id !== conversation.id)
        ];
      }
      
      // Update conversation metadata
      // Ensure createdAt is a Date object
      const createdAtDate = typeof conversation.createdAt === 'string' 
        ? new Date(conversation.createdAt) 
        : conversation.createdAt;
      
      const metadata: Omit<ConversationMetadata, 'id'> = {
        title: conversation.title,
        provider: conversation.provider,
        currentModel: conversation.currentModel,
        isArchived: conversation.isArchived || false,
        createdAt: createdAtDate.toISOString(),
        lastModified: new Date().toISOString(),
        messageCount: conversation.messages?.length || 0  // Add null check for messages
      };
      
      // Initialize if needed and update
      if (!index.conversationMetadata) {
        index.conversationMetadata = {};
      }
      index.conversationMetadata[conversation.id] = metadata;
      
      // Update index timestamp
      index.lastUpdated = new Date().toISOString();
      
      // Save updated index
      await this.writeFile(this.indexFile, JSON.stringify(index, null, 2));
      
      console.log(`[StorageService] Updated conversation index for ${conversation.id}`);
    } catch (error) {
      console.error('[StorageService] Failed to update conversation index:', error);
      throw error; // Re-throw to handle in the calling function
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
    const context = { path, contentLength: content.length };
    
    try {
      // Use localStorage for web environment
      const key = this.getStorageKey(path);
      logger.debug('Writing to storage', { ...context, key });
      
      // Test if localStorage is available
      const testKey = '__storage_test__';
      try {
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
      } catch (e) {
        const error = e as Error;
        logger.error('LocalStorage test failed', error, { testKey });
        throw new Error('LocalStorage is not available or full');
      }
      
      // Save the actual content
      localStorage.setItem(key, content);
      
      // Verify the write
      const savedContent = localStorage.getItem(key);
      if (savedContent !== content) {
        const error = new Error('Write verification failed - data corruption detected');
        logger.error('Write verification failed', error, {
          ...context,
          expectedLength: content.length,
          actualLength: savedContent?.length || 0,
          key
        });
        throw error;
      }
      
      logger.debug('Successfully wrote to storage', { key });
    } catch (error) {
      const storageKeys = Object.keys(localStorage).filter(k => k.startsWith('polyglut_'));
      logger.error('Failed to write file', error as Error, {
        ...context,
        availableKeys: storageKeys,
        storageSize: JSON.stringify(localStorage).length
      });
      throw error;
    }
  }

  private async readFile(path: string): Promise<string> {
    const context = { path };
    
    try {
      // Use localStorage for web environment
      const key = this.getStorageKey(path);
      logger.debug('Reading from storage', { ...context, key });
      
      const content = localStorage.getItem(key);
      if (content === null) {
        const availableKeys = Object.keys(localStorage).filter(k => k.startsWith('polyglut_'));
        const error = new Error(`File not found: ${path}`);
        logger.error('Key not found in storage', error, { 
          ...context, 
          key, 
          availableKeys,
          storageSize: JSON.stringify(localStorage).length
        });
        throw error;
      }
      
      logger.debug('Successfully read from storage', { 
        ...context, 
        key, 
        contentLength: content.length 
      });
      
      return content;
    } catch (error) {
      const storageKeys = Object.keys(localStorage).filter(k => k.startsWith('polyglut_'));
      logger.error('Failed to read file', error as Error, { 
        ...context,
        availableKeys: storageKeys,
        storageSize: JSON.stringify(localStorage).length
      });
      throw error;
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
    // Original key generation logic
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
