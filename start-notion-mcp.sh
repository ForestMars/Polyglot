#!/bin/bash

# Source environment variables
source .notion

# Export the environment variables
export NOTION_TOKEN
export NOTION_VERSION

# Set up the MCP headers
export OPENAPI_MCP_HEADERS="{\"Authorization\": \"Bearer $NOTION_TOKEN\", \"Notion-Version\": \"$NOTION_VERSION\"}"

# Run the Notion MCP server
npx -y @notionhq/notion-mcp-server
