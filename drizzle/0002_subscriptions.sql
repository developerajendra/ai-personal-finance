CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`plan` text,
	`category` text DEFAULT 'Other' NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`cycle` text DEFAULT 'Monthly' NOT NULL,
	`next_date` text NOT NULL,
	`ends` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`paid_with` text,
	`notes` text,
	`remind` integer DEFAULT true NOT NULL,
	`color` text,
	`monogram` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subscriptions_user_idx` ON `subscriptions` (`user_id`,`next_date`);