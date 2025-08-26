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
    
    // Move forward by chunkSize minus overlap
    // BUT ensure we always move forward by at least 1 character
    const nextStart = start + chunkSize - overlapSize;
    start = Math.max(nextStart, start + 1);
    
    // If we've reached the end, break to avoid infinite loop
    if (end >= text.length) break;
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
  try {
    console.log(`📂 Reading directory: ${folder}`);
    const files = await fs.readdir(folder);
    console.log(`📝 Found ${files.length} files in directory`);

    if (files.length === 0) {
      console.error('❌ No files found in the RAG directory. Please check the folder path.');
      return;
    }

    for (const file of files) {
      try {
        console.log(`\n📄 Processing file: ${file}`);
        const filePath = path.join(folder, file);
        
        // Skip directories and hidden files
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          console.log(`  ⏩ Skipping directory: ${file}`);
          continue;
        }
        if (file.startsWith('.')) {
          console.log(`  ⏩ Skipping hidden file: ${file}`);
          continue;
        }
        
        // Read file content
        let content;
        try {
          content = await fs.readFile(filePath, "utf-8");
          if (!content || content.trim().length === 0) {
            console.log(`  ⚠️ File is empty: ${file}`);
            continue;
          }
        } catch (error) {
          console.error(`  ❌ Error reading file ${file}:`, error);
          continue;
        }
        
        // Split content into chunks
        const chunks = chunkText(content, CHUNK_SIZE, OVERLAP_SIZE);
        console.log(`  📊 File length: ${content.length} chars, Split into ${chunks.length} chunks`);
        
        // Process each chunk
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          console.log(`  🔄 Processing chunk ${i + 1}/${chunks.length}`);
          
          try {
            // Get embedding for the chunk
            const embedding = await getEmbedding(chunk);
            console.log(`    ✅ Got embedding (${embedding.length} dimensions)`);
            
            // Clean the embedding array - ensure all values are finite numbers
            const cleanEmbedding = embedding.map(val => {
              const num = Number(val);
              return Number.isFinite(num) ? num : 0; // Replace invalid numbers with 0
            });
            
            // Convert to PostgreSQL vector format
            const embeddingStr = `{${cleanEmbedding.join(',')}}`;
            
            // Insert into database
            await pool.query(
              `INSERT INTO rag_documents (file_name, chunk_index, content, embedding) 
               VALUES ($1, $2, $3, $4::vector)`,
              [file, i, chunk, embeddingStr]
            );
            
            console.log(`    💾 Successfully inserted chunk ${i + 1}`);
          } catch (error) {
            console.error(`    ❌ Error processing chunk ${i + 1}:`, error);
            // Continue with next chunk even if one fails
          }
        }
      } catch (error) {
        console.error(`❌ Error processing file ${file}:`, error);
        // Continue with next file even if one fails
      }
    }
  } catch (error) {
    console.error('❌ Error reading RAG directory:', error);
    throw error;
  }
}

// Clear existing data first
await clearExistingData();

// Ingest with new chunking
await ingestFolder(ragFolder);
console.log("RAG ingestion finished successfully.");
await pool.end();