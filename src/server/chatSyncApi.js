// src/server/chatSyncApi.js
// Minimal REST API for chat sync, no Express required.

import http from 'http';
import { getAllChats, addOrUpdateChats, deleteChat, deleteChats } from './chatStore.js';

// Utility: parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Create server
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    // GET /fetchChats → return all server chats
    if (req.method === 'GET' && req.url === '/fetchChats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(getAllChats()));
    }

    // POST /pushChats or /sync → add/update chats
    if (req.method === 'POST' && (req.url === '/pushChats' || req.url === '/sync')) {
      const body = await parseBody(req);
      const { chats } = body;

      if (!Array.isArray(chats)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'chats must be array' }));
      }

      // Add or update incoming chats
      addOrUpdateChats(chats);

      // If syncing, return chats missing on the client
      if (req.url === '/sync') {
        const serverChats = getAllChats();
        const clientIds = new Set(chats.map(c => c.id));
        const missing = serverChats.filter(c => !clientIds.has(c.id));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ missing }));
      }

      // POST /pushChats response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    // DELETE /deleteChat/:id → delete a single chat
    if (req.method === 'DELETE' && req.url?.startsWith('/deleteChat/')) {
      const chatId = req.url.split('/deleteChat/')[1];
      if (!chatId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Chat ID required' }));
      }

      const deleted = deleteChat(chatId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, deleted }));
    }

    // POST /deleteChats → delete multiple chats
    if (req.method === 'POST' && req.url === '/deleteChats') {
      const body = await parseBody(req);
      const { chatIds } = body;

      if (!Array.isArray(chatIds)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'chatIds must be array' }));
      }

      const deletedCount = deleteChats(chatIds);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, deletedCount }));
    }

    // Fallback 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

// Start server
const PORT = process.env.CHAT_SYNC_PORT || 4001;
server.listen(PORT, () => {
  console.log(`Chat sync API running on http://localhost:${PORT}`);
});