// src/server/chatStore.js
// Chat store with eventual coherence: soft-delete, Lamport clock, deletion records.
// Hard deletes are gone. A deleted chat stays as {is_deleted: true, deletedAtLamport}
// until server-side GC confirms all devices have crossed a sync boundary past the deletion.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE_PATH = path.join(__dirname, 'chatStore.json');

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function readStore() {
  if (!fs.existsSync(STORE_PATH)) return { chats: {}, lamportClock: 0 };
  const raw = fs.readFileSync(STORE_PATH, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    // Migrate legacy format (plain array) to store format
    if (Array.isArray(parsed)) {
      const chats = Object.fromEntries(parsed.map(c => [c.id, c]));
      return { chats, lamportClock: 0 };
    }
    return parsed;
  } catch {
    return { chats: {}, lamportClock: 0 };
  }
}

function writeStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// ---------------------------------------------------------------------------
// Lamport clock
// The server clock advances on every write. Returned as [logicalTime, 'server'].
// Clients supply their own [logicalTime, deviceId] tuples; the server takes
// max(serverClock, clientClock) + 1 on ingestion, per Lamport's rule.
// ---------------------------------------------------------------------------

function tickClock(store, incomingLamport) {
  const [incomingL] = incomingLamport ?? [0];
  store.lamportClock = Math.max(store.lamportClock, incomingL) + 1;
  return [store.lamportClock, 'server'];
}

// Lexicographic dominance: τ_a ≻ τ_b iff a[0] > b[0], or (a[0] === b[0] && a[1] > b[1])
function dominates(tauA, tauB) {
  if (!tauA || !tauB) return false;
  const [lA, dA] = tauA;
  const [lB, dB] = tauB;
  return lA > lB || (lA === lB && String(dA) > String(dB));
}

// ---------------------------------------------------------------------------
// Private message filter (preserved from original)
// ---------------------------------------------------------------------------

function filterPrivateMessages(chat) {
  if (chat?.messages) {
    chat.messages = chat.messages.filter(msg => !msg.isPrivate);
  }
  return chat;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Returns all live (non-deleted) chats for normal UI reads.
export function getAllChats() {
  const { chats } = readStore();
  return Object.values(chats).filter(c => !c.is_deleted);
}

// Returns all chats including deletion records, for control plane reconciliation.
export function getAllChatsWithDeleted() {
  const { chats } = readStore();
  return Object.values(chats);
}

// Data plane: add or update chats. Applies Invariant 5: if the server holds a
// deletion record for a chat and the incoming update's Lamport tuple does not
// strictly dominate that record, the update is silently discarded.
// If the incoming update does dominate (causal participation after deletion),
// the resource is restored via upsert semantics (server-level upsert, Definition 6).
export function addOrUpdateChats(newChats) {
  const store = readStore();

  for (const incoming of newChats) {
    // Skip chats without an id
    if (!incoming.id) continue;

    const filtered = filterPrivateMessages({ ...incoming });
    const existing = store.chats[filtered.id];

    if (existing?.is_deleted) {
      const tauDelete = existing.deletedAtLamport;
      const tauIncoming = filtered.updatedAtLamport;

      if (dominates(tauIncoming, tauDelete)) {
        // Device causally participated after deletion: upsert (restore resource).
        // Advance server clock, record the merge.
        const serverTau = tickClock(store, tauIncoming);
        store.chats[filtered.id] = {
          ...filtered,
          is_deleted: false,
          deletedAtLamport: null,
          serverMergedAtLamport: serverTau,
        };
      }
      // else: update does not dominate deletion record → discard (Invariant 5).

    } else {
      // Normal upsert. Advance server clock.
      const tauIncoming = filtered.updatedAtLamport ?? [0, filtered.id];
      const serverTau = tickClock(store, tauIncoming);
      store.chats[filtered.id] = {
        ...existing,
        ...filtered,
        serverMergedAtLamport: serverTau,
      };
    }
  }

  writeStore(store);
}

// Control plane: mark a chat as deleted on the server.
// Writes a deletion record {is_deleted, deletedAtLamport} and retains the entry.
// Returns the deletion record for propagation to clients.
export function deleteChat(chatId, clientLamport) {
  const store = readStore();
  const existing = store.chats[chatId];

  if (!existing || existing.is_deleted) {
    return null; // Already deleted or never existed.
  }

  console.log('[chatStore] addOrUpdateChats:', {
    id: filtered.id,
    title: filtered.title,
    incomingMsgCount: (filtered.messages || []).length,
    existingMsgCount: (existing?.messages || []).length,
    tauIncoming,
    tauExisting: existing?.updatedAtLamport ?? existing?.serverMergedAtLamport ?? null,
    willOverwriteMessages: (filtered.messages || []).length < (existing?.messages || []).length,
  });


  const serverTau = tickClock(store, clientLamport);
  store.chats[chatId] = {
    ...existing,
    is_deleted: true,
    deletedAtLamport: serverTau,
    // Strip content to minimise storage; retain id and topology metadata.
    messages: undefined,
  };

  writeStore(store);
  return { id: chatId, deletedAtLamport: serverTau };
}

// Control plane: bulk delete.
export function deleteChats(chatIds, clientLamport) {
  const store = readStore();
  const records = [];

  for (const chatId of chatIds) {
    const existing = store.chats[chatId];
    if (!existing || existing.is_deleted) continue;

    const serverTau = tickClock(store, clientLamport);
    store.chats[chatId] = {
      ...existing,
      is_deleted: true,
      deletedAtLamport: serverTau,
      messages: undefined,
    };
    records.push({ id: chatId, deletedAtLamport: serverTau });
  }

  writeStore(store);
  return records;
}

// GC: hard-delete a chat only after all known devices have acknowledged the
// deletion by crossing a sync boundary past deletedAtLamport.
// Call this from a separate GC job, not from the sync path.
export function gcChat(chatId) {
  const store = readStore();
  const existing = store.chats[chatId];
  if (!existing?.is_deleted) return false;
  delete store.chats[chatId];
  writeStore(store);
  return true;
}