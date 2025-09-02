#!/bin/bash

# client.sh - Handle Server-Sent Events properly
source .notion

SERVER_AUTH_TOKEN="e467504324a97b3cb9ad546bf785a7127175fcd06ac52324a0986c0cb869b69f"

echo "Testing MCP server connection..."

echo "=== Testing MCP initialize ==="
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $SERVER_AUTH_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {
        "roots": {
          "listChanged": true
        },
        "sampling": {}
      },
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    },
    "id": 1
  }' \
  http://localhost:9001/mcp)

echo "$RESPONSE"

# Parse the SSE response - extract JSON from the data: line
JSON_DATA=$(echo "$RESPONSE" | grep '^data:' | sed 's/^data: //')
echo "Parsed JSON: $JSON_DATA"

# For now, let's just try the requests without worrying about session ID
# since the initialize worked
echo -e "\n=== Testing list resources ==="
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $SERVER_AUTH_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "method": "resources/list", 
    "params": {},
    "id": 2
  }' \
  http://localhost:9001/mcp

echo -e "\n\n=== Testing list tools ==="
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $SERVER_AUTH_TOKEN" \
  -d '{
    "jsonrpc": "2.0", 
    "method": "tools/list",
    "params": {},
    "id": 3
  }' \
  http://localhost:9001/mcp
