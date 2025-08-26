export interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
    seed?: number;
  };
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;        // Total time in nanoseconds
  load_duration?: number;         // Model loading time
  prompt_eval_count?: number;     // Tokens processed
  prompt_eval_duration?: number;  // Prompt processing time
  eval_count?: number;            // Response tokens
  eval_duration?: number;         // Response generation time
}

export class OllamaService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async chat(request: OllamaRequest): Promise<OllamaResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Ollama API error:', error);
      throw error;
    }
  }

  async listModels(): Promise<{ models: Array<{ name: string; modified_at: string; size: number }> }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
      throw error;
    }
  }

  async generate(request: Omit<OllamaRequest, 'messages'> & { prompt: string }): Promise<OllamaResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Ollama API error:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    const url = `${this.baseUrl}/api/tags`;
    console.log(`[OllamaService] Checking health at: ${url}`);
    
    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      const endTime = Date.now();
      
      console.log(`[OllamaService] Health check response: ${response.status} ${response.statusText} (${endTime - startTime}ms)`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        console.error(`[OllamaService] Health check failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      return response.ok;
    } catch (error) {
      console.error('[OllamaService] Health check error:', error);
      return false;
    }
  }
}
