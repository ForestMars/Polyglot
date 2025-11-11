// src/server/mcpDevApi.js
// Dev-only helper: serve /config/mcp.json and accept POST /mcp/inject to write config/inject.txt

import http from 'http';

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

const server = http.createServer(async (req, res) => {
  // Enable CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (req.method === 'GET' && req.url === '/config/mcp.json') {
      try {
        const fs = await import('fs');
        const raw = await fs.promises.readFile(new URL('../../config/mcp.json', import.meta.url), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(raw);
      } catch (err) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'config/mcp.json not found' }));
      }
    }

    if (req.method === 'POST' && req.url === '/mcp/inject') {
      const body = await parseBody(req);
      const { inject } = body;
      if (typeof inject !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'inject must be a string' }));
      }

      try {
        const fs = await import('fs');
        await fs.promises.writeFile(new URL('../../config/inject.txt', import.meta.url), inject, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: String(err) }));
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(err) }));
  }
});

const PORT = process.env.MCP_DEV_PORT || 4002;
server.listen(PORT, () => {
  console.log(`MCP dev API running on http://localhost:${PORT}`);
});

export default server;
