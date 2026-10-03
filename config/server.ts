import "server-only";

/**
 * Server-only configuration. Never import this from client components:
 * it reads secrets from the environment. Client-safe values live in
 * `config/client.ts` (NEXT_PUBLIC_* only).
 *
 * Values are read lazily on every call so tests and long-lived processes
 * see the current environment.
 */

export type AIProviderId = "gemini" | "anthropic" | "openai" | "ollama";

const AI_PROVIDERS: readonly AIProviderId[] = ["gemini", "anthropic", "openai", "ollama"];

function parseProvider(value: string | undefined, name: string): AIProviderId | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "claude") return "anthropic";
  if ((AI_PROVIDERS as readonly string[]).includes(normalized)) return normalized as AIProviderId;
  throw new Error(`${name}="${value}" is not a supported AI provider (${AI_PROVIDERS.join(", ")})`);
}

export function aiConfig() {
  const env = process.env;
  const defaultProvider = parseProvider(env.AI_PROVIDER, "AI_PROVIDER") ?? "gemini";
  return {
    defaultProvider,
    /** Explicit per-use-case overrides. No implicit fallback to another provider. */
    chatProvider: parseProvider(env.AI_CHAT_PROVIDER, "AI_CHAT_PROVIDER") ?? defaultProvider,
    jsonProvider: parseProvider(env.AI_JSON_PROVIDER, "AI_JSON_PROVIDER") ?? defaultProvider,
    analysisProvider: parseProvider(env.AI_ANALYSIS_PROVIDER, "AI_ANALYSIS_PROVIDER") ?? defaultProvider,
    gemini: {
      apiKey: env.AI_CHAT_API_KEY || env.GEMINI_API_KEY || "",
      model: env.GEMINI_MODEL || "gemini-2.0-flash-exp",
    },
    anthropic: {
      // ANTHROPIC_API_KEY is preferred; LLM_API_KEY is accepted as a generic alias.
      apiKey: env.ANTHROPIC_API_KEY || env.LLM_API_KEY || "",
      model: env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      // API keys are already scoped to a workspace; the Messages API takes no
      // workspace parameter. Kept for logging/ops visibility only.
      workspaceId: env.ANTHROPIC_WORKSPACE_ID || undefined,
      maxTokens: Number(env.ANTHROPIC_MAX_TOKENS || 4096),
    },
    openai: {
      apiKey: env.OPENAI_API_KEY || "",
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      baseUrl: env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    },
    ollama: {
      host: env.OLLAMA_HOST || "http://127.0.0.1:11434",
      model: env.OLLAMA_MODEL || "llama3:latest",
    },
  };
}

export function whatsappConfig() {
  const env = process.env;
  return {
    verifyToken: env.WHATSAPP_VERIFY_TOKEN || "",
    appSecret: env.WHATSAPP_APP_SECRET || "",
    accessToken: env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || "",
    graphApiVersion: env.WHATSAPP_GRAPH_API_VERSION || "v23.0",
    /** Inbound messages per sender per window before rate limiting kicks in. */
    rateLimitMax: Number(env.WHATSAPP_RATE_LIMIT_MAX || 20),
    rateLimitWindowSeconds: Number(env.WHATSAPP_RATE_LIMIT_WINDOW_SECONDS || 600),
    maxProcessingAttempts: Number(env.WHATSAPP_MAX_ATTEMPTS || 5),
  };
}

/** Shared secret for the job-runner endpoint (Vercel Cron sends it as a Bearer token). */
export function jobsSecret(): string {
  return process.env.CRON_SECRET || "";
}

/**
 * Development-only login bypass. Requires DEV_AUTH_BYPASS=true AND a
 * non-production runtime; `next build`/`next start` force NODE_ENV=production,
 * so this can never activate in a deployed build.
 */
export function devAuthBypass(): { enabled: boolean; email: string } {
  return {
    enabled: process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "true",
    email: process.env.DEV_AUTH_EMAIL || "dev@localhost.test",
  };
}
