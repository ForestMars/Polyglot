// src/scripts/ingestRagFolder.ts (merged version with all features)
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
const RECURSIVE = true; // Set to false to only process top-level directory

console.log(`Using CHUNK_SIZE: ${CHUNK_SIZE}, OVERLAP_SIZE: ${OVERLAP_SIZE}, RECURSIVE: ${RECURSIVE}`);

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

async function getAllFiles(dir: string, recursive: boolean = true): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && recursive) {
      // Recursively get files from subdirectories
      const subFiles = await getAllFiles(fullPath, recursive);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function getExistingFiles(): Promise<Set<string>> {
  const result = await pool.query("SELECT DISTINCT file_name FROM rag_documents");
  return new Set(result.rows.map(row => row.file_name));
}

async function getFileModificationTime(filePath: string): Promise<Date> {
  const stats = await fs.stat(filePath);
  return stats.mtime;
}

async function getStoredModificationTime(fileName: string): Promise<Date | null> {
  const result = await pool.query(
    "SELECT file_last_modified FROM rag_documents WHERE file_name = $1 LIMIT 1",
    [fileName]
  );
  return result.rows.length > 0 ? result.rows[0].file_last_modified : null;
}

async function removeExistingFile(fileName: string) {
  console.log(`  Removing existing chunks for ${fileName}`);
  await pool.query("DELETE FROM rag_documents WHERE file_name = $1", [fileName]);
}

async function processFile(filePath: string, fileName: string) {
  console.log(`Processing file: ${fileName}`);
  const content = await fs.readFile(filePath, "utf-8");
  
  // Get file modification time to store with chunks
  const fileModTime = await getFileModificationTime(filePath);
  
  // Split content into chunks using the improved chunking logic
  const chunks = chunkText(content, CHUNK_SIZE, OVERLAP_SIZE);
  console.log(`  File length: ${content.length} chars, Split into ${chunks.length} chunks`);
  console.log(`  Average chunk size: ${Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length)} chars`);
  
  // Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`  Processing chunk ${i + 1}/${chunks.length}`);
    
    const embedding = await getEmbedding(chunk);

    await pool.query(
      "INSERT INTO rag_documents (file_name, chunk_index, content, embedding, file_last_modified, created_at) VALUES ($1, $2, $3, $4, $5, NOW())",
      [fileName, i, chunk, `[${embedding.join(",")}]`, fileModTime]
    );
  }
}

async function ingestFiles(mode: 'full' | 'incremental' = 'incremental') {
  console.log(`\n=== Starting ${mode} ingestion ===`);
  
  // Get all files (recursively or not)
  const allFiles = await getAllFiles(ragFolder, RECURSIVE);
  console.log(`Found ${allFiles.length} files total`);
  
  if (mode === 'full') {
    console.log("Full mode: Clearing all existing data...");
    await pool.query("DELETE FROM rag_documents");
    console.log("Existing data cleared.");
  }
  
  // Get existing files in database
  const existingFiles = await getExistingFiles();
  console.log(`Found ${existingFiles.size} files already in database`);
  
  let processed = 0;
  let skipped = 0;
  let updated = 0;
  
  for (const filePath of allFiles) {
    // Get relative file name for storage (using basename for consistency)
    const fileName = path.basename(filePath);
    
    try {
      if (mode === 'incremental' && existingFiles.has(fileName)) {
        // Check if file has been modified
        const fileModTime = await getFileModificationTime(filePath);
        const storedModTime = await getStoredModificationTime(fileName);
        
        if (storedModTime && fileModTime <= storedModTime) {
          console.log(`Skipping ${fileName} (unchanged)`);
          skipped++;
          continue;
        } else {
          console.log(`File ${fileName} has been modified, updating...`);
          await removeExistingFile(fileName);
          updated++;
        }
      }
      
      await processFile(filePath, fileName);
      processed++;
      
    } catch (error) {
      console.error(`Error processing ${fileName}:`, error);
    }
  }
  
  console.log(`\n=== Ingestion complete ===`);
  console.log(`Files processed: ${processed}`);
  console.log(`Files updated: ${updated}`);
  console.log(`Files skipped: ${skipped}`);
}

// Command line argument parsing
const mode = process.argv[2] === '--full' ? 'full' : 'incremental';

console.log(`Mode: ${mode}`);
console.log(`Folder: ${ragFolder}`);

await ingestFiles(mode);
console.log("RAG ingestion finished successfully.");
await pool.end();