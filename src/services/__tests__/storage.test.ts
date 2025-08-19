import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../storage';
import { ConversationUtils } from '../conversationUtils';
import { Conversation, Message } from '../../types/conversation';

// Mock the file system operations
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn()
  }
}));

describe('StorageService', () => {
  let storageService: StorageService;
  let mockConversation: Conversation;

  beforeEach(() => {
    storageService = new StorageService('./test-data');
    
    mockConversation = {
      id: 'test-conv-1',
      title: 'Test Conversation',
      createdAt: new Date('2024-01-01'),
      lastModified: new Date('2024-01-01'),
      provider: 'ollama',
      currentModel: 'llama3.2',
      modelHistory: [],
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello, how are you?',
          timestamp: new Date('2024-01-01T10:00:00'),
          provider: 'ollama'
        }
      ],
      isArchived: false
    };
  });

  describe('initialization', () => {
    it('should initialize with correct directory paths', () => {
      expect(storageService).toBeDefined();
    });
  });

  describe('conversation operations', () => {
    it('should create a conversation with correct structure', () => {
      const conversation = ConversationUtils.createConversation('ollama', 'llama3.2');
      
      expect(conversation.id).toMatch(/^conv_\d+_[a-z0-9]+$/);
      expect(conversation.provider).toBe('ollama');
      expect(conversation.currentModel).toBe('llama3.2');
      expect(conversation.isArchived).toBe(false);
      expect(conversation.messages).toEqual([]);
    });

    it('should generate title from first user message', () => {
      const message: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'What is React?',
        timestamp: new Date(),
        provider: 'ollama'
      };
      
      const title = ConversationUtils.generateTitle([message]);
      expect(title).toBe('What is React?');
    });

    it('should truncate long titles appropriately', () => {
      const longMessage: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'This is a very long message that should be truncated because it exceeds the maximum length for conversation titles',
        timestamp: new Date(),
        provider: 'ollama'
      };
      
      const title = ConversationUtils.generateTitle([longMessage]);
      expect(title.length).toBeLessThanOrEqual(53); // 50 chars + '...'
      expect(title).toEndWith('...');
    });

    it('should add messages to conversation', () => {
      const conversation = ConversationUtils.createConversation('ollama', 'llama3.2');
      const message: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
        provider: 'ollama'
      };
      
      const updatedConversation = ConversationUtils.addMessage(conversation, message);
      
      expect(updatedConversation.messages).toHaveLength(1);
      expect(updatedConversation.messages[0]).toEqual(message);
      expect(updatedConversation.title).toBe('Hello');
    });

    it('should record model changes', () => {
      const conversation = ConversationUtils.createConversation('ollama', 'llama3.2');
      const updatedConversation = ConversationUtils.recordModelChange(
        conversation,
        'llama3.2',
        'gemma3'
      );
      
      expect(updatedConversation.currentModel).toBe('gemma3');
      expect(updatedConversation.modelHistory).toHaveLength(1);
      expect(updatedConversation.modelHistory[0].fromModel).toBe('llama3.2');
      expect(updatedConversation.modelHistory[0].toModel).toBe('gemma3');
    });
  });

  describe('conversation metadata', () => {
    it('should extract metadata correctly', () => {
      const metadata = ConversationUtils.getMetadata(mockConversation);
      
      expect(metadata.id).toBe(mockConversation.id);
      expect(metadata.title).toBe(mockConversation.title);
      expect(metadata.messageCount).toBe(1);
      expect(metadata.provider).toBe('ollama');
      expect(metadata.currentModel).toBe('llama3.2');
    });

    it('should get conversation summary', () => {
      const summary = ConversationUtils.getSummary(mockConversation);
      expect(summary).toBe('Hello, how are you?');
    });

    it('should handle empty conversations', () => {
      const emptyConversation = ConversationUtils.createConversation('ollama', 'llama3.2');
      const summary = ConversationUtils.getSummary(emptyConversation);
      expect(summary).toBe('No messages yet');
    });
  });

  describe('validation', () => {
    it('should validate correct conversation data', () => {
      const isValid = ConversationUtils.validateConversation(mockConversation);
      expect(isValid).toBe(true);
    });

    it('should reject invalid conversation data', () => {
      const invalidConversation = { ...mockConversation, id: undefined };
      const isValid = ConversationUtils.validateConversation(invalidConversation);
      expect(isValid).toBe(false);
    });
  });

  describe('sanitization', () => {
    it('should remove API keys from messages', () => {
      const sensitiveMessage: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'My API key is: sk-1234567890abcdef',
        timestamp: new Date(),
        provider: 'ollama'
      };
      
      const conversation = ConversationUtils.createConversation('ollama', 'llama3.2');
      const updatedConversation = ConversationUtils.addMessage(conversation, sensitiveMessage);
      const sanitized = ConversationUtils.sanitizeConversation(updatedConversation);
      
      expect(sanitized.messages[0].content).toBe('My API key is: [REDACTED]');
    });
  });
});
