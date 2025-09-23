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

#### Scenario 1: Same Chat, Different
