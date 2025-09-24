# Sync API

The Sync API enables optional synchronization of research data and memory context across devices while maintaining local-first architecture and privacy control.

## Sync Server Endpoints

Base URL: `http://localhost:4001` (configurable)

### Research-Aware Synchronization

#### GET /sync/projects

Retrieve synchronized research projects with memory context.

```bash
curl -X GET http://localhost:4001/sync/projects?includeMemory=true
```

**Response:**
```json
{
  "projects": [
    {
      "id": "ai-comparison-study-2024",
      "title": "Multi-Model AI Comparative Analysis",
      "conversations": ["research-session-1", "research-session-2"],
      "knowledgeBase": ["doc-1", "doc-2"],
      "memoryContext": {
        "globalInsights": ["insight-1", "insight-2"],
        "crossConversationLinks": [...]
      },
      "lastSynced": "2024-03-15T10:30:00.000Z"
    }
  ],
  "syncMetadata": {
    "serverVersion": "1.2.0",
    "lastFullSync": "2024-03-15T09:00:00.000Z"
  }
}
```

#### POST /sync/conversations

Synchronize conversation data with memory preservation.

```bash
curl -X POST http://localhost:4001/sync/conversations \
  -H "Content-Type: application/json" \
  -d '{
    "conversations": [...],
    "memoryContexts": [...],
    "syncPreferences": {
      "preservePrivacy": true,
      "memoryLevel": "full"
    }
  }'
```

**Request Body:**
```json
{
  "conversations": [
    {
      "id": "research-session-1",
      "projectId": "ai-comparison-study-2024",
      "title": "GPT-4 Baseline Analysis",
      "messages": [...],
      "memoryMarkers": ["baseline-established", "methodology-defined"],
      "modelHistory": [
        {
          "model": "gpt-4o",
          "messageRange": [0, 15],
          "contextTransfer": "full"
        }
      ],
      "knowledgeReferences": ["methodology-doc"],
      "lastModified": "2024-03-15T14:22:00.000Z"
    }
  ],
  "memoryContexts": [
    {
      "conversationId": "research-session-1",
      "contextData": {
        "insights": ["key-insight-1"],
        "hypotheses": ["hypothesis-1"],
        "researchState": "baseline-complete"
      },
      "privacyLevel": "encrypted"
    }
  ]
}
```

**Response:**
```json
{
  "synced": ["research-session-1"],
  "conflicts": [],
  "missing": [],
  "memoryIntegrity": "preserved",
  "syncTimestamp": "2024-03-15T14:25:00.000Z"
}
```

#### POST /sync/knowledge-base

Synchronize RAG documents and knowledge integration.

```bash
curl -X POST http://localhost:4001/sync/knowledge-base \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [...],
    "integrations": [...],
    "privacySettings": {...}
  }'
```

## Sync Client API

### Research Project Synchronization

```typescript
// Sync entire research project with memory preservation
await syncClient.syncProject({
  projectId: 'ai-comparison-study-2024',
  syncComponents: {
    conversations: true,
    memoryContext: true,
    knowledgeBase: true,
    modelConfigurations: true
  },
  privacySettings: {
    encryptMemory: true,
    excludePersonalData: true,
    anonymizeMetrics: false
  },
  conflictResolution: 'preserve-local-memory'
});
```

### Selective Memory Synchronization

```typescript
// Sync only specific memory contexts
await syncClient.syncMemoryContexts({
  conversationIds: ['research-session-1', 'research-session-2'],
  memoryLevel: 'markers-and-insights', // or 'full' or 'summary'
  crossDeviceAccess: true,
  retentionPolicy: 'permanent'
});

// Sync knowledge base with privacy controls
await syncClient.syncKnowledgeBase({
  documentIds: ['methodology-paper', 'previous-results'],
  processingLevel: 'embeddings-only', // exclude raw text for privacy
  accessibility: 'project-scoped',
  encryptionLevel: 'device-key'
});
```

### Conflict Resolution for Research Data

```typescript
// Handle sync conflicts with
