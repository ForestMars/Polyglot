// test-single-ingest.js
import { Pool } from "pg";
import { getEmbedding } from "../services/rag/embeddings.ts";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "polyglut_user",
  password: process.env.PGPASSWORD || "polyglut",
  database: process.env.PGDATABASE || "polyglut_rag",
});

async function testSingleIngest() {
  try {
    const testContent = "What did Vic say to the Inspector? You're early, he said.";
    
    console.log("1. Testing embedding generation...");
    const embedding = await getEmbedding(testContent);
    console.log(`   ✓ Generated embedding with ${embedding.length} dimensions`);
    console.log(`   ✓ First few values: [${embedding.slice(0, 3).join(', ')}...]`);
    
    console.log("\n2. Testing database insertion...");
    const result = await pool.query(
      "INSERT INTO rag_documents (file_name, chunk_index, content, embedding) VALUES ($1, $2, $3, $4) RETURNING id",
      ["test-file.txt", 0, testContent, `[${embedding.join(",")}]`]
    );
    
    console.log(`   ✓ Inserted with ID: ${result.rows[0].id}`);
    
    console.log("\n3. Testing retrieval...");
    const checkResult = await pool.query(
      "SELECT file_name, content, embedding IS NOT NULL as has_embedding FROM rag_documents WHERE id = $1",
      [result.rows[0].id]
    );
    
    console.log(`   ✓ Retrieved: ${checkResult.rows[0].file_name}`);
    console.log(`   ✓ Has embedding: ${checkResult.rows[0].has_embedding}`);
    
    // Clean up
    await pool.query("DELETE FROM rag_documents WHERE id = $1", [result.rows[0].id]);
    
    console.log("\n✅ Single ingestion test successful!");
    
  } catch (error) {
    console.error("❌ Error in test:", error);
  } finally {
    await pool.end();
  }
}

testSingleIngest();