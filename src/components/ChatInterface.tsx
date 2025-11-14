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
import { messageRouter } from '@/services/messageRouter';


import { runRAGPipeline } from "@/services/rag/ragPipeline";

const FORCE_ENABLE_RAG = false;
const RAG_DISTANCE_THRESHOLD = 0.3; 

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
    id: 'mistral',
    name: 'Mistral',
    apiKeys: [],
    models: [
      'mistral-large-latest',
      'mistral-medium-latest',
      'mistral-small-latest',
      'open-mistral-7b',
      'open-mixtral-8x7b',
      'open-mixtral-8x22b',
      'codestral-latest'
    ],
    defaultModel: 'mistral-large-latest'
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
  const [isPrivate, setIsPrivate] = useState(false);

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

const handleKeyPress = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
};

  // Added debugging 
const handleSendMessage = async () => {
  console.log('🚨 HANDLESENDMESSAGE CALLED WITH:', input);
  console.log('🚨 Current settings:', settings);
  const enableRAG = settings?.enableRAG ?? false;
  if (!input.trim() || !selectedProvider || !selectedModel) return;

        // === MCP integration ===
        // MCP (Model Context Protocol) routing decision logic:
        // The messageRouter.handleMessage() function analyzes the user's input using keyword matching
        // to determine if this is a request that should be handled by MCP tools instead of AI models.
        // For example, "What day is it?" matches date/time keywords and gets routed to the MCP day-server
        // via WebSocket, while "Write me a poem" has no MCP tool matches and goes to AI providers.

        console.log('🔍 About to call messageRouter.handleMessage() with:', input.trim());

        const mcpResult = await messageRouter.handleMessage(input.trim());
        console.log('🔍 messageRouter returned:', mcpResult);
        if (mcpResult) {
        // Ensure we have an active conversation
        if (!conversationState.currentConversation) {
          if (conversationState.createConversation) {
            await conversationState.createConversation(selectedProvider, selectedModel);
          }
        }
        // First add the user message
        const userMessage: Message = {
          id: `msg_${Date.now()}`,
          role: 'user', 
          content: input.trim(),
          timestamp: new Date(),
          provider: selectedProvider
        };

        setMessages(prev => [...prev, userMessage]);

        if (conversationState.addMessage) {
          await conversationState.addMessage(userMessage);
        }
        // MCP tool successfully handled the request and returned a direct answer
        // (e.g., day-server returned "Friday, November 22, 2024")
        // Display this result immediately without involving any AI processing
        const mcpAssistantMessage: Message = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: mcpResult,
          timestamp: new Date(),
          provider: 'MCP'
        };
        
        setMessages(prev => [...prev, mcpAssistantMessage]);
        
        // Persist the MCP response to conversation history for future reference
        if (conversationState.addMessage) {
          await conversationState.addMessage(mcpAssistantMessage);
        }
        return; // Exit early - MCP provided the answer, no need for AI processing
      }
        // === End MCP integration ===

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

  let ragUsed = false;
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

    // Create the assistant message placeholder
    const assistantMessage: Message = {
      id: `msg_${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      provider: selectedProvider,
      usedRAG: false
    };

    // Add the assistant message to the UI immediately with loading state
    const startTime = Date.now();
    setMessages(prev => [...prev, {...assistantMessage, isThinking: true, startTime}]);

    // === RAG integration (build messagesToSend) ===
  console.log('🔍 Starting RAG integration check...');
  console.log('🔍 settings object:', settings);
  console.log('🔍 settings?.enableRAG:', enableRAG);
    
  let messagesToSend: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = 
    messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

  messagesToSend.push({ role: 'user', content: input.trim() });

    // MCP system-prompt injection is handled centrally by ApiService (cached at initialization).


  if (FORCE_ENABLE_RAG || enableRAG) {   
      console.log('🔍 RAG is enabled, querying for context...');
      const ragRequest = { question: input.trim(), k: 5 };
      console.log('🚀 RAG Request:', JSON.stringify(ragRequest, null, 2));
      console.log('🌐 Making request to: http://localhost:3001/query-rag');

      try {
        const startTime = Date.now();
        const response = await fetch('http://localhost:3001/query-rag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ragRequest)
        });
        const responseTime = Date.now() - startTime;

        console.log(`⏱️ RAG response received in ${responseTime}ms`);
        console.log(`🔍 Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ RAG Error Response:', errorText);
          throw new Error(`RAG endpoint returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('📦 RAG Response Data:', JSON.stringify(data, null, 2));

        if (!data.results || data.results.length === 0) {
          console.warn('⚠️ RAG returned empty results array');
        } else {
          console.log(`✅ RAG returned ${data.results.length} results`);
        }

        if (data.results && data.results.length > 0) {
          // Check if the results are actually relevant (strict threshold)
          const relevantResults = data.results.filter(chunk => chunk.distance < 0.3);
          
          if (relevantResults.length > 0) {
            // Use RAG context
            const chunks = relevantResults.map(chunk => chunk.content).join('\n\n');
            const context = `Use the following context to answer the question. If the context doesn't contain relevant information, say "I don't have information about that in the provided context."\n\nContext:\n${chunks}`;
            
            messagesToSend = [
              { role: 'system', content: context },
              { role: 'user', content: input.trim() }
            ];
            ragUsed = true;
            
            console.log(`🔍 RAG: Retrieved ${relevantResults.length} relevant chunks (filtered from ${data.results.length})`);
            console.log('🔍 First chunk preview:', relevantResults[0].content.substring(0, 100) + '...');
            console.log('🔍 System message length:', context.length, 'characters');
          } else {
            console.log('🔍 RAG: No relevant results found (all above distance threshold), using general knowledge');
          }
        } else {
          console.log('🔍 RAG: No results found, using general knowledge');
        }
      } catch (err) {
        console.error('🔍 RAG API error:', err);
        console.log('🔍 Falling back to non-RAG query');
        // Fall back to non-RAG query
      }
    } else {
      console.log('🔍 RAG is disabled');
      console.log('🔍 About to send to LLM, ragUsed:', ragUsed);
      console.log('🔍 messagesToSend:', messagesToSend);
    }
    // === End RAG integration ===

    // Send the message to the LLM using existing ApiService
    console.log('🔍 Sending to LLM:', {
      provider: selectedProvider,
      model: selectedModel,
      messageCount: messagesToSend.length,
      hasSystemMessage: messagesToSend.some(m => m.role === 'system'),
      userMessage: messagesToSend.find(m => m.role === 'user')?.content?.substring(0, 100) + '...'
    });
    
    const apiKey = settings?.[selectedApiKey] || '';
    const apiService = new ApiService();
    const response = await apiService.sendMessage({
      provider: selectedProvider,
      model: selectedModel,
      messages: messagesToSend,
      apiKey,
      baseUrl: selectedProvider === "ollama" ? "http://localhost:11434" : undefined
    });

    // Calculate thinking time
    const endTime = Date.now();
    const thinkingTimeSeconds = ((endTime - startTime) / 1000).toFixed(1);
    
    // Update the assistant message with the response and thinking time
    const updatedAssistantMessage = {
      ...assistantMessage,
      content: `*Thought for ${thinkingTimeSeconds} seconds*\n\n${response.content}`,
      // content: response.content,
      timestamp: new Date(),
      usedRAG: ragUsed,
      isThinking: false
    };

    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === assistantMessage.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = updatedAssistantMessage;
        return updated;
      }
      return [...prev, updatedAssistantMessage];
    });

    // Add assistant response to conversation state
    if (conversationState.addMessage) {
      await conversationState.addMessage(updatedAssistantMessage);
    }
  } catch (error) {
    console.error('Error sending message:', error);
    toast({
      title: 'Error',
      description: 'Failed to send message. Check console for details.',
      variant: 'destructive'
    });
  } finally {
    console.log('🔍 Finished handleSendMessage, ragUsed:', ragUsed);
    setIsLoading(false);
  }
};

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // Immediate scroll
    scrollToBottom();
    
    // Additional scroll after a brief delay to handle any async updates
    const timeoutId = setTimeout(scrollToBottom, 100);
    
    return () => clearTimeout(timeoutId);
  }, [messages, scrollToBottom]);

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

  // Load current conversation messages (but don't override during active chat)
  useEffect(() => {
    // Don't override messages if we're currently loading (sending a message)
    if (isLoading) return;
    
    if (conversationState.currentConversation) {
      setMessages(conversationState.currentConversation.messages || []);
    } else {
      setMessages([]);
    }
  }, [conversationState.currentConversation, isLoading]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-30 w-79 transform bg-white shadow-lg transition-transform duration-300 ease-in-out md:relative md:translate-x-0`}>
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


          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="rag-checkbox" className="text-sm font-medium">
                RAG
              </label>
              <input
                id="rag-checkbox"
                type="checkbox"
                checked={settings?.enableRAG ?? false}
                onChange={(e) => updateSetting('enableRAG', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>
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
                  <div className="flex flex-col items-center">
                    <Bot className="h-4 w-4" />
                    {message.usedRAG && (
                      <span className="text-xs mt-1">📑</span>
                    )}
                    </div>
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
                {/* Smart thinking throbber - only shows when waiting for model response */}
                {isLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}
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