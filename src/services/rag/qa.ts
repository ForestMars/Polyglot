import { runRAGPipeline } from "../../services/rag/ragPipeline";

export async function POST(req: Request) {
  const { question } = await req.json();
  const { answer } = await runRAGPipeline(question);
  return new Response(JSON.stringify({ answer }), {
    headers: { "Content-Type": "application/json" },
  });
}
