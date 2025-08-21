// src/services/rag/ragPipeline.ts
import { queryRAG } from "./queryRag";
import { ApiService } from "@/services/api";  // Polywog's existing service
import { useSettings } from "@/hooks/useSettings";

// Run the full RAG pipeline for a user question
export async function runRAGPipeline(
  question: string,
  k = 5
) {
  // Step 1: Retrieve relevant chunks from Postgres
  const retrievedChunks = await queryRAG(question, k);

  // Step 2: Combine retrieved chunks into a single context string
  const context = retrievedChunks.join("\n\n");

  // Step 3: Build the augmented message
  const augmentedMessage = `
Retrieved context:
${context}

User question:
${question}
  `;

  // Step 4: Use Polywog's existing ApiService to send message to selected provider
  const { settings } = useSettings();
  const providerId = settings.selectedProvider;
  const model = settings.selectedModel;
  const apiKey = settings?.[settings.selectedApiKey] || '';

  const apiService = new ApiService();
  const response = await apiService.sendMessage({
    provider: providerId,
    model: model!,
    messages: [{ role: "user", content: augmentedMessage }],
    apiKey,
    baseUrl: providerId === "ollama" ? "http://localhost:11434" : undefined
  });

  // Step 5: Return response and chunks for debugging/provenance
  return { answer: response.content, retrievedChunks };
}
