import "server-only";
import { aiConfig, type AIProviderId } from "@/config/server";
import {
  ProviderConfigurationError,
  type LLMProvider,
} from "@/server/ai/contracts";
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
