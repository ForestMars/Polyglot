// src/server/queryRag.ts
import { Pool } from "pg";
import { getEmbedding } from "../services/rag/embeddings"; // Add this line!

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
    // Updated to use actual columns: id, chunk_index, file_name, content
    const res = await pool.query(
      `SELECT id, chunk_index, file_name, content, (embedding <=> $1::vector) as distance 
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

    // Return the actual columns
    return res.rows.map((row) => ({
      id: row.id,
      chunk_index: row.chunk_index,
      file_name: row.file_name,
      content: row.content,
      distance: row.distance
    }));
    
  } catch (error) {
    console.error("Error in queryRAG:", error);
    throw error;
  }
}