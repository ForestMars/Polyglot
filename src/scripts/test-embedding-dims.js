// test-embedding-dims.js
async function testEmbeddingDimensions() {
  try {
    const response = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: 'test text',
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Embedding dimensions: ${data.embedding.length}`);
    console.log(`First 5 values: [${data.embedding.slice(0, 5).join(', ')}...]`);
    
  } catch (error) {
    console.error('Error:', error);
    console.log('\nMake sure Ollama is running and you have the model:');
    console.log('ollama pull nomic-embed-text');
  }
}

testEmbeddingDimensions();