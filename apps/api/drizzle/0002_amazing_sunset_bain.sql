DROP TABLE `sessions`;--> statement-breakpoint
-- Migrations run inside a transaction, where PRAGMA foreign_keys is a no-op,
-- so key -> order links are parked while `orders` is rebuilt.
CREATE TABLE `__cdkey_orders` AS SELECT `id`, `order_id` FROM `cdkeys` WHERE `order_id` IS NOT NULL;--> statement-breakpoint
UPDATE `cdkeys` SET `order_id` = NULL;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_no` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`product_id` integer NOT NULL,
	`product_name` text NOT NULL,
	`credits` real NOT NULL,
	`quantity` integer NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`pay_amount` integer NOT NULL,
	`pay_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`trade_no` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL,
	`paid_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "order_no", "email", "password_hash", "product_id", "product_name", "credits", "quantity", "amount", "method", "pay_amount", "pay_url", "status", "trade_no", "created_at", "expires_at", "paid_at") SELECT "id", "order_no", "email", "password_hash", "product_id", "product_name", "credits", "quantity", "amount", "method", "pay_amount", "pay_url", "status", "trade_no", "created_at", "expires_at", "paid_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
UPDATE `cdkeys` SET `order_id` = (SELECT `order_id` FROM `__cdkey_orders` WHERE `__cdkey_orders`.`id` = `cdkeys`.`id`) WHERE `id` IN (SELECT `id` FROM `__cdkey_orders`);--> statement-breakpoint
DROP TABLE `__cdkey_orders`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_no_unique` ON `orders` (`order_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_trade_no_unique` ON `orders` (`trade_no`);