# API Documentation

Polyglot provides both client-side and server-side APIs for chat management and synchronization.

## API Components
- **[Sync API](api/sync-api.md)** - Server REST endpoints for synchronization
- **[Client API](api/client-api.md)** - Browser-based chat operations
- **[Storage API](api/storage-api.md)** - IndexedDB abstraction layer
- **[Complete Reference](api/api-reference.md)** - All APIs in one document

## Quick Reference

### Client Storage Operations
```typescript
import { indexedDbStorage } from './src/services/indexedDbStorage';

// Basic operations
await indexedDbStorage.saveConversation(chat);
const chats = await indexedDbStorage.listConversations();
const chat = await indexedDbStorage.loadConversation(id);
await indexedDbStorage.deleteConversation(id);
```
