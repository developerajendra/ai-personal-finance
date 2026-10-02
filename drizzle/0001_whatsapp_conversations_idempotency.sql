CREATE TABLE `conversation_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversation_messages_conversation_idx` ON `conversation_messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversations_user_channel_idx` ON `conversations` (`user_id`,`channel`,`updated_at`);--> statement-breakpoint
CREATE TABLE `pending_clarifications` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`collected_fields` text NOT NULL,
	`missing_fields` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pending_clarifications_conversation_idx` ON `pending_clarifications` (`conversation_id`,`status`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key`, `window_start`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_inbound_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`wa_message_id` text NOT NULL,
	`from_phone` text NOT NULL,
	`user_id` text,
	`message_type` text NOT NULL,
	`body` text,
	`wa_timestamp` text,
	`status` text DEFAULT 'received' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`locked_until` text,
	`last_error` text,
	`result` text,
	`received_at` text NOT NULL,
	`processed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_inbound_wa_message_uq` ON `whatsapp_inbound_messages` (`wa_message_id`);--> statement-breakpoint
CREATE INDEX `whatsapp_inbound_status_idx` ON `whatsapp_inbound_messages` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `whatsapp_links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`phone_number` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`code_hash` text,
	`code_expires_at` text,
	`verify_attempts` integer DEFAULT 0 NOT NULL,
	`verified_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_links_user_uq` ON `whatsapp_links` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_links_phone_uq` ON `whatsapp_links` (`phone_number`);--> statement-breakpoint
CREATE TABLE `whatsapp_outbound_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`inbound_id` text,
	`to_phone` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`locked_until` text,
	`wa_message_id` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`inbound_id`) REFERENCES `whatsapp_inbound_messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_outbound_inbound_uq` ON `whatsapp_outbound_messages` (`inbound_id`);--> statement-breakpoint
CREATE INDEX `whatsapp_outbound_status_idx` ON `whatsapp_outbound_messages` (`status`,`next_attempt_at`);--> statement-breakpoint
ALTER TABLE `investments` ADD `source` text;--> statement-breakpoint
ALTER TABLE `investments` ADD `source_ref` text;--> statement-breakpoint
CREATE UNIQUE INDEX `investments_user_source_ref_uq` ON `investments` (`user_id`,`source`,`source_ref`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `source_ref` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `updated_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_user_source_ref_uq` ON `transactions` (`user_id`,`source`,`source_ref`);