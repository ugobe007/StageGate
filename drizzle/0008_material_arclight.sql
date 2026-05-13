ALTER TABLE `prospects` ADD `contactLinkedIn` varchar(512);--> statement-breakpoint
ALTER TABLE `prospects` ADD `emailConfidence` varchar(20) DEFAULT 'low';--> statement-breakpoint
ALTER TABLE `prospects` ADD `repliedAt` timestamp;