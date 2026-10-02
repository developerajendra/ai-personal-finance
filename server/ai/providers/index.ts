import "server-only";
import { aiConfig, type AIProviderId } from "@/config/server";
import {
  ProviderConfigurationError,
  type LLMProvider,
} from "@/server/ai/contracts";
import { extractJsonObject } from "@/server/ai/contracts/json";
import { createAnthropicProvider } from "./anthropic/adapter";
import { createGeminiProvider } from "./gemini/adapter";
import { createOllamaProvider } from "./ollama/adapter";
import { createOpenAIProvider } from "./openai/adapter";

export type AIUseCase = "chat" | "json" | "analysis";

/**
 * Resolve the provider configured for a use case. Selection is server-side
 * only. If the configured provider lacks credentials this throws — it never
 * silently routes financial data to a different provider.
 */
export function getProvider(useCase: AIUseCase): LLMProvider {
  const config = aiConfig();
  const id: AIProviderId =
    useCase === "chat" ? config.chatProvider : useCase === "json" ? config.jsonProvider : config.analysisProvider;
  return createProvider(id);
}

export function createProvider(id: AIProviderId): LLMProvider {
  const config = aiConfig();
  switch (id) {
    case "anthropic":
      if (!config.anthropic.apiKey) {
        throw new ProviderConfigurationError("Anthropic is selected but ANTHROPIC_API_KEY (or LLM_API_KEY) is not set");
      }
      return createAnthropicProvider(config.anthropic);
    case "openai":
      if (!config.openai.apiKey) {
        throw new ProviderConfigurationError("OpenAI is selected but OPENAI_API_KEY is not set");
      }
      return createOpenAIProvider(config.openai);
    case "gemini":
      if (!config.gemini.apiKey) {
        throw new ProviderConfigurationError("Gemini is selected but AI_CHAT_API_KEY is not set");
      }
      return createGeminiProvider(config.gemini);
    case "ollama":
      return createOllamaProvider(config.ollama);
  }
}

/** One-shot text generation with the provider configured for `useCase`. */
export async function generateText(useCase: AIUseCase, prompt: string, system = ""): Promise<string> {
  const provider = getProvider(useCase);
  const { text } = await provider.generate({ system, messages: [{ role: "user", content: prompt }] });
  return text;
}

/** One-shot JSON generation; the caller must still validate the shape. */
export async function generateJson(
  useCase: AIUseCase,
  prompt: string,
  system?: string
): Promise<Record<string, unknown>> {
  const instruction =
    "CRITICAL: Return ONLY a valid JSON object. No markdown, no explanations, no text outside the JSON.";
  const text = await generateText(useCase, `${prompt}\n\n${instruction}`, system ?? "");
  return extractJsonObject(text);
}
