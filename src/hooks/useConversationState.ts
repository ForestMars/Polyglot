// src/hooks/useConversationState.ts
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ConversationStateManager, ConversationState, ConversationFilters } from '@/services/conversationStateManager';
import { Conversation, Message } from '@/types/conversation';
import { indexedDbStorage } from '@/services/indexedDbStorage';

export const useConversationState = () => {
  const [state, setState] = useState<ConversationState>({
    conversations: [],
    currentConversation: null,
    isLoading: false,
    error: null,
    lastUpdated: new Date()
  });
  
  // Create a single instance of the state manager
  const stateManager = useMemo(() => new ConversationStateManager(), []);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize state manager
  useEffect(() => {

    const initializeManager = async () => {
      try {
        const testChats = await indexedDbStorage.listConversations();
        console.log('Direct IndexedDB test:', testChats.length);
        // Subscribe to state changes
        const unsubscribe = stateManager.subscribe(setState);
        unsubscribeRef.current = unsubscribe;
        
        // Initialize the manager
        await stateManager.initialize();
      } catch (error) {
        console.error('Failed to initialize conversation state manager:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Initialization failed'
        }));
      }
    };

    initializeManager();

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      stateManager.destroy();
    };
  }, [stateManager]);

  // Conversation operations
  const createConversation = useCallback(async (provider: string, model: string) => {
    return await stateManager.createConversation(provider, model);
  }, [stateManager]);

  const loadConversation = useCallback(async (id: string) => {
    return await stateManager.loadConversation(id);
  }, [stateManager]);

  const addMessage = useCallback(async (message: Message) => {
    return await stateManager.addMessage(message);
  }, [stateManager]);

  const switchModel = useCallback(async (newModel: string) => {
    return await stateManager.switchModel(newModel);
  }, [stateManager]);

  const toggleArchive = useCallback(async (conversationId: string) => {
    return await stateManager.toggleArchive(conversationId);
  }, [stateManager]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    return await stateManager.deleteConversation(conversationId);
  }, [stateManager]);

  const updateConversationMetadata = useCallback(async (conversationId: string, updates: Partial<Pick<Conversation, 'title'>>) => {
    return await stateManager.updateConversationMetadata(conversationId, updates);
  }, [stateManager]);

  const searchConversations = useCallback(async (filters: ConversationFilters) => {
    return await stateManager.searchConversations(filters);
  }, [stateManager]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const refreshConversations = useCallback(async () => {
    // Force reload conversations
    await stateManager.initialize();
  }, [stateManager]);

  // Cache operations
  const toggleCache = useCallback(() => {
    stateManager.toggleCache();
  }, [stateManager]);

  const isCacheEnabled = useCallback(() => {
    return stateManager.isCacheEnabled();
  }, [stateManager]);

  return {
    // State
    state,
    
    // Conversation operations
    createConversation,
    loadConversation,
    addMessage,
    switchModel,
    toggleArchive,
    deleteConversation,
    updateConversationMetadata,
    searchConversations,
    clearError,
    refreshConversations,
    toggleCache,
    isCacheEnabled,
    conversations: state.conversations,
    currentConversation: state.currentConversation,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated
  };
};
