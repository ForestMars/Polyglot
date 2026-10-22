export interface OvenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OvenRouterChatRequest {
  messages: OvenRouterMessage[];
}

export interface OvenRouterChatResult {
  content: string;
  model: string;
  created_at: number; // epoch seconds, matching the other provider services
}

const ROLE_LABEL = {
  system: "System",
  user: "User",
  assistant: "Assistant",
} as const;

// The gateway takes a single `prompt` string and routes on that exact text, so a
// lone user message passes through untouched and multi-turn history becomes a
// role-labelled transcript ending on an open Assistant turn.
export function flattenMessages(messages: OvenRouterMessage[]): string {
  if (messages.length === 1 && messages[0].role === "user") {
    return messages[0].content;
  }
  const transcript = messages
    .map((m) => `${ROLE_LABEL[m.role]}: ${m.content}`)
    .join("\n\n");
  return `${transcript}\n\nAssistant:`;
}

export class OvenRouterService {
  // Relative path, served by the dev-server proxy so the browser stays same-origin.
  static readonly DEFAULT_BASE_URL = "/ovenrouter";

  private baseUrl: string;

  constructor(baseUrl: string = OvenRouterService.DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async chat(request: OvenRouterChatRequest): Promise<OvenRouterChatResult> {
    const response = await fetch(`${this.baseUrl}/v1/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: flattenMessages(request.messages) }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "<no body>");
      throw new Error(
        `OvenRouter API error: ${response.status} ${response.statusText} — ${errorBody}`,
      );
    }

    const data = await response.json();

    // Tier 5 returns Ollama's generate payload (`response` holds the text). Tier 4
    // (Jev) returns a decision object, which is surfaced as JSON rather than dropped.
    const content =
      typeof data.response === "string" ? data.response : JSON.stringify(data);
    const created =
      typeof data.created_at === "string" ? Date.parse(data.created_at) : NaN;

    return {
      content,
      model: typeof data.model === "string" ? data.model : "cascade",
      created_at: Number.isNaN(created)
        ? Math.floor(Date.now() / 1000)
        : Math.floor(created / 1000),
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/healthz`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
