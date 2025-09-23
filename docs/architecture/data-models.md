# Data Models and Schemas

## Core Data Entities

### Chat Entity
Primary entity representing a conversation thread.

```typescript
interface Chat {
  id?: string;                    // Unique identifier (UUID)
  title: string;                  // Display name for the chat
  messages: Message[];            // Ordered array of conversation messages
  createdAt: Date;               // Initial creation timestamp
  updatedAt: Date;               // Last modification timestamp
  lastModified: Date;            // Sync-specific modification timestamp
  model?: string;                // AI model identifier (e.g., 'gpt-4')
  provider?: string;             // AI service provider (e.g., 'openai')
  currentModel?: string;         // Currently active model (fallback: model)
  isArchived?: boolean;          // Archive status (default: false)
}
```

#### Field Specifications

##### Required Fields
- **title**: `string` - Human-readable chat name
- **messages**: `Message[]` - Conversation content
- **createdAt**: `Date` - When chat was first created
- **updatedAt**: `Date` - Last time any field was modified
- **lastModified**: `Date` - Used for sync conflict resolution

##### Optional Fields
- **id**: `string` - Auto-generated UUID if not provided
- **model**: `string` - AI model used for responses
- **provider**: `string` - Service provider identifier
- **currentModel**: `string` - Active model (defaults to model field)
- **isArchived**: `boolean` - Archive status (defaults to false)

##### Field Relationships
```typescript
// Fallback chain for model identification
const effectiveModel = chat.currentModel || chat.model || 'unknown';

// Sync timestamp fallback
const syncTimestamp = chat.lastModified || chat.updatedAt || chat.createdAt;
```

### Message Entity
Individual message within a chat conversation.

```typescript
interface Message {
  id: string;                    // Unique message identifier (UUID)
  role: 'user' | 'assistant';    // Message sender type
  content: string;               // Message text content
  timestamp: Date;               // Message creation time
}
```

#### Field Specifications

##### Required Fields
- **id**: `string` - Unique identifier for the message
- **role**: `'user' | 'assistant'` - Identifies message sender
- **content**: `string` - The actual message text
- **timestamp**: `Date` - When message was created

##### Role Types
```typescript
type MessageRole = 'user' | 'assistant';

// User message: Input from human user
const userMessage: Message = {
  id: 'msg-123',
  role: 'user',
  content: 'What is the weather like?',
  timestamp: new Date()
};

// Assistant message: Response from AI
const assistantMessage: Message = {
  id: 'msg-124',
  role: 'assistant',
  content: 'I cannot check current weather conditions.',
  timestamp: new Date()
};
```

### AppMeta Entity
Application metadata for sync and versioning.

```typescript
interface AppMeta {
  id: string;                    // Metadata record identifier
  lastSync?: Date;               // Last successful synchronization
  version?: string;              // Application version
  [key: string]: any;            // Extensible metadata fields
}
```

#### Standard Metadata Records
```typescript
// Primary app metadata
const appMeta: AppMeta = {
  id: 'app',
  version: '1.0.0',
  lastSync: new Date('2024-01-15T10:30:00Z'),
  installDate: new Date('2024-01-01T00:00:00Z'),
  totalChats: 42,
  totalMessages: 1337
};

// User preferences metadata
const userPrefs: AppMeta = {
  id: 'preferences',
  theme: 'dark',
  defaultModel: 'gpt-4',
  syncEnabled: true,
  autoArchiveAfterDays: 30
};
```

## Data Validation

### Chat Validation
```typescript
function validateChat(chat: any): chat is Chat {
  // Required field validation
  if (typeof chat.title !== 'string' || chat.title.trim().length === 0) {
    return false;
  }

  if (!Array.isArray(chat.messages)) {
    return false;
  }

  // Date field validation
  const dateFields = ['createdAt', 'updatedAt', 'lastModified'];
  for (const field of dateFields) {
    if (chat[field] && !(chat[field] instanceof Date) && !isValidDateString(chat[field])) {
      return false;
    }
  }

  // Message validation
  return chat.messages.every(validateMessage);
}
```

### Message Validation
```typescript
function validateMessage(message: any): message is Message {
  // Required fields
  if (typeof message.id !== 'string' || message.id.length === 0) {
    return false;
  }

  if (!['user', 'assistant'].includes(message.role)) {
    return false;
  }

  if (typeof message.content !== 'string') {
    return false;
  }

  // Timestamp validation
  if (!message.timestamp || (!isValidDate(message.timestamp) && !isValidDateString(message.timestamp))) {
    return false;
  }

  return true;
}
```

### Utility Validators
```typescript
function isValidDate(date: any): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

function isValidDateString(dateStr: any): boolean {
  if (typeof dateStr !== 'string') return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
```

## Data Transformation

### Serialization for Storage
```typescript
// Convert Chat to storage format
function serializeChatForStorage(chat: Chat): any {
  return {
    ...chat,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    lastModified: chat.lastModified.toISOString(),
    messages: chat.messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp.toISOString()
    }))
  };
}

// Convert from storage format to Chat
function deserializeChatFromStorage(stored: any): Chat {
  return {
    ...stored,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    lastModified: new Date(stored.lastModified),
    messages: stored.messages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }))
  };
}
```

