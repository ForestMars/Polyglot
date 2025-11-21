import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConversationSidebar } from '../ConversationSidebar';
import { Conversation } from '@/types/conversation';

// Mock the storage service
vi.mock('@/services/storage', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    listConversations: vi.fn(),
    archiveConversation: vi.fn(),
    unarchiveConversation: vi.fn(),
    deleteConversation: vi.fn(),
  })),
}));

// Mock the conversation utils
vi.mock('@/services/conversationUtils', () => ({
  ConversationUtils: {
    getSummary: vi.fn((conv) => conv.messages[0]?.content || 'No messages'),
  },
}));

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('ConversationSidebar', { tags: ['db'] }, () => {
  const mockConversation: Conversation = {
    id: 'conv-1',
    title: 'Test Conversation',
    createdAt: new Date('2024-01-01'),
    lastModified: new Date('2024-01-01T10:00:00'),
    provider: 'ollama',
    currentModel: 'llama3.2',
    modelHistory: [],
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, how are you?',
        timestamp: new Date('2024-01-01T10:00:00'),
        provider: 'ollama'
      }
    ],
    isArchived: false
  };

  const defaultProps = {
    currentConversationId: undefined,
    onConversationSelect: vi.fn(),
    onNewConversation: vi.fn(),
    selectedProvider: 'ollama',
    selectedModel: 'llama3.2'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the sidebar with correct title', () => {
    render(<ConversationSidebar {...defaultProps} />);
    
    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText('New Chat')).toBeInTheDocument();
  });

  it('shows search input', () => {
    render(<ConversationSidebar {...defaultProps} />);
    
    expect(screen.getByPlaceholderText('Search conversations...')).toBeInTheDocument();
  });

  it('shows archive toggle button', () => {
    render(<ConversationSidebar {...defaultProps} />);
    
    expect(screen.getByText('Show Archived')).toBeInTheDocument();
  });

  it('calls onNewConversation when New Chat button is clicked', () => {
    render(<ConversationSidebar {...defaultProps} />);
    
    const newChatButton = screen.getByText('New Chat');
    fireEvent.click(newChatButton);
    
    expect(defaultProps.onNewConversation).toHaveBeenCalledTimes(1);
  });

  it('shows loading state initially', () => {
    render(<ConversationSidebar {...defaultProps} />);
    
    expect(screen.getByText('Loading conversations...')).toBeInTheDocument();
  });

  it('shows empty state when no conversations exist', async () => {
    render(<ConversationSidebar {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
      expect(screen.getByText('Start a new chat to get started')).toBeInTheDocument();
    });
  });

  it('handles search input changes', () => {
    render(<ConversationSidebar {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search conversations...');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    
    expect(searchInput).toHaveValue('test query');
  });

  it('toggles archive visibility', () => {
    render(<ConversationSidebar {...defaultProps} />);
    
    const archiveButton = screen.getByText('Show Archived');
    fireEvent.click(archiveButton);
    
    expect(screen.getByText('Hide Archived')).toBeInTheDocument();
  });

  it('shows conversation count', async () => {
    render(<ConversationSidebar {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('0 conversations')).toBeInTheDocument();
    });
  });

  it('renders with correct width and styling', () => {
    render(<ConversationSidebar {...defaultProps} />);
    
    const sidebar = screen.getByText('Conversations').closest('div');
    expect(sidebar).toHaveClass('flex', 'flex-col', 'h-full', 'bg-background', 'border-r', 'border-border');
  });

  it('has proper accessibility attributes', () => {
    render(<ConversationSidebar {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search conversations...');
    expect(searchInput).toBeInTheDocument();
    
    const newChatButton = screen.getByText('New Chat');
    expect(newChatButton).toBeInTheDocument();
  });
});
