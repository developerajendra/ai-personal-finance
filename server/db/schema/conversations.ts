import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./index";

/**
 * Provider-independent conversation history shared by web chat and WhatsApp.
 * Content is stored as plain text plus optional JSON metadata, never in a
 * provider-specific message format, so switching models keeps history usable.
 */
export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // "web" | "whatsapp"
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    userChannelIdx: index("conversations_user_channel_idx").on(table.userId, table.channel, table.updatedAt),
  })
);

export const conversationMessages = sqliteTable(
  "conversation_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "user" | "assistant"
    content: text("content").notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    conversationIdx: index("conversation_messages_conversation_idx").on(table.conversationId, table.createdAt),
  })
);

/**
 * An action the assistant could not complete because required details were
 * missing. At most one open clarification per conversation.
 */
export const pendingClarifications = sqliteTable(
  "pending_clarifications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    collectedFields: text("collected_fields", { mode: "json" }).notNull().$type<Record<string, unknown>>(),
    missingFields: text("missing_fields", { mode: "json" }).notNull().$type<string[]>(),
    status: text("status").notNull().default("open"), // "open" | "resolved" | "cancelled" | "expired"
    expiresAt: text("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    conversationStatusIdx: index("pending_clarifications_conversation_idx").on(table.conversationId, table.status),
  })
);
