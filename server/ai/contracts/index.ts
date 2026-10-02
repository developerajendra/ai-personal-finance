import type { AIProviderId } from "@/config/server";

/**
 * Provider-neutral contracts. Adapters translate these to and from each
 * vendor's wire format; nothing outside `server/ai/providers` should depend
 * on a vendor SDK type.
 */

/** JSON-Schema subset understood by every supported provider (incl. Gemini). */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, ToolPropertySchema>;
  required?: string[];
}

export type ToolPropertySchema =
  | { type: "string"; description?: string; enum?: string[] }
  | { type: "number" | "integer" | "boolean"; description?: string };

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  /** Raw arguments from the model. Untrusted until validated by the orchestrator. */
  input: unknown;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  content: string;
  isError?: boolean;
}

export type ProviderMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; results: ToolResult[] };

export interface GenerateRequest {
  system: string;
  messages: ProviderMessage[];
  tools?: ToolDefinition[];
  maxTokens?: number;
}

export interface GenerateResponse {
  text: string;
  toolCalls: ToolCall[];
}

export interface LLMProvider {
  readonly id: AIProviderId;
  readonly model: string;
  /** False for adapters that can only return text (tool requests are ignored). */
  readonly supportsTools: boolean;
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}

export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigurationError";
  }
}
