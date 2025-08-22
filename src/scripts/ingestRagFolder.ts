import fs from "fs/promises";
import path from "path";
import { Pool } from "pg";
import dotenv from "dotenv";
import { getEmbedding } from "../services/rag/embeddings";

dotenv.config();

const configPath = path.resolve("config/rag.json");
const configRaw = await fs.readFile(configPath, "utf-8");
const config = JSON.parse(configRaw);

const ragFolder = config.rag.folderPath;

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "password",
  database: process.env.PGDATABASE || "polyglut_rag",
});

async function ingestFolder(folder: string) {
  const files = await fs.readdir(folder);

  for (const file of files) {
    const filePath = path.join(folder, file);
    const content = await fs.readFile(filePath, "utf-8");
    const embedding = await getEmbedding(content);

    await pool.query(
      "INSERT INTO rag_documents (content, embedding) VALUES ($1, $2)",
      [content, embedding]
    );
  }
}

await ingestFolder(ragFolder);
console.log("RAG ingestion finished successfully.");
await pool.end();
