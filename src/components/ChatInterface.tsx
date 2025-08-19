import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Settings, Bot, User, Loader2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SettingsPanel } from './SettingsPanel';
import { ConversationSidebar } from './ConversationSidebar';
import { useToast } from '@/hooks/use-toast';
import { useConversationState } from '@/hooks/useConversationState';
import { useSettings } from '@/hooks/useSettings';
import { ApiService } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Conversation, Message } from '@/types/conversation';

export interface Provider {
  id: string;
  name: string;
  apiKeys: { id: string; name: string; key: string }[];
  models: string[];
  defaultModel: string;
  isLocal?: boolean; // For Ollama and other local providers
  baseUrl?: string; // For Ollama's local endpoint
}

export const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [providers, setProviders] = useState<Provider[]>([
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
    },
    {
      id: 'ollama',
      name: 'Ollama (Local)',
      apiKeys: [],
      models: ['llama3.2', 'llama3.2:3b', 'llama3.2:8b', 'llama3.2:70b', 'mistral', 'codellama', 'phi3'],
      defaultModel: 'llama3.2',
      isLocal: true,
      baseUrl: 'http://localhost:11434'
    }
  ]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const apiService = new ApiService();
  
  // Use the new centralized state management hooks
  const { 
    state: conversationState, 
    createConversation, 
    loadConversation, 
    addMessage, 
    switchModel,
    searchConversations,
    getConversationStats
  } = useConversationState();
  
  const { 
    settings, 
    updateSetting, 
    isLoading: settingsLoading 
  } = useSettings();

  // Initialize settings from the settings service
  useEffect(() => {
    if (settings) {
      setShowSidebar(!settings.sidebarCollapsed);
      // Don't auto-set provider/model - let user choose explicitly
    }
  }, [settings]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch models when Ollama is selected
  useEffect(() => {
    if (selectedProvider === 'ollama') {
      const fetchModels = async () => {
        try {
          const response = await fetch('http://localhost:11434/api/tags');
          if (response.ok) {
            const data = await response.json();
            const modelNames = data.models?.map((m: { name: string }) => m.name) || [];
            setAvailableModels(modelNames);
            
            // Update the providers array with actual available models
            setProviders(prev => prev.map(provider => 
              provider.id === 'ollama' 
                ? { ...provider, models: modelNames, defaultModel: modelNames[0] }
                : provider
            ));
          }
        } catch (error) {
          console.error('Failed to fetch models:', error);
        }
      };
      fetchModels();
    } else {
      setAvailableModels([]);
    }
  }, [selectedProvider]);

  // Update the providers array to use actual available models for Ollama
  useEffect(() => {
    if (selectedProvider === 'ollama' && availableModels.length > 0) {
      setProviders(prev => prev.map(provider => 
        provider.id === 'ollama' 
          ? { ...provider, models: availableModels, defaultModel: availableModels[0] }
          : provider
      ));
    }
  }, [availableModels, selectedProvider]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    const currentProvider = providers.find(p => p.id === selectedProvider);
    if (!currentProvider) return;

    // For local providers like Ollama, API key is not required
    if (!currentProvider.isLocal && (!selectedApiKey || !selectedModel)) {
      toast({
        title: "Configuration Required",
        description: "Please select a provider, API key, and model in settings.",
        variant: "destructive"
      });
      return;
    }

    // For Ollama, model is required but API key is not
    if (currentProvider.isLocal && !selectedModel) {
      toast({
        title: "Configuration Required",
        description: "Please select a model for Ollama in settings.",
        variant: "destructive"
      });
      return;
    }

    // Create conversation if none exists
    if (!conversationState.currentConversation) {
      const newConversation = await createConversation(
        selectedProvider,
        selectedModel
      );
    }

    // Handle model switching if needed
    if (conversationState.currentConversation && conversationState.currentConversation.currentModel !== selectedModel) {
      await switchModel(selectedModel);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      provider: selectedProvider
    };

    await addMessage(userMessage);
    setInput('');
    setIsLoading(true);

    // Start timing
    const startTime = Date.now();

    try {
      const chatRequest = {
        provider: selectedProvider,
        model: selectedModel,
        messages: [
          ...messages
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => ({ 
              role: msg.role as 'user' | 'assistant', 
              content: msg.content 
            })),
          { role: 'user' as const, content: input.trim() }
        ],
        apiKey: selectedApiKey,
        baseUrl: currentProvider.baseUrl
      };

      const response = await apiService.sendMessage(chatRequest);
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      const responseTimeSeconds = (responseTime / 1000).toFixed(1);
      
      // Prepend timing info to response content
      const timedContent = `Thought for ${responseTimeSeconds} seconds\n\n${response.content}`;
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: timedContent,
        timestamp: response.timestamp,
        provider: selectedProvider
      };

      await addMessage(assistantMessage);
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Conversation management functions
  const handleNewConversation = useCallback(async () => {
    try {
      // Create new conversation
      const newConversation = await createConversation(
        selectedProvider || 'ollama',
        selectedModel || 'llama3.2'
      );
      
      // Clear messages for new conversation
      setMessages([]);
      
      toast({
        title: "New Conversation",
        description: "Started a new conversation"
      });
    } catch (error) {
      console.error('Failed to create new conversation:', error);
      toast({
        title: "Error",
        description: "Failed to create new conversation",
        variant: "destructive"
      });
    }
  }, [selectedProvider, selectedModel, createConversation, toast]);

  const handleConversationSelect = useCallback(async (conversation: Conversation) => {
    try {
      // Load the selected conversation
      const loadedConversation = await loadConversation(conversation.id);
      
      // Set messages from loaded conversation
      setMessages(loadedConversation.messages);
      
      // Update provider and model selection
      setSelectedProvider(loadedConversation.provider);
      setSelectedModel(loadedConversation.currentModel);
      
      toast({
        title: "Conversation Loaded",
        description: `Switched to "${loadedConversation.title}"`
      });
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive"
      });
    }
  }, [loadConversation, toast]);

  const loadConversations = useCallback(async () => {
    try {
      // Use empty filters to get all conversations
      await searchConversations({
        searchQuery: '',
        provider: '',
        model: '',
        showArchived: false
      });
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, [searchConversations]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Auto-save conversation when messages change
  useEffect(() => {
    if (conversationState.currentConversation && messages.length > 0) {
      // The state manager handles auto-saving automatically
      // No need to manually call auto-save
    }
  }, [messages, conversationState.currentConversation]);

  // Handle model switching
  const handleModelChange = useCallback(async (newModel: string) => {
    if (newModel === selectedModel || !conversationState.currentConversation) return;

    try {
      // Switch model using the state manager
      await switchModel(newModel);

      // Update local state
      setSelectedModel(newModel);

      // Show notification
      toast({
        title: "Model Changed",
        description: `Switched to ${newModel}`,
        duration: 2000
      });
    } catch (error) {
      console.error('Failed to update model:', error);
      toast({
        title: "Error",
        description: "Failed to update model",
        variant: "destructive"
      });
    }
  }, [selectedModel, conversationState.currentConversation, switchModel, toast]);

  const currentProvider = providers.find(p => p.id === selectedProvider);
  const hasValidConfig = selectedProvider && selectedModel && 
    (currentProvider?.isLocal || selectedApiKey);

  return (
    <div className="flex h-screen bg-background">
      {/* Conversation Sidebar */}
      {showSidebar && (
        <div className="w-80 border-r border-border lg:block">
          <ConversationSidebar
            currentConversationId={conversationState.currentConversation?.id}
            onConversationSelect={handleConversationSelect}
            onNewConversation={handleNewConversation}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
          />
        </div>
      )}
      
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <div className="glass-panel border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Polyglut Chat</h1>
              {conversationState.currentConversation && (
                <p className="text-sm text-muted-foreground">
                  {conversationState.currentConversation.title}
                </p>
              )}
              {hasValidConfig && !conversationState.currentConversation && (
                <p className="text-sm text-muted-foreground">
                  {currentProvider?.name} • {selectedModel}
                </p>
              )}
              {/* Show available models for Ollama */}
              {selectedProvider === 'ollama' && availableModels.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span>Available models:</span>
                  <div className="flex gap-1">
                    {availableModels.slice(0, 3).map((model) => (
                      <Badge 
                        key={model} 
                        variant="outline" 
                        className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() => handleModelChange(model)}
                      >
                        {model}
                      </Badge>
                    ))}
                    {availableModels.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{availableModels.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className="glass-panel"
            >
              <Menu className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSettings(!showSettings)}
              className="glass-panel"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Bot className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Welcome to Polyglut Chat</h3>
                <p className="text-muted-foreground">
                  {hasValidConfig 
                    ? "Start a conversation by typing a message below."
                    : "Configure your API settings to get started."
                  }
                </p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 animate-message-in ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div className={`p-2 rounded-full ${
                  message.role === 'user' 
                    ? 'chat-bubble-user' 
                    : 'glass-panel'
                }`}>
                  {message.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`max-w-[70%] p-4 rounded-2xl ${
                    message.role === 'user'
                      ? 'chat-bubble-user rounded-tr-md'
                      : 'chat-bubble-ai rounded-tl-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex items-start gap-3 animate-message-in">
                <div className="glass-panel p-2 rounded-full">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="chat-bubble-ai rounded-tl-md p-4 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="animate-typing">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="glass-panel border-t p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={hasValidConfig ? "Type your message..." : "Configure settings first..."}
                  disabled={!hasValidConfig || isLoading}
                  className="min-h-[60px] max-h-[200px] resize-none glass-panel"
                  rows={1}
                />
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || !hasValidConfig || isLoading}
                className="self-end h-[60px] px-6"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative">
            <SettingsPanel
              providers={providers}
              setProviders={setProviders}
              selectedProvider={selectedProvider}
              setSelectedProvider={setSelectedProvider}
              selectedApiKey={selectedApiKey}
              setSelectedApiKey={setSelectedApiKey}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              onClose={() => setShowSettings(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};