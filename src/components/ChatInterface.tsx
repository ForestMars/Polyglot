import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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

// Default providers configuration
const DEFAULT_PROVIDERS = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    apiKeys: [],
    models: [
      'openai/gpt-4-turbo',
      'anthropic/claude-3-opus',
      'google/gemini-pro',
      'meta-llama/llama-3-70b-instruct',
      'mistralai/mistral-large-latest'
    ],
    defaultModel: 'openai/gpt-4-turbo'
  },
  {
    id: 'together',
    name: 'TogetherAI',
    apiKeys: [],
    models: [
      'meta-llama/Llama-3-70b-chat-hf',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'Qwen/Qwen1.5-72B-Chat',
      'codellama/CodeLlama-70b-Instruct-hf'
    ],
    defaultModel: 'meta-llama/Llama-3-70b-chat-hf'
  },
  {
    id: 'groq',
    name: 'Groq',
    apiKeys: [],
    models: [
      'mixtral-8x7b-32768',
      'llama3-70b-8192',
      'llama3-8b-8192'
    ],
    defaultModel: 'mixtral-8x7b-32768'
  },
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
    isLocal: true
  }
];

export interface Provider {
  id: string;
  name: string;
  apiKeys: { id: string; name: string; key: string }[];
  models: string[];
  defaultModel: string;
  isLocal?: boolean;
  baseUrl?: string;
}

