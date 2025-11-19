// src/tests/server/ragApi.unit.test.ts
import { vi, describe, it, expect } from 'vitest';
import request from 'supertest'; // Assuming you use supertest for HTTP testing
// Import the server module (adjust path as needed)
import { server } from '../../server/ragApi'; 

// 🚨 STEP 1: Mock the queryRAG function
vi.mock('../../src/server/queryRAG', () => ({
  // Define a mock function for queryRAG
  queryRAG: vi.fn(async (question: string) => {
    // 💡 This is where the tool-routing logic is mocked!
    if (question.toLowerCase().includes('what day is it')) {
      // Simulate the model using the internal "date/time" tool (MCP server)
      console.log('--- MOCK: queryRAG detected Date Question ---');
      return [{
        type: 'tool_response', 
        content: `Today is Tuesday, November 18, 2025.`,
        source: 'MCP_SERVER_DATE_TOOL'
      }];
    }
    // Simulate a standard RAG response for other questions
    return [{ 
      type: 'rag_document', 
      content: 'Standard RAG result for a non-time query.', 
      source: 'DocDB' 
    }];
  }),
}));

// We need to import the mocked function to assert its calls later
import { queryRAG } from '../../src/server/queryRAG';

// src/tests/server/ragApi.unit.test.ts (Continuing from above)

describe('RAG API - Model Tooling Test', () => {
    
  // Use a global mock of the date so the test is predictable
  const MOCK_DATE_RESULT = 'Today is Tuesday, November 18, 2025.';

  it('should trigger the date tool when the question asks for the day', async () => {
    const question = 'Hey model, what day is it today?';

    const response = await request(server)
      .post('/query-rag')
      .send({ question })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // 1. Assert that the server called queryRAG
    expect(queryRAG).toHaveBeenCalledTimes(1);
    expect(queryRAG).toHaveBeenCalledWith(question);

    // 2. Assert the response content is the mocked date tool result
    // (We are checking that the server correctly passed through the tool's output)
    expect(response.body.results).toBeDefined();
    expect(response.body.results[0].content).toBe(MOCK_DATE_RESULT);
    expect(response.body.results[0].source).toBe('MCP_SERVER_DATE_TOOL');
  });

  it('should NOT trigger the date tool for a standard RAG query', async () => {
    // Clear the call history from the previous test
    vi.mocked(queryRAG).mockClear(); 

    const question = 'What are the main benefits of using Bun?';

    const response = await request(server)
      .post('/query-rag')
      .send({ question })
      .set('Accept', 'application/json')
      .expect(200);

    // 1. Assert that the server called queryRAG
    expect(queryRAG).toHaveBeenCalledTimes(1);

    // 2. Assert the response content is the standard RAG result
    expect(response.body.results[0].content).toBe('Standard RAG result for a non-time query.');
    expect(response.body.results[0].source).toBe('DocDB');
  });
});
