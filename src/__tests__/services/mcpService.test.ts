import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Small helper to delay
const tick = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms))

describe('mcpService discovery and prompt generation', { tags: ['db'] }, () => {
  beforeEach(() => {
    // Reset module cache so each test gets a fresh mcpService instance
    vi.resetModules()

    // Mock fetch to serve a config with two servers
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        servers: [
          { name: 'day-server', description: 'Provides current day', url: 'ws://localhost:9001' },
          { name: 'email-tool', description: 'Local email tool (Gmail)', url: 'ws://localhost:3000' }
        ]
      })
    }) as any

    // Mock WebSocket to simulate MCP servers
    class MockWebSocket {
      url: string
      onopen: ((ev?: any) => void) | null = null
      onmessage: ((ev: { data: string }) => void) | null = null
      onerror: ((err: any) => void) | null = null
      sent: any[] = []

      constructor(url: string) {
        this.url = url
        // call onopen shortly after the consumer attaches handlers
        setTimeout(() => {
          if (this.onopen) this.onopen()
        }, 0)
      }

      send(data: string) {
        this.sent.push(data)
        try {
          const msg = JSON.parse(data)
          if (msg.method === 'tools/list') {
            // Return different tool lists depending on URL
            const tools = this.url.includes('9001')
              ? [{ name: 'get_day', description: 'Returns current day of the week' }]
              : [{ name: 'send_email', description: 'Send an email via SMTP' }]

            const response = {
              jsonrpc: '2.0',
              id: msg.id,
              result: { tools }
            }

            setTimeout(() => {
              if (this.onmessage) this.onmessage({ data: JSON.stringify(response) })
            }, 0)
          }
        } catch (e) {
          // ignore
        }
      }

      // no-op
      addEventListener() {}
      removeEventListener() {}
    }

    // @ts-ignore - replace global WebSocket
    global.WebSocket = MockWebSocket as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // @ts-ignore
    delete (global as any).WebSocket
    // @ts-ignore
    delete (global as any).fetch
  })

  it('discovers both configured servers and builds a structured cached prompt', async () => {
    const mod = await import('@/services/mcpService')
    const { mcpService } = mod

    // initialize will attempt to fetch config and connect to servers
    await mcpService.initialize()

    // Wait a short while for async discovery to complete
    await tick(50)

    const tools = mcpService.getAvailableTools()
    const toolNames = tools.map(t => t.name)

    expect(toolNames).toContain('get_day')
    expect(toolNames).toContain('send_email')

    const prompt = mcpService.getCachedSystemPrompt()
    expect(prompt).toBeTruthy()
    expect(prompt).toContain('send_email')
    expect(prompt).toContain('tool_call')
    expect(prompt).toContain('Example (send an email)')
  })
})
