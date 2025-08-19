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
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Conversation, ConversationMetadata } from '@/types/conversation';
import { StorageService } from '@/services/storage';
import { ConversationUtils } from '@/services/conversationUtils';

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [filterModel, setFilterModel] = useState<string>('');
  
  const { toast } = useToast();
  const storageService = new StorageService();

  // Load conversations on mount and when dependencies change
  useEffect(() => {
    loadConversations();
  }, [showArchived]);

  // Filter conversations based on search and filters
  useEffect(() => {
    let filtered = conversations.filter(conv => {
      // Filter by archive status
      if (conv.isArchived !== showArchived) return false;
      
      // Filter by provider
      if (filterProvider && conv.provider !== filterProvider) return false;
      
      // Filter by model
      if (filterModel && conv.currentModel !== filterModel) return false;
      
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = conv.title.toLowerCase().includes(query);
        const matchesContent = conv.messages.some(msg => 
          msg.content.toLowerCase().includes(query)
        );
        if (!matchesTitle && !matchesContent) return false;
      }
      
      return true;
    });

    // Sort by last modified (newest first)
    filtered.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    
    setFilteredConversations(filtered);
  }, [conversations, searchQuery, showArchived, filterProvider, filterModel]);

  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedConversations = await storageService.listConversations();
      setConversations(loadedConversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [storageService, toast]);

  const handleConversationSelect = useCallback((conversation: Conversation) => {
    onConversationSelect(conversation);
  }, [onConversationSelect]);

  const handleArchiveConversation = useCallback(async (conversationId: string) => {
    try {
      await storageService.archiveConversation(conversationId);
      await loadConversations();
      toast({
        title: "Conversation Archived",
        description: "The conversation has been moved to archives"
      });
    } catch (error) {
      console.error('Failed to archive conversation:', error);
      toast({
        title: "Error",
        description: "Failed to archive conversation",
        variant: "destructive"
      });
    }
  }, [storageService, loadConversations, toast]);

  const handleUnarchiveConversation = useCallback(async (conversationId: string) => {
    try {
      await storageService.unarchiveConversation(conversationId);
      await loadConversations();
      toast({
        title: "Conversation Restored",
        description: "The conversation has been restored from archives"
      });
    } catch (error) {
      console.error('Failed to restore conversation:', error);
      toast({
        title: "Error",
        description: "Failed to restore conversation",
        variant: "destructive"
      });
    }
  }, [storageService, loadConversations, toast]);

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    try {
      await storageService.deleteConversation(conversationId);
      await loadConversations();
      toast({
        title: "Conversation Deleted",
        description: "The conversation has been permanently deleted"
      });
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  }, [storageService, loadConversations, toast]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterProvider('');
    setFilterModel('');
  }, []);

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

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchQuery) count++;
    if (filterProvider) count++;
    if (filterModel) count++;
    return count;
  };

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <Button
            onClick={onNewConversation}
            size="sm"
            className="h-8 px-3"
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
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery || filterProvider || filterModel ? (
              <>
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No conversations match your filters</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-2"
                >
                  Clear filters
                </Button>
              </>
            ) : showArchived ? (
              <>
                <Archive className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No archived conversations</p>
              </>
            ) : (
              <>
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-sm">Start a new chat to get started</p>
              </>
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
                onArchive={() => handleArchiveConversation(conversation.id)}
                onUnarchive={() => handleUnarchiveConversation(conversation.id)}
                onDelete={() => handleDeleteConversation(conversation.id)}
                showArchived={showArchived}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  showArchived: boolean;
}

const ConversationItem = ({
  conversation,
  isActive,
  onSelect,
  onArchive,
  onUnarchive,
  onDelete,
  showArchived
}: ConversationItemProps) => {
  const [showActions, setShowActions] = useState(false);

  const handleAction = (action: () => void) => {
    action();
    setShowActions(false);
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
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
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
            {ConversationUtils.getSummary(conversation)}
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
      {showActions && (
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
          <DropdownMenu open={showActions} onOpenChange={setShowActions}>
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
                <DropdownMenuItem onClick={() => handleAction(onArchive)}>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </DropdownMenuItem>
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
      )}
    </div>
  );
};

// Helper function to get provider icon (moved outside component for reusability)
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
