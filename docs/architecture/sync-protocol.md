# Synchronization Protocol

## Protocol Overview

Polyglot implements a **simple bidirectional synchronization protocol** over HTTP REST APIs.

### Synchronization Model
- **Client-Server**: Traditional hub-and-spoke model
- **Pull-Push**: Client initiates sync and receives updates
- **Eventually Consistent**: Changes propagate across devices over time
- **Conflict Resolution**: Last-write-wins based on chat ID

## Sync Flow Architecture

### Complete Sync Sequence
```
┌─────────┐                    ┌─────────┐
│ Client  │                    │ Server  │
└────┬────┘                    └────┬────┘
     │                              │
     │ 1. POST /sync               │
     │    {chats: [...]}           │
     ├────────────────────────────►│
     │                              │
     │                         2. Merge chats
     │                         3. Find missing
     │                              │
     │    {missing: [...]}          │
     │◄────────────────────────────┤
     │                              │
 4. Store missing chats              │
     │                              │
```

### Sync Phases

#### Phase 1: Client Upload
```javascript
// Client preparation
const localChats = await indexedDbStorage.listConversations(true); // Include archived
const syncPayload = {
  chats: localChats
};

// HTTP request
const response = await fetch('http://localhost:4001/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(syncPayload)
});
```

#### Phase 2: Server Processing
```javascript
// Server merge operation
const { chats } = requestBody;
addOrUpdateChats(chats); // Merge into server storage

// Find chats missing on client
const serverChats = getAllChats();
const clientIds = new Set(chats.map(c => c.id));
const missing = serverChats.filter(c => !clientIds.has(c.id));
```

#### Phase 3: Server Response
```javascript
// Response payload
{
  missing: [...] // Chats on server not sent by client
}
```

#### Phase 4: Client Integration
```javascript
// Client processes missing chats
const { missing } = await response.json();
for (const chat of missing) {
  await indexedDbStorage.saveConversation(chat);
}
```

## Data Exchange Format

### Sync Request Payload
```json
{
  "chats": [
    {
      "id": "uuid-string",
      "title": "Chat Title",
      "messages": [
        {
          "id": "msg-uuid",
          "role": "user" | "assistant",
          "content": "message text",
          "timestamp": "2024-01-15T10:30:00.000Z"
        }
      ],
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "lastModified": "2024-01-15T10:30:00.000Z",
      "model": "gpt-4",
      "provider": "openai",
      "currentModel": "gpt-4",
      "isArchived": false
    }
  ]
}
```

### Sync Response Payload
```json
{
  "missing": [
    // Same Chat structure as request
  ]
}
```

## Conflict Resolution

### Resolution Strategy: Last-Write-Wins
```javascript
// Server-side conflict resolution
const existingChat = chatsById[incomingChat.id];
const resolvedChat = incomingChat; // Always use incoming chat

// No timestamp comparison or field-level merging
chatsById[incomingChat.id] = resolvedChat;
```

### Conflict Scenarios

#### Scenario 1: Same Chat, Different Updates
```javascript
// Device A updates chat title
chatA = {id: "123", title: "New Title", lastModified: "2024-01-15T10:00:00Z"}

// Device B adds message
chatB = {id: "123", title: "Old Title", messages: [...newMessage], lastModified: "2024-01-15T10:01:00Z"}

// Resolution: Last device to sync wins completely
// Result: chatB overwrites chatA (title reverts, message is kept)
```

#### Scenario 2: Chat Deleted on One Device
```javascript
// Device A deletes chat (not sent in sync)
// Device B modifies chat (sent in sync)

// Server result: Chat exists (Device B wins)
// Device A will receive the "deleted" chat back
```

#### Scenario 3: New Chat with Same ID
```javascript
// Extremely rare due to UUID generation
// Server: incoming chat overwrites existing
// No merge attempt or error handling
```

### Limitations of Current Model
- **No timestamp-based resolution**: lastModified not used for conflicts
- **No field-level merging**: Entire chat object replaced
- **No deletion tracking**: Deleted chats can reappear
- **No user intervention**: Automatic resolution only

## Sync Triggers

### Manual Synchronization
```javascript
// User-initiated sync
async function syncWithServer() {
  try {
    const response = await fetch('/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chats: await getLocalChats() })
    });

    const { missing } = await response.json();
    await saveRemoteChats(missing);
  } catch (error) {
    console.error('Sync failed:', error);
  }
}
```

### Automatic Sync Points
Potential trigger points (not currently implemented):
- Application startup
- Periodic intervals (e.g., every 5 minutes)
- Before application close
- Network connectivity restoration
- After significant local changes

