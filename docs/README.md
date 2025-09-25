# Polyglot Documentation

Polyglot is a local playground for AI research where you control memory across models and conversations.
Build persistent knowledge that carries across model switches, chat threads, and sessions. Add your own documents via RAG, connect tools through MCP servers, and compare how different AI models (cloud or local) perform with the same controlled memory context. Everything runs locally with ability to syncronize multiple devices, so your research environment and accumulated knowledge stays private and under your control while being accessible anywhere.

## What Makes Polyglot So Different

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
