export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  provider?: string;
  usedRAG?: boolean;
}

export interface ModelChange {
  timestamp: Date;
  fromModel: string;
  toModel: string;
  messageIndex: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  lastModified: Date;
  provider: string;
  currentModel: string;
  modelHistory: ModelChange[];
  messages: Message[];
  isArchived: boolean;
}

export interface UserSettings {
  selectedProvider: string;
  selectedModel: string;
  selectedApiKey: string;
  showArchivedChats: boolean;
  ollamaBaseUrl: string;
}

export interface ConversationMetadata {
  id: string;
  title: string;
  createdAt: string; // ISO date string for better serialization
  lastModified: string; // ISO date string for better serialization
  provider: string;
  currentModel: string;
  messageCount: number;
  isArchived: boolean;
}

export interface StorageIndex {
  version?: number;
  conversationIds: string[];
  lastUpdated: string; // ISO date string for better serialization
  conversationMetadata?: {
    [key: string]: Omit<ConversationMetadata, 'id'>;
  };
}