### Sync Frequency Considerations
- **Too Frequent**: Network overhead, server load
- **Too Infrequent**: Higher chance of conflicts, stale data
- **Optimal**: User-initiated or significant change events

## Error Handling

### Network Errors
```javascript
async function syncWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await performSync();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Server Errors
```javascript
// Handle various server responses
const response = await fetch('/sync', {...});

if (!response.ok) {
  switch (response.status) {
    case 400:
      throw new Error('Invalid sync payload');
    case 500:
      throw new Error('Server storage error');
    case 503:
      throw new Error('Server temporarily unavailable');
    default:
      throw new Error(`Sync failed: ${response.status}`);
  }
}
```

### Data Validation
```javascript
// Client-side validation before sync
function validateChatForSync(chat) {
  if (!chat.id || !chat.title) {
    throw new Error('Chat missing required fields');
  }

  if (!Array.isArray(chat.messages)) {
    throw new Error('Chat messages must be array');
  }

  // Validate message structure
  for (const msg of chat.messages) {
    if (!msg.id || !msg.role || !msg.content) {
      throw new Error('Message missing required fields');
    }
  }
}
```

## Protocol Extensions

### Future Enhancements

#### Timestamp-Based Conflict Resolution
```javascript
// Enhanced conflict resolution
function resolveConflict(localChat, remoteChat) {
  if (!localChat) return remoteChat;
  if (!remoteChat) return localChat;

  // Use lastModified for resolution
  return new Date(localChat.lastModified) > new Date(remoteChat.lastModified)
    ? localChat
    : remoteChat;
}
```

#### Incremental Sync
```javascript
// Only sync changed chats
const lastSyncTime = await getLastSyncTimestamp();
const changedChats = await getChatsModifiedSince(lastSyncTime);

const response = await fetch('/sync', {
  method: 'POST',
  body: JSON.stringify({
    chats: changedChats,
    since: lastSyncTime
  })
});
```

#### Field-Level Merging
```javascript
// Merge individual fields based on timestamps
function mergeChats(localChat, remoteChat) {
  return {
    id: localChat.id,
    title: localChat.titleModified > remoteChat.titleModified
      ? localChat.title
      : remoteChat.title,
    messages: mergeMessageArrays(localChat.messages, remoteChat.messages),
    // ... other fields
  };
}
```

#### Deletion Tracking
```javascript
// Track deletions in sync protocol
{
  "chats": [...],
  "deleted": ["chat-id-1", "chat-id-2"]  // IDs of deleted chats
}
```

## Performance Optimization

### Payload Compression
```javascript
// Gzip compression for large payloads
const compressed = await gzipCompress(JSON.stringify(syncPayload));

await fetch('/sync', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Encoding': 'gzip'
  },
  body: compressed
});
```

### Chunked Sync
```javascript
// Split large sync operations
const chunkSize = 100;
const chunks = chunkArray(allChats, chunkSize);

for (const chunk of chunks) {
  await syncChunk(chunk);
}
```

### Delta Sync
```javascript
// Only send changes since last sync
const delta = {
  created: newChats,
  updated: modifiedChats,
  deleted: deletedChatIds
};
```

## Security Considerations

### Transport Security
- **HTTPS Required**: Encrypt data in transit
- **Certificate Validation**: Verify server identity
- **HSTS Headers**: Force secure connections

### Authentication
```javascript
// JWT token authentication
await fetch('/sync', {
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(syncPayload)
});
```

### Data Validation
```javascript
// Server-side input validation
function validateSyncRequest(req, res, next) {
  const { chats } = req.body;

  if (!Array.isArray(chats)) {
    return res.status(400).json({ error: 'chats must be array' });
  }

  for (const chat of chats) {
    if (!isValidChat(chat)) {
      return res.status(400).json({ error: 'invalid chat format' });
    }
  }

  next();
}
```

## Monitoring and Observability

### Sync Metrics
```javascript
// Track sync performance
const syncMetrics = {
  startTime: Date.now(),
  chatsSent: localChats.length,
  chatsReceived: missing.length,
  payloadSize: JSON.stringify(syncPayload).length,
  networkTime: 0,
  processingTime: 0
};

// Log metrics
console.log('Sync completed:', syncMetrics);
```

### Error Tracking
```javascript
// Structured error logging
function logSyncError(error, context) {
  console.error('Sync error:', {
    error: error.message,
    stack: error.stack,
    endpoint: context.endpoint,
    chatsCount: context.chatsCount,
    timestamp: new Date().toISOString()
  });
}
```

### Health Monitoring
```javascript
// Sync health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    chatsCount: getAllChats().length,
    lastSync: getLastSyncTime(),
    uptime: process.uptime()
  });
});
```
