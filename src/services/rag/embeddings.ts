// src/services/rag/embeddings.ts
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text,  // This is correct for Ollama's API
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Debug logging
    console.log("Raw Ollama response:", JSON.stringify(data, null, 2));
    console.log("data.embedding type:", typeof data.embedding);
    console.log("Is data.embedding array?", Array.isArray(data.embedding));
    if (data.embedding && data.embedding.length) {
      console.log("First few values:", data.embedding.slice(0, 5));
      console.log("Type of first element:", typeof data.embedding[0]);
    }
    
    return data.embedding;
  } catch (error) {
    console.error('Error getting embedding from Ollama:', error);
    throw error;
  }
}