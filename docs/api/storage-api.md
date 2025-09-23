# Storage API Reference

## PolyglotDatabase Class

Dexie-based IndexedDB database implementation.

### Schema Definition
```typescript
this.version(1).stores({
  chats: '++id, title, createdAt, updatedAt, lastModified, model, provider, currentModel, isArchived',
  meta: 'id, lastSync, version'
});
```

### Tables

#### chats Table
- **Primary Key**: `id` (auto-increment string)
- **Indexes**: `title`, `createdAt`, `updatedAt`, `lastModified`, `model`, `provider`, `currentModel`, `isArchived`
- **Type**: `Table<Chat, string>`

#### meta Table
- **Primary Key**: `id` (string)
- **Indexes**: `lastSync`, `version`
- **Type**: `Table<AppMeta, string>`

## Data Models

### Chat Interface
```typescript
interface Chat {
  id?: string;                    // Auto-generated UUID if not provided
  title: string;                  // Chat display name
  messages: Message[];            // Array of chat messages
  createdAt: Date;               // Chat creation timestamp
  updatedAt: Date;               // Last update timestamp
  lastModified: Date;            // Last modification (used for sync)
  model?: string;                // AI model used
  provider?: string;             // AI provider (openai, anthropic, etc)
  currentModel?: string;         // Currently active model
  isArchived?: boolean;          // Archive status (default: false)
}
```

### Message Interface
```typescript
interface Message {
  id: string;                    // Unique message ID
  role: 'user' | 'assistant';    // Message sender role
  content: string;               // Message text content
  timestamp: Date;               // Message timestamp
}
```

### AppMeta Interface
```typescript
interface AppMeta {
  id: string;                    // Metadata record ID
  lastSync?: Date;               // Last synchronization timestamp
  version?: string;              // Application version
  [key: string]: any;            // Additional metadata fields
}
```

## Internal Storage Operations

### Date Conversion

#### convertDatesToObjects(chat: any): Chat
Converts stored date strings back to Date objects.

```typescript
private convertDatesToObjects(chat: any): Chat {
  return {
    ...chat,
    createdAt: new Date(chat.createdAt),
    updatedAt: new Date(chat.updatedAt),
    lastModified: new Date(chat.lastModified || chat.updatedAt || Date.now()),
    isArchived: chat.isArchived || false,
    currentModel: chat.currentModel || chat.model,
    messages: (chat.messages || []).map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }))
  };
}
```

#### prepareChatForStorage(chat: Chat): Chat
Prepares chat object for IndexedDB storage with proper defaults.

```typescript
private prepareChatForStorage(chat: Chat): Chat {
  const now = new Date();
  return {
    ...chat,
    id: chat.id || crypto.randomUUID(),
    createdAt: chat.createdAt || now,
    updatedAt: now,
    lastModified: now,
    isArchived: chat.isArchived || false,
    currentModel: chat.currentModel || chat.model || 'unknown',
    messages: (chat.messages || []).map(msg => ({
      ...msg,
      id: msg.id || crypto.randomUUID(),
      timestamp: msg.timestamp || now
    }))
  };
}
```

### Database Management

#### initialize(): Promise<void>
Initialize database with schema validation and error recovery.

```typescript
await this.db.open();

// Verify expected tables exist
const tableNames = this.db.tables.map(table => table.name);
const expectedTables = ['chats', 'meta'];

for (const expectedTable of expectedTables) {
  if (!tableNames.includes(expectedTable)) {
    throw new Error(`Missing expected table: ${expectedTable}`);
  }
}
```

#### resetDatabase(): Promise<void>
Delete and recreate database (used for error recovery).

```typescript
await this.db.delete();
this.db = new PolyglotDatabase();
await this.db.open();
```

### Query Operations

#### Conversation Queries
```typescript
// Get all conversations ordered by lastModified (newest first)
const chats = await this.db.chats.orderBy('lastModified').reverse().toArray();

// Get specific conversation
const chat = await this.db.chats.get(id);

// Save/update conversation
const chatId = await this.db.chats.put(preparedChat);

// Delete conversation
await this.db.chats.delete(id);
```

#### Metadata Queries
```typescript
// Get metadata record
const meta = await this.db.meta.get(id);

// Save metadata
await this.db.meta.put(meta);
```

### Filtering Operations

#### Archive Filtering
```typescript
// Filter archived conversations
if (showArchived) {
  return convertedChats;
} else {
  return convertedChats.filter(chat => !chat.isArchived);
}
```

## Error Recovery

### Schema Version Errors
```typescript
if (error.name === 'VersionError' || error.name === 'NotFoundError') {
  console.log('Schema mismatch detected, recreating database...');
  await this.resetDatabase();
}
```

### Storage Quota Handling
- Graceful degradation when quota exceeded
- Automatic cleanup of oldest conversations
- User notification of storage limitations

### Network Errors
- All operations work offline
- Sync failures don't affect local operations
- Automatic retry mechanisms for sync operations

## Performance Characteristics

### Query Performance
- **Primary key lookups**: O(log n)
- **Index scans**: O(log n + m) where m = result set size
- **Full table scans**: O(n) - avoided where possible

### Storage Efficiency
- **JSON serialization**: Compact representation
- **Index overhead**: ~10-15% storage overhead
- **Date storage**: ISO strings for cross-browser compatibility

### Memory Usage
- **Lazy loading**: Conversations loaded on demand
- **Result caching**: Dexie provides automatic result caching
- **Memory cleanup**: Automatic garbage collection of unused objects

## Browser Storage Limits

### Typical Limits
- **Chrome**: ~60% of available disk space
- **Firefox**: Up to 2GB per origin
- **Safari**: 1GB per origin
- **Edge**: Similar to Chrome

### Quota Management
```typescript
// Check current usage
navigator.storage.estimate().then(estimate => {
  console.log(`Used: ${estimate.usage}, Quota: ${estimate.quota}`);
});

// Request persistent storage
navigator.storage.persist().then(granted => {
  if (granted) {
    console.log('Persistent storage granted');
  }
});
```
