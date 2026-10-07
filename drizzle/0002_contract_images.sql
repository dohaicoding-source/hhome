CREATE TABLE `contract_images` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`contract_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contract_images_owner_contract` ON `contract_images` (`owner`,`contract_id`);