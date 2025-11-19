// tests/integration/mcpDayTool.integration.test.ts
// Integration test for MCP day tool - verifies the model can correctly determine
// the current day of the week using MCP tools instead of hallucinating an answer

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { messageRouter } from '../../src/services/messageRouter';
import { mcpService } from '../../src/services/mcpService';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('MCP Day Tool Integration', () => {
  let mcpServer: ChildProcess;
  
  beforeAll(async () => {
    // Start the MCP day-server on WebSocket port 9001
    const serverPath = path.join(process.cwd(), 'day-server.mjs');
    mcpServer = spawn('node', [serverPath]);
    
    // Give the WebSocket server time to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock the config fetch to provide our test server
    global.fetch = vi.fn((url) => {
      if (url.toString().includes('/config/mcp.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            servers: [{
              name: 'day-server',
              description: 'Day of week tool server',
              url: 'ws://localhost:9001'
            }]
          })
        } as Response);
      }
      return Promise.reject(new Error('Not found'));
    });
    
    // Initialize mcpService with our mocked config
    console.log('🧪 Initializing mcpService...');
    await mcpService.initialize();
    console.log('🧪 mcpService initialized');
    
    // Wait for connection to fully establish and tools to be discovered
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Debug: Check what tools were discovered
    const tools = mcpService.getAvailableTools();
    console.log('🧪 Available tools:', tools);
  });
  
  afterAll(() => {
    // Clean up: kill the MCP server process
    if (mcpServer) {
      mcpServer.kill();
    }
  });
  
  it('should know what day of the week it is via MCP tool', async () => {
    // Ask what day it is - this should route to MCP instead of the LLM
    const response = await messageRouter.handleMessage('What day is it?');
    
    // Get the actual current day
    const expectedDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    // Verify MCP returned a response
    expect(response).toBeTruthy();
    expect(response).toContain(expectedDay);
  });
  
  it('should handle "what day of the week" phrasing', async () => {
    const response = await messageRouter.handleMessage('What day of the week is it?');
    const expectedDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    expect(response).toBeTruthy();
    expect(response).toContain(expectedDay);
  });
});