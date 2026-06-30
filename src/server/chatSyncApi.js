// src/server/chatSyncApi.js
// Chat sync API with control/data plane separation.
//
// Data plane  → POST /pushChats   real-time update propagation, Invariant 5 enforced in chatStore
// Control plane → POST /sync      reconciliation at epoch boundaries, deletion records exchanged
//               → POST /deleteChat, POST /deleteChats   initiate deletions (write deletion records)
//
// The old DELETE /deleteChat/:id is gone. Deletion is always a control plane write,
// never a hard remove at the HTTP layer.

import http from 'http';
import { WebSocketServer } from 'ws';
import {
  getAllChats,
  getAllChatsWithDeleted,
  addOrUpdateChats,
  deleteChat,
  deleteChats,
} from './chatStore.js';

const PORT = process.env.CHAT_SYNC_PORT || 4001;

// WebSocket — real-time data plane broadcast (stub, smoke-test only)
const sockets = new Set();

function broadcast(chat) {
  const payload = JSON.stringify({ id: chat.id, updatedAtLamport: chat.updatedAtLamport, ...chat });
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}
// Utility
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// Lexicographic dominance (mirrors chatStore.js — kept local to avoid a shared
// util import for now; extract to shared/lamport.js when the codebase grows).
function dominates(tauA, tauB) {
  if (!tauA || !tauB) return false;
  const [lA, dA] = tauA;
  const [lB, dB] = tauB;
  return lA > lB || (lA === lB && String(dA) > String(dB));
}

/*
 * Reconciliation (control plane, Section 3.4 Case 1)
*
* Client sends its full state: live chats + deletion records.
* Server applies the causal participation check and returns:
*   - chats the client is missing (server has, client doesn't)
*   - deletion records the client hasn't seen
*   - chats the server accepted from the client's push
*
* The check for each server-held deletion record d against a client chat c:
*   If c.updatedAtLamport ⊀ d.deletedAtLamport, c has no causal participation
*   after deletion → client must accept the deletion.
*   If c.updatedAtLamport ≻ d.deletedAtLamport, c causally participated after
*   deletion → server upserts c (handled in addOrUpdateChats), deletion loses.
*/
function reconcile(clientChats, clientDeletionRecords) {
  // Ingest client's live chats (chatStore enforces Invariant 5 internally)
  if (clientChats.length > 0) {
    addOrUpdateChats(clientChats);
  }

  const serverAll = getAllChatsWithDeleted();
  const serverById = Object.fromEntries(serverAll.map(c => [c.id, c]));

  const clientLiveIds = new Set(clientChats.map(c => c.id));
  const clientDeletedIds = new Set((clientDeletionRecords || []).map(r => r.id));

  /* Chats the client has live that the server has marked deleted:
   * already handled in addOrUpdateChats (discarded unless causal dominance).
   * We need to tell the client about server-side deletions it hasn't seen.
   */
  const deletionsForClient = serverAll
    .filter(c => c.is_deleted && !clientDeletedIds.has(c.id))
    .map(c => ({ id: c.id, deletedAtLamport: c.deletedAtLamport }));

  // Chats the client is missing entirely (server has live, client has neither
  // live nor a deletion record for them — topologically unknown resource case).
  const missingForClient = serverAll.filter(
    c => !c.is_deleted && !clientLiveIds.has(c.id) && !clientDeletedIds.has(c.id)
  ).map(c => ({
    ...c,
    updatedAtLamport: c.updatedAtLamport ?? c.clock ?? [0, "server"]
    }));

  // Deletion records the client sent that the server doesn't have yet.
  // Apply them now (control plane delete on behalf of client).
  const clientInitiatedDeletes = (clientDeletionRecords || []).filter(
    r => !serverById[r.id]?.is_deleted
  );
  if (clientInitiatedDeletes.length > 0) {
    deleteChats(
      clientInitiatedDeletes.map(r => r.id),
      clientInitiatedDeletes[0]?.deletedAtLamport
    );
  }

  return { missing: missingForClient, deletions: deletionsForClient };
}

// Server
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    // GET /fetchChats → live chats only (data plane read, no deletion records)
    if (req.method === 'GET' && req.url === '/fetchChats') {
      return json(res, 200, getAllChats());
    }

    // POST /pushChats → data plane: real-time update propagation.
    // Invariant 5 enforced in chatStore.addOrUpdateChats.
    // No reconciliation; no deletion records returned.
    if (req.method === 'POST' && req.url === '/pushChats') {
      const { chats } = await parseBody(req);
      if (!Array.isArray(chats)) return json(res, 400, { error: 'chats must be array' });

      addOrUpdateChats(chats);
      return json(res, 200, { ok: true });
    }

    // POST /sync → control plane: epoch-boundary reconciliation.
    // Client sends { chats, deletionRecords }.
    // Server returns { missing, deletions }.
    if (req.method === 'POST' && req.url === '/sync') {
      const { chats, deletionRecords } = await parseBody(req);
      if (!Array.isArray(chats)) return json(res, 400, { error: 'chats must be array' });

      const { missing, deletions } = reconcile(chats, deletionRecords || []);
      return json(res, 200, { missing, deletions });
    }

    // POST /deleteChat → control plane: single deletion record write.
    // Body: { chatId, lamport }
    if (req.method === 'POST' && req.url === '/deleteChat') {
      const { chatId, lamport } = await parseBody(req);
      if (!chatId) return json(res, 400, { error: 'chatId required' });

      const record = deleteChat(chatId, lamport);
      return json(res, 200, { ok: true, record });
    }

    // ------------------------------------------------------------------
    // POST /deleteChats → control plane: bulk deletion record write.
    // Body: { chatIds, lamport }
    // ------------------------------------------------------------------
    if (req.method === 'POST' && req.url === '/deleteChats') {
      const { chatIds, lamport } = await parseBody(req);
      if (!Array.isArray(chatIds)) return json(res, 400, { error: 'chatIds must be array' });

      const records = deleteChats(chatIds, lamport);
      return json(res, 200, { ok: true, records, deletedCount: records.length });
    }

    json(res, 404, { error: 'Not found' });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
});

const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  sockets.add(ws);
  ws.on('close', () => sockets.delete(ws));
  ws.on('error', () => sockets.delete(ws));
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, () => {
    console.log(`Chat sync API running on http://localhost:${PORT}`);
  });
}

export { server };