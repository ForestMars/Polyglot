import { getRelevantChunks } from "@/services/rag/retrieval";
import { callLLM } from "@/services/llmClient"; // your chat model wrapper

export async function answerQuestion(userQuestion: string) {
  const chunks = await getRelevantChunks(userQuestion, 5);

  const prompt = `
You are a helpful assistant. Use the following context to answer the question.

Context:
${chunks.join("\n\n")}

Question:
${userQuestion}
`;

  return await callLLM(prompt);
}
