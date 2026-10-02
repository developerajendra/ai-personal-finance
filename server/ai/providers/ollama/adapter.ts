import "server-only";
import type { GenerateRequest, GenerateResponse, LLMProvider } from "@/server/ai/contracts";
import { generateChatContent } from "./client";

/**
 * Text-only adapter around the existing Ollama client (keeps its response
 * cache). Local llama3 models don't reliably support tool calling, so the
 * orchestrator falls back to the `<action>` JSON protocol for this provider.
 */
export function createOllamaProvider(config: { model: string }): LLMProvider {
  return {
    id: "ollama",
    model: config.model,
    supportsTools: false,

    async generate(request: GenerateRequest): Promise<GenerateResponse> {
      const history = request.messages.slice(0, -1);
      const last = request.messages[request.messages.length - 1];
      const transcript = history
        .map((m) => {
          if (m.role === "tool") return m.results.map((r) => `Result of ${r.name}: ${r.content}`).join("\n");
          return `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`;
        })
        .join("\n");
      const lastText =
        last?.role === "tool" ? last.results.map((r) => `Result of ${r.name}: ${r.content}`).join("\n") : last?.content ?? "";
      const system = transcript ? `${request.system}\n\nConversation so far:\n${transcript}` : request.system;
      return { text: await generateChatContent(lastText, system), toolCalls: [] };
    },
  };
}
