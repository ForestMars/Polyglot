// src/server/queryRag.ts
import { Pool } from "pg";
import { getEmbedding } from "../services/rag/embeddings";

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "password",
  database: process.env.PGDATABASE || "polyglut_rag",
});

export async function queryRAG(question: string, k = 5) {
  const questionEmbedding = await getEmbedding(question);

  const res = await pool.query(
    `SELECT content FROM rag_documents ORDER BY embedding <-> $1 LIMIT $2`,
    [questionEmbedding, k]
  );

  // debug
  console.log("Top retrieved chunks:", res.rows.map((r) => r.content));

  return res.rows.map((row) => row.content);
}
