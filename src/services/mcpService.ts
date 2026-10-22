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

interface ToolExecutionResult {
  executed: boolean;
  originalContent: string;
  // Raw outcome of the call, for the caller to feed back to the model.
  toolName?: string;
  toolResultMessage?: string;
  error?: string;
}

class McpService {
  private servers: McpServer[] = [];
  private connections: Map<string, WebSocket> = new Map();
  private tools: McpTool[] = [];
  private cachedSystemPrompt: string = '';
  private pendingToolDiscovery: Map<string, { resolve: () => void; reject: (error: any) => void }> = new Map();
  // Ready promise resolves when initialize() completes (successful or not)
  public ready: Promise<void>;
  private _resolveReady: (() => void) | null = null;

  constructor() {
    this.ready = new Promise((resolve) => { this._resolveReady = resolve; });
  }

  async initialize() {
    console.log('🔌 Initializing MCP service...');

    // Load servers from /config/mcp.json (served by the app). Do not hardcode local servers here.
    try {
      console.log('🌐 Attempting to fetch /config/mcp.json...');
      const resp = await fetch('/config/mcp.json');
      if (!resp.ok) {
        console.warn(`⚠️ /config/mcp.json returned HTTP ${resp.status}; attempting fallback to sync server...`);
        // Try fallback to sync server which may be serving the config
  const syncEndpoint = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SYNC_SERVER_URL) || 'http://localhost:4002';
        try {
          const resp2 = await fetch(`${syncEndpoint.replace(/\/$/, '')}/config/mcp.json`);
          if (resp2.ok) {
            const cfg2 = await resp2.json();
            this.servers = Array.isArray(cfg2?.servers) ? cfg2.servers : [];
            console.log(`📥 Loaded MCP config from sync server:`, this.servers.map((s: any) => s.name));
          } else {
            console.warn('⚠️ Sync server did not serve config; no MCP servers will be configured.');
            this.servers = [];
          }
        } catch (err) {
          console.warn('⚠️ Failed to fetch config from sync server fallback:', err);
          this.servers = [];
        }
      } else {
        const config = await resp.json();
        this.servers = Array.isArray(config?.servers) ? config.servers : [];
        console.log(`📥 Loaded MCP config from /config/mcp.json:`, this.servers.map((s: any) => s.name));
      }
    } catch (err) {
      console.warn('⚠️ Could not load /config/mcp.json; attempting fallback to sync server...', err);
      // Try sync server fallback if initial fetch errored
  const syncEndpoint = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SYNC_SERVER_URL) || 'http://localhost:4002';
      try {
        const resp2 = await fetch(`${syncEndpoint.replace(/\/$/, '')}/config/mcp.json`);
        if (resp2.ok) {
          const cfg2 = await resp2.json();
          this.servers = Array.isArray(cfg2?.servers) ? cfg2.servers : [];
          console.log(`📥 Loaded MCP config from sync server:`, this.servers.map((s: any) => s.name));
        } else {
          console.warn('⚠️ Sync server did not serve config; no MCP servers will be configured.');
          this.servers = [];
        }
      } catch (err2) {
        console.warn('⚠️ Sync server fallback failed as well:', err2);
        this.servers = [];
      }
    }
    console.log(`📋 Found ${this.servers.length} MCP servers in config:`, this.servers.map(s => s.name));

    // If no servers were provided in config, do not auto-detect or hardcode any local servers.
    // Operator (or deployment) should provide `/config/mcp.json` listing local tool servers when needed.

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

    // Cache a plain-text system prompt containing discovered tools for reuse by the app.
    try {
      this.cachedSystemPrompt = this.getToolsAsSystemPrompt();
    } catch (err) {
      console.warn('⚠️ Failed to build cached system prompt:', err);
      this.cachedSystemPrompt = '';
    }

    // For testing/dev: if we discovered tools, optionally send the cached system-prompt injection text to the local sync server.
    // This behavior is gated by the VITE_ALLOW_MCP_INJECT build-time flag to avoid accidental repo writes in production.
    try {
      const injectText = this.cachedSystemPrompt;
      const allowInject = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ALLOW_MCP_INJECT === 'true')
        || (typeof window !== 'undefined' && (window as any).ALLOW_MCP_INJECT === true);

      if (injectText && injectText.length > 0 && allowInject) {
        // POST to the local sync server which exposes a write endpoint for dev
        const syncEndpoint = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SYNC_SERVER_URL) || (typeof window !== 'undefined' && (window as any).VITE_SYNC_SERVER_URL) || 'http://localhost:4002';
        const url = `${syncEndpoint.replace(/\/$/, '')}/mcp/inject`;
        console.log('📤 (dev-only) Sending MCP inject text to', url);
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inject: injectText })
        });
        if (!resp.ok) {
          console.warn('⚠️ MCP inject POST returned', resp.status, await resp.text().catch(() => ''));
        } else {
          console.log('📥 MCP inject written to server (dev-only)');
        }
      }
    } catch (err) {
      console.warn('⚠️ Failed to write MCP inject to server (dev-only):', err);
    }

    // Mark ready regardless of success so callers won't wait indefinitely. Resolve AFTER cached prompt (and optional dev write)
    try { this._resolveReady?.(); } catch {};
  }

  /**
   * Detects a tool_code block in model output and executes it.
   * Returns the raw outcome in `toolResultMessage`. The caller appends that to the
   * conversation and asks the model for its reply, so the model writes the confirmation.
   */
  async detectAndExecuteTool(content: string): Promise<ToolExecutionResult> {
    // Try to match array format first
    let toolCallMatch = content.match(/```tool_code\s*\n\s*send_email\(to=\[(.*?)\],\s*subject="([^"]+)"(?:,\s*body="([^"]+)")?\)\s*\n\s*```/s);
    let to: string | string[] | undefined;
    let subject: string | undefined;
    let body: string | undefined;

    if (toolCallMatch) {
      to = toolCallMatch[1].split(',').map(email => email.trim().replace(/['"]/g, ''));
      subject = toolCallMatch[2];
      body = toolCallMatch[3];
    } else {
      // Try string format
      toolCallMatch = content.match(/```tool_code\s*\n\s*send_email\(to="([^"]+)",\s*subject="([^"]+)"(?:,\s*body="([^"]+)")?\)\s*\n\s*```/s);
      if (toolCallMatch) {
        [, to, subject, body] = toolCallMatch;
      }
    }

    if (!to || !subject) {
      return { executed: false, originalContent: content };
    }

    const toolName = 'send_email';
    const args = { to, subject, body: body || '(No message body)' };
    console.log('[mcpService] Detected tool call: send_email', args);

    const emailServer = this.servers.find(server => server.name === 'email-tool');

    if (!emailServer) {
      console.error('[mcpService] MCP server "email-tool" is missing from config');
      return {
        executed: false,
        originalContent: content,
        toolName,
        error: 'MCP server "email-tool" is not configured',
        toolResultMessage: `Tool result for send_email: FAILED. The MCP server "email-tool" is not configured. No email was sent.`
      };
    }

    if (!this.connections.has(emailServer.name)) {
      console.error(`[mcpService] No active connection to "${emailServer.name}"`);
      return {
        executed: false,
        originalContent: content,
        toolName,
        error: `MCP server "${emailServer.name}" is not connected`,
        toolResultMessage: `Tool result for send_email: FAILED. The MCP server "${emailServer.name}" is not connected. No email was sent.`
      };
    }

    try {
      const serverResult = await this.callTool(toolName, emailServer.name, args);
      console.log('[mcpService] send_email server result:', serverResult);

      const detail = serverResult
        ? `Server response: ${serverResult}`
        : 'The server returned no content, which it also does on a normal successful send.';

      return {
        executed: true,
        originalContent: content,
        toolName,
        toolResultMessage:
          `Tool result for send_email: the call completed without error. ` +
          `Recipient: ${Array.isArray(to) ? to.join(', ') : to}. Subject: "${subject}". ${detail}`
      };
    } catch (error) {
      console.error('[mcpService] Tool execution failed:', error);
      return {
        executed: false,
        originalContent: content,
        toolName,
        error: String(error),
        toolResultMessage: `Tool result for send_email: FAILED with error: ${String(error)}. No email was sent.`
      };
    }
  }

  /**
   * Return the cached system prompt built at initialization (or empty string).
   */
  getCachedSystemPrompt(): string {
    return this.cachedSystemPrompt || '';
  }




  /**
   * Return a plain-text summary of available tools suitable for insertion into a system prompt.
   * Example:
   * "Available tools:\n- toolA (day-server): description\n- toolB (other-server): description"
   */
getToolsAsSystemPrompt(): string {
  if (!this.tools || this.tools.length === 0) return '';
  const lines = this.tools.map(t => `- ${t.name} (server: ${t.server}): ${t.description}`);
  return `Available tools:\n${lines.join('\n')}\n\nTo call a tool, use this EXACT format:
\`\`\`tool_code
send_email(to="recipient@example.com", subject="Subject", body="Body text")
\`\`\`

EXAMPLE:
User: Send an email to john@example.com with subject "Hello"
Assistant: [drafts and gets confirmation]
User: yes
Assistant:
\`\`\`tool_code
send_email(to="john@example.com", subject="Hello", body="The body text")
\`\`\`

Use these tools when they can help answer the user's question.`;
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
      console.error('the server is ${serverName} with ${args}');
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

// Expose for debugging in the browser console in non-production environments
try {
  if (typeof window !== 'undefined' && (import.meta as any)?.env?.MODE !== 'production') {
    (window as any).mcpService = mcpService;
  }
} catch (err) {
  // ignore - defensive for non-browser or weird bundlers
}