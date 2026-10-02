import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { whatsappConfig } from "@/config/server";
import { isValidSignature, parseInboundMessages } from "@/server/integrations/whatsapp/webhook";
import { acceptInbound, processAndReply, runDueWhatsAppJobs } from "@/server/jobs/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Meta verification handshake (configured once in the App Dashboard). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { verifyToken } = whatsappConfig();
  if (
    verifyToken &&
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === verifyToken &&
    params.get("hub.challenge")
  ) {
    return new NextResponse(params.get("hub.challenge"), { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * Inbound events. Order matters:
 *  1. verify the signature over the raw body (reject anything unsigned);
 *  2. durably store accepted messages (duplicates collapse on wa_message_id);
 *  3. acknowledge with 200;
 *  4. process after the response via waitUntil. If that work is cut short,
 *     the rows stay "received"/"failed" and the job sweeper picks them up.
 */
export async function POST(request: NextRequest) {
  const { appSecret } = whatsappConfig();
  if (!appSecret) {
    console.error("[WhatsApp] WHATSAPP_APP_SECRET is not set; refusing unsigned webhooks");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!isValidSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = parseInboundMessages(payload);
  let newIds: string[] = [];
  try {
    newIds = await acceptInbound(messages);
  } catch (error) {
    // Not stored → not acknowledged; Meta will retry the delivery.
    console.error("[WhatsApp] Failed to store inbound messages:", error);
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }

  waitUntil(
    (async () => {
      try {
        if (newIds.length > 0) await processAndReply(newIds);
        await runDueWhatsAppJobs(5);
      } catch (error) {
        console.error("[WhatsApp] Background processing error:", error);
      }
    })()
  );

  return NextResponse.json({ received: messages.length, accepted: newIds.length });
}
