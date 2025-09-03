// src/services/messageRouter.ts
import { mcpService } from './mcpService';

export class MessageRouter {
  async routeMessage(message: string): Promise<{ useMCP: boolean; toolName?: string; serverName?: string }> {
    const lowerMessage = message.toLowerCase();
    
    // Date/time questions go to MCP
    if (lowerMessage.includes('what day') || 
        lowerMessage.includes('what time') || 
        lowerMessage.includes('current date') ||
        lowerMessage.includes('today')) {
      return { useMCP: true, toolName: 'get_current_date', serverName: 'day-server' };
    }
    
    // Everything else goes to your AI providers
    return { useMCP: false };
  }
  
  async handleMessage(message: string) {
    const route = await this.routeMessage(message);
    
    if (route.useMCP && route.toolName && route.serverName) {
      // Call MCP tool
      return await mcpService.callTool(route.toolName, route.serverName);
    } else {
      // Send to your existing AI provider (Ollama, OpenAI, etc.)
      return null; // Let your existing chat handler take over
    }
  }
}

export const messageRouter = new MessageRouter();