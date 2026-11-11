ALTER TABLE `tasks` ADD `password` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `totp_secret` text DEFAULT '' NOT NULL;