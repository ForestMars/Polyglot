import { Conversation, UserSettings } from '../types/conversation';

const CONVERSATION_PREFIX = 'conversation_';
const SETTINGS_KEY = 'user_settings';

export class StorageService {
  /**
   * Initialize the storage service
   * This is a no-op for localStorage but required by the interface
   */
  async initialize(): Promise<void> {
    // No initialization needed for localStorage
  }

  async autoSaveConversation(conversation: Conversation): Promise<void> {
    await this.saveConversation(conversation);
  }

  // Conversation CRUD Operations
  async saveConversation(conversation: Conversation): Promise<void> {
    const key = `${CONVERSATION_PREFIX}${conversation.id}`;
    
    // Ensure messages is an array
    if (!Array.isArray(conversation.messages)) {
      conversation.messages = [];
    }
    
    // Ensure timestamps are set and properly serialized
    const now = new Date();
    conversation.lastModified = now;
    if (!conversation.createdAt) {
      conversation.createdAt = now;
    }

    // Prepare the data for storage with proper date handling
    const dataToStore = {
      ...conversation,
      createdAt: (conversation.createdAt instanceof Date ? conversation.createdAt : new Date(conversation.createdAt)).toISOString(),
      lastModified: (conversation.lastModified instanceof Date ? conversation.lastModified : new Date(conversation.lastModified)).toISOString(),
      messages: conversation.messages.map(msg => ({
        ...msg,
        timestamp: (msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)).toISOString()
      }))
    };
    
    // Save to localStorage
    localStorage.setItem(key, JSON.stringify(dataToStore));
  }

  async loadConversation(id: string): Promise<Conversation> {
    const key = `${CONVERSATION_PREFIX}${id}`;
    const data = localStorage.getItem(key);
    
    if (!data) {
      throw new Error(`Conversation not found: ${id}`);
    }

    const parsed = JSON.parse(data);
    
    // Convert string dates back to Date objects
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      lastModified: new Date(parsed.lastModified),
      messages: parsed.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    };
  }

  async listConversations(): Promise<Conversation[]> {
    const conversations: Conversation[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CONVERSATION_PREFIX)) {
        try {
          const id = key.replace(CONVERSATION_PREFIX, '');
          const conversation = await this.loadConversation(id);
          conversations.push(conversation);
        } catch (error) {
          console.error(`Error loading conversation from key ${key}:`, error);
          continue;
        }
      }
    }
    
    return conversations.sort((a, b) => 
      b.lastModified.getTime() - a.lastModified.getTime()
    );
  }

  async deleteConversation(id: string): Promise<void> {
    const key = `${CONVERSATION_PREFIX}${id}`;
    localStorage.removeItem(key);
  }

  async archiveConversation(id: string): Promise<void> {
    const conversation = await this.loadConversation(id);
    conversation.isArchived = true;
    await this.saveConversation(conversation);
  }

  async unarchiveConversation(id: string): Promise<void> {
    const conversation = await this.loadConversation(id);
    conversation.isArchived = false;
    await this.saveConversation(conversation);
  }

  // Settings Operations
  async saveSettings(settings: UserSettings): Promise<void> {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  async loadSettings(): Promise<UserSettings> {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) {
      return this.getDefaultSettings();
    }
    return JSON.parse(data);
  }

  private getDefaultSettings(): UserSettings {
    return {
      selectedProvider: 'ollama',
      selectedModel: 'llama3.2',
      selectedApiKey: '',
      showArchivedChats: false,
      ollamaBaseUrl: 'http://localhost:11434',
    };
  }
}
