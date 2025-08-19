# Storage Service

The Storage Service provides file-based persistence for conversations and user settings in Polyglut.

## Overview

The storage service is designed to:
- Save and load conversations across browser sessions
- Persist user settings and preferences
- Support conversation archiving and deletion
- Provide search and filtering capabilities
- Handle model switching with full context preservation

## Architecture

### File Structure
```
./data/
├── conversations/
│   ├── index.json          # Conversation metadata index
│   ├── {id1}.json         # Individual conversation files
│   └── {id2}.json
└── settings.json           # User settings and preferences
```

### Core Components

#### StorageService
Main service class that handles all file operations:
- **Conversation CRUD**: Create, read, update, delete conversations
- **Settings Management**: Save and load user preferences
- **Auto-save**: Automatic conversation persistence
- **Search & Filter**: Find conversations by content, provider, or model

#### ConversationUtils
Utility class for conversation operations:
- **ID Generation**: Create unique conversation identifiers
- **Title Generation**: Auto-generate titles from first user message
- **Model Change Tracking**: Record when users switch models mid-conversation
- **Data Validation**: Ensure conversation data integrity
- **Sanitization**: Remove sensitive information (API keys, etc.)

## Usage

### Basic Setup

```typescript
import { StorageService } from './services/storage';
import { ConversationUtils } from './services/conversationUtils';

// Initialize storage service
const storageService = new StorageService('./data');
await storageService.initialize();
```

### Creating Conversations

```typescript
// Create a new conversation
const conversation = ConversationUtils.createConversation('ollama', 'llama3.2');

// Add a user message
const message = {
  id: 'msg-1',
  role: 'user' as const,
  content: 'Hello, how are you?',
  timestamp: new Date(),
  provider: 'ollama'
};

const updatedConversation = ConversationUtils.addMessage(conversation, message);

// Save to storage
await storageService.saveConversation(updatedConversation);
```

### Loading Conversations

```typescript
// List all conversations
const conversations = await storageService.listConversations();

// Load specific conversation
const conversation = await storageService.loadConversation('conv_123');

// Search conversations
const searchResults = await storageService.searchConversations('React');
```

### Model Switching

```typescript
// Record a model change
const updatedConversation = ConversationUtils.recordModelChange(
  conversation,
  'llama3.2',
  'gemma3'
);

// Save the updated conversation
await storageService.saveConversation(updatedConversation);
```

### Settings Management

```typescript
// Load user settings
const settings = await storageService.loadSettings();

// Update settings
settings.selectedModel = 'gemma3';
await storageService.saveSettings(settings);
```

## Data Models

### Conversation
```typescript
interface Conversation {
  id: string;                    // Unique identifier
  title: string;                 // Auto-generated title
  createdAt: Date;               // Creation timestamp
  lastModified: Date;            // Last modification time
  provider: string;              // AI provider (ollama, openai, etc.)
  currentModel: string;          // Currently active model
  modelHistory: ModelChange[];   // Track of model switches
  messages: Message[];           // Conversation messages
  isArchived: boolean;           // Archive status
}
```

### ModelChange
```typescript
interface ModelChange {
  timestamp: Date;               // When the change occurred
  fromModel: string;             // Previous model
  toModel: string;               // New model
  messageIndex: number;          // Message index when changed
}
```

### UserSettings
```typescript
interface UserSettings {
  selectedProvider: string;      // Current AI provider
  selectedModel: string;         // Current model
  selectedApiKey: string;        // API key (if applicable)
  showArchivedChats: boolean;    // Archive visibility preference
  ollamaBaseUrl: string;         // Ollama endpoint URL
}
```

## Features

### Auto-save
Conversations are automatically saved after each message:
```typescript
// Auto-save after sending message
await storageService.autoSaveConversation(conversation);
```

### Search & Filter
Find conversations by various criteria:
```typescript
// Search by content
const results = await storageService.searchConversations('React hooks');

// Filter by provider
const ollamaChats = await storageService.getConversationsByProvider('ollama');

// Filter by model
const llamaChats = await storageService.getConversationsByModel('llama3.2');
```

### Archiving
Hide conversations without deleting them:
```typescript
// Archive a conversation
await storageService.archiveConversation('conv_123');

// Unarchive a conversation
await storageService.unarchiveConversation('conv_123');
```

## Error Handling

The service includes comprehensive error handling:
- **Graceful Fallbacks**: Returns empty arrays instead of crashing
- **Detailed Logging**: Console errors for debugging
- **Data Validation**: Ensures conversation integrity
- **Recovery**: Continues operation even if individual files fail

## Performance Considerations

- **Lazy Loading**: Conversations are loaded on-demand
- **Indexing**: Quick metadata lookups without loading full content
- **Caching**: Conversation metadata is cached for faster access
- **Background Operations**: Auto-save doesn't block the UI

## Future Enhancements

- **Database Migration**: Move to SQLite or PostgreSQL
- **Cloud Sync**: Backup conversations to cloud storage
- **Compression**: Reduce storage footprint for long conversations
- **Encryption**: Secure sensitive conversation data
- **Backup/Restore**: Automatic backup and recovery

## Testing

Run the storage service tests:
```bash
npm run test src/services/__tests__/storage.test.ts
```

The test suite covers:
- Conversation creation and management
- Model switching functionality
- Data validation and sanitization
- Error handling scenarios
- Utility function behavior
