import { queryRAG } from "../../server/ragAPI";

export async function runRAGPipeline(question: string) {
  const chunks = await queryRAG(question, 5);

  const prompt = `
You are a helpful assistant. Use the following context to answer the question.

Context:
${chunks.join("\n\n")}

Question:
${question}
`;

  const answer = await callLLM(prompt);
  return { answer };
}
