import "server-only";
import { and, asc, eq, inArray, isNotNull, lte, or, lt, isNull, sql } from "drizzle-orm";
import { db, type Executor } from "@/server/db/client";
import {
  rateLimits,
  whatsappInboundMessages,
  whatsappLinks,
  whatsappOutboundMessages,
} from "@/server/db/schema";

export type WhatsappLink = typeof whatsappLinks.$inferSelect;
export type InboundMessage = typeof whatsappInboundMessages.$inferSelect;
export type OutboundMessage = typeof whatsappOutboundMessages.$inferSelect;

// ─── Links ──────────────────────────────────────────────────────────

export async function findLinkByUser(userId: string, exec: Executor = db): Promise<WhatsappLink | null> {
  const [row] = await exec.select().from(whatsappLinks).where(eq(whatsappLinks.userId, userId)).limit(1);
  return row ?? null;
}

export async function findLinkByPhone(phone: string, exec: Executor = db): Promise<WhatsappLink | null> {
  const [row] = await exec.select().from(whatsappLinks).where(eq(whatsappLinks.phoneNumber, phone)).limit(1);
  return row ?? null;
}

export async function deleteLink(id: string, exec: Executor = db): Promise<void> {
  await exec.delete(whatsappLinks).where(eq(whatsappLinks.id, id));
}

export async function insertLink(values: typeof whatsappLinks.$inferInsert, exec: Executor = db): Promise<WhatsappLink> {
  const [row] = await exec.insert(whatsappLinks).values(values).returning();
  return row;
}

export async function updateLink(id: string, values: Partial<typeof whatsappLinks.$inferInsert>): Promise<void> {
  await db
    .update(whatsappLinks)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(whatsappLinks.id, id));
}

// ─── Inbound ────────────────────────────────────────────────────────

/**
 * Persist inbound messages. The unique index on wa_message_id makes
 * concurrent retries of one delivery collapse to a single row; returns only
 * the rows this call actually inserted.
 */
export async function insertInbound(
  rows: Array<typeof whatsappInboundMessages.$inferInsert>
): Promise<InboundMessage[]> {
  if (rows.length === 0) return [];
  return db.insert(whatsappInboundMessages).values(rows).onConflictDoNothing().returning();
}

export async function setInboundStatus(
  id: string,
  values: Partial<typeof whatsappInboundMessages.$inferInsert>,
  exec: Executor = db
): Promise<void> {
  await exec.update(whatsappInboundMessages).set(values).where(eq(whatsappInboundMessages.id, id));
}

/**
 * Atomically claim an inbound message for processing. Only one worker can win:
 * the UPDATE's WHERE clause re-checks the claimable state.
 */
export async function claimInbound(id: string, now: Date, lockMs: number): Promise<InboundMessage | null> {
  const nowIso = now.toISOString();
  const [row] = await db
    .update(whatsappInboundMessages)
    .set({
      status: "processing",
      lockedUntil: new Date(now.getTime() + lockMs).toISOString(),
      attempts: sql`${whatsappInboundMessages.attempts} + 1`,
    })
    .where(
      and(
        eq(whatsappInboundMessages.id, id),
        or(
          eq(whatsappInboundMessages.status, "received"),
          and(
            eq(whatsappInboundMessages.status, "failed"),
            isNotNull(whatsappInboundMessages.nextAttemptAt),
            lte(whatsappInboundMessages.nextAttemptAt, nowIso)
          ),
          and(eq(whatsappInboundMessages.status, "processing"), lt(whatsappInboundMessages.lockedUntil, nowIso))
        )
      )
    )
    .returning();
  return row ?? null;
}

