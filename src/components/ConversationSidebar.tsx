// src/components/ConversationSidebar.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Plus, 
  Archive, 
  Trash2, 
  MoreHorizontal, 
  MessageSquare,
  Clock,
  Bot,
  Filter,
  X,
  Edit3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useConversationState } from '@/hooks/useConversationState';
import { Conversation, ConversationMetadata } from '@/types/conversation';

interface ConversationSidebarProps {
  currentConversationId?: string;
  onConversationSelect: (conversation: Conversation) => void;
  onNewConversation: () => void;
  selectedProvider: string;
  selectedModel: string;
}

export const ConversationSidebar = ({
  currentConversationId,
  onConversationSelect,
  onNewConversation,
  selectedProvider,
  selectedModel
}: ConversationSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [filterModel, setFilterModel] = useState<string>('');
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  
  // Use the new centralized state management hook
  const { 
    state: conversationState, 
    toggleArchive, 
    deleteConversation,
    updateConversationMetadata,
    searchConversations
  } = useConversationState();
  
  const [conversationToRename, setConversationToRename] = useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const { toast } = useToast();
  
  // Load conversations based on filters
  useEffect(() => {
    const loadFilteredConversations = async () => {
      try {
        console.log('=== DEBUG: Loading conversations with filters ===');
        console.log('Current filters:', { 
          showArchived, 
          filterProvider, 
          filterModel, 
          searchQuery 
        });
        
        // Use the state manager's searchConversations method to get filtered conversations
        const results = await searchConversations({
          searchQuery: searchQuery,
          provider: filterProvider,
          model: filterModel,
          showArchived: showArchived
        });
        
        console.log(`[ConversationSidebar] Loaded ${results.length} conversations (showArchived: ${showArchived})`);
        setFilteredConversations(results);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    };
    
    loadFilteredConversations();
  }, [searchQuery, filterProvider, filterModel, showArchived, searchConversations]);
  
  // Handle the archive toggle
  const handleToggleArchive = useCallback(async (conversationOrId: Conversation | string) => {
    // Handle both Conversation object and string ID cases
    const conversationId = typeof conversationOrId === 'string' ? conversationOrId : conversationOrId.id;
    const targetConversation = typeof conversationOrId === 'string' 
      ? conversationState.conversations.find(c => c.id === conversationOrId)
      : conversationOrId;
      
    if (!targetConversation) {
      console.error('Conversation not found:', conversationOrId);
      return;
    }

    console.log('=== DEBUG: Toggling archive status ===');
    console.log('Conversation before toggle:', {
      id: targetConversation.id,
      title: targetConversation.title,
      currentState: targetConversation.isArchived ? 'archived' : 'unarchived',
      willChangeTo: !targetConversation.isArchived ? 'archived' : 'unarchived'
    });
    
    try {
      await toggleArchive(conversationId);
      console.log('Successfully toggled archive status for conversation:', conversationId);
      
      // Log the new state after a short delay to ensure state has updated
      setTimeout(() => {
        const updated = conversationState.conversations.find(c => c.id === conversationId);
        console.log('Conversation state after toggle:', updated);
        console.log('All conversations after toggle:', conversationState.conversations.map(c => ({
          id: c.id,
          title: c.title,
          isArchived: c.isArchived,
          lastModified: c.lastModified
        })));
      }, 100);
      
      // Refresh the conversation list to reflect the changes
      // Use the current showArchived state to maintain the current view
      await searchConversations({
        searchQuery: searchQuery,
        provider: filterProvider,
        model: filterModel,
        showArchived: showArchived  // Include the current showArchived state
      });
      
      console.log('Refreshed conversation list with showArchived:', showArchived);
    } catch (error) {
      console.error('Failed to toggle archive status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update conversation status',
        variant: 'destructive',
      });
    }
  }, [toggleArchive, toast, searchConversations, searchQuery, showArchived, filterProvider, filterModel]);

  const handleDelete = useCallback(async (conversation: Conversation) => {
    try {
      await deleteConversation(conversation.id);
      // Refresh the conversation list after deletion
      const results = await searchConversations({
        searchQuery,
        provider: filterProvider,
        model: filterModel,
        showArchived
      });
      setFilteredConversations(results);
      
      toast({
        title: 'Success',
        description: 'Conversation deleted',
      });
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      });
    }
  }, [deleteConversation, searchConversations, searchQuery, filterProvider, filterModel, showArchived, toast]);

  const handleRenameConversation = useCallback((conversation: Conversation) => {
    setConversationToRename(conversation);
    setNewTitle(conversation.title);
    setIsRenameDialogOpen(true);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!conversationToRename || !newTitle.trim() || newTitle.trim() === conversationToRename.title) {
      setIsRenameDialogOpen(false);
      return;
    }

    try {
      // Update the conversation title using the state manager
      await updateConversationMetadata(conversationToRename.id, { title: newTitle.trim() });
      
      setIsRenameDialogOpen(false);
      setConversationToRename(null);
      setNewTitle('');
      toast({
        title: "Chat Renamed",
        description: `Chat renamed to "${newTitle.trim()}"`,
      });
    } catch (error) {
      toast({
        title: "Rename Failed",
        description: "Failed to rename chat. Please try again.",
        variant: "destructive",
      });
    }
  }, [conversationToRename, newTitle, updateConversationMetadata, toast]);

  const handleConversationSelect = useCallback((conversation: Conversation) => {
    onConversationSelect(conversation);
  }, [onConversationSelect]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterProvider('');
    setFilterModel('');
  }, []);

  // Helper function to format dates
  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours}h ago`;
    } else if (diffInHours < 168) { // 7 days
      const days = Math.floor(diffInHours / 24);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Helper function to get provider icon
  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'ollama':
        return <Bot className="w-4 h-4" />;
      case 'openai':
        return <MessageSquare className="w-4 h-4" />;
      case 'anthropic':
        return <MessageSquare className="w-4 h-4" />;
      case 'google':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchQuery) count++;
    if (filterProvider) count++;
    if (filterModel) count++;
    return count;
  };

  // ConversationItem component definition (moved inside main component for scope access)
  const ConversationItem = ({
    conversation,
    isActive,
    onSelect,
    onArchive,
    onUnarchive,
    onDelete,
    onRename,
    showArchived
  }: {
    conversation: Conversation;
    isActive: boolean;
    onSelect: () => void;
    onArchive: () => void;
    onUnarchive: () => void;
    onDelete: () => void;
    onRename: () => void;
    showArchived: boolean;
  }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleAction = (action: () => void) => {
      action();
      setIsMenuOpen(false);
    };

    return (
      <div
        className={`
          group relative p-3 rounded-lg cursor-pointer transition-all duration-200
          ${isActive 
            ? 'bg-primary text-primary-foreground shadow-sm' 
            : 'hover:bg-muted/50 hover:shadow-sm'
          }
        `}
        onClick={onSelect}
      >
        {/* Conversation Content */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            {getProviderIcon(conversation.provider)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-medium text-sm truncate ${
                isActive ? 'text-primary-foreground' : 'text-foreground'
              }`}>
                {conversation.title}
              </h3>
              {conversation.isArchived && (
                <Archive className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
            
            <p className={`text-xs truncate mb-2 ${
              isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
            }`}>
              {conversation.messages?.length > 0 
                ? (typeof conversation.messages[conversation.messages.length - 1].content === 'string'
                    ? conversation.messages[conversation.messages.length - 1].content.substring(0, 50)
                    : 'Message with content')
                : 'No messages yet'}
              {conversation.messages?.length > 0 && conversation.messages[conversation.messages.length - 1].content.length > 50 ? '...' : ''}
            </p>
            
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span className={isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}>
                  {formatDate(conversation.lastModified)}
                </span>
              </div>
              
              <Badge 
                variant="secondary" 
                className={`text-xs ${
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : ''
                }`}
              >
                {conversation.currentModel}
              </Badge>
            </div>
          </div>
        </div>

        {/* Action Menu */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 w-6 p-0 ${
                    isActive ? 'hover:bg-primary-foreground/20' : 'hover:bg-muted'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent align="end" className="w-48">
                {conversation.isArchived ? (
                  <DropdownMenuItem onClick={() => handleAction(onUnarchive)}>
                    <Archive className="w-4 h-4 mr-2" />
                    Restore from Archive
                  </DropdownMenuItem>
                ) : (
                                      <>
                      <DropdownMenuItem onClick={() => onRename()}>
                        <Edit3 className="w-4 h-4 mr-2" />
                        Rename Chat
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAction(onArchive)}>
                        <Archive className="w-4 h-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    </>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={() => handleAction(onDelete)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Permanently
                </DropdownMenuItem>
              </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Header */}
      <div className="p-4 pb-2 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold mr-4">Conversations</h2>
          <Button
            onClick={onNewConversation}
            size="sm"
            className="h-8 px-3 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Chat
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 h-9"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filters:</span>
          
          {filterProvider && (
            <Badge variant="secondary" className="text-xs">
              {filterProvider}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                onClick={() => setFilterProvider('')}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
          
          {filterModel && (
            <Badge variant="secondary" className="text-xs">
              {filterModel}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                onClick={() => setFilterModel('')}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
          
          {getActiveFiltersCount() > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={clearFilters}
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Archive Toggle */}
        <div className="flex items-center justify-between">
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className="h-7 px-2 text-xs"
          >
            <Archive className="w-3 h-3 mr-1" />
            {showArchived ? 'Hide' : 'Show'} Archived
          </Button>
          
          <span className="text-xs text-muted-foreground">
            {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {conversationState.isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery || filterProvider || filterModel ? (
              <div>
                <p>No conversations match your filters.</p>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={clearFilters}
                  className="mt-2"
                >
                  Clear filters
                </Button>
              </div>
            ) : showArchived ? (
              <p>No archived conversations.</p>
            ) : (
              <p>No conversations yet. Start chatting to create one!</p>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === currentConversationId}
                onSelect={() => handleConversationSelect(conversation)}
                onArchive={() => handleToggleArchive(conversation.id)}
                onUnarchive={() => handleToggleArchive(conversation.id)}
                onDelete={() => handleDelete(conversation)}
                onRename={() => handleRenameConversation(conversation)}
                showArchived={showArchived}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="chat-title" className="text-sm font-medium">
                Chat Title
              </Label>
              <Input
                id="chat-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter new chat title..."
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameSubmit();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsRenameDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleRenameSubmit}>
                Rename
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
