import { Conversation, Message } from '../types/conversation';

export class SimpleStorageService {
  private readonly CONVERSATION_PREFIX = 'conversation_';
  private readonly CONVERSATION_INDEX_KEY = 'conversation_index';

  constructor() {}

  async initialize(): Promise<void> {
    // No initialization needed for localStorage
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    try {
      // Update timestamps
      const now = new Date();
      conversation.lastModified = now;
      if (!conversation.createdAt) {
        conversation.createdAt = now;
      }
      
      // Ensure messages is an array
      conversation.messages = conversation.messages || [];
      
      // Save to localStorage
      const key = `${this.CONVERSATION_PREFIX}${conversation.id}`;
      localStorage.setItem(key, JSON.stringify(conversation));
      
      // Update index
      await this.updateConversationIndex(conversation);
    } catch (error) {
      console.error('Failed to save conversation:', error);
      throw error;
    }
  }

  async loadConversation(id: string): Promise<Conversation> {
    try {
      if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('Invalid conversation ID');
      }
      
      const key = `${this.CONVERSATION_PREFIX}${id}`;
      const data = localStorage.getItem(key);
      
      if (!data) {
        throw new Error('Conversation not found');
      }
      
      const conversation = JSON.parse(data);
      
      // Ensure basic structure
      if (!conversation.messages || !Array.isArray(conversation.messages)) {
        conversation.messages = [];
      }
      
      // Ensure required fields
      return {
        id: conversation.id || id,
        title: conversation.title || 'Untitled',
        messages: conversation.messages,
        provider: conversation.provider || 'default',
        currentModel: conversation.currentModel || 'default',
        isArchived: Boolean(conversation.isArchived),
        createdAt: conversation.createdAt ? new Date(conversation.createdAt) : new Date(),
        lastModified: conversation.lastModified ? new Date(conversation.lastModified) : new Date(),
        modelHistory: Array.isArray(conversation.modelHistory) ? conversation.modelHistory : []
      };
    } catch (error) {
      console.error('Failed to load conversation:', error);
      throw error;
    }
  }

  async listConversations(): Promise<Conversation[]> {
    try {
      const conversations: Conversation[] = [];
      const keys = Object.keys(localStorage);
      
      for (const key of keys) {
        if (key.startsWith(this.CONVERSATION_PREFIX)) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const conv = JSON.parse(data);
              // Only include minimal data in the list view
              conversations.push({
                id: conv.id || key.replace(this.CONVERSATION_PREFIX, ''),
                title: conv.title || 'Untitled',
                messages: [], // Don't include messages in list view
                provider: conv.provider || 'default',
                currentModel: conv.currentModel || 'default',
                isArchived: Boolean(conv.isArchived),
                createdAt: conv.createdAt ? new Date(conv.createdAt) : new Date(),
                lastModified: conv.lastModified ? new Date(conv.lastModified) : new Date(),
                modelHistory: [] // Don't include history in list view
              });
            }
          } catch (e) {
            console.error('Error parsing conversation:', key, e);
          }
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

  private async updateConversationIndex(conversation: Conversation): Promise<void> {
    try {
      // Read current index
      let index = {
        conversationIds: [] as string[],
        conversationMetadata: {} as Record<string, any>
      };
      
      const indexData = localStorage.getItem(this.CONVERSATION_INDEX_KEY);
      if (indexData) {
        try {
          const parsed = JSON.parse(indexData);
          if (parsed) {
            index = {
              conversationIds: Array.isArray(parsed.conversationIds) ? parsed.conversationIds : [],
              conversationMetadata: parsed.conversationMetadata || {}
            };
          }
        } catch (e) {
          console.warn('Failed to parse conversation index, resetting');
        }
      }
      
      // Update index if needed
      if (!index.conversationIds.includes(conversation.id)) {
        index.conversationIds.unshift(conversation.id);
      }
      
      // Update metadata
      index.conversationMetadata[conversation.id] = {
        title: conversation.title,
        provider: conversation.provider,
        currentModel: conversation.currentModel,
        isArchived: Boolean(conversation.isArchived),
        createdAt: conversation.createdAt ? conversation.createdAt.toISOString() : new Date().toISOString(),
        lastModified: conversation.lastModified ? conversation.lastModified.toISOString() : new Date().toISOString()
      };
      
      // Save updated index
      localStorage.setItem(this.CONVERSATION_INDEX_KEY, JSON.stringify(index));
    } catch (error) {
      console.error('Failed to update conversation index:', error);
    }
  }

  async deleteConversation(id: string): Promise<void> {
    try {
      const key = `${this.CONVERSATION_PREFIX}${id}`;
      localStorage.removeItem(key);
      
      // Update index
      const indexData = localStorage.getItem(this.CONVERSATION_INDEX_KEY);
      if (indexData) {
        try {
          const index = JSON.parse(indexData);
          if (index && Array.isArray(index.conversationIds)) {
            index.conversationIds = index.conversationIds.filter((cid: string) => cid !== id);
            if (index.conversationMetadata) {
              delete index.conversationMetadata[id];
            }
            localStorage.setItem(this.CONVERSATION_INDEX_KEY, JSON.stringify(index));
          }
        } catch (e) {
          console.error('Failed to update index after deletion:', e);
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw error;
    }
  }
}
