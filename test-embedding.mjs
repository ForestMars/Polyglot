import { getEmbedding } from './src/services/rag/embeddings.js';

async function test() {
  try {
    console.log('Testing getEmbedding...');
    const embedding = await getEmbedding('test');
    console.log('Got embedding of length:', embedding.length);
    console.log('First 5 values:', embedding.slice(0, 5));
  } catch (error) {
    console.error('Error in test:', error);
  }
}

test();
