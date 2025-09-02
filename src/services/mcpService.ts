// src/services/mcpService.ts - Service that manages MCP connections
interface McpServer {
  name: string;
  description: string;
  url: string;
}

interface McpTool {
  name: string;
  description: string;
  server: string;
}

class McpService {
  private servers: McpServer[] = [];
  private connections: Map<string, WebSocket> = new Map();
  private tools: McpTool[] = [];

  async initialize() {
    // Load server configuration
    const config = await import('../../config/mcp.json');
    this.servers = config.servers;
    
    // Connect to all configured servers
    for (const server of this.servers) {
      await this.connectToServer(server);
    }
  }

  private async connectToServer(server: McpServer): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(server.url);
      
      ws.onopen = () => {
        this.connections.set(server.name, ws);
        this.discoverTools(server.name);
        resolve();
      };
      
      ws.onerror = () => {
        console.error(`Failed to connect to ${server.name}`);
        reject();
      };
      
      ws.onmessage = (event) => {
        this.handleMessage(server.name, JSON.parse(event.data));
      };
    });
  }

  private discoverTools(serverName: string) {
    const ws = this.connections.get(serverName);
    if (!ws) return;
    
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    }));
  }

  private handleMessage(serverName: string, message: any) {
    if (message.result?.tools) {
      const serverTools = message.result.tools.map((tool: any) => ({
        ...tool,
        server: serverName
      }));
      this.tools.push(...serverTools);
    }
  }

  async callTool(toolName: string, serverName: string, args = {}): Promise<string | null> {
    const ws = this.connections.get(serverName);
    if (!ws) return null;

    return new Promise((resolve) => {
      const id = Date.now();
      
      const handler = (event: MessageEvent) => {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result?.content?.[0]?.text || null);
        }
      };
      
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: toolName, arguments: args }
      }));
    });
  }

  getAvailableTools(): McpTool[] {
    return this.tools;
  }
}

export const mcpService = new McpService();

// src/hooks/useMcp.ts - React hook for using MCP in components
import { useState, useEffect } from 'react';
import { mcpService } from '../services/mcpService';

export function useMcp() {
  const [tools, setTools] = useState<any[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    mcpService.initialize().then(() => {
      setTools(mcpService.getAvailableTools());
      setIsReady(true);
    });
  }, []);

  const callTool = async (toolName: string, serverName: string, args = {}) => {
    return await mcpService.callTool(toolName, serverName, args);
  };

  return { tools, callTool, isReady };
}

// Modification to existing ChatInterface.tsx
import { useMcp } from '../hooks/useMcp';

export function ChatInterface() {
  const { tools, callTool, isReady } = useMcp();
  
  const handleMessage = async (userMessage: string) => {
    // Check if we can handle this with MCP tools
    if (userMessage.toLowerCase().includes('day')) {
      const dayTool = tools.find(t => t.name === 'get_day');
      if (dayTool) {
        const result = await callTool('get_day', dayTool.server);
        if (result) {
          // Add as assistant message
          return result;
        }
      }
    }
    
    // Fall back to normal AI provider handling
    // ... your existing message handling
  };
  
  // ... rest of your existing component
}

