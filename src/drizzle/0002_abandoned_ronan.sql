PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`circleId` integer NOT NULL,
	`monthId` integer NOT NULL,
	`fileId` text NOT NULL,
	`status` text DEFAULT 'paid' NOT NULL,
	`paidAt` integer DEFAULT (unixepoch()) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`circleId`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monthId`) REFERENCES `circle_months`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_payments`("id", "userId", "circleId", "monthId", "fileId", "status", "paidAt", "createdAt", "updatedAt") SELECT "id", "userId", "circleId", "monthId", "fileId", "status", "paidAt", "createdAt", "updatedAt" FROM `payments`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
ALTER TABLE `__new_payments` RENAME TO `payments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `payments_user_id_idx` ON `payments` (`userId`);--> statement-breakpoint
CREATE INDEX `payments_circle_id_idx` ON `payments` (`circleId`);--> statement-breakpoint
CREATE INDEX `payments_month_id_idx` ON `payments` (`monthId`);--> statement-breakpoint
ALTER TABLE `users` ADD `languageCode` text;