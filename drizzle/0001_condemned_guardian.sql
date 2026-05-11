CREATE TABLE `company_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`website` varchar(512),
	`contactName` varchar(255),
	`contactEmail` varchar(320),
	`contactPhone` varchar(64),
	`country` varchar(100),
	`robotTypes` text,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exhibitor_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`showId` int NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`website` varchar(512),
	`contactEmail` varchar(320),
	`contactName` varchar(255),
	`outreachStatus` enum('new','emailed','responded','registered') NOT NULL DEFAULT 'new',
	`aiSummary` text,
	`emailDraft` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `exhibitor_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `logistics_partners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`serviceType` enum('customs','transporter','insurance','parts','general') NOT NULL,
	`contactName` varchar(255),
	`contactEmail` varchar(320),
	`contactPhone` varchar(64),
	`website` varchar(512),
	`city` varchar(100),
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `logistics_partners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`serviceId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(10,2),
	`configuration` text,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`showId` int NOT NULL,
	`status` enum('pending','confirmed','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
	`totalAmount` decimal(10,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(255) NOT NULL,
	`brand` enum('stagegate','stagehand','stagepro') NOT NULL DEFAULT 'stagegate',
	`category` enum('logistics','activation','support','marketing','training','showroom') NOT NULL,
	`description` text,
	`basePrice` decimal(10,2),
	`priceUnit` varchar(100),
	`pricingTiers` text,
	`phase` enum('phase1','phase2') NOT NULL DEFAULT 'phase1',
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int DEFAULT 0,
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `trade_shows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`location` varchar(255),
	`venue` varchar(255),
	`city` varchar(100),
	`startDate` timestamp,
	`endDate` timestamp,
	`website` varchar(512),
	`exhibitorListUrl` varchar(512),
	`status` enum('upcoming','active','completed') NOT NULL DEFAULT 'upcoming',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trade_shows_id` PRIMARY KEY(`id`)
);
