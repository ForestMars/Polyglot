// src/server/chatStore.js
// Simple JSON file-based chat store for prototyping
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Helper function to remove private messages from a chat object
function filterPrivateMessages(chat) {
    if (chat && chat.messages) {
        // Filter out any message where isPrivate is true.
        chat.messages = chat.messages.filter(msg => !msg.isPrivate);
    }
    return chat;
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
