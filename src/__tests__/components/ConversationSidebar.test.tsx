import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConversationSidebar } from '@/components/ConversationSidebar';
import { vi } from 'vitest';

const mockConversations = [
  {
    id: 'conv1',
    title: 'First Chat',
    messages: [
      { id: 'msg1', role: 'user', content: 'Hello', timestamp: new Date() }
    ],
    provider: 'ollama',
    currentModel: 'llama3.2',
    isArchived: false,
    createdAt: new Date(Date.now() - 3600000), // 1 hour ago
    lastModified: new Date()
  },
  {
    id: 'conv2',
    title: 'Second Chat',
    messages: [
      { id: 'msg2', role: 'user', content: 'How are you?', timestamp: new Date() }
    ],
    provider: 'ollama',
    currentModel: 'mistral',
    isArchived: false,
    createdAt: new Date(),
    lastModified: new Date()
  }
];

describe('ConversationSidebar', { tags: ['db'] }, () => {
  const onSelect = vi.fn();
  const onNewConversation = vi.fn();
  const onToggleArchive = vi.fn();
  const onDelete = vi.fn();
  const onSearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays list of conversations', () => {
    render(
      <ConversationSidebar
        conversations={mockConversations}
        currentConversationId="conv1"
        onConversationSelect={onSelect}
        onNewConversation={onNewConversation}
        onToggleArchive={onToggleArchive}
        onDelete={onDelete}
        onSearch={onSearch}
        selectedProvider="ollama"
        selectedModel="llama3.2"
      />
    );

    expect(screen.getByText('First Chat')).toBeInTheDocument();
    expect(screen.getByText('Second Chat')).toBeInTheDocument();
  });

  it('calls onConversationSelect when a conversation is clicked', async () => {
    render(
      <ConversationSidebar
        conversations={mockConversations}
        currentConversationId="conv1"
        onConversationSelect={onSelect}
        onNewConversation={onNewConversation}
        onToggleArchive={onToggleArchive}
        onDelete={onDelete}
        onSearch={onSearch}
        selectedProvider="ollama"
        selectedModel="llama3.2"
      />
    );

    const secondChat = screen.getByText('Second Chat');
    fireEvent.click(secondChat);

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(mockConversations[1]);
    });
  });

  it('shows new chat button', () => {
    render(
      <ConversationSidebar
        conversations={mockConversations}
        currentConversationId="conv1"
        onConversationSelect={onSelect}
        onNewConversation={onNewConversation}
        onToggleArchive={onToggleArchive}
        onDelete={onDelete}
        onSearch={onSearch}
        selectedProvider="ollama"
        selectedModel="llama3.2"
      />
    );

    const newChatButton = screen.getByRole('button', { name: /new chat/i });
    expect(newChatButton).toBeInTheDocument();
  });

  it('calls onNewConversation when new chat button is clicked', () => {
    render(
      <ConversationSidebar
        conversations={mockConversations}
        currentConversationId="conv1"
        onConversationSelect={onSelect}
        onNewConversation={onNewConversation}
        onToggleArchive={onToggleArchive}
        onDelete={onDelete}
        onSearch={onSearch}
        selectedProvider="ollama"
        selectedModel="llama3.2"
      />
    );

    const newChatButton = screen.getByRole('button', { name: /new chat/i });
    fireEvent.click(newChatButton);
    expect(onNewConversation).toHaveBeenCalled();
  });

  it('shows search bar', () => {
    render(
      <ConversationSidebar
        conversations={mockConversations}
        currentConversationId="conv1"
        onConversationSelect={onSelect}
        onNewConversation={onNewConversation}
        onToggleArchive={onToggleArchive}
        onDelete={onDelete}
        onSearch={onSearch}
        selectedProvider="ollama"
        selectedModel="llama3.2"
      />
    );

    const searchInput = screen.getByPlaceholderText(/search conversations/i);
    expect(searchInput).toBeInTheDocument();
  });
});
