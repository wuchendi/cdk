CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_no` text NOT NULL,
	`user_id` integer,
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_no_unique` ON `orders` (`order_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_trade_no_unique` ON `orders` (`trade_no`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`credits` real NOT NULL,
	`price` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `cdkeys` ADD `order_id` integer REFERENCES orders(id);--> statement-breakpoint
INSERT INTO `products` (`name`, `description`, `credits`, `price`, `sort`) VALUES
	('充值 CDK（1 额度）', '自动发货，卡密含 1 额度。', 1, 800, 1),
	('充值 CDK（3 额度）', '自动发货，卡密含 3 额度。', 3, 2400, 2),
	('充值 CDK（10 额度）', '自动发货，卡密含 10 额度。', 10, 8000, 3);
