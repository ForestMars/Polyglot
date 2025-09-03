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
  private pendingToolDiscovery: Map<string, { resolve: () => void; reject: (error: any) => void }> = new Map();

  async initialize() {
    console.log('🔌 Initializing MCP service...');
    
    // Test with hardcoded config first
    const config = { servers: [{ name: "day-server", description: "day-server test", url: "ws://localhost:9001" }] };
    this.servers = config.servers;
    console.log(`📋 Found ${this.servers.length} MCP servers in config:`, this.servers.map(s => s.name));
    
    // Connect to all configured servers
    for (const server of this.servers) {
      console.log(`🔗 Attempting to connect to ${server.name} at ${server.url}...`);
      try {
        await this.connectToServer(server);
        console.log(`✅ Successfully connected to ${server.name}`);
      } catch (error) {
        console.error(`❌ Failed to connect to ${server.name}:`, error);
      }
    }
    
    console.log(`🛠️ MCP initialization complete. Total tools available: ${this.tools.length}`);
  }

  private async connectToServer(server: McpServer): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(server.url);
      
      // Set up tool discovery promise before connection
      const toolDiscoveryPromise = new Promise<void>((resolveTools, rejectTools) => {
        this.pendingToolDiscovery.set(server.name, { resolve: resolveTools, reject: rejectTools });
        
        // Add timeout for tool discovery
        setTimeout(() => {
          if (this.pendingToolDiscovery.has(server.name)) {
            this.pendingToolDiscovery.delete(server.name);
            rejectTools(new Error(`Tool discovery timeout for ${server.name}`));
          }
        }, 10000);
      });
      
      ws.onopen = async () => {
        console.log(`🟢 WebSocket connection established to ${server.name}`);
        this.connections.set(server.name, ws);
        console.log(`🔍 Discovering tools from ${server.name}...`);
        this.discoverTools(server.name);
        
        // Wait for tool discovery to complete
        try {
          await toolDiscoveryPromise;
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      ws.onerror = (error) => {
        console.error(`🔴 WebSocket connection failed to ${server.name}:`, error);
        // Clean up pending tool discovery
        if (this.pendingToolDiscovery.has(server.name)) {
          this.pendingToolDiscovery.delete(server.name);
        }
        reject(error);
      };
      
      ws.onmessage = (event) => {
        this.handleMessage(server.name, JSON.parse(event.data));
      };
    });
  }

  private discoverTools(serverName: string) {
    const ws = this.connections.get(serverName);
    if (!ws) return;
    
    console.log(`📡 Sending tools/list request to ${serverName}...`);
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
      console.log(`🛠️ Received ${serverTools.length} tools from ${serverName}:`, serverTools.map(t => t.name));
      this.tools.push(...serverTools);
      
      // Resolve the tool discovery promise
      const pending = this.pendingToolDiscovery.get(serverName);
      if (pending) {
        this.pendingToolDiscovery.delete(serverName);
        pending.resolve();
      }
    }
    
    // Handle errors
    if (message.error) {
      console.error(`❌ Error from ${serverName}:`, message.error);
      const pending = this.pendingToolDiscovery.get(serverName);
      if (pending) {
        this.pendingToolDiscovery.delete(serverName);
        pending.reject(new Error(message.error.message || 'Unknown MCP error'));
      }
    }
  }

  async callTool(toolName: string, serverName: string, args = {}): Promise<string | null> {
    const ws = this.connections.get(serverName);
    if (!ws) {
      console.error(`❌ No connection to server ${serverName} for tool ${toolName}`);
      return null;
    }

    console.log(`🔧 Calling tool ${toolName} on ${serverName} with args:`, args);

    return new Promise((resolve) => {
      const id = Date.now();
      
      const handler = (event: MessageEvent) => {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          const result = msg.result?.content?.[0]?.text || null;
          console.log(`✨ Tool ${toolName} result:`, result);
          resolve(result);
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