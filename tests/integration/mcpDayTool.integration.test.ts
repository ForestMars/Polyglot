// tests/integration/mcpDayTool.integration.test.ts
// Integration test for MCP day tool - verifies the model can correctly determine
// the current day of the week using MCP tools instead of hallucinating an answer

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { messageRouter } from '../../src/services/messageRouter';
import { mcpService } from '../../src/services/mcpService';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('MCP Day Tool Integration', { tags: ['db'] }, () => {
  let mcpServer: ChildProcess;
  
  beforeAll(async () => {
    // Start the MCP day-server on WebSocket port 9001
    const serverPath = path.join(process.cwd(), 'tools/day-tool/day-server.js');
    mcpServer = spawn('node', [serverPath]);
    
    // Wait for server process to start
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
    
    // Initialize mcpService and wait for it to be ready
    console.log('🧪 Initializing mcpService...');
    await mcpService.initialize();
    await mcpService.ready;
    console.log('🧪 mcpService ready');
    
    // Verify tools were discovered
    const tools = mcpService.getAvailableTools();
    console.log('🧪 Available tools:', tools.map(t => `${t.name} (${t.server})`));
    
    if (tools.length === 0) {
      throw new Error('No MCP tools discovered - connection may have failed');
    }
  });
  
  afterAll(() => {
    // Clean up: kill the MCP server process
    if (mcpServer) {
      mcpServer.kill();
    }
    // Restore fetch
    vi.restoreAllMocks();
  });
  
  it('should know what day of the week it is via MCP tool', async () => {
    const response = await messageRouter.handleMessage('What day is it?');
    const expectedDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    expect(response).toBeTruthy();
    expect(response).toContain(expectedDay);
  });
  
  it('should handle "what day of the week" phrasing', async () => {
    const response = await messageRouter.handleMessage('What day of the week is it?');
    const expectedDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    expect(response).toBeTruthy();
    expect(response).toContain(expectedDay);
  });
  
  it('should handle "today" keyword', async () => {
    const response = await messageRouter.handleMessage('What is today?');
    const expectedDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    expect(response).toBeTruthy();
    expect(response).toContain(expectedDay);
  });
  
  it('should correctly answer what day tomorrow is', async () => {
    const response = await messageRouter.handleMessage('What day is tomorrow?');
    
    // "Tomorrow" should NOT be routed to MCP - it should return null
    // and let the LLM handle the reasoning
    expect(response).toBeNull();
  });
});