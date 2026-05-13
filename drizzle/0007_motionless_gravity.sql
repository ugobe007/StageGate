CREATE TABLE `outreach_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prospectId` int NOT NULL,
	`emailSentAt` timestamp,
	`emailSubject` varchar(300),
	`emailBody` text,
	`emailStatus` enum('pending','sent','failed','opened','replied') NOT NULL DEFAULT 'pending',
	`videoMessageUrl` varchar(500),
	`responseStatus` enum('none','positive','negative','scheduled') NOT NULL DEFAULT 'none',
	`scheduledCallAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outreach_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prospects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company` varchar(200) NOT NULL,
	`robotName` varchar(200),
	`robotType` varchar(50),
	`hqCountry` varchar(100),
	`attendsLasVegas` varchar(10) DEFAULT 'unknown',
	`contactName` varchar(200),
	`contactEmail` varchar(200),
	`contactTitle` varchar(200),
	`contactDept` varchar(100),
	`website` varchar(300),
	`shows` json DEFAULT ('[]'),
	`notes` text,
	`status` enum('new','contacted','responded','scheduled','converted','not_interested') NOT NULL DEFAULT 'new',
	`videoMessageUrl` varchar(500),
	`scheduledCallAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prospects_id` PRIMARY KEY(`id`)
);
