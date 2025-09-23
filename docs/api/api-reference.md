# API Reference

## Client Storage API

### IndexedDbStorage Class
```typescript
import { indexedDbStorage } from './src/services/indexedDbStorage';

// Save conversation
await indexedDbStorage.saveConversation({
  id: 'chat-123',
  title: 'My Chat',
  messages: [{ id: 'msg-1', role: 'user', content: 'Hello', timestamp: new Date() }],
  createdAt: new Date(),
  updatedAt: new Date(),
  lastModified: new Date()
});

// List conversations
const chats = await indexedDbStorage.listConversations(false); // excludeArchived

// Load specific conversation
const chat = await indexedDbStorage.loadConversation('chat-123');

// Delete conversation
await indexedDbStorage.deleteConversation('chat-123');
Sync Server API
Base URL
http://localhost:4001
GET /fetchChats
Returns all server-stored chats.
Response:
json[{
  "id": "chat-123",
  "title": "My Chat",
  "messages": [...],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "lastModified": "2024-01-01T00:00:00.000Z"
}]
POST /sync
Bidirectional synchronization.
Request:
json{
  "chats": [Chat[]]
}
Response:
json{
  "missing": [Chat[]]  // Chats on server not sent by client
}
Curl Example:
bashcurl -X POST http://localhost:4001/sync \
  -H "Content-Type: application/json" \
  -d '{"chats": []}'
Data Types
Chat Interface
typescriptinterface Chat {
  id?: string;
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
Message Interface
typescriptinterface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
Error Handling
Client Errors

Database initialization failure: Automatic recovery and recreation
Storage quota exceeded: Automatic cleanup of oldest chats
Date conversion errors: Fallback to current timestamp

Server Errors

400 Bad Request: Invalid JSON or missing chats array
500 Internal Server Error: File system or JSON parsing error
404 Not Found: Invalid endpoint

Rate Limiting
No rate limiting implemented. For production, consider:

Request throttling per IP
Maximum payload size limits
Authentication tokens
