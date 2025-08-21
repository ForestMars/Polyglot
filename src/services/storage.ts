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

  // Conversation CRUD Operations
  async saveConversation(conversation: Conversation): Promise<void> {
    const key = `${CONVERSATION_PREFIX}${conversation.id}`;
    
    console.log(`[Storage] Saving conversation ${conversation.id} with key ${key}`);
    console.log(`[Storage] Conversation title: "${conversation.title}", isArchived: ${conversation.isArchived}`);
    
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
    console.log(`[Storage] Saved conversation ${conversation.id} to localStorage`);
    
    // Verify it was saved
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log(`[Storage] Verification: saved title "${parsed.title}", isArchived: ${parsed.isArchived}`);
    } else {
      console.error(`[Storage] ERROR: Conversation ${conversation.id} was not saved!`);
    }
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

  async listConversations(includeArchived: boolean = false): Promise<Conversation[]> {
    const conversations: Conversation[] = [];
    console.log(`[Storage] Listing conversations (includeArchived: ${includeArchived})`);
    
    // First, log all keys for debugging
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CONVERSATION_PREFIX)) {
        try {
          const id = key.replace(CONVERSATION_PREFIX, '');
          const data = localStorage.getItem(key);
          
          if (!data) continue;
          
          // Quick parse to check if archived without full deserialization
          const partial = JSON.parse(data);
          
          // Skip archived conversations unless explicitly requested
          if (!includeArchived && partial.isArchived) {
            console.log(`[Storage] Skipping archived conversation ${id}`);
            continue;
          }
          
          // Only load and deserialize the full conversation if needed
          const conversation = await this.loadConversation(id);
          conversations.push(conversation);
          
        } catch (error) {
          console.error(`Error loading conversation from key ${key}:`, error);
          // Try to clean up corrupted data
          if (key) {
            console.log(`[Storage] Removing corrupted conversation: ${key}`);
            localStorage.removeItem(key);
          }
          continue;
        }
      }
    }
    
    // Sort by lastModified (newest first)
    const sorted = conversations.sort((a, b) => 
      b.lastModified.getTime() - a.lastModified.getTime()
    );
    
    console.log(`[Storage] Found ${sorted.length} conversations`);
    return sorted;
  }

  async deleteConversation(id: string): Promise<void> {
    const key = `${CONVERSATION_PREFIX}${id}`;
    console.log(`[Storage] Deleting conversation ${id} with key ${key}`);
    localStorage.removeItem(key);
    console.log(`[Storage] Deleted conversation ${id}, localStorage now has ${localStorage.length} items`);
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
