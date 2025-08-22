// src/server/ragApi.ts
import http from "node:http";
import { queryRAG } from "./queryRAG";

const PORT = 3001;

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/query-rag") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { question } = JSON.parse(body);
        const results = await queryRAG(question);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ results }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => console.log(`RAG API running on port ${PORT}`));
