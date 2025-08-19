import { Conversation, Message, ModelChange } from '../types/conversation';

export class ConversationUtils {
  /**
   * Generate a unique conversation ID
   */
  static generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a conversation title from the first user message
   */
  static generateTitle(messages: Message[]): string {
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    
    if (!firstUserMessage) {
      return `New Chat ${new Date().toLocaleDateString()}`;
    }

    const content = firstUserMessage.content.trim();
    
    // If message is short, use it directly
    if (content.length <= 50) {
      return content;
    }
    
    // If message is longer, truncate and add ellipsis
    if (content.length <= 100) {
      return content.substring(0, 50) + '...';
    }
    
    // For very long messages, take first sentence or first 50 chars
    const firstSentence = content.match(/^[^.!?]+[.!?]/);
    if (firstSentence) {
      const sentence = firstSentence[0].trim();
      return sentence.length <= 50 ? sentence : sentence.substring(0, 50) + '...';
    }
    
    return content.substring(0, 50) + '...';
  }

  /**
   * Create a new conversation
   */
  static createConversation(
    provider: string,
    model: string,
    initialMessage?: Message
  ): Conversation {
    const messages = initialMessage ? [initialMessage] : [];
    const id = this.generateId();
    
    return {
      id,
      title: this.generateTitle(messages),
      createdAt: new Date(),
      lastModified: new Date(),
      provider,
      currentModel: model,
      modelHistory: [],
      messages,
      isArchived: false
    };
  }

  /**
   * Add a message to a conversation
   */
  static addMessage(conversation: Conversation, message: Message): Conversation {
    const updatedConversation = {
      ...conversation,
      messages: [...conversation.messages, message],
      lastModified: new Date()
    };

    // Update title if this is the first user message
    if (message.role === 'user' && conversation.messages.length === 0) {
      updatedConversation.title = this.generateTitle([message]);
    }

    return updatedConversation;
  }

  /**
   * Record a model change in the conversation
   */
  static recordModelChange(
    conversation: Conversation,
    fromModel: string,
    toModel: string
  ): Conversation {
    const modelChange: ModelChange = {
      timestamp: new Date(),
      fromModel,
      toModel,
      messageIndex: conversation.messages.length
    };

    return {
      ...conversation,
      currentModel: toModel,
      modelHistory: [...conversation.modelHistory, modelChange],
      lastModified: new Date()
    };
  }

  /**
   * Get conversation metadata (without full message content)
   */
  static getMetadata(conversation: Conversation) {
    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      lastModified: conversation.lastModified,
      provider: conversation.provider,
      currentModel: conversation.currentModel,
      messageCount: conversation.messages.length,
      isArchived: conversation.isArchived
    };
  }

  /**
   * Check if a conversation has unread messages
   */
  static hasUnreadMessages(conversation: Conversation, lastReadIndex: number = -1): boolean {
    return conversation.messages.length > lastReadIndex + 1;
  }

  /**
   * Get the last message in a conversation
   */
  static getLastMessage(conversation: Conversation): Message | null {
    if (conversation.messages.length === 0) {
      return null;
    }
    return conversation.messages[conversation.messages.length - 1];
  }

  /**
   * Get conversation summary for display
   */
  static getSummary(conversation: Conversation): string {
    const lastMessage = this.getLastMessage(conversation);
    if (!lastMessage) {
      return 'No messages yet';
    }

    const content = lastMessage.content;
    if (content.length <= 100) {
      return content;
    }

    return content.substring(0, 100) + '...';
  }

  /**
   * Validate conversation data
   */
  static validateConversation(conversation: any): conversation is Conversation {
    return (
      typeof conversation === 'object' &&
      conversation !== null &&
      typeof conversation.id === 'string' &&
      typeof conversation.title === 'string' &&
      conversation.createdAt instanceof Date &&
      conversation.lastModified instanceof Date &&
      typeof conversation.provider === 'string' &&
      typeof conversation.currentModel === 'string' &&
      Array.isArray(conversation.modelHistory) &&
      Array.isArray(conversation.messages) &&
      typeof conversation.isArchived === 'boolean'
    );
  }

  /**
   * Sanitize conversation data (remove sensitive information)
   */
  static sanitizeConversation(conversation: Conversation): Conversation {
    return {
      ...conversation,
      messages: conversation.messages.map(msg => ({
        ...msg,
        // Remove any potential sensitive data from message content
        content: msg.content.replace(/api[_-]?key\s*[:=]\s*[^\s]+/gi, 'api_key: [REDACTED]')
      }))
    };
  }
}
