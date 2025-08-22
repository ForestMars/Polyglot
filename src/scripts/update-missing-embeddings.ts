// update-missing-embeddings.js
import { Pool } from "pg";
import { getEmbedding } from "../services/rag/embeddings.js";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "polyglut_user",
  password: process.env.PGPASSWORD || "polyglut",
  database: process.env.PGDATABASE || "polyglut_rag",
});

async function updateMissingEmbeddings() {
  try {
    console.log("Finding records without embeddings...");
    
    const result = await pool.query(
      "SELECT id, file_name, chunk_index, content FROM rag_documents WHERE embedding IS NULL ORDER BY id"
    );
    
    console.log(`Found ${result.rows.length} records without embeddings\n`);
    
    if (result.rows.length === 0) {
      console.log("✅ All records already have embeddings!");
      return;
    }
    
    let processed = 0;
    let errors = 0;
    
    for (const row of result.rows) {
      try {
        console.log(`Processing ${processed + 1}/${result.rows.length}: ${row.file_name} (chunk ${row.chunk_index})`);
        
        // Generate embedding
        const embedding = await getEmbedding(row.content);
        
        // Update database
        await pool.query(
          "UPDATE rag_documents SET embedding = $1 WHERE id = $2",
          [`[${embedding.join(",")}]`, row.id]
        );
        
        processed++;
        console.log(`   ✅ Updated (${embedding.length} dimensions)`);
        
        // Small delay to be nice to Ollama
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errors++;
        console.error(`   ❌ Failed: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully processed: ${processed}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📁 Total records: ${result.rows.length}`);
    
    // Verify results
    const checkResult = await pool.query(
      "SELECT COUNT(*) as total, COUNT(embedding) as with_embeddings FROM rag_documents"
    );
    
    console.log(`\n🔍 Database status:`);
    console.log(`   Total records: ${checkResult.rows[0].total}`);
    console.log(`   With embeddings: ${checkResult.rows[0].with_embeddings}`);
    
  } catch (error) {
    console.error("❌ Error updating embeddings:", error);
  } finally {
    await pool.end();
  }
}

updateMissingEmbeddings();