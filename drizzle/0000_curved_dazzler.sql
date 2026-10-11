CREATE TABLE `rsvps` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`attendance` text NOT NULL,
	`pax` integer NOT NULL,
	`wish` text NOT NULL,
	`visible` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`rate_key` text NOT NULL
);
