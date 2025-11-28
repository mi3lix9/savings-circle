CREATE TABLE `circle_months` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`circleId` integer NOT NULL,
	`name` text NOT NULL,
	`index` integer NOT NULL,
	`totalStocks` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`circleId`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `circle_months_circle_id_idx` ON `circle_months` (`circleId`);--> statement-breakpoint
CREATE TABLE `circles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`startDate` integer,
	`monthlyAmount` real NOT NULL,
	`isLocked` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`circleId` integer NOT NULL,
	`monthId` integer NOT NULL,
	`paid` integer DEFAULT false NOT NULL,
	`paidAt` integer,
	`invoiceUrl` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`circleId`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monthId`) REFERENCES `circle_months`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payments_user_id_idx` ON `payments` (`userId`);--> statement-breakpoint
CREATE INDEX `payments_circle_id_idx` ON `payments` (`circleId`);--> statement-breakpoint
CREATE INDEX `payments_month_id_idx` ON `payments` (`monthId`);--> statement-breakpoint
CREATE TABLE `stocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`circleId` integer NOT NULL,
	`userId` integer NOT NULL,
	`monthId` integer NOT NULL,
	`stockCount` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`editable` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`circleId`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monthId`) REFERENCES `circle_months`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `stocks_user_id_idx` ON `stocks` (`userId`);--> statement-breakpoint
CREATE INDEX `stocks_circle_id_idx` ON `stocks` (`circleId`);--> statement-breakpoint
CREATE INDEX `stocks_month_id_idx` ON `stocks` (`monthId`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telegramId` text NOT NULL,
	`phone` text,
	`isAdmin` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_telegramId_unique` ON `users` (`telegramId`);