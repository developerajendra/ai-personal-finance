import { NextRequest, NextResponse } from "next/server";
import { jobsSecret } from "@/config/server";
import { runDueWhatsAppJobs } from "@/server/jobs/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retry sweeper for the WhatsApp pipeline. Call on a schedule (Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET`) or from any external scheduler.
 */
async function handle(request: NextRequest) {
  const secret = jobsSecret();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDueWhatsAppJobs(25);
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
