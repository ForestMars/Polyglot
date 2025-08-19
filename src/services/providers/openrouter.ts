interface OpenRouterRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export class OpenRouterService {
  private readonly baseUrl = 'https://openrouter.ai/api/v1';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(request: OpenRouterRequest) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://your-app-url.com', // Required by OpenRouter
        'X-Title': 'Polyglut' // Your app name
      },
      body: JSON.stringify({
        ...request,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 2000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch from OpenRouter');
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      model: data.model,
      created_at: data.created
    };
  }

  async listModels() {
    const response = await fetch(`${this.baseUrl}/models`);
    if (!response.ok) {
      throw new Error('Failed to fetch OpenRouter models');
    }
    return response.json();
  }
}
