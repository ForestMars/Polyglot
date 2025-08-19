// src/__tests__/services/storage.test.ts
import { StorageService } from '@/services/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('StorageService', () => {
  let storage: StorageService;

  beforeEach(() => {
    // Clear all mocks and reset storage
    vi.clearAllMocks();
    storage = new StorageService();
  });

  it('caches conversation data', async () => {
    const conversation = {
      id: 'test-1',
      title: 'Test',
      messages: [],
      provider: 'ollama',
      currentModel: 'llama3.2',
      isArchived: false,
      createdAt: new Date(),
      lastModified: new Date()
    };

    // Mock file system operations
    vi.spyOn(storage, 'readFile').mockResolvedValueOnce(JSON.stringify(conversation));
    
    // First load - should read from file
    const result1 = await storage.loadConversation('test-1');
    expect(result1).toEqual(conversation);
    
    // Second load - should use cache
    const result2 = await storage.loadConversation('test-1');
    expect(result2).toEqual(conversation);
    expect(storage.readFile).toHaveBeenCalledTimes(1); // Should only read once
  });
});
