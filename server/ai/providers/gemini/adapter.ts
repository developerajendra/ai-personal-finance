import "server-only";
import { randomUUID } from "crypto";
import {
  GoogleGenerativeAI,
  type Content,
  type FunctionDeclaration,
  type FunctionDeclarationSchema,
  type Part,
} from "@google/generative-ai";
import type {
  GenerateRequest,
  GenerateResponse,
  LLMProvider,
  ProviderMessage,
  ToolCall,
} from "@/server/ai/contracts";

function toGeminiContents(messages: ProviderMessage[]): Content[] {
  const out: Content[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", parts: [{ text: m.content }] });
    } else if (m.role === "assistant") {
      const parts: Part[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const call of m.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: (call.input ?? {}) as object } });
      }
      out.push({ role: "model", parts: parts.length > 0 ? parts : [{ text: "" }] });
    } else {
      out.push({
        role: "function",
        parts: m.results.map((r) => ({
          functionResponse: { name: r.name, response: { content: r.content, isError: r.isError ?? false } },
        })),
      });
    }
  }
  return out;
}

export function createGeminiProvider(config: { apiKey: string; model: string }): LLMProvider {
  const genAI = new GoogleGenerativeAI(config.apiKey);

  return {
    id: "gemini",
    model: config.model,
    supportsTools: true,

    async generate(request: GenerateRequest): Promise<GenerateResponse> {
      const functionDeclarations: FunctionDeclaration[] | undefined = request.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        // Our ToolParameterSchema is the JSON-Schema subset Gemini accepts.
        parameters: t.parameters as unknown as FunctionDeclarationSchema,
      }));
      const model = genAI.getGenerativeModel({
        model: config.model,
        systemInstruction: request.system,
        ...(functionDeclarations?.length ? { tools: [{ functionDeclarations }] } : {}),
        ...(request.maxTokens ? { generationConfig: { maxOutputTokens: request.maxTokens } } : {}),
      });
      const result = await model.generateContent({ contents: toGeminiContents(request.messages) });
      const parts = result.response.candidates?.[0]?.content?.parts ?? [];

      const text: string[] = [];
      const toolCalls: ToolCall[] = [];
      for (const part of parts) {
        if (part.text) text.push(part.text);
        if (part.functionCall) {
          // Gemini has no call ids; generate one to pair results with calls.
          toolCalls.push({ id: `gemini-${randomUUID()}`, name: part.functionCall.name, input: part.functionCall.args });
        }
      }
      return { text: text.join(""), toolCalls };
    },
  };
}
