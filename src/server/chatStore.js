// Simple JSON file-based chat store for prototyping
const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'chatStore.json');

function readChats() {
  if (!fs.existsSync(STORE_PATH)) return [];
  const raw = fs.readFileSync(STORE_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeChats(chats) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(chats, null, 2));
}

function getAllChats() {
  return readChats();
}

function addOrUpdateChats(newChats) {
  const chats = readChats();
  const byId = Object.fromEntries(chats.map(c => [c.id, c]));
  for (const chat of newChats) {
    byId[chat.id] = chat;
  }
  writeChats(Object.values(byId));
}

module.exports = { getAllChats, addOrUpdateChats };
