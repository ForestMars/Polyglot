// src/scripts/ingestRagFolder.ts
import fs from "fs/promises";
import path from "path";
import { Pool } from "pg";
import dotenv from "dotenv";
import { getEmbedding } from "../services/rag/embeddings";

dotenv.config();

const configPath = path.resolve("config/rag.json");
const configRaw = await fs.readFile(configPath, "utf-8");
const config = JSON.parse(configRaw);

const ragFolder = config.folderPath;
const CHUNK_SIZE = 200; // Adjust this to your desired chunk size
const OVERLAP_SIZE = 20; // Overlap between chunks to maintain context

console.log(`Using CHUNK_SIZE: ${CHUNK_SIZE}, OVERLAP_SIZE: ${OVERLAP_SIZE}`);

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "polyglut_user",
  password: process.env.PGPASSWORD || "polyglut",
  database: process.env.PGDATABASE || "polyglut_rag",
});

function chunkText(text: string, chunkSize: number, overlapSize: number): string[] {
  console.log(`🔍 chunkText called with chunkSize: ${chunkSize}, overlapSize: ${overlapSize}`);
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
      console.log(`   Created chunk ${chunks.length}: ${chunk.length} chars`);
    }
    
    start = end - overlapSize;
    if (start <= 0) start = end; // Prevent infinite loop
  }
  
  console.log(`   Total chunks created: ${chunks.length}`);
  return chunks;
}

async function clearExistingData() {
  console.log("Clearing existing embeddings...");
  await pool.query("DELETE FROM rag_documents");
  console.log("Existing data cleared.");
}

async function ingestFolder(folder: string) {
  const files = await fs.readdir(folder);

  for (const file of files) {
    console.log(`Processing file: ${file}`);
    const filePath = path.join(folder, file);
    const content = await fs.readFile(filePath, "utf-8");
    
    // Split content into chunks
    const chunks = chunkText(content, CHUNK_SIZE, OVERLAP_SIZE);
    console.log(`  File length: ${content.length} chars, Split into ${chunks.length} chunks`);
    console.log(`  Average chunk size: ${Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length)} chars`);
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`  Processing chunk ${i + 1}/${chunks.length}`);
      
      const embedding = await getEmbedding(chunk);

      await pool.query(
        "INSERT INTO rag_documents (file_name, chunk_index, content, embedding) VALUES ($1, $2, $3, $4)",
        [file, i, chunk, `[${embedding.join(",")}]`]
      );
    }
  }
}

// Clear existing data first
await clearExistingData();

// Ingest with new chunking
await ingestFolder(ragFolder);
console.log("RAG ingestion finished successfully.");
await pool.end();