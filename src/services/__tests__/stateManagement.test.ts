import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConversationStateManager } from '../conversationStateManager';
import { SettingsService, AppSettings } from '../settingsService';
import { StorageService } from '../storage';
import { ConversationUtils } from '../conversationUtils';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock the storage service
vi.mock('../storage', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    saveConversation: vi.fn().mockResolvedValue(undefined),
    loadConversation: vi.fn().mockResolvedValue({
      id: 'test-conv',
      title: 'Test Conversation',
      createdAt: new Date(),
      lastModified: new Date(),
      provider: 'ollama',
      currentModel: 'llama3.2',
      modelHistory: [],
      messages: [],
      isArchived: false
    }),
    listConversations: vi.fn().mockResolvedValue([]),
    archiveConversation: vi.fn().mockResolvedValue(undefined),
    unarchiveConversation: vi.fn().mockResolvedValue(undefined),
    deleteConversation: vi.fn().mockResolvedValue(undefined),
    searchConversations: vi.fn().mockResolvedValue([]),
    autoSaveConversation: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('SettingsService', () => {
  let settingsService: SettingsService;

  beforeEach(() => {
    settingsService = new SettingsService();
    vi.clearAllMocks();
  });

  describe('loadSettings', () => {
    it('should load default settings when none exist', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const settings = await settingsService.loadSettings();
      
      expect(settings.selectedProvider).toBe('ollama');
      expect(settings.selectedModel).toBe('llama3.2');
      expect(settings.theme).toBe('system');
    });

    it('should load existing settings from localStorage', async () => {
      const mockSettings = {
        selectedProvider: 'openai',
        selectedModel: 'gpt-4',
        theme: 'dark'
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSettings));
      
      const settings = await settingsService.loadSettings();
      
      expect(settings.selectedProvider).toBe('openai');
      expect(settings.selectedModel).toBe('gpt-4');
      expect(settings.theme).toBe('dark');
    });

    it('should handle invalid JSON gracefully', async () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      
      const settings = await settingsService.loadSettings();
      
      expect(settings.selectedProvider).toBe('ollama'); // Default
      expect(settings.selectedModel).toBe('llama3.2'); // Default
    });
  });

  describe('saveSettings', () => {
    it('should save settings to localStorage', async () => {
      const updates = {
        selectedProvider: 'anthropic',
        theme: 'light'
      };
      
      await settingsService.saveSettings(updates);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'polyglut_settings',
        expect.stringContaining('anthropic')
      );
    });

    it('should merge with existing settings', async () => {
      const existingSettings = {
        selectedProvider: 'ollama',
        selectedModel: 'llama3.2'
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingSettings));
      
      const updates = { theme: 'dark' };
      await settingsService.saveSettings(updates);
      
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData.selectedProvider).toBe('ollama');
      expect(savedData.theme).toBe('dark');
    });
  });

  describe('updateSetting', () => {
    it('should update a single setting', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        selectedProvider: 'ollama'
      }));
      
      await settingsService.updateSetting('theme', 'dark');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'polyglut_settings',
        expect.stringContaining('dark')
      );
    });
  });

  describe('validation', () => {
    it('should validate theme values', async () => {
      const invalidTheme = 'invalid-theme';
      
      await settingsService.saveSettings({ theme: invalidTheme as any });
      
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData.theme).toBe('system'); // Should fall back to default
    });

    it('should validate numeric values', async () => {
      const invalidInterval = 999; // Too high
      
      await settingsService.saveSettings({ autoSaveInterval: invalidInterval });
      
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData.autoSaveInterval).toBe(5); // Should fall back to default
    });
  });
});

