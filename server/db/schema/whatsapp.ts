import { sqliteTable, text, integer, index, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";
import { users } from "./index";

/**
 * A WhatsApp number linked to an application user. A number becomes
 * `verified` only after the signed-in user requests a code in the app and the
 * same code arrives from that number through Meta's signed webhook.
 */
export const whatsappLinks = sqliteTable(
  "whatsapp_links",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull(), // E.164 digits without "+", as Meta sends `from`
    status: text("status").notNull().default("pending"), // "pending" | "verified" | "revoked"
    codeHash: text("code_hash"),
    codeExpiresAt: text("code_expires_at"),
    verifyAttempts: integer("verify_attempts").notNull().default(0),
    verifiedAt: text("verified_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    // One link row per user; a phone number may only be linked to one user.
    userUnique: uniqueIndex("whatsapp_links_user_uq").on(table.userId),
    phoneUnique: uniqueIndex("whatsapp_links_phone_uq").on(table.phoneNumber),
  })
);

/**
 * Every accepted inbound message, persisted before the webhook is acknowledged.
 * `waMessageId` is unique, so concurrent Meta retries of the same delivery
 * collapse into one row at the database level.
 */
export const whatsappInboundMessages = sqliteTable(
  "whatsapp_inbound_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    waMessageId: text("wa_message_id").notNull(),
    fromPhone: text("from_phone").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    messageType: text("message_type").notNull(),
    body: text("body"),
    waTimestamp: text("wa_timestamp"),
    // "received" | "processing" | "processed" | "failed" | "ignored" | "rate_limited"
    status: text("status").notNull().default("received"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: text("next_attempt_at"),
    lockedUntil: text("locked_until"),
    lastError: text("last_error"),
    result: text("result", { mode: "json" }).$type<Record<string, unknown>>(),
    receivedAt: text("received_at").notNull().$defaultFn(() => new Date().toISOString()),
    processedAt: text("processed_at"),
  },
  (table) => ({
    waMessageUnique: uniqueIndex("whatsapp_inbound_wa_message_uq").on(table.waMessageId),
    statusIdx: index("whatsapp_inbound_status_idx").on(table.status, table.nextAttemptAt),
  })
);

/**
 * Replies queued for delivery. Created in the same transaction that marks the
 * inbound message processed, so retrying a failed send never repeats the
 * financial write that produced it.
 */
export const whatsappOutboundMessages = sqliteTable(
  "whatsapp_outbound_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    inboundId: text("inbound_id").references(() => whatsappInboundMessages.id, { onDelete: "set null" }),
    toPhone: text("to_phone").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("pending"), // "pending" | "sending" | "sent" | "failed"
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: text("next_attempt_at"),
    lockedUntil: text("locked_until"),
    waMessageId: text("wa_message_id"),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    sentAt: text("sent_at"),
  },
  (table) => ({
    // One reply per inbound message.
    inboundUnique: uniqueIndex("whatsapp_outbound_inbound_uq").on(table.inboundId),
    statusIdx: index("whatsapp_outbound_status_idx").on(table.status, table.nextAttemptAt),
  })
);

/** Fixed-window counters shared across serverless instances. */
export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.key, table.windowStart] }),
  })
);
