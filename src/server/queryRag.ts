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

// Extant function to just retrieve chunks
export async function queryRAG_(question: string, k = 5) {
  try {
    console.log("\n🔍 RAG RETRIEVAL DEBUG");
    console.log("=".repeat(50));
    console.log(`📝 Question: "${question}"`);
    
    // Get embedding for the question
    const questionEmbedding = await getEmbedding(question);
    console.log("✅ Question embedding generated:", questionEmbedding.slice(0, 3), `(${questionEmbedding.length}D)`);
    
    // Convert embedding to proper vector string format
    const embeddingStr = `[${questionEmbedding.join(',')}]`;

    // Query for similar documents using cosine distance
    const res = await pool.query(
      `SELECT id, chunk_index, file_name, content, (embedding <=> $1::vector) as distance 
       FROM rag_documents 
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector 
       LIMIT $2`,
      [embeddingStr, k]
    );

    // Enhanced logging
    console.log(`\n📚 Found ${res.rows.length} similar chunks:`);
    res.rows.forEach((row, i) => {
      const similarity = (1 - row.distance) * 100; // Convert distance to similarity percentage
      console.log(`\n${i + 1}. File: ${row.file_name}`);
      console.log(`   Similarity: ${similarity.toFixed(1)}%`);
      console.log(`   Content: ${row.content.substring(0, 200)}...`);
    });
    
    console.log("=".repeat(50));

    // Return the chunks
    return res.rows.map((row) => ({
      id: row.id,
      chunk_index: row.chunk_index,
      file_name: row.file_name,
      content: row.content,
      distance: row.distance,
      similarity: 1 - row.distance // Add similarity score
    }));
    
  } catch (error) {
    console.error("❌ Error in queryRAG:", error);
    throw error;
  }
}

// Query to combine RAG retrieval + model response
export async function queryRAG(question: string, modelFunction: Function, k = 5) {
  try {
    console.log("\n🤖 RAG + MODEL QUERY");
    console.log("=".repeat(60));
    
    // Step 1: Get relevant chunks
    const chunks = await queryRAG(question, k);
    
    if (chunks.length === 0) {
      console.log("❌ No relevant chunks found!");
      return "I couldn't find any relevant information to answer your question.";
    }
    
    // Step 2: Build context from chunks
    const context = chunks
      .map((chunk, i) => {
        return `--- Document ${i + 1}: ${chunk.file_name} (Similarity: ${(chunk.similarity * 100).toFixed(1)}%) ---\n${chunk.content}`;
      })
      .join('\n\n');
    
    console.log(`\n📄 Built context (${context.length} chars):`);
    console.log("-".repeat(40));
    console.log(context);
    console.log("-".repeat(40));
    
    // Step 3: Build the full prompt
    const systemPrompt = `You are a helpful assistant that answers questions based solely on the provided context. Use only the information from the context to answer questions. If the answer is not clearly in the context, say so.

CONTEXT:
${context}`;

    const userPrompt = `Based on the context above, please answer: ${question}`;
    
    console.log("\n🎯 PROMPTS SENT TO MODEL:");
    console.log("SYSTEM PROMPT LENGTH:", systemPrompt.length);
    console.log("USER PROMPT:", userPrompt);
    console.log("-".repeat(40));
    
    // Step 4: Get model response
    console.log("\n🤖 Calling model...");
    const response = await modelFunction(systemPrompt, userPrompt);
    
    console.log("\n📤 MODEL RESPONSE:");
    console.log(response);
    console.log("=".repeat(60));
    
    return response;
    
  } catch (error) {
    console.error("❌ Error in queryRAGWithAnswer:", error);
    throw error;
  }
}

// Helper function if you're using Ollama
export async function queryRAGWithOllama(question: string, model = "llama2", k = 5) {
  const ollamaFunction = async (systemPrompt: string, userPrompt: string) => {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: `${systemPrompt}\n\nUser: ${userPrompt}\nAssistant:`,
        stream: false
      })
    });
    
    const data = await response.json();
    return data.response;
  };
  
  return queryRAGWithAnswer(question, ollamaFunction, k);
}