import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  GenerateRequest,
  GenerateResponse,
  LLMProvider,
  ProviderMessage,
  ToolCall,
} from "@/server/ai/contracts";

type AnthropicMessage = Anthropic.MessageParam;

function toAnthropicMessages(messages: ProviderMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const call of m.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.input ?? {} });
      }
      out.push({ role: "assistant", content: blocks.length > 0 ? blocks : "" });
    } else {
      out.push({
        role: "user",
        content: m.results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.toolCallId,
          content: r.content,
          is_error: r.isError ?? false,
        })),
      });
    }
  }
  return out;
}

export function createAnthropicProvider(config: { apiKey: string; model: string; maxTokens: number }): LLMProvider {
  const client = new Anthropic({ apiKey: config.apiKey });

  return {
    id: "anthropic",
    model: config.model,
    supportsTools: true,

    async generate(request: GenerateRequest): Promise<GenerateResponse> {
      const response = await client.messages.create({
        model: config.model,
        max_tokens: request.maxTokens ?? config.maxTokens,
        system: request.system,
        messages: toAnthropicMessages(request.messages),
        ...(request.tools && request.tools.length > 0
          ? {
              tools: request.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: { ...t.parameters } as Anthropic.Tool.InputSchema,
              })),
            }
          : {}),
      });

      const text: string[] = [];
      const toolCalls: ToolCall[] = [];
      for (const block of response.content) {
        if (block.type === "text") text.push(block.text);
        else if (block.type === "tool_use") toolCalls.push({ id: block.id, name: block.name, input: block.input });
      }
      return { text: text.join(""), toolCalls };
    },
  };
}
