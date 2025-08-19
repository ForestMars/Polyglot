import { OllamaService, type OllamaRequest, type OllamaResponse } from './ollama';

export interface ChatRequest {
  provider: string;
  model: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  apiKey?: string;
  baseUrl?: string;
}

export interface ChatResponse {
  content: string;
  provider: string;
  model: string;
  timestamp: Date;
}

export class ApiService {
  private ollamaService: OllamaService;

  constructor() {
    this.ollamaService = new OllamaService();
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const { provider, model, messages, baseUrl } = request;

    try {
      switch (provider) {
        case 'ollama':
          return await this.handleOllamaRequest(model, messages, baseUrl);
        case 'openai':
          return await this.handleOpenAIRequest(model, messages, request.apiKey);
        case 'anthropic':
          return await this.handleAnthropicRequest(model, messages, request.apiKey);
        case 'google':
          return await this.handleGoogleRequest(model, messages, request.apiKey);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error(`API request failed for ${provider}:`, error);
      throw error;
    }
  }

  private async handleOllamaRequest(
    model: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    baseUrl?: string
  ): Promise<ChatResponse> {
    // Always create a new instance with the provided base URL or use the default
    const ollamaService = new OllamaService(baseUrl);

    try {
      // Check if Ollama is running
      const isHealthy = await ollamaService.healthCheck();
      if (!isHealthy) {
        throw new Error('Ollama is not running. Please start Ollama and ensure it\'s accessible at the configured URL.');
      }

      const ollamaRequest: OllamaRequest = {
        model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        }
      };

      const response = await ollamaService.chat(ollamaRequest);

      return {
        content: response.message.content,
        provider: 'ollama',
        model: response.model,
        timestamp: new Date(response.created_at)
      };
    } catch (error) {
      console.error('Ollama request failed:', error);
      throw error;
    }
  }

  private async handleOpenAIRequest(
    model: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    apiKey?: string
  ): Promise<ChatResponse> {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    // TODO: Implement actual OpenAI API call
    // For now, return a mock response
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      content: `Mock OpenAI response using ${model}. This is a placeholder until you implement the actual OpenAI API integration.`,
      provider: 'openai',
      model,
      timestamp: new Date()
    };
  }

  private async handleAnthropicRequest(
    model: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    apiKey?: string
  ): Promise<ChatResponse> {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }

    // TODO: Implement actual Anthropic API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      content: `Mock Anthropic response using ${model}. This is a placeholder until you implement the actual Anthropic API integration.`,
      provider: 'anthropic',
      model,
      timestamp: new Date()
    };
  }

  private async handleGoogleRequest(
    model: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    apiKey?: string
  ): Promise<ChatResponse> {
    if (!apiKey) {
      throw new Error('Google API key is required');
    }

    // TODO: Implement actual Google API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      content: `Mock Google response using ${model}. This is a placeholder until you implement the actual Google API integration.`,
      provider: 'google',
      model,
      timestamp: new Date()
    };
  }

  async checkProviderHealth(provider: string, baseUrl?: string): Promise<boolean> {
    switch (provider) {
      case 'ollama':
        const ollamaService = baseUrl ? new OllamaService(baseUrl) : this.ollamaService;
        return await ollamaService.healthCheck();
      case 'openai':
      case 'anthropic':
      case 'google':
        // TODO: Implement health checks for cloud providers
        return true;
      default:
        return false;
    }
  }
}
