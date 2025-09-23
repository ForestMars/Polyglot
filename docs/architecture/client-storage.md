# Client Storage Architecture

## IndexedDB Implementation

### Database Schema

#### PolyglotDB Structure
```typescript
class PolyglotDatabase extends Dexie {
  chats!: Table<Chat, string>;
  meta!: Table<AppMeta, string>;

  constructor() {
    super('PolyglotDB');

    this.version(1).stores({
      chats: '++id, title, createdAt, updatedAt, lastModified, model, provider, currentModel, isArchived',
      meta: 'id, lastSync, version'
    });
  }
}
```

#### Table Definitions

##### chats Table
- **Primary Key**: `++id` (auto-incrementing string)
- **Indexes**:
  - `title` - Chat title for searching
  - `createdAt` - Creation timestamp for sorting
  - `updatedAt` - Last update for change tracking
  - `lastModified` - Sync timestamp for conflict resolution
  - `model` - AI model filtering
  - `provider` - AI provider filtering
  - `currentModel` - Active model tracking
  - `isArchived` - Archive status filtering

##### meta Table
- **Primary Key**: `id` (string)
- **Indexes**:
  - `lastSync` - Synchronization timestamp
  - `version` - Application version tracking

### Data Models

#### Chat Entity
```typescript
interface Chat {
  id?: string;                    // UUID, auto-generated if not provided
  title: string;                  // Display name for the chat
  messages: Message[];            // Array of conversation messages
  createdAt: Date;               // When chat was first created
  updatedAt: Date;               // Last time chat was modified
  lastModified: Date;            // Used for sync conflict resolution
  model?: string;                // AI model identifier (e.g., 'gpt-4')
  provider?: string;             // AI provider (e.g., 'openai')
  currentModel?: string;         // Currently active model
  isArchived?: boolean;          // Archive status (default: false)
}
```

#### Message Entity
```typescript
interface Message {
  id: string;                    // Unique message identifier
  role: 'user' | 'assistant';    // Message sender type
  content: string;               // Message text content
  timestamp: Date;               // When message was created
}
```

#### AppMeta Entity
```typescript
interface AppMeta {
  id: string;                    // Metadata record identifier
  lastSync?: Date;               // Last synchronization timestamp
  version?: string;              // Application version
  [key: string]: any;            // Extensible metadata fields
}
```

## Storage Operations

### CRUD Operations

#### Create/Update Chat
```typescript
async saveConversation(conversation: Chat): Promise<void> {
  const preparedConversation = this.prepareChatForStorage(conversation);
  await this.db.chats.put(preparedConversation);
}

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

#### Read Operations
```typescript
// Get all chats (ordered by last modified)
async listConversations(showArchived: boolean = false): Promise<Chat[]> {
  let query = this.db.chats.orderBy('lastModified').reverse();
  const chats = await query.toArray();
  const convertedChats = chats.map(chat => this.convertDatesToObjects(chat));

  return showArchived ?
    convertedChats :
    convertedChats.filter(chat => !chat.isArchived);
}

// Get specific chat
async loadConversation(id: string): Promise<Chat> {
  const chat = await this.db.chats.get(id);
  if (!chat) throw new Error(`Conversation not found: ${id}`);
  return this.convertDatesToObjects(chat);
}
```

#### Delete Operations
```typescript
async deleteConversation(id: string): Promise<void> {
  await this.db.chats.delete(id);
}
```

### Date Handling

#### Storage Format
IndexedDB stores dates as ISO string representations for cross-browser compatibility.

#### Conversion Logic
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

#### Error Handling
- Invalid dates default to current timestamp
- Missing dates use fallback chain: `lastModified || updatedAt || Date.now()`
- Conversion errors are logged but don't throw exceptions

## Database Management

### Initialization Process
```typescript
async initialize(): Promise<void> {
  await this.db.open();

  // Verify schema integrity
  const tableNames = this.db.tables.map(table => table.name);
  const expectedTables = ['chats', 'meta'];

  for (const expectedTable of expectedTables) {
    if (!tableNames.includes(expectedTable)) {
      throw new Error(`Missing expected table: ${expectedTable}`);
    }
  }
}
```

### Version Management
```typescript
this.version(1).upgrade(async (trans) => {
  // Initialize default metadata
  await trans.table('meta').put({
    id: 'app',
    version: '1.0.0',
    lastSync: null
  });
});
```

### Error Recovery
```typescript
private async resetDatabase(): Promise<void> {
  await this.db.delete();
  this.db = new PolyglotDatabase();
  await this.db.open();
}
```

Recovery triggers:
- `VersionError`: Schema version mismatch
- `NotFoundError`: Missing database or tables
- Corruption detection during operations

## Query Optimization

### Index Usage
```typescript
// Efficient: Uses lastModified index
this.db.chats.orderBy('lastModified').reverse()

// Efficient: Uses primary key
this.db.chats.get(id)

// Efficient: Uses isArchived index
this.db.chats.where('isArchived').equals(false)

// Less efficient: Full table scan
this.db.chats.filter(chat => chat.title.includes(searchTerm))
```

### Performance Considerations
- **Primary key lookups**: O(log n)
- **Indexed queries**: O(log n + m) where m = result size
- **Full table scans**: O(n) - avoided where possible
- **Sorting**: Uses index when possible

## Storage Capacity Management

### Browser Limits
- **Chrome**: ~60% of available disk space
- **Firefox**: Up to 2GB per origin
- **Safari**: 1GB per origin
- **Edge**: Similar to Chrome

### Quota Monitoring
```typescript
async checkStorageQuota(): Promise<{usage: number, quota: number}> {
  const estimate = await navigator.storage.estimate();
  return {
    usage: estimate.usage || 0,
    quota: estimate.quota || 0
  };
}
```

### Cleanup Strategies
- Archive old conversations instead of deleting
- Implement LRU eviction for message history
- Compress large message content
- User-initiated cleanup tools

## Data Migration

### localStorage Migration
```typescript
async migrateFromLocalStorage(): Promise<void> {
  const localData = localStorage.getItem('polyglot-chats');
  if (!localData) return;

  const chats: Chat[] = JSON.parse(localData);
  for (const chat of chats) {
    await this.saveChat(chat);
  }

  localStorage.removeItem('polyglot-chats');
}
```

### Version Upgrades
Future version upgrades handled via Dexie version management:
```typescript
this.version(2).stores({
  // Modified schema
}).upgrade(async (trans) => {
  // Migration logic
});
```

## Synchronization Support

### Conflict Detection
```typescript
// lastModified field used for conflict resolution
const isNewer = serverChat.lastModified > localChat.lastModified;
```

### Sync Preparation
```typescript
// Prepare chats for server sync
const chatsForSync = await this.listConversations(true); // Include archived
const syncPayload = chatsForSync.map(chat => ({
  ...chat,
  // Ensure dates are ISO strings
  createdAt: chat.createdAt.toISOString(),
  updatedAt: chat.updatedAt.toISOString(),
  lastModified: chat.lastModified.toISOString(),
  messages: chat.messages.map(msg => ({
    ...msg,
    timestamp: msg.timestamp.toISOString()
  }))
}));
```

## Error Handling Strategy

### Graceful Degradation
- Database initialization failures trigger reset
- Query failures return empty results
- Storage quota exceeded logs warnings
- Date conversion errors use fallbacks

### Error Recovery
```typescript
async safeOperation<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error('Storage operation failed:', error);
    return fallback;
  }
}
```

### User Experience
- Operations fail silently with logging
- User sees loading states during recovery
- Data integrity prioritized over perfect UX
- Clear error messages for irrecoverable failures
