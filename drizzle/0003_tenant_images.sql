CREATE TABLE `tenant_images` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`tenant_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tenant_images_owner_tenant` ON `tenant_images` (`owner`,`tenant_id`);