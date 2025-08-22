// src/server/queryRag.ts
import { Pool } from "pg";
import { getEmbedding } from "../services/rag/embeddings";

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "polyglut_user",
  password: process.env.PGPASSWORD || "polyglut",
  database: process.env.PGDATABASE || "polyglut_rag",
});

export async function queryRAG(question: string, k = 5) {
  try {
    // Get embedding for the question
    const questionEmbedding = await getEmbedding(question);
    console.log("Question embedding:", questionEmbedding.slice(0, 5), "Length:", questionEmbedding.length);
    console.log("Type of first element:", typeof questionEmbedding[0]);
    
    // Convert embedding to proper vector string format
    const embeddingStr = `[${questionEmbedding.join(',')}]`;

    // Query for similar documents using cosine distance
    const res = await pool.query(
      `SELECT content, metadata, (embedding <=> $1::vector) as distance 
       FROM rag_documents 
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector 
       LIMIT $2`,
      [embeddingStr, k]
    );

    // Debug logging
    console.log(`Found ${res.rows.length} similar chunks for question: "${question}"`);
    console.log("Top retrieved chunks:", res.rows.map((r, i) => 
      `${i+1}. (distance: ${r.distance.toFixed(4)}) ${r.content.substring(0, 100)}...`
    ));

    return res.rows.map((row) => ({
      content: row.content,
      metadata: row.metadata,
      distance: row.distance
    }));
    
  } catch (error) {
    console.error("Error in queryRAG:", error);
    throw error;
  }
}