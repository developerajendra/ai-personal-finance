import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { conversationMessages, conversations, pendingClarifications } from "@/server/db/schema";

export type Channel = "web" | "whatsapp";

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Clarification {
  id: string;
  action: string;
  collectedFields: Record<string, unknown>;
  missingFields: string[];
  attempts: number;
}

/** WhatsApp threads idle longer than this start a fresh conversation. */
const WHATSAPP_SESSION_IDLE_MS = 6 * 60 * 60 * 1000;
export const CLARIFICATION_TTL_MS = 30 * 60 * 1000;
export const CLARIFICATION_MAX_ATTEMPTS = 3;

/**
 * Resolve the conversation to use. A supplied id is honoured only when it
 * belongs to the same user and channel; otherwise a new one is started.
 */
export async function getOrCreateConversation(
  userId: string,
  channel: Channel,
  conversationId?: string | null,
  now = new Date()
): Promise<string> {
  if (conversationId) {
    const [row] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId), eq(conversations.channel, channel)))
      .limit(1);
    if (row) return row.id;
  }
  if (channel === "whatsapp") {
    const [latest] = await db
      .select({ id: conversations.id, updatedAt: conversations.updatedAt })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.channel, "whatsapp")))
      .orderBy(desc(conversations.updatedAt))
      .limit(1);
    if (latest && now.getTime() - new Date(latest.updatedAt).getTime() < WHATSAPP_SESSION_IDLE_MS) {
      return latest.id;
    }
  }
  const iso = now.toISOString();
  const [created] = await db
    .insert(conversations)
    .values({ userId, channel, createdAt: iso, updatedAt: iso })
    .returning({ id: conversations.id });
  return created.id;
}

export async function recentMessages(conversationId: string, userId: string, limit = 20): Promise<StoredMessage[]> {
  const rows = await db
    .select({ role: conversationMessages.role, content: conversationMessages.content })
    .from(conversationMessages)
    .where(and(eq(conversationMessages.conversationId, conversationId), eq(conversationMessages.userId, userId)))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(limit);
  return rows.reverse().map((r) => ({ role: r.role as StoredMessage["role"], content: r.content }));
}

export async function appendExchange(
  conversationId: string,
  userId: string,
  userText: string,
  assistantText: string,
  metadata: Record<string, unknown>,
  now = new Date()
): Promise<void> {
  // Two distinct timestamps keep user→assistant ordering stable.
  const userAt = now.toISOString();
  const assistantAt = new Date(now.getTime() + 1).toISOString();
  await db.batch([
    db.insert(conversationMessages).values({ conversationId, userId, role: "user", content: userText, createdAt: userAt }),
    db.insert(conversationMessages).values({
      conversationId,
      userId,
      role: "assistant",
      content: assistantText,
      metadata,
      createdAt: assistantAt,
    }),
    db.update(conversations).set({ updatedAt: assistantAt }).where(eq(conversations.id, conversationId)),
  ]);
}

export async function getOpenClarification(
  conversationId: string,
  userId: string,
  now = new Date()
): Promise<Clarification | null> {
  const [row] = await db
    .select()
    .from(pendingClarifications)
    .where(
      and(
        eq(pendingClarifications.conversationId, conversationId),
        eq(pendingClarifications.userId, userId),
        eq(pendingClarifications.status, "open")
      )
    )
    .orderBy(desc(pendingClarifications.createdAt))
    .limit(1);
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() <= now.getTime() || row.attempts >= CLARIFICATION_MAX_ATTEMPTS) {
    await closeClarification(row.id, "expired");
    return null;
  }
  return {
    id: row.id,
    action: row.action,
    collectedFields: row.collectedFields,
    missingFields: row.missingFields,
    attempts: row.attempts,
  };
}

/** Replace any open clarification in this conversation with a new one. */
export async function openClarification(
  conversationId: string,
  userId: string,
  action: string,
  collectedFields: Record<string, unknown>,
  missingFields: string[],
  now = new Date()
): Promise<void> {
  const iso = now.toISOString();
  await db.batch([
    db
      .update(pendingClarifications)
      .set({ status: "resolved", updatedAt: iso })
      .where(
        and(
          eq(pendingClarifications.conversationId, conversationId),
          eq(pendingClarifications.userId, userId),
          eq(pendingClarifications.status, "open")
        )
      ),
    db.insert(pendingClarifications).values({
      conversationId,
      userId,
      action,
      collectedFields,
      missingFields,
      status: "open",
      expiresAt: new Date(now.getTime() + CLARIFICATION_TTL_MS).toISOString(),
      createdAt: iso,
      updatedAt: iso,
    }),
  ]);
}

export async function closeClarification(id: string, status: "resolved" | "cancelled" | "expired"): Promise<void> {
  await db
    .update(pendingClarifications)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(pendingClarifications.id, id));
}

export async function bumpClarificationAttempt(id: string, attempts: number): Promise<void> {
  await db
    .update(pendingClarifications)
    .set({ attempts: attempts + 1, updatedAt: new Date().toISOString() })
    .where(eq(pendingClarifications.id, id));
}
