CREATE TABLE `show_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`showId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `show_notifications_id` PRIMARY KEY(`id`)
);
