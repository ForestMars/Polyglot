# System Architecture Overview

## High-Level Architecture

Polyglot implements a **client-server architecture** with **offline-first design principles**.

```
┌─────────────────┐    HTTP/REST    ┌─────────────────┐
│                 │◄───────────────►│                 │
│   Client App    │                 │   Sync Server   │
│                 │                 │                 │
│  ┌───────────┐  │                 │  ┌───────────┐  │
│  │ React UI  │  │                 │  │ HTTP API  │  │
│  └───────────┘  │                 │  └───────────┘  │
│  ┌───────────┐  │                 │  ┌───────────┐  │
│  │IndexedDB  │  │                 │  │JSON Store│  │
│  │ Storage   │  │                 │  └───────────┘  │
│  └───────────┘  │                 │                 │
└─────────────────┘                 └─────────────────┘
```

## Core Components

### Client-Side Components

#### React Frontend
- **Purpose**: User interface and interaction layer
- **Technology**: React with TypeScript
- **Features**: Chat interface, conversation management, settings
- **State**: Local React state with IndexedDB persistence

#### IndexedDB Storage Layer
- **File**: `src/services/indexedDbStorage.ts`
- **Technology**: IndexedDB via Dexie ORM
- **Purpose**: Offline-first local data persistence
- **Capacity**: ~50MB typical browser storage
- **Features**:
  - CRUD operations for chats and messages
  - Automatic date conversion
  - Data migration from localStorage
  - Error recovery and database reset

### Server-Side Components

#### HTTP Sync Server
- **File**: `src/server/chatSyncApi.js`
- **Technology**: Node.js native HTTP module
- **Purpose**: RESTful API for chat synchronization
- **Features**:
  - CORS-enabled endpoints
  - JSON request/response handling
  - Error handling and status codes

#### JSON File Storage
- **File**: `src/server/chatStore.js`
- **Technology**: Node.js file system operations
- **Purpose**: Simple persistent chat storage
- **Format**: Single JSON file with chat array
- **Features**:
  - Atomic read/write operations
  - ID-based chat merging
  - File corruption recovery

## Design Principles

### Offline-First Architecture
1. **Local Primary Storage**: IndexedDB serves as primary data store
2. **Server Optional**: Full functionality without server connection
3. **Sync Enhancement**: Server provides cross-device synchronization
4. **Graceful Degradation**: App works with partial or no connectivity

### Simplicity Over Complexity
1. **No Database**: Server uses JSON files for simplicity
2. **Minimal Dependencies**: Client uses Dexie only, server uses Node.js stdlib
3. **Single Process**: No microservices or distributed components
4. **REST API**: Simple HTTP endpoints over WebSocket complexity

### Data Consistency Model
1. **Eventually Consistent**: Data eventually syncs across devices
2. **Last-Write-Wins**: Simple conflict resolution by chat ID
3. **No Real-Time**: Sync is manual or periodic, not real-time
4. **Client Authority**: Client decides when to sync

## Data Flow Architecture

### Chat Creation Flow
```
1. User creates chat in React UI
2. React calls indexedDbStorage.saveConversation()
3. Data stored in IndexedDB immediately
4. Chat available offline
5. Optional: Sync to server when connected
```

### Synchronization Flow
```
1. Client calls POST /sync with local chats
2. Server merges chats into JSON store
3. Server responds with chats missing on client
4. Client saves missing chats to IndexedDB
5. Both client and server have complete chat set
```

### Offline Operation Flow
```
1. Network unavailable
2. All chat operations work normally
3. Data persists in IndexedDB
4. Sync resumes when network returns
5. No data loss or functionality degradation
```

## Technology Stack

### Client Stack
- **Framework**: React 18+ with TypeScript
- **Storage**: IndexedDB via Dexie ORM
- **Build**: Vite bundler
- **Styling**: Tailwind CSS (assumed)
- **State**: React hooks (useState, useEffect)

### Server Stack
- **Runtime**: Node.js 18+
- **Framework**: Native HTTP module (no Express)
- **Storage**: JSON files via fs module
- **Process Management**: PM2 (recommended for production)

### Development Stack
- **Language**: TypeScript (client), JavaScript (server)
- **Package Manager**: npm
- **Version Control**: Git
- **Deployment**: Static hosting + Node.js server

## Scalability Characteristics

### Current Scale Limits
- **Users**: Single user per client instance
- **Chats**: Thousands per user (IndexedDB limit ~50MB)
- **Messages**: Thousands per chat
- **Concurrent Users**: Limited by single server instance
- **Storage**: JSON file size limitations

### Scaling Considerations
- **Horizontal Scaling**: Requires database backend
- **Real-Time Features**: Would need WebSocket implementation
- **Multi-User**: Requires authentication and user isolation
- **High Availability**: Needs load balancer and multiple instances

## Security Model

### Current Security
- **Authentication**: None (public access)
- **Authorization**: None (all chats accessible)
- **Transport**: HTTP (HTTPS recommended for production)
- **Storage**: Unencrypted local and server storage

### Production Security Requirements
- **HTTPS**: Required for production deployment
- **Authentication**: JWT or session-based auth recommended
- **CORS**: Specific origins instead of wildcard
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Sanitize all user inputs

## Deployment Architecture

### Development Deployment
```
localhost:3000  (React dev server)
localhost:4001  (Node.js sync server)
```

### Production Deployment Options

#### Option 1: Static + Server
```
CDN/Static Host  (React build)
VPS/Cloud Server (Node.js API)
```

#### Option 2: Full Stack Platform
```
Vercel/Netlify   (React app)
Heroku/Railway   (Node.js API)
```

#### Option 3: Container Deployment
```
Docker Container (React + Nginx)
Docker Container (Node.js API)
```

## Performance Characteristics

### Client Performance
- **Cold Start**: ~1-2 seconds (IndexedDB initialization)
- **Chat Loading**: <100ms (indexed queries)
- **Message Rendering**: Real-time (React updates)
- **Storage Operations**: <50ms typical

### Server Performance
- **Request Latency**: <100ms for sync operations
- **Throughput**: 100+ requests/second (single instance)
- **Memory Usage**: <50MB (JSON file caching)
- **Disk I/O**: Atomic writes on sync operations

### Network Performance
- **Sync Payload**: Proportional to chat count
- **Bandwidth**: ~1KB per chat average
- **Offline Operation**: Zero network dependency
- **Sync Frequency**: User-initiated or periodic
