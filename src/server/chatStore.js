// src/server/chatStore.js
// Simple JSON file-based chat store for prototyping (ESM)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname replacement for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export function getAllChats() {
  return readChats();
}

export function addOrUpdateChats(newChats) {
  const chats = readChats();
  const byId = Object.fromEntries(chats.map(c => [c.id, c]));
  for (const chat of newChats) {
    byId[chat.id] = chat;
  }
  writeChats(Object.values(byId));
}
