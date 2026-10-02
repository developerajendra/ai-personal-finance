import "server-only";
import { db } from "@/server/db/client";
import * as waRepo from "@/server/db/repositories/whatsappRepository";
import { whatsappConfig } from "@/config/server";
import { handleMessage, type OrchestratorDeps } from "@/server/ai/orchestrator";
import { resolveVerifiedUser, tryVerifyLink } from "@/server/integrations/whatsapp/linking";
import { sendTextMessage, WhatsAppSendError } from "@/server/integrations/whatsapp/client";
import type { ParsedInboundMessage } from "@/server/integrations/whatsapp/webhook";

/**
 * Durable WhatsApp pipeline backed by database state (no in-memory queue):
 *
 *   webhook ──insert(received)──▶ inbound ──claim──▶ orchestrator ──┐
 *                                                                   ▼
 *          outbound(pending) ◀── one transaction: mark processed + queue reply
 *                 │
 *                 └──claim──▶ Graph API send ──▶ sent | failed(backoff)
 *
 * Each stage is claimed with a conditional UPDATE, so concurrent workers and
 * Meta retries never double-process. Financial writes are keyed on the
 * WhatsApp message id; re-running a step after a crash cannot duplicate them,
 * and resending a reply never re-runs the write.
 */

const PROCESS_LOCK_MS = 2 * 60 * 1000;
const SEND_LOCK_MS = 60 * 1000;
const NOT_LINKED_REPLY =
  "Hi! This number isn't linked to a Personal Finance account yet. Sign in to the app, open Settings → WhatsApp, and send the LINK code shown there.";
const UNSUPPORTED_REPLY = "I can only read text messages for now. Please type your request.";
const FAILED_REPLY = "Sorry, I couldn't process that message. Nothing was saved — please try again in a moment.";
const RATE_LIMIT_REPLY = "You're sending messages too quickly. Please wait a few minutes and try again.";

export function backoffMs(attempt: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 30 * 60 * 1000);
}

/**
 * Store accepted messages before the webhook is acknowledged and apply the
 * per-sender rate limit. Returns ids of newly stored messages that need
 * processing (duplicates of earlier deliveries are dropped by the DB).
 */
export async function acceptInbound(messages: ParsedInboundMessage[], now = new Date()): Promise<string[]> {
  const inserted = await waRepo.insertInbound(
    messages.map((m) => ({
      waMessageId: m.waMessageId,
      fromPhone: m.from,
      messageType: m.type,
      body: m.body,
      waTimestamp: m.timestamp,
      status: "received",
      receivedAt: now.toISOString(),
    }))
  );

  const config = whatsappConfig();
  const toProcess: string[] = [];
  for (const row of inserted) {
    const count = await waRepo.hitRateLimit(`wa:${row.fromPhone}`, config.rateLimitWindowSeconds, now);
    if (count > config.rateLimitMax) {
      await waRepo.setInboundStatus(row.id, { status: "rate_limited", processedAt: now.toISOString() });
      // Tell the sender once per window, not on every excess message.
      if (count === config.rateLimitMax + 1) {
        await waRepo.insertOutbound({ inboundId: row.id, toPhone: row.fromPhone, body: RATE_LIMIT_REPLY });
      }
      continue;
    }
    toProcess.push(row.id);
  }
  return toProcess;
}

async function completeInbound(
  inboundId: string,
  toPhone: string,
  reply: string,
  values: { status: "processed" | "ignored" | "failed"; userId?: string | null; result?: Record<string, unknown>; lastError?: string },
  now: Date
): Promise<void> {
  // Status change and reply enqueue commit together.
  await db.transaction(async (tx) => {
    await waRepo.setInboundStatus(
      inboundId,
      {
        status: values.status,
        userId: values.userId ?? undefined,
        result: values.result,
        lastError: values.lastError,
        lockedUntil: null,
        nextAttemptAt: null,
        processedAt: now.toISOString(),
      },
      tx
    );
    await waRepo.insertOutbound({ inboundId, toPhone, body: reply }, tx);
  });
}

