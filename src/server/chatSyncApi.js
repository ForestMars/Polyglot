// Minimal REST API for chat sync
const express = require('express');
const cors = require('cors');
const { getAllChats, addOrUpdateChats } = require('./chatStore');

const app = express();
app.use(cors());
app.use(express.json());

// Fetch all chats (for initial sync)
app.get('/fetchChats', (req, res) => {
  res.json(getAllChats());
});

// Push new/updated chats from client
app.post('/pushChats', (req, res) => {
  const { chats } = req.body;
  if (!Array.isArray(chats)) return res.status(400).json({ error: 'chats must be array' });
  addOrUpdateChats(chats);
  res.json({ ok: true });
});

// Sync endpoint: client sends local chats, gets missing server chats
app.post('/sync', (req, res) => {
  const { chats: clientChats } = req.body;
  if (!Array.isArray(clientChats)) return res.status(400).json({ error: 'chats must be array' });
  addOrUpdateChats(clientChats);
  const serverChats = getAllChats();
  // Return chats not present on client (by id)
  const clientIds = new Set(clientChats.map(c => c.id));
  const missing = serverChats.filter(c => !clientIds.has(c.id));
  res.json({ missing });
});

// Start server
const PORT = process.env.CHAT_SYNC_PORT || 4001;
app.listen(PORT, () => {
  console.log(`Chat sync API running on port ${PORT}`);
});
