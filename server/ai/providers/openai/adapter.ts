import "server-only";
import type {
  GenerateRequest,
  GenerateResponse,
  LLMProvider,
  ProviderMessage,
  ToolCall,
} from "@/server/ai/contracts";

/**
 * OpenAI Chat Completions adapter over plain fetch (no SDK, so no Node
 * engine constraint on the deployment).
 */

type OpenAIMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

function toOpenAIMessages(system: string, messages: ProviderMessage[]): OpenAIMessage[] {
  const out: OpenAIMessage[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "user") out.push({ role: "user", content: m.content });
    else if (m.role === "assistant") {
      out.push({
        role: "assistant",
        content: m.content || null,
        ...(m.toolCalls?.length
          ? {
              tool_calls: m.toolCalls.map((c) => ({
                id: c.id,
                type: "function" as const,
                function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) },
              })),
            }
          : {}),
      });
    } else {
      for (const r of m.results) out.push({ role: "tool", tool_call_id: r.toolCallId, content: r.content });
    }
  }
  return out;
}

export function createOpenAIProvider(config: { apiKey: string; model: string; baseUrl: string }): LLMProvider {
  return {
    id: "openai",
    model: config.model,
    supportsTools: true,

    async generate(request: GenerateRequest): Promise<GenerateResponse> {
      const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: toOpenAIMessages(request.system, request.messages),
          ...(request.maxTokens ? { max_completion_tokens: request.maxTokens } : {}),
          ...(request.tools?.length
            ? {
                tools: request.tools.map((t) => ({
                  type: "function",
                  function: { name: t.name, description: t.description, parameters: t.parameters },
                })),
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`OpenAI request failed (${res.status}): ${body.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>;
          };
        }>;
      };
      const message = data.choices?.[0]?.message;
      const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((c) => {
        let input: unknown = {};
        try {
          input = c.function?.arguments ? JSON.parse(c.function.arguments) : {};
        } catch {
          // Leave malformed arguments for the orchestrator's validator to reject.
          input = { __unparseable: c.function?.arguments };
        }
        return { id: c.id, name: c.function?.name ?? "", input };
      });
      return { text: message?.content ?? "", toolCalls };
    },
  };
}
