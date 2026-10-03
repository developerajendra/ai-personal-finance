import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { aiConfig, whatsappConfig } from "@/config/server";
import { getProvider } from "@/server/ai/providers";

export const dynamic = "force-dynamic";

interface Check {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * GET: WhatsApp + AI setup checklist for the Settings card. Reports only whether
 * each setting is present (never its value), plus a live check of the access
 * token against the Graph API so a wrong/expired token is caught.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wa = whatsappConfig();
  const ai = aiConfig();
  const origin = request.nextUrl.origin;
  const checks: Check[] = [
    { key: "verify", label: "Webhook verify token", ok: !!wa.verifyToken, detail: wa.verifyToken ? "WHATSAPP_VERIFY_TOKEN is set" : "Set WHATSAPP_VERIFY_TOKEN (any random string) and use the same value in Meta's webhook settings" },
    { key: "secret", label: "App secret", ok: !!wa.appSecret, detail: wa.appSecret ? "WHATSAPP_APP_SECRET is set" : "Set WHATSAPP_APP_SECRET — without it every incoming message is rejected (503)" },
    { key: "token", label: "Access token", ok: !!wa.accessToken, detail: wa.accessToken ? "WHATSAPP_ACCESS_TOKEN is set" : "Set WHATSAPP_ACCESS_TOKEN (permanent system-user token) — needed to send replies" },
    { key: "phone", label: "Phone number ID", ok: !!wa.phoneNumberId, detail: wa.phoneNumberId ? "WHATSAPP_PHONE_NUMBER_ID is set" : "Set WHATSAPP_PHONE_NUMBER_ID (WhatsApp → API Setup in the Meta app)" },
  ];

  let aiOk = true;
  let aiDetail = `${ai.chatProvider} is configured for chat replies`;
  try {
    getProvider("chat");
  } catch (error) {
    aiOk = false;
    aiDetail = error instanceof Error ? error.message : "AI provider is not configured";
  }
  checks.push({ key: "ai", label: "AI provider for replies", ok: aiOk, detail: aiDetail });

  // Live token check (read-only Graph call)
  if (wa.accessToken && wa.phoneNumberId) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${wa.graphApiVersion}/${encodeURIComponent(wa.phoneNumberId)}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${wa.accessToken}` }, signal: AbortSignal.timeout(6000), cache: "no-store" }
      );
      const body = await res.json().catch(() => ({}));
      checks.push(
        res.ok
          ? { key: "graph", label: "Meta Graph API", ok: true, detail: `Token works for ${body.display_phone_number ?? "the number"}${body.verified_name ? ` (${body.verified_name})` : ""}` }
          : { key: "graph", label: "Meta Graph API", ok: false, detail: body?.error?.message ?? `Graph API returned ${res.status}` }
      );
    } catch (error) {
      checks.push({ key: "graph", label: "Meta Graph API", ok: false, detail: `Could not reach graph.facebook.com: ${error instanceof Error ? error.message : "network error"}` });
    }
  }

  return NextResponse.json({
    ready: checks.every((c) => c.ok),
    webhookUrl: `${origin}/api/webhooks/whatsapp`,
    checks,
  });
}
