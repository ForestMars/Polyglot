interface MistralRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  safe_prompt?: boolean;
  random_seed?: number;
}

export class MistralService {
  private readonly baseUrl = 'https://api.mistral.ai/v1';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(request: MistralRequest) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        ...request,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 2000,
        top_p: request.top_p ?? 1.0,
        stream: false,
        safe_prompt: request.safe_prompt ?? false
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.message || 'Failed to fetch from Mistral');
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      model: data.model,
      created_at: data.created
    };
  }

  async listModels() {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch Mistral models');
    }
    
    const data = await response.json();
    return data.data;
  }
}
