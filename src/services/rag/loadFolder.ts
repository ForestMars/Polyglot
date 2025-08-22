// src/services/rag/loadFolder.ts
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { embedText } from "./embedder"; // your embedding function
import { chunkText } from "./chunker";  // splits text into chunks

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "polyglut_user",
  password: process.env.PGPASSWORD || "polyglut",
  database: process.env.PGDATABASE || "polyglut_rag",
});


// Main function to ingest all files from a given folder into the RAG database
// folderPath: absolute or relative path to the folder containing documents
export async function loadFolder(folderPath: string) {

    // Check if the folder exists; if not, throw an error
    if (!fs.existsSync(folderPath)) {
      throw new Error("RAG folder path does not exist.");
    }
  
    // List all text-based files (.txt and .md) in the folder
    const files = fs.readdirSync(folderPath)
                    .filter(f => f.endsWith(".txt") || f.endsWith(".md"));
  
    let totalChunks = 0; // Counter for total chunks inserted
  
    // Process each file
    for (const fileName of files) {
      const filePath = path.join(folderPath, fileName); // Full path to the file
      const text = fs.readFileSync(filePath, "utf8");   // Read file content as text
  
      const chunks = chunkText(text);  // Split text into smaller chunks
  
      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await embedText(chunk); // Compute embedding vector for this chunk
  
        // Insert the chunk and its embedding into the database
        // Columns: file name, chunk index, text content, embedding vector
        await pool.query(
          `INSERT INTO rag_documents (file_name, chunk_index, content, embedding)
           VALUES ($1, $2, $3, $4)`,
          [fileName, i, chunk, embedding]
        );
  
        totalChunks++; // Increment counter
      }
    }
  
    // Log summary after all files are processed
    console.log(`Loaded ${files.length} files with ${totalChunks} chunks into RAG database.`);
  }