# Chat Synchronization System

## Architecture

The chat synchronization system implements a client-server architecture with offline-first capabilities:

- **Client Layer**: IndexedDB-based local storage
- **Server Layer**: JSON file-based persistent storage  
- **API Layer**: HTTP REST endpoints for synchronization

## Components

### indexedDbStorage.ts

**Purpose**: Client-side database abstraction layer

**Functionality**:
- Manages chat conversations in IndexedDB using Dexie ORM
- Implements CRUD operations for Chat and AppMeta entities
- Performs automatic data migration from localStorage
- Handles date serialization/deserialization
- Maintains data integrity across browser sessions

**Key Methods**:
- `initialize()`: Database setup and schema validation
- `saveConversation(conversation)`: Persist chat data
- `listConversations(showArchived)`: Retrieve chat list
- `loadConversation(id)`: Fetch specific chat
- `deleteConversation(id)`: Remove chat record

### chatStore.js

**Purpose**: Server-side data persistence layer

**Functionality**:
- Manages chat data in JSON flat file format
- Provides atomic read/write operations
- Implements merge-based update strategy

**API**:
- `getAllChats()`: Returns array of all stored chats
- `addOrUpdateChats(newChats)`: Merges chat array using ID-based deduplication

**Storage Format**: Single JSON file (`chatStore.json`) containing chat array

### chatSyncApi.js

**Purpose**: HTTP synchronization server

**Endpoints**:

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/fetchChats` | Retrieve all server chats | None | `Chat[]` |
| POST | `/pushChats` | Upload client chats | `{chats: Chat[]}` | `{ok: true}` |
| POST | `/sync` | Bidirectional sync | `{chats: Chat[]}` | `{missing: Chat[]}` |

**Features**:
- CORS-enabled for cross-origin requests
- Error handling with appropriate HTTP status codes
- Request body parsing for JSON payloads

## Data Flow

### Synchronization Process

1. **Initialization**: Client loads local chats from IndexedDB
2. **Sync Request**: Client initiates sync via POST `/sync` with local chat array
3. **Server Merge**: Server merges received chats into JSON store
4. **Conflict Resolution**: Server identifies chats missing on client
5. **Response**: Server returns missing chats to client
6. **Client Update**: Client persists received chats to IndexedDB

### Conflict Resolution Strategy

- **Method**: Last-write-wins based on chat ID
- **Scope**: No timestamp-based conflict detection
- **Behavior**: Newer chats completely replace existing entries

## Technical Specifications

### Data Models

```typescript
interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  lastModified: Date;
  model?: string;
  provider?: string;
  currentModel?: string;
  isArchived?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
```

### Configuration

- **Server Port**: Environment variable `CHAT_SYNC_PORT` (default: 4001)
- **Storage Location**: `./chatStore.json` relative to server directory
- **Database Name**: `PolyglotDB`

## Operational Characteristics

### Performance
- **Client**: Indexed queries via Dexie ORM
- **Server**: Synchronous file I/O operations
- **Network**: Bulk transfer of chat arrays

### Reliability
- **Client**: Automatic database recovery and migration
- **Server**: File system-based persistence
- **Sync**: Idempotent operations with error handling

### Dependencies
- **Client**: Dexie.js for IndexedDB abstraction
- **Server**: Node.js standard library only
- **API**: Native HTTP module, no external frameworks
