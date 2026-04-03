CREATE TABLE `accounts` (
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `provider_account_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bank_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bank_name` text NOT NULL,
	`account_number` text,
	`account_type` text NOT NULL,
	`asset_type` text,
	`balance` real NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`original_amount` real,
	`original_currency` text,
	`last_updated` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`is_published` integer DEFAULT true NOT NULL,
	`issue_date` text,
	`due_date` text,
	`interest_rate` real,
	`paid_date` text,
	`tags` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `financial_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer,
	`period` text NOT NULL,
	`snapshot_date` text NOT NULL,
	`total_investments` real DEFAULT 0 NOT NULL,
	`total_loans` real DEFAULT 0 NOT NULL,
	`total_properties` real DEFAULT 0 NOT NULL,
	`total_bank_balances` real DEFAULT 0 NOT NULL,
	`total_receivables` real DEFAULT 0 NOT NULL,
	`total_stocks` real DEFAULT 0 NOT NULL,
	`total_mutual_funds` real DEFAULT 0 NOT NULL,
	`total_ppf` real DEFAULT 0 NOT NULL,
	`total_fixed_assets` real DEFAULT 0 NOT NULL,
	`total_liquid_assets` real DEFAULT 0 NOT NULL,
	`net_worth` real DEFAULT 0 NOT NULL,
	`total_income` real DEFAULT 0 NOT NULL,
	`total_expenses` real DEFAULT 0 NOT NULL,
	`net_balance` real DEFAULT 0 NOT NULL,
	`investment_breakdown` text,
	`loan_breakdown` text,
	`property_breakdown` text,
	`category_breakdown` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `investments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text,
	`original_amount` real,
	`original_currency` text,
	`type` text NOT NULL,
	`asset_type` text,
	`start_date` text NOT NULL,
	`end_date` text,
	`maturity_date` text,
	`maturity_amount` real,
	`original_maturity_amount` real,
	`interest_rate` real,
	`rule_label` text,
	`rule_formula` text,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`is_published` integer DEFAULT true NOT NULL,
	`tags` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `loan_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`loan_id` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`outstanding_amount` real NOT NULL,
	`principal_paid` real NOT NULL,
	`interest_paid` real NOT NULL,
	`emi_amount` real NOT NULL,
	`interest_rate` real NOT NULL,
	`remaining_tenure_months` integer NOT NULL,
	`snapshot_date` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`principal_amount` real NOT NULL,
	`outstanding_amount` real NOT NULL,
	`interest_rate` real NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`emi_amount` real NOT NULL,
	`emi_date` integer NOT NULL,
	`tenure_months` integer NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`is_published` integer DEFAULT true NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mutual_funds` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tradingsymbol` text NOT NULL,
	`fund_name` text NOT NULL,
	`folio` text NOT NULL,
	`quantity` real NOT NULL,
	`average_price` real NOT NULL,
	`last_price` real NOT NULL,
	`pnl` real NOT NULL,
	`pnl_percentage` real NOT NULL,
	`last_updated` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `portfolio_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`icon` text,
	`href` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ppf_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`member_id` text,
	`member_name` text,
	`establishment_id` text,
	`establishment_name` text,
	`deposit_employee_share` real DEFAULT 0 NOT NULL,
	`deposit_employer_share` real DEFAULT 0 NOT NULL,
	`withdraw_employee_share` real DEFAULT 0 NOT NULL,
	`withdraw_employer_share` real DEFAULT 0 NOT NULL,
	`pension_contribution` real DEFAULT 0 NOT NULL,
	`grand_total` real DEFAULT 0 NOT NULL,
	`extracted_from` text,
	`extracted_at` text,
	`last_updated` text,
	`raw_data` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `processed_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email_id` text NOT NULL,
	`processed_at` text,
	`investment_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`asset_type` text,
	`purchase_price` real NOT NULL,
	`current_value` real,
	`purchase_date` text NOT NULL,
	`location` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'owned' NOT NULL,
	`is_published` integer DEFAULT true NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`session_token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stocks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tradingsymbol` text NOT NULL,
	`exchange` text NOT NULL,
	`instrument_token` text NOT NULL,
	`quantity` integer NOT NULL,
	`average_price` real NOT NULL,
	`last_price` real NOT NULL,
	`pnl` real NOT NULL,
	`pnl_percentage` real NOT NULL,
	`last_updated` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`type` text NOT NULL,
	`balance` real,
	`account` text,
	`source` text NOT NULL,
	`quality_grade` text,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`config_key` text NOT NULL,
	`config_value` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer,
	`image` text,
	`hashed_password` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
