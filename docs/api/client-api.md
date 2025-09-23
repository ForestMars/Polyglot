# Client API Reference

## IndexedDbStorage Class

Main client-side storage interface for chat operations.

### Import
```typescript
import { indexedDbStorage } from './src/services/indexedDbStorage';
```

### Initialization
The storage is automatically initialized on module load. Check readiness:

```typescript
import { ready } from './src/services/indexedDbStorage';

await ready; // Ensures database is initialized
```

### Core Methods

#### saveConversation(conversation: Chat): Promise<void>
Save or update a conversation.

```typescript
await indexedDbStorage.saveConversation({
  id: 'chat-123',
  title: 'My Chat',
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: new Date()
    }
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
  lastModified: new Date(),
  model: 'gpt-4',
  provider: 'openai',
  isArchived: false
});
```

#### listConversations(showArchived?: boolean): Promise<Chat[]>
Get all conversations, optionally including archived ones.

```typescript
// Get active conversations only
const activeChats = await indexedDbStorage.listConversations();

// Get all conversations including archived
const allChats = await indexedDbStorage.listConversations(true);
```

Returns conversations ordered by `lastModified` (newest first).

#### loadConversation(id: string): Promise<Chat>
Load a specific conversation by ID.

```typescript
const chat = await indexedDbStorage.loadConversation('chat-123');
```

Throws error if conversation not found.

#### deleteConversation(id: string): Promise<void>
Permanently delete a conversation.

```typescript
await indexedDbStorage.deleteConversation('chat-123');
```

### Legacy Methods (Compatibility)

#### getChats(): Promise<Chat[]>
Alias for `listConversations()`.

```typescript
const chats = await indexedDbStorage.getChats();
```

#### getChat(id: string): Promise<Chat | null>
Get conversation by ID, returns null if not found.

```typescript
const chat = await indexedDbStorage.getChat('chat-123');
if (chat) {
  // Chat exists
}
```

#### saveChat(chat: Chat): Promise<string>
Save chat and return the chat ID.

```typescript
const chatId = await indexedDbStorage.saveChat({
  title: 'New Chat',
  messages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  lastModified: new Date()
});
```

#### deleteChat(id: string): Promise<void>
Alias for `deleteConversation()`.

```typescript
await indexedDbStorage.deleteChat('chat-123');
```

### Utility Methods

#### initialize(): Promise<void>
Manually initialize the database (usually not needed).

```typescript
await indexedDbStorage.initialize();
```

#### isReady(): Promise<boolean>
Check if database is ready for operations.

```typescript
const ready = await indexedDbStorage.isReady();
```

#### migrateFromLocalStorage(): Promise<void>
Migrate data from localStorage to IndexedDB (automatic on first load).

```typescript
await indexedDbStorage.migrateFromLocalStorage();
```

### Metadata Operations

#### getMeta(id?: string): Promise<AppMeta | null>
Get application metadata.

```typescript
const meta = await indexedDbStorage.getMeta('app');
```

#### setMeta(meta: AppMeta): Promise<void>
Set application metadata.

```typescript
await indexedDbStorage.setMeta({
  id: 'app',
  version: '1.0.0',
  lastSync: new Date()
});
```

## Error Handling

All methods handle errors gracefully:
- Database initialization failures trigger automatic recovery
- Missing data returns null/empty arrays rather than throwing
- Date conversion errors fall back to current timestamp
- Quota exceeded errors log warnings but don't throw

```typescript
try {
  await indexedDbStorage.saveConversation(chat);
} catch (error) {
  console.error('Failed to save chat:', error);
  // Method will have logged error details
}
```

## Data Persistence

- **Storage**: Browser IndexedDB via Dexie ORM
- **Database Name**: `PolyglotDB`
- **Tables**: `chats`, `meta`
- **Persistence**: Survives browser restarts, tab closes
- **Capacity**: ~50MB typical, varies by browser

## Date Handling

All date fields are automatically converted:
- **Storage**: Dates stored as ISO strings
- **Retrieval**: Automatically converted back to Date objects
- **Fallback**: Invalid dates default to current timestamp

## Browser Compatibility

- **Chrome 61+**: Full support
- **Firefox 60+**: Full support
- **Safari 13.1+**: Full support
- **Edge 79+**: Full support
- **IE**: Not supported
