import type { Provider } from '@/components/ChatInterface'

export const mockProviders: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiKeys: [
      { id: '1', name: 'Personal Key', key: 'sk-test-1234567890abcdef' },
      { id: '2', name: 'Work Key', key: 'sk-test-0987654321fedcba' }
    ],
    models: ['gpt-4.1-2025-04-14', 'gpt-4o', 'gpt-4o-mini'],
    defaultModel: 'gpt-4.1-2025-04-14'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    apiKeys: [
      { id: '3', name: 'Claude Key', key: 'sk-ant-test-1234567890abcdef' }
    ],
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-haiku-20241022'],
    defaultModel: 'claude-sonnet-4-20250514'
  },
  {
    id: 'google',
    name: 'Google',
    apiKeys: [],
    models: ['gemini-pro', 'gemini-pro-vision'],
    defaultModel: 'gemini-pro'
  }
]

export const mockEmptyProviders: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiKeys: [],
    models: ['gpt-4.1-2025-04-14', 'gpt-4o', 'gpt-4o-mini'],
    defaultModel: 'gpt-4.1-2025-04-14'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    apiKeys: [],
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-haiku-20241022'],
    defaultModel: 'claude-sonnet-4-20250514'
  },
  {
    id: 'google',
    name: 'Google',
    apiKeys: [],
    models: ['gemini-pro', 'gemini-pro-vision'],
    defaultModel: 'gemini-pro'
  }
] 