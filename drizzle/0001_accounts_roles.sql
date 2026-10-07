CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`recovery_hash` text NOT NULL,
	`created_at` text NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_phone` ON `accounts` (`phone`);
--> statement-breakpoint
CREATE TABLE `auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires_at` integer NOT NULL
);

--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text,
	`phone` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`building_ids` text DEFAULT '[]' NOT NULL,
	`tenant_id` text,
	`token_hash` text,
	`expires_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `membership_workspace_phone` ON `memberships` (`workspace_id`,`phone`);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_workspace_user` ON `memberships` (`workspace_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `membership_user` ON `memberships` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_token` ON `memberships` (`token_hash`);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_owner` ON `workspaces` (`owner_id`);