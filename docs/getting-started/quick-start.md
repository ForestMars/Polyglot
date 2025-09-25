## Quick Start

### TL;DR
```bash
    git clone https://github.com/ForestMars/Polyglot.git
   cd Polyglot && npm install && npm run dev
```

---
### Prerequisites

- Node.js 18+
- npm or yarn (bun support coming soon)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/polyglot.git
   cd polyglot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional for development)
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys if testing real integrations
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:8080`

## Your First Research Session (2 minutes)

- Start a conversation: Open http://localhost:3000, create new chat
- Test memory persistence: Close browser, reopen - your conversation is still there
- Switch models: Try the same prompt with different AI models, notice how context carries over
- Add knowledge: (Coming soon) Upload a document to see RAG integration

## Understanding Memory Control (1 minute)
Unlike standard AI chat tools, every interaction in Polyglot builds your controlled knowledge base:

- Conversations persist across browser sessions
- Context maintains when switching between AI models
- You control what knowledge gets integrated and how
