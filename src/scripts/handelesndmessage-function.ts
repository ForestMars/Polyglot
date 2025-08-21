import { runRAGPipeline } from "@/services/rag/ragPipeline";

// inside ChatInterface component
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

    // Prepare final message content
    let finalMessageContent = input.trim();

    // === RAG integration ===
    if (settings?.enableRAG) { // assume you have a toggle in settings
      const { answer: ragAugmentedContent } = await runRAGPipeline(input.trim());
      finalMessageContent = ragAugmentedContent;
    }
    // === End RAG integration ===

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

    // Send the message to the LLM using existing ApiService
    const apiKey = settings?.[selectedApiKey] || '';
    const apiService = new ApiService();
    const response = await apiService.sendMessage({
      provider: selectedProvider,
      model: selectedModel,
      messages: [{ role: 'user', content: finalMessageContent }],
      apiKey,
      baseUrl: selectedProvider === "ollama" ? "http://localhost:11434" : undefined
    });

    // Update the assistant message with the response
    const updatedAssistantMessage = {
      ...assistantMessage,
      content: response.content,
      timestamp: new Date()
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
    setIsLoading(false);
  }
};
