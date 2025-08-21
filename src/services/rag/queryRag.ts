// src/services/rag/queryRag.ts

import { Pool } from "pg";
import { embedText } from "./embedder";  // your embedding function

// Postgres connection pool (same as Step 3)
const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "password",
  database: process.env.PGDATABASE || "polyglut_rag",
});

// Function to query top-k relevant chunks for a user question
// question: the user input string
// k: number of chunks to retrieve
export async function queryRAG(question: string, k = 5) {

  // Compute embedding for the question
  const questionEmbedding = await embedText(question); // returns number[]

  // Query Postgres using vector similarity (<->) to find closest chunks
  const res = await pool.query(
    `SELECT content
     FROM rag_documents
     ORDER BY embedding <-> $1
     LIMIT $2`,
    [questionEmbedding, k]
  );

  // Return only the text content of the top-k chunks
  return res.rows.map(row => row.content);
}
