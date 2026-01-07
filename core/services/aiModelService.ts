/**
 * Centralized AI Model Configuration Service
 * Manages which AI model to use across the application
 */

export type AIModelProvider = 'gemini' | 'ollama';
export type AIModelType = 'chat' | 'json' | 'analysis';

interface AIModelConfig {
  provider: AIModelProvider;
  model: string;
  enabled: boolean;
}

// Default configuration
const DEFAULT_PROVIDER: AIModelProvider = (process.env.AI_PROVIDER as AIModelProvider) || 'gemini';
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3:latest';
const DEFAULT_OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

// Provider-specific configurations
const GEMINI_CONFIG: AIModelConfig = {
  provider: 'gemini',
  model: DEFAULT_GEMINI_MODEL,
  enabled: !!process.env.AI_CHAT_API_KEY,
};

const OLLAMA_CONFIG: AIModelConfig = {
  provider: 'ollama',
  model: DEFAULT_OLLAMA_MODEL,
  enabled: true, // Ollama doesn't require API key, just server running
};

/**
 * Get the active AI provider
 */
export function getActiveProvider(): AIModelProvider {
  return DEFAULT_PROVIDER;
}

/**
 * Get the model name for the active provider
 */
export function getActiveModel(): string {
  if (DEFAULT_PROVIDER === 'gemini') {
    return DEFAULT_GEMINI_MODEL;
  }
  return DEFAULT_OLLAMA_MODEL;
}

/**
 * Get configuration for a specific provider
 */
export function getProviderConfig(provider: AIModelProvider): AIModelConfig {
  return provider === 'gemini' ? GEMINI_CONFIG : OLLAMA_CONFIG;
}

/**
 * Check if a provider is enabled
 */
export function isProviderEnabled(provider: AIModelProvider): boolean {
  const config = getProviderConfig(provider);
  return config.enabled;
}

/**
 * Get all available providers and their status
 */
export function getAvailableProviders(): Record<AIModelProvider, { enabled: boolean; model: string }> {
  return {
    gemini: {
      enabled: GEMINI_CONFIG.enabled,
      model: DEFAULT_GEMINI_MODEL,
    },
    ollama: {
      enabled: OLLAMA_CONFIG.enabled,
      model: DEFAULT_OLLAMA_MODEL,
    },
  };
}

/**
 * Get Ollama host configuration
 */
export function getOllamaHost(): string {
  return DEFAULT_OLLAMA_HOST;
}

/**
 * Get Gemini API key
 */
export function getGeminiApiKey(): string {
  return process.env.AI_CHAT_API_KEY || '';
}

/**
 * Check if the active provider is available
 */
export function isActiveProviderAvailable(): boolean {
  return isProviderEnabled(DEFAULT_PROVIDER);
}

/**
 * Get model configuration for a specific use case
 * Allows override per use case if needed
 */
export function getModelForUseCase(useCase: AIModelType): {
  provider: AIModelProvider;
  model: string;
} {
  // Check for use-case specific overrides
  const chatProvider = (process.env.AI_CHAT_PROVIDER as AIModelProvider) || DEFAULT_PROVIDER;
  const jsonProvider = (process.env.AI_JSON_PROVIDER as AIModelProvider) || DEFAULT_PROVIDER;
  const analysisProvider = (process.env.AI_ANALYSIS_PROVIDER as AIModelProvider) || DEFAULT_PROVIDER;

  let provider = DEFAULT_PROVIDER;
  
  switch (useCase) {
    case 'chat':
      provider = chatProvider;
      break;
    case 'json':
      provider = jsonProvider;
      break;
    case 'analysis':
      provider = analysisProvider;
      break;
  }

  // Ensure provider is enabled
  if (!isProviderEnabled(provider)) {
    console.warn(`[AI Model] Provider ${provider} not enabled for ${useCase}, falling back to ${DEFAULT_PROVIDER}`);
    provider = DEFAULT_PROVIDER;
  }

  return {
    provider,
    model: provider === 'gemini' ? DEFAULT_GEMINI_MODEL : DEFAULT_OLLAMA_MODEL,
  };
}

