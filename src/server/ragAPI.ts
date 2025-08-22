// src/server/ragApi.ts
import http from "node:http";
import { queryRAG } from "./queryRAG";

const PORT = 3001;

console.log("🟢 SERVER FILE LOADED - THIS SHOULD ALWAYS SHOW");
console.log("🟢 Current time:", new Date().toISOString());
console.log("🟢 Process ID:", process.pid);

const server = http.createServer(async (req, res) => {
  console.log("🔥 REQUEST RECEIVED - METHOD:", req.method, "URL:", req.url);
  console.log("🔥 Headers:", JSON.stringify(req.headers, null, 2));
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("✅ HANDLING CORS PREFLIGHT REQUEST");
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "http://localhost:8080",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    });
    res.end();
    return;
  }
  
  // Add CORS headers to all responses
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:8080");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "POST" && req.url === "/query-rag") {
    console.log("✅ MATCHED POST /query-rag");
    let body = "";
    
    req.on("data", chunk => {
      console.log("📥 DATA CHUNK RECEIVED:", chunk.toString());
      body += chunk;
    });
    
    req.on("end", async () => {
      console.log("🏁 REQUEST END - Full body:", body);
      try {
        const parsed = JSON.parse(body);
        console.log("✅ JSON PARSED:", parsed);
        const { question } = parsed;
        console.log("❓ QUESTION EXTRACTED:", question);
        
        console.log("🔍 ABOUT TO CALL queryRAG...");
        const results = await queryRAG(question);
        console.log("✅ QUERYRAG RETURNED:", results ? results.length : "null", "results");
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ results }));
        console.log("📤 RESPONSE SENT");
        
      } catch (err) {
        console.error("❌ ERROR CAUGHT:", err);
        console.error("❌ ERROR STACK:", err.stack);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
        console.log("📤 ERROR RESPONSE SENT");
      }
    });
    
    req.on("error", (err) => {
      console.error("🚨 REQUEST ERROR:", err);
    });
    
  } else {
    console.log("❌ REQUEST DID NOT MATCH - Method:", req.method, "URL:", req.url);
    res.writeHead(404);
    res.end();
    console.log("📤 404 RESPONSE SENT");
  }
});

server.on("error", (err) => {
  console.error("🚨 SERVER ERROR:", err);
});

server.listen(PORT, () => {
  console.log("🚀 SERVER LISTENING ON PORT", PORT);
  console.log("🚀 Server started at:", new Date().toISOString());
  console.log("🚀 Try: curl -X POST http://localhost:3001/query-rag -H 'Content-Type: application/json' -d '{\"question\":\"test\"}'");
});

console.log("🟢 SCRIPT END REACHED");