/** Process one inbound message if it can be claimed. Safe to call concurrently. */
export async function processInbound(
  inboundId: string,
  deps: OrchestratorDeps & { now?: () => Date } = {}
): Promise<"processed" | "skipped" | "retry" | "failed"> {
  const now = deps.now?.() ?? new Date();
  const row = await waRepo.claimInbound(inboundId, now, PROCESS_LOCK_MS);
  if (!row) return "skipped";

  try {
    let userId = await resolveVerifiedUser(row.fromPhone);

    if (!userId) {
      const link = await tryVerifyLink(row.fromPhone, row.body, now);
      const reply = link.handled ? link.reply : NOT_LINKED_REPLY;
      await completeInbound(row.id, row.fromPhone, reply, {
        status: link.handled && link.ok ? "processed" : "ignored",
        userId: link.handled && link.ok ? link.userId : null,
        result: { kind: link.handled ? "link" : "unlinked" },
      }, now);
      return "processed";
    }

    if (row.messageType !== "text" || !row.body?.trim()) {
      await completeInbound(row.id, row.fromPhone, UNSUPPORTED_REPLY, { status: "ignored", userId }, now);
      return "processed";
    }

    const result = await handleMessage(
      { userId, channel: "whatsapp", message: row.body, sourceRef: row.waMessageId },
      deps
    );
    await completeInbound(row.id, row.fromPhone, result.reply, {
      status: "processed",
      userId,
      result: { conversationId: result.conversationId, actions: result.actions, provider: result.provider },
    }, now);
    return "processed";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[WhatsApp] Processing ${row.waMessageId} failed (attempt ${row.attempts}):`, message);
    const maxAttempts = whatsappConfig().maxProcessingAttempts;
    if (row.attempts >= maxAttempts) {
      await completeInbound(row.id, row.fromPhone, FAILED_REPLY, { status: "failed", lastError: message }, now);
      return "failed";
    }
    await waRepo.setInboundStatus(row.id, {
      status: "failed",
      lastError: message,
      lockedUntil: null,
      nextAttemptAt: new Date(now.getTime() + backoffMs(row.attempts)).toISOString(),
    });
    return "retry";
  }
}

/** Send one queued reply if it can be claimed. */
export async function sendOutbound(outboundId: string, now = new Date()): Promise<"sent" | "skipped" | "retry" | "failed"> {
  const row = await waRepo.claimOutbound(outboundId, now, SEND_LOCK_MS);
  if (!row) return "skipped";
  try {
    const { waMessageId } = await sendTextMessage(row.toPhone, row.body);
    await waRepo.setOutboundStatus(row.id, {
      status: "sent",
      waMessageId,
      sentAt: new Date().toISOString(),
      lockedUntil: null,
      nextAttemptAt: null,
      lastError: null,
    });
    return "sent";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retryable = !(error instanceof WhatsAppSendError) || error.retryable;
    const giveUp = !retryable || row.attempts >= whatsappConfig().maxProcessingAttempts;
    await waRepo.setOutboundStatus(row.id, {
      status: "failed",
      lastError: message,
      lockedUntil: null,
      nextAttemptAt: giveUp ? null : new Date(now.getTime() + backoffMs(row.attempts)).toISOString(),
    });
    console.error(`[WhatsApp] Send ${row.id} failed (attempt ${row.attempts}${giveUp ? ", giving up" : ""}):`, message);
    return giveUp ? "failed" : "retry";
  }
}

/** Process the given inbound messages, then deliver their replies. */
export async function processAndReply(inboundIds: string[]): Promise<void> {
  for (const id of inboundIds) await processInbound(id);
  const outbound = await waRepo.findOutboundByInbound(inboundIds);
  for (const o of outbound) await sendOutbound(o.id);
}

/**
 * Sweep anything due: new messages whose post-ack processing never ran,
 * retries whose backoff elapsed, and stale locks from crashed workers.
 * Invoked by the job endpoint (cron) and opportunistically by the webhook.
 */
export async function runDueWhatsAppJobs(limit = 10): Promise<{ inbound: number; outbound: number }> {
  const now = new Date();
  const inboundIds = await waRepo.dueInboundIds(now, limit);
  for (const id of inboundIds) await processInbound(id);
  const outboundIds = await waRepo.dueOutboundIds(new Date(), limit);
  for (const id of outboundIds) await sendOutbound(id);
  return { inbound: inboundIds.length, outbound: outboundIds.length };
}
