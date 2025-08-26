import { OllamaService, type OllamaRequest, type OllamaResponse } from './ollama';
import { OpenRouterService } from './providers/openrouter';
import { TogetherService } from './providers/together';
import { GroqService } from './providers/groq';

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
  responseTime?: number; // Total time in milliseconds from request to response
}

export class ApiService {
  private ollamaService: OllamaService;
  private openRouterService: OpenRouterService | null = null;
  private togetherService: TogetherService | null = null;
  private groqService: GroqService | null = null;

  constructor() {
    this.ollamaService = new OllamaService();
  }

  private getOpenRouterService(apiKey: string): OpenRouterService {
    if (!this.openRouterService || this.openRouterService['apiKey'] !== apiKey) {
      this.openRouterService = new OpenRouterService(apiKey);
    }
    return this.openRouterService;
  }

  private getTogetherService(apiKey: string): TogetherService {
    if (!this.togetherService || this.togetherService['apiKey'] !== apiKey) {
      this.togetherService = new TogetherService(apiKey);
    }
    return this.togetherService;
  }

  private getGroqService(apiKey: string): GroqService {
    if (!this.groqService || this.groqService['apiKey'] !== apiKey) {
      this.groqService = new GroqService(apiKey);
    }
    return this.groqService;
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
        case 'openrouter':
          return await this.handleOpenRouterRequest(model, messages, request.apiKey);
        case 'together':
          return await this.handleTogetherRequest(model, messages, request.apiKey);
        case 'groq':
          return await this.handleGroqRequest(model, messages, request.apiKey);
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
    console.log('[handleOllamaRequest] Starting request with model:', model);
    console.log('[handleOllamaRequest] Base URL:', baseUrl || 'default');
    
    // Always create a new instance with the provided base URL or use the default
    const ollamaService = new OllamaService(baseUrl);

    try {
      console.log('[handleOllamaRequest] Checking Ollama health...');
      const isHealthy = await ollamaService.healthCheck();
      console.log('[handleOllamaRequest] Health check result:', isHealthy);
      
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

      console.log('[handleOllamaRequest] Sending request to Ollama:', JSON.stringify(ollamaRequest, null, 2));
      
      const startTime = Date.now();
      const response = await ollamaService.chat(ollamaRequest);
      const endTime = Date.now();
      
      console.log(`[handleOllamaRequest] Received response in ${endTime - startTime}ms`);
      console.log('[handleOllamaRequest] Response:', JSON.stringify(response, null, 2));

      return {
        content: response.message.content,
        provider: 'ollama',
        model: response.model,
        timestamp: new Date(response.created_at),
        responseTime: endTime - startTime
      };
    } catch (error) {
      console.error('[handleOllamaRequest] Request failed:', error);
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
    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 1000));
    const endTime = Date.now();
    
    return {
      content: `Mock OpenAI response using ${model}. This is a placeholder until you implement the actual OpenAI API integration.`,
      provider: 'openai',
      model,
      timestamp: new Date(),
      responseTime: endTime - startTime
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
    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 1000));
    const endTime = Date.now();
    
    return {
      content: `Mock Anthropic response using ${model}. This is a placeholder until you implement the actual Anthropic API integration.`,
      provider: 'anthropic',
      model,
      timestamp: new Date(),
      responseTime: endTime - startTime
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

  private async handleOpenRouterRequest(
    model: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    apiKey?: string
  ): Promise<ChatResponse> {
    if (!apiKey) {
      throw new Error('OpenRouter API key is required');
    }

    const openRouterService = this.getOpenRouterService(apiKey);
    const response = await openRouterService.chat({
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    });

    return {
      content: response.content,
      provider: 'openrouter',
      model: response.model,
      timestamp: new Date(response.created_at * 1000)
    };
  }

  private async handleTogetherRequest(
    model: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    apiKey?: string
  ): Promise<ChatResponse> {
    if (!apiKey) {
      throw new Error('TogetherAI API key is required');
    }

    const togetherService = this.getTogetherService(apiKey);
    const response = await togetherService.chat({
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    });

    return {
      content: response.content,
      provider: 'together',
      model: response.model,
      timestamp: new Date(response.created_at * 1000)
    };
  }

  private async handleGroqRequest(
    model: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    apiKey?: string
  ): Promise<ChatResponse> {
    if (!apiKey) {
      throw new Error('Groq API key is required');
    }

    const groqService = this.getGroqService(apiKey);
    const response = await groqService.chat({
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    });

    return {
      content: response.content,
      provider: 'groq',
      model: response.model,
      timestamp: new Date(response.created_at * 1000)
    };
  }

  async checkProviderHealth(provider: string, baseUrl?: string): Promise<boolean> {
    switch (provider) {
      case 'ollama':
        const ollamaService = baseUrl ? new OllamaService(baseUrl) : this.ollamaService;
        return await ollamaService.healthCheck();
      case 'openai':
      case 'anthropic':
      case 'openrouter':
      case 'together':
      case 'groq':
      case 'google':
        // Basic health check for cloud providers - just check if API key is provided
        return true;
      default:
        return false;
    }
  }
}
