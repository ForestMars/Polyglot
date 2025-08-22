// src/services/ragPipeline.ts
const RAG_API_BASE = 'http://localhost:3001';

export async function runRAGPipeline(question: string) {
  try {
    const response = await fetch(`${RAG_API_BASE}/query-rag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, k: 5 }),
    });

    if (!response.ok) {
      throw new Error(`RAG API error: ${response.status}`);
    }

    const data = await response.json();
    
    const context = data.results.join('\n\n');
    const sources = data.results;

    return { context, sources };
  } catch (error) {
    console.error('RAG pipeline error:', error);
    return { context: '', sources: [] };
  }
}