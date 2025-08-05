import { vi } from 'vitest'

export const mockApiCall = vi.fn().mockResolvedValue({
  content: 'Mock AI response',
  timestamp: new Date(),
  provider: 'openai'
})

export const mockApiCallError = vi.fn().mockRejectedValue(new Error('API Error'))

export const mockApiCallTimeout = vi.fn().mockImplementation(() => 
  new Promise((resolve) => setTimeout(() => resolve({
    content: 'Delayed response',
    timestamp: new Date(),
    provider: 'openai'
  }), 1000))
)

export const mockApiCallWithProvider = vi.fn().mockImplementation((provider: string) => 
  Promise.resolve({
    content: `Mock response from ${provider}`,
    timestamp: new Date(),
    provider
  })
) 