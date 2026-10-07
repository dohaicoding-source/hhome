CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`slot` text,
	`version` integer DEFAULT 1 NOT NULL,
	`parent_id` text,
	`tenant_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `records_owner_kind` ON `records` (`owner`,`kind`);
--> statement-breakpoint
CREATE UNIQUE INDEX `records_unique_slot` ON `records` (`owner`,`kind`,`slot`);