describe('ConversationStateManager', () => {
  let stateManager: ConversationStateManager;
  let mockStorageService: any;

  beforeEach(() => {
    stateManager = new ConversationStateManager();
    mockStorageService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      saveConversation: vi.fn().mockResolvedValue(undefined),
      loadConversation: vi.fn().mockResolvedValue({
        id: 'test-conv',
        title: 'Test Conversation',
        createdAt: new Date(),
        lastModified: new Date(),
        provider: 'ollama',
        currentModel: 'llama3.2',
        modelHistory: [],
        messages: [],
        isArchived: false
      }),
      listConversations: vi.fn().mockResolvedValue([]),
      archiveConversation: vi.fn().mockResolvedValue(undefined),
      unarchiveConversation: vi.fn().mockResolvedValue(undefined),
      deleteConversation: vi.fn().mockResolvedValue(undefined),
      searchConversations: vi.fn().mockResolvedValue([]),
      autoSaveConversation: vi.fn().mockResolvedValue(undefined)
    };

    // Mock the storage service constructor
    vi.mocked(StorageService).mockImplementation(() => mockStorageService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await stateManager.initialize();
      
      expect(mockStorageService.initialize).toHaveBeenCalled();
      expect(mockStorageService.listConversations).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      mockStorageService.initialize.mockRejectedValue(new Error('Storage failed'));
      
      await stateManager.initialize();
      
      const state = stateManager.getState();
      expect(state.error).toBe('Storage failed');
    });
  });

  describe('state management', () => {
    it('should notify listeners of state changes', async () => {
      const listener = vi.fn();
      const unsubscribe = stateManager.subscribe(listener);
      
      await stateManager.initialize();
      
      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].isLoading).toBe(false);
      
      unsubscribe();
    });

    it('should provide readonly state access', () => {
      const state = stateManager.getState();
      
      // State should be readonly
      expect(() => {
        (state as any).conversations = [];
      }).toThrow();
    });
  });

  describe('conversation operations', () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it('should create new conversations', async () => {
      const conversation = await stateManager.createConversation('ollama', 'llama3.2');
      
      expect(conversation.provider).toBe('ollama');
      expect(conversation.currentModel).toBe('llama3.2');
      expect(mockStorageService.saveConversation).toHaveBeenCalled();
    });

    it('should load conversations by ID', async () => {
      const conversation = await stateManager.loadConversation('test-id');
      
      expect(conversation.id).toBe('test-conv');
      expect(mockStorageService.loadConversation).toHaveBeenCalledWith('test-id');
    });

    it('should handle model switching', async () => {
      // First create a conversation
      const conversation = await stateManager.createConversation('ollama', 'llama3.2');
      
      // Then switch models
      await stateManager.switchModel('gemma3');
      
      const state = stateManager.getState();
      expect(state.currentConversation?.currentModel).toBe('gemma3');
      expect(state.currentConversation?.modelHistory).toHaveLength(1);
    });

    it('should archive and unarchive conversations', async () => {
      const conversation = await stateManager.createConversation('ollama', 'llama3.2');
      
      await stateManager.toggleArchive(conversation.id);
      expect(mockStorageService.archiveConversation).toHaveBeenCalledWith(conversation.id);
      
      await stateManager.toggleArchive(conversation.id);
      expect(mockStorageService.unarchiveConversation).toHaveBeenCalledWith(conversation.id);
    });

    it('should delete conversations', async () => {
      const conversation = await stateManager.createConversation('ollama', 'llama3.2');
      
      await stateManager.deleteConversation(conversation.id);
      
      expect(mockStorageService.deleteConversation).toHaveBeenCalledWith(conversation.id);
      
      const state = stateManager.getState();
      expect(state.conversations).toHaveLength(0);
    });
  });

  describe('search and filtering', () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it('should search conversations', async () => {
      const filters = {
        searchQuery: 'test',
        provider: 'ollama',
        model: 'llama3.2',
        showArchived: false
      };
      
      await stateManager.searchConversations(filters);
      
      expect(mockStorageService.searchConversations).toHaveBeenCalledWith('test');
    });

    it('should provide conversation statistics', () => {
      const stats = stateManager.getConversationStats();
      
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.archived).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on destroy', () => {
      stateManager.destroy();
      
      // Should not throw errors
      expect(() => {
        stateManager.getState();
      }).not.toThrow();
    });
  });
});

describe('ConversationUtils', () => {
  describe('ID generation', () => {
    it('should generate unique IDs', () => {
      const id1 = ConversationUtils.generateId();
      const id2 = ConversationUtils.generateId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^conv_\d+_[a-z0-9]+$/);
    });
  });

  describe('title generation', () => {
    it('should generate titles from short messages', () => {
      const message = {
        id: '1',
        role: 'user' as const,
        content: 'Hello world',
        timestamp: new Date(),
        provider: 'ollama'
      };
      
      const title = ConversationUtils.generateTitle([message]);
      expect(title).toBe('Hello world');
    });

    it('should truncate long messages', () => {
      const longMessage = {
        id: '1',
        role: 'user' as const,
        content: 'This is a very long message that should be truncated because it exceeds the maximum length for conversation titles',
        timestamp: new Date(),
        provider: 'ollama'
      };
      
      const title = ConversationUtils.generateTitle([longMessage]);
      expect(title.length).toBeLessThanOrEqual(53);
      expect(title).toEndWith('...');
    });
  });

  describe('conversation creation', () => {
    it('should create conversations with correct structure', () => {
      const conversation = ConversationUtils.createConversation('ollama', 'llama3.2');
      
      expect(conversation.provider).toBe('ollama');
      expect(conversation.currentModel).toBe('llama3.2');
      expect(conversation.isArchived).toBe(false);
      expect(conversation.messages).toHaveLength(0);
      expect(conversation.modelHistory).toHaveLength(0);
    });
  });

  describe('model change tracking', () => {
    it('should record model changes correctly', () => {
      const conversation = ConversationUtils.createConversation('ollama', 'llama3.2');
      const updated = ConversationUtils.recordModelChange(conversation, 'llama3.2', 'gemma3');
      
      expect(updated.currentModel).toBe('gemma3');
      expect(updated.modelHistory).toHaveLength(1);
      expect(updated.modelHistory[0].fromModel).toBe('llama3.2');
      expect(updated.modelHistory[0].toModel).toBe('gemma3');
    });
  });
});
