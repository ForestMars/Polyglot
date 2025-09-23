# Sync API Reference

## Base URL
```
http://localhost:4001
```

## Authentication
None. All endpoints are publicly accessible.

## Endpoints

### GET /fetchChats
Retrieve all server-stored chats.

**Request:**
- Method: `GET`
- Headers: None required
- Body: None

**Response:**
```json
[
  {
    "id": "chat-123",
    "title": "Example Chat",
    "messages": [
      {
        "id": "msg-456",
        "role": "user",
        "content": "Hello world",
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
```

**Status Codes:**
- `200` - Success
- `500` - Server error (file read failure)

**Example:**
```bash
curl http://localhost:4001/fetchChats
```

### POST /pushChats
Upload client chats to server without receiving server chats back.

**Request:**
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "chats": [Chat[]]
}
```

**Response:**
```json
{
  "ok": true
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request (missing chats array)
- `500` - Server error (file write failure)

**Example:**
```bash
curl -X POST http://localhost:4001/pushChats \
  -H "Content-Type: application/json" \
  -d '{"chats": [{"id": "test", "title": "Test", "messages": [], "createdAt": "2024-01-15T10:00:00.000Z", "updatedAt": "2024-01-15T10:00:00.000Z", "lastModified": "2024-01-15T10:00:00.000Z"}]}'
```

### POST /sync
Bidirectional synchronization. Upload client chats and receive missing server chats.

**Request:**
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "chats": [Chat[]]
}
```

**Response:**
```json
{
  "missing": [Chat[]]
}
```

The `missing` array contains chats that exist on the server but were not included in the client's request.

**Status Codes:**
- `200` - Success
- `400` - Invalid request (missing chats array)
- `500` - Server error

**Example:**
```bash
curl -X POST http://localhost:4001/sync \
  -H "Content-Type: application/json" \
  -d '{"chats": []}'
```

### OPTIONS (All Endpoints)
CORS preflight support.

**Response:**
- Status: `204 No Content`
- Headers: CORS headers set

## Error Handling

### 400 Bad Request
```json
{
  "error": "chats must be array"
}
```

### 404 Not Found
```json
{
  "error": "Not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Error message details"
}
```

## CORS Configuration
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

## Data Persistence
- Server stores all chats in `chatStore.json`
- Merge strategy: ID-based deduplication (newer chats overwrite existing)
- File format: JSON array of Chat objects

## Conflict Resolution
- **Strategy**: Last-write-wins based on chat ID
- **No timestamp comparison**: Server accepts all incoming chats
- **Duplicate handling**: Incoming chats replace existing chats with same ID

## Rate Limiting
None implemented. Consider adding rate limiting for production use.

## Server Configuration
- **Port**: Environment variable `CHAT_SYNC_PORT` (default: 4001)
- **Storage**: `chatStore.json` in server directory
- **Dependencies**: Node.js standard library only
