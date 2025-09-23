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