### Sync Payload Transformation
```typescript
// Prepare chats for server sync
function prepareChatForSync(chat: Chat): any {
  const syncChat = serializeChatForStorage(chat);

  // Ensure required fields for sync
  return {
    ...syncChat,
    id: syncChat.id || crypto.randomUUID(),
    isArchived: syncChat.isArchived || false,
    currentModel: syncChat.currentModel || syncChat.model || 'unknown'
  };
}
```

## Default Values and Factories

### Chat Factory
```typescript
function createNewChat(title: string, options: Partial<Chat> = {}): Chat {
  const now = new Date();

  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    messages: [],
    createdAt: now,
    updatedAt: now,
    lastModified: now,
    isArchived: false,
    ...options
  };
}
```

### Message Factory
```typescript
function createMessage(role: MessageRole, content: string): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content: content.trim(),
    timestamp: new Date()
  };
}

// Convenience factories
const createUserMessage = (content: string) => createMessage('user', content);
const createAssistantMessage = (content: string) => createMessage('assistant', content);
```

### AppMeta Factory
```typescript
function createAppMeta(id: string, data: Partial<AppMeta> = {}): AppMeta {
  return {
    id,
    version: '1.0.0',
    lastSync: null,
    ...data
  };
}
```

## Schema Evolution

### Version 1 Schema (Current)
```typescript
// Current schema definitions
interface ChatV1 {
  id?: string;
  title: string;
  messages: MessageV1[];
  createdAt: Date;
  updatedAt: Date;
  lastModified: Date;
  model?: string;
  provider?: string;
  currentModel?: string;
  isArchived?: boolean;
}

interface MessageV1 {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
```

### Future Schema Migrations

#### Proposed Version 2 Enhancements
```typescript
interface ChatV2 extends ChatV1 {
  tags?: string[];               // Chat categorization
  parentChatId?: string;         // Chat threading
  settings?: ChatSettings;       // Per-chat configuration
}

interface MessageV2 extends MessageV1 {
  metadata?: MessageMetadata;    // Extended message data
  editHistory?: MessageEdit[];   // Message edit tracking
}

interface ChatSettings {
  temperature?: number;          // AI model temperature
  maxTokens?: number;           // Response length limit
  systemPrompt?: string;        // Custom system prompt
}

interface MessageMetadata {
  tokenCount?: number;          // Token usage tracking
  modelUsed?: string;           // Actual model for response
  latency?: number;             // Response time
}
```

#### Migration Strategy
```typescript
function migrateChatV1ToV2(chatV1: ChatV1): ChatV2 {
  return {
    ...chatV1,
    tags: [],                     // Default empty tags
    parentChatId: null,           // No parent by default
    settings: {                   // Default settings
      temperature: 0.7,
      maxTokens: 2000
    }
  };
}
```

## Data Constraints and Limits

### Size Constraints
```typescript
const CONSTRAINTS = {
  CHAT_TITLE_MAX_LENGTH: 200,
  MESSAGE_CONTENT_MAX_LENGTH: 100000,
  MESSAGES_PER_CHAT_MAX: 10000,
  CHATS_PER_USER_MAX: 50000
};
```

### Validation with Constraints
```typescript
function validateChatConstraints(chat: Chat): string[] {
  const errors: string[] = [];

  if (chat.title.length > CONSTRAINTS.CHAT_TITLE_MAX_LENGTH) {
    errors.push(`Title exceeds ${CONSTRAINTS.CHAT_TITLE_MAX_LENGTH} characters`);
  }

  if (chat.messages.length > CONSTRAINTS.MESSAGES_PER_CHAT_MAX) {
    errors.push(`Too many messages (${chat.messages.length}/${CONSTRAINTS.MESSAGES_PER_CHAT_MAX})`);
  }

  for (const message of chat.messages) {
    if (message.content.length > CONSTRAINTS.MESSAGE_CONTENT_MAX_LENGTH) {
      errors.push(`Message content too long: ${message.id}`);
    }
  }

  return errors;
}
```

## Type Guards and Utilities

### Type Guards
```typescript
function isChat(obj: any): obj is Chat {
  return obj &&
    typeof obj.title === 'string' &&
    Array.isArray(obj.messages) &&
    obj.messages.every(isMessage);
}

function isMessage(obj: any): obj is Message {
  return obj &&
    typeof obj.id === 'string' &&
    ['user', 'assistant'].includes(obj.role) &&
    typeof obj.content === 'string' &&
    (obj.timestamp instanceof Date || typeof obj.timestamp === 'string');
}
```

### Utility Functions
```typescript
// Deep clone chat with new IDs
function cloneChat(chat: Chat): Chat {
  return {
    ...chat,
    id: crypto.randomUUID(),
    messages: chat.messages.map(msg => ({
      ...msg,
      id: crypto.randomUUID()
    }))
  };
}

// Get chat statistics
function getChatStats(chat: Chat): {
  messageCount: number;
  userMessages: number;
  assistantMessages: number;
  totalChars: number;
} {
  return {
    messageCount: chat.messages.length,
    userMessages: chat.messages.filter(m => m.role === 'user').length,
    assistantMessages: chat.messages.filter(m => m.role === 'assistant').length,
    totalChars: chat.messages.reduce((sum, m) => sum + m.content.length, 0)
  };
}
```