export async function dueInboundIds(now: Date, limit: number): Promise<string[]> {
  const nowIso = now.toISOString();
  const rows = await db
    .select({ id: whatsappInboundMessages.id })
    .from(whatsappInboundMessages)
    .where(
      or(
        eq(whatsappInboundMessages.status, "received"),
        and(
          eq(whatsappInboundMessages.status, "failed"),
          isNotNull(whatsappInboundMessages.nextAttemptAt),
          lte(whatsappInboundMessages.nextAttemptAt, nowIso)
        ),
        and(eq(whatsappInboundMessages.status, "processing"), lt(whatsappInboundMessages.lockedUntil, nowIso))
      )
    )
    .orderBy(asc(whatsappInboundMessages.receivedAt))
    .limit(limit);
  return rows.map((r) => r.id);
}

// ─── Outbound ───────────────────────────────────────────────────────

/** Queue at most one reply per inbound message. */
export async function insertOutbound(
  values: typeof whatsappOutboundMessages.$inferInsert,
  exec: Executor = db
): Promise<OutboundMessage | null> {
  const [row] = await exec.insert(whatsappOutboundMessages).values(values).onConflictDoNothing().returning();
  return row ?? null;
}

export async function findOutboundByInbound(inboundIds: string[]): Promise<OutboundMessage[]> {
  if (inboundIds.length === 0) return [];
  return db.select().from(whatsappOutboundMessages).where(inArray(whatsappOutboundMessages.inboundId, inboundIds));
}

export async function claimOutbound(id: string, now: Date, lockMs: number): Promise<OutboundMessage | null> {
  const nowIso = now.toISOString();
  const [row] = await db
    .update(whatsappOutboundMessages)
    .set({
      status: "sending",
      lockedUntil: new Date(now.getTime() + lockMs).toISOString(),
      attempts: sql`${whatsappOutboundMessages.attempts} + 1`,
    })
    .where(
      and(
        eq(whatsappOutboundMessages.id, id),
        or(
          and(
            or(eq(whatsappOutboundMessages.status, "pending"), eq(whatsappOutboundMessages.status, "failed")),
            isNotNull(whatsappOutboundMessages.nextAttemptAt),
            lte(whatsappOutboundMessages.nextAttemptAt, nowIso)
          ),
          and(eq(whatsappOutboundMessages.status, "pending"), isNull(whatsappOutboundMessages.nextAttemptAt)),
          and(eq(whatsappOutboundMessages.status, "sending"), lt(whatsappOutboundMessages.lockedUntil, nowIso))
        )
      )
    )
    .returning();
  return row ?? null;
}

export async function setOutboundStatus(
  id: string,
  values: Partial<typeof whatsappOutboundMessages.$inferInsert>
): Promise<void> {
  await db.update(whatsappOutboundMessages).set(values).where(eq(whatsappOutboundMessages.id, id));
}

export async function dueOutboundIds(now: Date, limit: number): Promise<string[]> {
  const nowIso = now.toISOString();
  const rows = await db
    .select({ id: whatsappOutboundMessages.id })
    .from(whatsappOutboundMessages)
    .where(
      or(
        and(eq(whatsappOutboundMessages.status, "pending"), isNull(whatsappOutboundMessages.nextAttemptAt)),
        and(
          or(eq(whatsappOutboundMessages.status, "pending"), eq(whatsappOutboundMessages.status, "failed")),
          isNotNull(whatsappOutboundMessages.nextAttemptAt),
          lte(whatsappOutboundMessages.nextAttemptAt, nowIso)
        ),
        and(eq(whatsappOutboundMessages.status, "sending"), lt(whatsappOutboundMessages.lockedUntil, nowIso))
      )
    )
    .orderBy(asc(whatsappOutboundMessages.createdAt))
    .limit(limit);
  return rows.map((r) => r.id);
}

// ─── Rate limiting ──────────────────────────────────────────────────

/**
 * Fixed-window counter shared by every serverless instance. Increments
 * atomically and returns the count for the current window.
 */
export async function hitRateLimit(key: string, windowSeconds: number, now = new Date()): Promise<number> {
  const windowStart = Math.floor(now.getTime() / 1000 / windowSeconds) * windowSeconds;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  return row.count;
}
