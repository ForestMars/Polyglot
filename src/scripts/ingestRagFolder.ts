// src/scripts/ingestRagFolder.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import dotenv from "dotenv";
import { getEmbedding } from "@/services/rag/embeddings";

dotenv.config();

// --- Resolve __dirname in ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const configPath = path.join(__dirname, "../../config/rag.json");
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
