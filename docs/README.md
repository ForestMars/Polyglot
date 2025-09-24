# Polyglot Documentation

Polyglot is a local playground for AI research where you control memory across models and conversations.
Build persistent knowledge that carries across model switches, chat threads, and sessions. Add your own documents via RAG, connect tools through MCP servers, and compare how different AI models (cloud or local) perform with the same controlled memory context. Everything runs locally with ability to syncronize multiple devices, so your research environment and accumulated knowledge stays private and under your control while being accessible anywhere.

## What Makes Polyglot Different

- Memory Control: You decide what persists across all conversations and models - no black box algorithms deciding what's "relevant"
- Model Agnostic Research: Compare cloud and local models with identical memory context
- Knowledge Integration: Import your documents (RAG) and connect external tools (MCP) to enhance AI capabilities
- Research Continuity: Long-term projects that build context and knowledge over weeks and months
- Local-First Architecture: Your research environment stays private and under your control

## Core Use Cases
- AI Researchers: Compare model performance with controlled variables, maintain experimental context across sessions, integrate custom knowledge bases for grounded responses.
- Developers: Iterate on code with persistent context, maintain architectural discussions across multiple sessions, integrate development tools via MCP.
- Knowledge Workers: Build long-term research projects, synthesize information across multiple AI interactions, maintain private knowledge environments.

## Essential Documents
- **[Installation](installation.md)** - Complete setup guide
- **[Quick Start](quick-start.md)** - 5-minute getting started
- **[API Reference](api-reference.md)** - REST endpoints and client APIs
- **[Deployment](deployment.md)** - Production deployment
- **[Troubleshooting](troubleshooting.md)** - Common issues and fixes

## System Requirements
- Node.js 18+ (server optional)
- Modern browser with IndexedDB support
- 50MB disk space for client storage

## Architecture Overview
Client-side IndexedDB storage with optional server synchronization via REST API.
3. docs/quick-start.md
markdown# Quick Start Guide

---
---

## 1. Install and Run (2 minutes)
```bash
git clone https://github.com/ForestMars/Polyglot.git
cd Polyglot && npm install && npm run dev
2. Create Your First Chat (1 minute)

Open http://localhost:3000
Click "New Chat"
Type a message and press Enter
Chat is automatically saved to browser storage

3. Test Offline Mode (1 minute)

Disconnect from internet
Create more chats and messages
Refresh browser - data persists
Reconnect internet - ready to sync

4. Optional: Enable Sync (1 minute)
bash# New terminal
cd src/server && node chatSyncApi.js
Chats now sync across devices and browsers.
Next Steps

API Reference - Integrate with your backend
Deployment - Deploy to production
Architecture - Understand the system design


### 4. docs/api-reference.md
```markdown
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


### 2. docs/installation.md
```markdown
# Installation Guide

## Client-Only Setup (Recommended for Most Users)
```bash
git clone https://github.com/ForestMars/Polyglot.git
cd Polyglot
npm install
npm run dev
Access at http://localhost:3000
Full Setup with Sync Server
bash# Terminal 1: Client
npm run dev

# Terminal 2: Server
cd src/server
node chatSyncApi.js
Production Build
bashnpm run build
# Deploy dist/ directory to static hosting
Verification

Create a chat conversation
Check browser DevTools → Application → IndexedDB → PolyglotDB
For sync: POST test data to http://localhost:4001/sync

Common Issues

Port conflicts: Change CHAT_SYNC_PORT environment variable
IndexedDB errors: Clear browser storage and reload
CORS errors: Ensure server allows origin domain
