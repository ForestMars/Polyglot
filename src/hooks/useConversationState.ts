import { useState, useEffect, useCallback, useRef } from 'react';
import { ConversationStateManager, ConversationState, ConversationFilters } from '@/services/conversationStateManager';
import { Conversation, Message } from '@/types/conversation';

export const useConversationState = () => {
  const [state, setState] = useState<ConversationState>({
    conversations: [],
    currentConversation: null,
    isLoading: false,
    error: null,
    lastUpdated: new Date()
  });
  
  const stateManagerRef = useRef<ConversationStateManager | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize state manager
  useEffect(() => {
    const initializeManager = async () => {
      try {
        const manager = new ConversationStateManager();
        stateManagerRef.current = manager;
        
        // Subscribe to state changes
        const unsubscribe = manager.subscribe(setState);
        unsubscribeRef.current = unsubscribe;
        
        // Initialize the manager
        await manager.initialize();
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
      if (stateManagerRef.current) {
        stateManagerRef.current.destroy();
      }
    };
  }, []);

  // Conversation operations
  const createConversation = useCallback(async (provider: string, model: string) => {
    if (!stateManagerRef.current) {
      throw new Error('State manager not initialized');
    }
    return await stateManagerRef.current.createConversation(provider, model);
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    if (!stateManagerRef.current) {
      throw new Error('State manager not initialized');
    }
    return await stateManagerRef.current.loadConversation(id);
  }, []);

  const addMessage = useCallback(async (message: Message) => {
    if (!stateManagerRef.current) {
      throw new Error('State manager not initialized');
    }
    return await stateManagerRef.current.addMessage(message);
  }, []);

  const switchModel = useCallback(async (newModel: string) => {
    if (!stateManagerRef.current) {
      throw new Error('State manager not initialized');
    }
    return await stateManagerRef.current.switchModel(newModel);
  }, []);

  const toggleArchive = useCallback(async (conversationId: string) => {
    if (!stateManagerRef.current) {
      throw new Error('State manager not initialized');
    }
    return await stateManagerRef.current.toggleArchive(conversationId);
  }, []);

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!stateManagerRef.current) {
      throw new Error('State manager not initialized');
    }
    return await stateManagerRef.current.deleteConversation(conversationId);
  }, []);

  const searchConversations = useCallback(async (filters: ConversationFilters) => {
    if (!stateManagerRef.current) {
      throw new Error('State manager not initialized');
    }
    return await stateManagerRef.current.searchConversations(filters);
  }, []);

  const getConversationStats = useCallback(() => {
    if (!stateManagerRef.current) {
      return {
        total: 0,
        active: 0,
        archived: 0,
        byProvider: {},
        byModel: {}
      };
    }
    return stateManagerRef.current.getConversationStats();
  }, []);

  const exportConversation = useCallback(async (conversationId: string) => {
    if (!stateManagerRef.current) {
      throw new Error('State manager not initialized');
    }
    return await stateManagerRef.current.exportConversation(conversationId);
  }, []);

  const importConversation = useCallback(async (jsonData: string) => {
    if (!stateManagerRef.current) {
      throw new Error('State manager not initialized');
    }
    return await stateManagerRef.current.importConversation(jsonData);
  }, []);

  const cleanupOldConversations = useCallback(async (maxAge: number) => {
    if (!stateManagerRef.current) {
      throw new Error('State manager not initialized');
    }
    return await stateManagerRef.current.cleanupOldConversations(maxAge);
  }, []);

  // Utility functions
  const getCurrentConversation = useCallback(() => {
    return state.currentConversation;
  }, [state.currentConversation]);

  const getConversations = useCallback(() => {
    return state.conversations;
  }, [state.conversations]);

  const isLoading = useCallback(() => {
    return state.isLoading;
  }, [state.isLoading]);

  const hasError = useCallback(() => {
    return state.error !== null;
  }, [state.error]);

  const getError = useCallback(() => {
    return state.error;
  }, [state.error]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!stateManagerRef.current) {
      throw new Error('State manager not initialized');
    }
    
    // Force reload conversations
    await stateManagerRef.current.initialize();
  }, []);

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
    searchConversations,
    
    // Utility operations
    exportConversation,
    importConversation,
    cleanupOldConversations,
    
    // State utilities
    getCurrentConversation,
    getConversations,
    getConversationStats,
    isLoading,
    hasError,
    getError,
    clearError,
    refreshConversations,
    
    // Raw state values for convenience
    conversations: state.conversations,
    currentConversation: state.currentConversation,
    isLoadingState: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated
  };
};
