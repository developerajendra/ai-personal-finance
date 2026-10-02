import { randomUUID } from "crypto";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import type { GenerateRequest, GenerateResponse, LLMProvider } from "@/server/ai/contracts";

export async function createUser(name = "user"): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({ id, name, email: `${name}-${id}@example.test` });
  return id;
}

/**
 * Scripted provider for orchestrator tests. Each `generate` call returns the
 * next scripted response (or derives it from the request). No network.
 */
export function scriptedProvider(
  script: Array<GenerateResponse | ((req: GenerateRequest) => GenerateResponse)>,
  opts: { supportsTools?: boolean } = {}
): LLMProvider & { calls: GenerateRequest[] } {
  const calls: GenerateRequest[] = [];
  let i = 0;
  return {
    id: "anthropic",
    model: "mock-model",
    supportsTools: opts.supportsTools ?? true,
    calls,
    async generate(req) {
      calls.push(req);
      const step = script[Math.min(i++, script.length - 1)];
      return typeof step === "function" ? step(req) : step;
    },
  };
}