export const ChatInterface = () => {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isSwitchingConversation, setIsSwitchingConversation] = useState(false);
  const [providers, setProviders] = useState<Provider[]>(DEFAULT_PROVIDERS);

  // Refs
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const switchConversationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks
  const { settings, updateSetting, isLoading: isSettingsLoading } = useSettings();
  const { toast } = useToast();
  const conversationState = useConversationState();

  // Derived state from settings
  const selectedProvider = settings?.selectedProvider || '';
  const selectedApiKey = settings?.selectedApiKey || '';
  const selectedModel = settings?.selectedModel || '';

  // Get current provider details
  const currentProvider = useMemo(() =>
    providers.find(p => p.id === selectedProvider),
    [providers, selectedProvider]
  );

  // Check if settings are properly configured
  const isConfigured = selectedProvider && selectedModel && (currentProvider?.isLocal || selectedApiKey);

  // Fetch models when provider changes
  useEffect(() => {
    const fetchModels = async () => {
      try {
        if (selectedProvider === 'ollama') {
          const response = await fetch('http://localhost:11434/api/tags');
          const data = await response.json();
          const modelNames = data.models?.map((m: any) => m.name) || [];
          setAvailableModels(modelNames);

          setProviders(prev =>
            prev.map(provider =>
              provider.id === 'ollama'
                ? { ...provider, models: modelNames, defaultModel: modelNames[0] || 'llama3.2' }
                : provider
            )
          );
        } else if (selectedProvider) {
          const provider = DEFAULT_PROVIDERS.find(p => p.id === selectedProvider);
          if (provider) {
            setAvailableModels(provider.models);
          }
        } else {
          setAvailableModels([]);
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
        setAvailableModels([]);
      }
    };

    fetchModels();
  }, [selectedProvider]);

  // Handle provider change
  const handleProviderChange = async (providerId: string) => {
    // Update settings
    await updateSetting('selectedProvider', providerId);
    await updateSetting('selectedModel', '');

    // Update available models for the selected provider
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      setAvailableModels(provider.models);
    }
  };

  // Handle API key change
  const handleApiKeyChange = async (keyId: string) => {
    await updateSetting('selectedApiKey', keyId);
  };

  // Handle new conversation
  const handleNewConversation = useCallback(async () => {
    if (!selectedProvider || !selectedModel) {
      toast({
        title: 'Error',
        description: 'Please select a provider and model first',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSwitchingConversation(true);
      setMessages([]);
      setInput('');
      
      // Create a new conversation
      if (conversationState.createConversation) {
        const newConversation = await conversationState.createConversation(selectedProvider, selectedModel);
        
        // Make sure the conversation is properly set as current
        if (conversationState.loadConversation) {
          await conversationState.loadConversation(newConversation.id);
        }
      }
    } catch (error) {
      console.error('Failed to create new conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create a new conversation',
        variant: 'destructive'
      });
    } finally {
      setIsSwitchingConversation(false);
    }
  }, [conversationState, selectedProvider, selectedModel, toast]);

  // Handle send message
  const handleSendMessage = async () => {
    if (!input.trim() || !selectedProvider || !selectedModel) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      provider: selectedProvider
    };

    // Add user message to local state
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      setIsLoading(true);

      // Create new conversation if needed
      if (!conversationState.currentConversation?.id && conversationState.createConversation) {
        await conversationState.createConversation(selectedProvider, selectedModel);
      }

      // Add user message to the conversation
      if (conversationState.addMessage) {
        await conversationState.addMessage(userMessage);
      }

      // Get the API key for the selected provider
      const apiKey = settings?.[selectedApiKey] || '';

      // Create the assistant message placeholder
      const assistantMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        provider: selectedProvider
      };

      // Add the assistant message to the UI immediately
      setMessages(prev => [...prev, assistantMessage]);

      // Get all messages including the new user message
      const allMessages = [...messages, userMessage];

      // Filter out system messages before sending to the API
      const filteredMessages = allMessages
        .filter((msg): msg is Message => 
          msg.role === 'user' || msg.role === 'assistant'
        )
        .map(({ role, content }) => ({ 
          role: role as 'user' | 'assistant', 
          content 
        }));

      // Call the API service to get the AI response
      const apiService = new ApiService();
      const response = await apiService.sendMessage({
        provider: selectedProvider,
        model: selectedModel,
        messages: filteredMessages,
        apiKey,
        baseUrl: selectedProvider === 'ollama' ? 'http://localhost:11434' : undefined
      });

      // Update the assistant message with the response
      const updatedAssistantMessage = {
        ...assistantMessage,
        content: response.content,
        timestamp: new Date()
      };

      // Update local state
      setMessages(prev => {
        const messageIndex = prev.findIndex(m => m.id === assistantMessage.id);
        if (messageIndex !== -1) {
          const updatedMessages = [...prev];
          updatedMessages[messageIndex] = updatedAssistantMessage;
          return updatedMessages;
        }
        return [...prev, updatedAssistantMessage];
      });

      // Add the assistant's response to the conversation
      if (conversationState.addMessage) {
        await conversationState.addMessage(updatedAssistantMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Get a user-friendly error message
      let errorMessage = 'Sorry, there was an error processing your message. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Failed to connect to the AI service. Please check your internet connection and try again.';
        } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
          errorMessage = 'Authentication failed. Please check your API key in settings.';
        } else if (error.message.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (error.message.includes('model')) {
          errorMessage = 'Model not found. Please select a different model in settings.';
        }
      }
      
      // Update the error message in the UI
      setMessages(prev => {
        const messageIndex = prev.findIndex(m => m.role === 'assistant' && m.content === '');
        if (messageIndex !== -1) {
          const updatedMessages = [...prev];
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            content: errorMessage
          };
          return updatedMessages;
        }
        return [...prev, {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date(),
          isError: true
        }];
      });
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press in the input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // Check if we have a valid configuration
  const hasValidConfig = selectedProvider && selectedModel && (currentProvider?.isLocal || selectedApiKey);

  // Handle conversation selection
  const handleConversationSelect = useCallback(async (conversation: Conversation) => {
    if (isSwitchingConversation || conversationState.currentConversation?.id === conversation.id) {
      return;
    }

    setIsSwitchingConversation(true);
    try {
      // Load the selected conversation
      const loadedConversation = await conversationState.loadConversation(conversation.id);
      
      // Update messages with the loaded conversation's messages
      if (loadedConversation && loadedConversation.messages) {
        setMessages([...loadedConversation.messages]);
      } else {
        setMessages([]);
      }
      
      // Update selected model if needed
      if (loadedConversation.currentModel && loadedConversation.currentModel !== selectedModel) {
        await updateSetting('selectedModel', loadedConversation.currentModel);
      }
      
      // Update selected provider if needed
      if (loadedConversation.provider && loadedConversation.provider !== selectedProvider) {
        await updateSetting('selectedProvider', loadedConversation.provider);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to load conversation. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSwitchingConversation(false);
    }
  }, [conversationState, isSwitchingConversation, selectedModel, selectedProvider, updateSetting, toast]);

  // Load current conversation messages
  useEffect(() => {
    if (conversationState.currentConversation) {
      setMessages(conversationState.currentConversation.messages || []);
    } else {
      setMessages([]);
    }
  }, [conversationState.currentConversation]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-30 w-64 transform bg-white shadow-lg transition-transform duration-300 ease-in-out md:relative md:translate-x-0`}>
        <ConversationSidebar
          currentConversationId={conversationState.currentConversation?.id}
          onConversationSelect={handleConversationSelect}
          onNewConversation={handleNewConversation}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 bg-background">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 shadow-sm">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="ml-2 text-lg font-semibold">Polyglut</h1>
            {selectedModel && (
              <span className="ml-2 text-sm text-muted-foreground">
                {selectedModel.split('/').pop()}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </div>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4 bg-background" ref={scrollAreaRef}>
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
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className={`p-4 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-none'
                      : 'bg-muted rounded-tl-none'
                  }`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                {isLoading && (
                  <div className="chat-bubble-ai rounded-tl-md p-4 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="animate-typing">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="bg-card border-t p-4 shadow-sm">
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
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSettings(false);
            }
          }}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <SettingsPanel
              providers={providers}
              setProviders={setProviders}
              selectedProvider={selectedProvider}
              setSelectedProvider={async (providerId) => await updateSetting('selectedProvider', providerId)}
              selectedApiKey={selectedApiKey}
              setSelectedApiKey={async (keyId) => await updateSetting('selectedApiKey', keyId)}
              selectedModel={selectedModel}
              setSelectedModel={async (model) => await updateSetting('selectedModel', model)}
              onClose={() => setShowSettings(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};