// src/scripts/ingestRagFolder.ts
import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";
import * as dotenv from "dotenv";

async function getEmbedding(text: string): Promise<number[]> {
  // naive dummy embedding: convert each char code modulo 100
  return Array.from(text.slice(0, 512)).map(c => c.charCodeAt(0) % 100);
}

dotenv.config();

// --- Resolve __dirname in ESM ---
const configPath = path.resolve(process.cwd(), "config/rag.json");

// --- Interfaces ---
interface RagConfig {
  ragFolder: string;
  chunkSize?: number;
  topK?: number;
}

// --- Utilities ---
function splitTextIntoChunks(text: string, chunkSize: number = 500): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

// --- Load config ---

if (!fs.existsSync(configPath)) {
  console.error("Missing config/rag.json. Please create it with { ragFolder: '...' }");
  process.exit(1);
}

const { ragFolder, chunkSize = 500 }: RagConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
if (!fs.existsSync(ragFolder)) {
  console.error(`RAG folder does not exist: ${ragFolder}`);
  process.exit(1);
}

// --- Postgres setup ---
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ingest() {
  const files = fs.readdirSync(ragFolder).filter(f => f.endsWith(".txt") || f.endsWith(".md"));

  for (const file of files) {
    const fullPath = path.join(ragFolder, file);
    const text = fs.readFileSync(fullPath, "utf-8");
    const chunks = splitTextIntoChunks(text, chunkSize);

    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      try {
        const embedding = await getEmbedding(chunk); // should return number[]
        await pool.query(
          `INSERT INTO rag_documents(file_name, chunk_index, content, embedding)
           VALUES ($1, $2, $3, $4)`,
          [file, index, chunk, embedding]
        );
      } catch (err) {
        console.error(`Failed to insert chunk ${index} of ${file}:`, err);
      }
    }

    console.log(`Ingested ${chunks.length} chunks from ${file}`);
  }

  console.log("RAG ingestion complete!");
}

(async () => {
  try {
    await ingest();
    console.log("RAG ingestion finished successfully.");
  } catch (err) {
    console.error("RAG ingestion failed:", err);
  } finally {
    try {
      await pool.end();
    } catch (err) {
      console.error("Error closing Postgres pool:", err);
    }
  }
})();
