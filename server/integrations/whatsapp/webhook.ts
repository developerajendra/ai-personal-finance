import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Validate Meta's `X-Hub-Signature-256` header: "sha256=" + hex HMAC-SHA256
 * of the exact raw request body, keyed with the App Secret.
 */
export function isValidSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!appSecret || !header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(header.slice("sha256=".length), "hex");
  } catch {
    return false;
  }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export interface ParsedInboundMessage {
  waMessageId: string;
  from: string;
  type: string;
  body: string | null;
  timestamp: string | null;
}

/**
 * Extract user messages from a WhatsApp Business webhook payload
 * (`entry[].changes[].value.messages[]`). Status callbacks are ignored.
 */
export function parseInboundMessages(payload: unknown): ParsedInboundMessage[] {
  const out: ParsedInboundMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { field?: string; value?: { messages?: unknown[] } })?.value;
      if (!Array.isArray(value?.messages)) continue;
      for (const m of value.messages as Array<Record<string, any>>) {
        if (typeof m?.id !== "string" || typeof m?.from !== "string") continue;
        out.push({
          waMessageId: m.id,
          from: normalizePhone(m.from),
          type: typeof m.type === "string" ? m.type : "unknown",
          body: m.type === "text" && typeof m.text?.body === "string" ? m.text.body : null,
          timestamp: typeof m.timestamp === "string" ? m.timestamp : null,
        });
      }
    }
  }
  return out;
}

/** WhatsApp ids are E.164 digits without "+"; normalise user input the same way. */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}
