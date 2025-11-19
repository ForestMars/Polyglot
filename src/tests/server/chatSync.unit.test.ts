// src/tests/services/chatSync.unit.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// Import the server instance directly (not starting it on a port)
// We need to export the server from chatSyncApi.js first
import { server } from '../../server/chatSyncApi.js';

// Create supertest agent - NO network ports used
const agent = request(server);

describe('Chat Sync API - Unit Tests', () => {
  let createdChatId: string;

  // Clean up: delete any test chats before each test
  beforeEach(async () => {
    // Get all chats
    const response = await agent.get('/fetchChats');
    const chats = response.body;
    
    // Delete any existing test chats
    const testChatIds = chats
      .filter((chat: any) => chat.id?.startsWith('test_'))
      .map((chat: any) => chat.id);
    
    if (testChatIds.length > 0) {
      await agent
        .post('/deleteChats')
        .send({ chatIds: testChatIds });
    }
  });

  it('should create, delete, and verify removal of a chat', async () => {
    // --- 1. CREATE (Push a new chat to the server) ---
    const newChat = {
      id: `test_conv_${Date.now()}`,
      title: 'Test Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const createResponse = await agent
      .post('/pushChats')
      .send({ chats: [newChat] });

    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.body).toHaveProperty('ok', true);
    createdChatId = newChat.id;

    // Verify it was created
    const fetchAfterCreate = await agent.get('/fetchChats');
    expect(fetchAfterCreate.statusCode).toBe(200);
    const chatExists = fetchAfterCreate.body.some((chat: any) => chat.id === createdChatId);
    expect(chatExists).toBe(true);

    // --- 2. DELETE ---
    const deleteResponse = await agent
      .delete(`/deleteChat/${createdChatId}`);

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.body).toHaveProperty('ok', true);
    expect(deleteResponse.body).toHaveProperty('deleted', true);

    // --- 3. CONFIRM REMOVAL ---
    const fetchAfterDelete = await agent.get('/fetchChats');
    expect(fetchAfterDelete.statusCode).toBe(200);
    
    const isChatStillPresent = fetchAfterDelete.body.some(
      (chat: any) => chat.id === createdChatId
    );
    expect(isChatStillPresent).toBe(false);
  });

  it('should handle deleting non-existent chat', async () => {
    const response = await agent
      .delete('/deleteChat/nonexistent_id_12345');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('deleted', false);
  });

  it('should handle missing chat ID in delete request', async () => {
    const response = await agent
      .delete('/deleteChat/');

    expect(response.statusCode).toBe(400);
  });

  it('should delete multiple chats', async () => {
    // Create test chats
    const testChats = [
      {
        id: `test_1_${Date.now()}`,
        title: 'Test 1',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: `test_2_${Date.now()}`,
        title: 'Test 2',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    await agent
      .post('/pushChats')
      .send({ chats: testChats });

    // Delete them
    const response = await agent
      .post('/deleteChats')
      .send({ chatIds: testChats.map(c => c.id) });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('deletedCount', 2);

    // Verify deletion
    const fetchResponse = await agent.get('/fetchChats');
    const remainingIds = fetchResponse.body.map((chat: any) => chat.id);
    
    testChats.forEach(chat => {
      expect(remainingIds).not.toContain(chat.id);
    });
  });

  it('should fetch all chats', async () => {
    const response = await agent.get('/fetchChats');
    
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should handle CORS preflight', async () => {
    const response = await agent.options('/fetchChats');
    
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });
});