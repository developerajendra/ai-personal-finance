import "server-only";
import { whatsappConfig } from "@/config/server";

export class WhatsAppSendError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "WhatsAppSendError";
  }
}

/** WhatsApp text bodies are limited to 4096 characters. */
const MAX_TEXT_LENGTH = 4096;

/**
 * Send a free-form text reply through the WhatsApp Cloud API. Free-form
 * messages are only deliverable inside the customer-service window opened by
 * the user's inbound message; replies here always answer an inbound message.
 */
export async function sendTextMessage(to: string, body: string): Promise<{ waMessageId: string | null }> {
  const config = whatsappConfig();
  if (!config.accessToken || !config.phoneNumberId) {
    throw new WhatsAppSendError("WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID are not configured", true);
  }
  const text = body.length > MAX_TEXT_LENGTH ? `${body.slice(0, MAX_TEXT_LENGTH - 1)}…` : body;
  const res = await fetch(
    `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // 4xx other than 429 won't succeed on retry (bad number, expired window, auth).
    const retryable = res.status === 429 || res.status >= 500;
    throw new WhatsAppSendError(`WhatsApp send failed (${res.status}): ${detail.slice(0, 300)}`, retryable);
  }
  const data = (await res.json().catch(() => ({}))) as { messages?: Array<{ id?: string }> };
  return { waMessageId: data.messages?.[0]?.id ?? null };
}
