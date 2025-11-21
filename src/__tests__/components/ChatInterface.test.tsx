import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatInterface } from '@/components/ChatInterface';
import { vi } from 'vitest';

// Mock the hooks and components
vi.mock('@/hooks/useConversationState', () => ({
  useConversationState: () => ({
    state: {
      conversations: [
        {
          id: 'conv1',
          title: 'Test Chat',
          messages: [
            { id: 'msg1', role: 'user', content: 'Hello', timestamp: new Date() },
            { id: 'msg2', role: 'assistant', content: 'Hi there!', timestamp: new Date() }
          ],
          provider: 'ollama',
          currentModel: 'llama3.2',
          isArchived: false,
          createdAt: new Date(),
          lastModified: new Date()
        }
      ],
      currentConversation: {
        id: 'conv1',
        title: 'Test Chat',
        messages: [
          { id: 'msg1', role: 'user', content: 'Hello', timestamp: new Date() },
          { id: 'msg2', role: 'assistant', content: 'Hi there!', timestamp: new Date() }
        ],
        provider: 'ollama',
        currentModel: 'llama3.2',
        isArchived: false,
        createdAt: new Date(),
        lastModified: new Date()
      },
      isLoading: false,
      error: null
    },
    createConversation: vi.fn(),
    loadConversation: vi.fn(),
    addMessage: vi.fn(),
    switchModel: vi.fn(),
    searchConversations: vi.fn(),
    toggleArchive: vi.fn(),
    deleteConversation: vi.fn()
  })
}));

vi.mock('@/hooks/use-settings', () => ({
  useSettings: () => ({
    settings: { theme: 'light' },
    updateSettings: vi.fn()
  })
}));

describe('ChatInterface', { tags: ['db'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chat messages', () => {
    render(<ChatInterface />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('allows sending a new message', async () => {
    const mockAddMessage = vi.fn();
    vi.mocked(useConversationState).mockImplementation(() => ({
      ...useConversationState(),
      addMessage: mockAddMessage
    }));

    render(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'New message' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(mockAddMessage).toHaveBeenCalledWith(
        'conv1',
        expect.objectContaining({
          role: 'user',
          content: 'New message'
        })
      );
    });
  });

  it('shows loading state when sending a message', async () => {
    vi.mocked(useConversationState).mockImplementation(() => ({
      ...useConversationState(),
      state: {
        ...useConversationState().state,
        isLoading: true
      }
    }));

    render(<ChatInterface />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays error message when there is an error', () => {
    vi.mocked(useConversationState).mockImplementation(() => ({
      ...useConversationState(),
      state: {
        ...useConversationState().state,
        error: 'Failed to load conversation'
      }
    }));

    render(<ChatInterface />);
    
    expect(screen.getByText('Failed to load conversation')).toBeInTheDocument();
  });

  it('allows switching models', () => {
    const mockSwitchModel = vi.fn();
    vi.mocked(useConversationState).mockImplementation(() => ({
      ...useConversationState(),
      switchModel: mockSwitchModel
    }));

    render(<ChatInterface />);
    
    const modelSelect = screen.getByRole('combobox', { name: /model/i });
    fireEvent.mouseDown(modelSelect);
    
    const newModelOption = screen.getByText('mistral');
    fireEvent.click(newModelOption);
    
    expect(mockSwitchModel).toHaveBeenCalledWith('conv1', 'mistral');
  });
});
