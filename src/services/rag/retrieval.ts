import { Pool } from "pg";
import { getEmbedding } from "@/services/rag/embeddings";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function getRelevantChunks(query: string, topK = 5) {
  // Step 1: Embed the question
  const queryEmbedding = await getEmbedding(query);

  // Step 2: Retrieve closest chunks from Postgres
  const { rows } = await pool.query(
    `SELECT content 
       FROM rag_documents
      ORDER BY embedding <-> $1
      LIMIT $2`,
    [queryEmbedding, topK]
  );

  return rows.map(r => r.content);
}
