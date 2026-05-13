CREATE TABLE `agent_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentName` varchar(100) NOT NULL,
	`status` enum('running','success','error') NOT NULL DEFAULT 'running',
	`triggeredBy` varchar(100) DEFAULT 'admin',
	`inputSummary` varchar(500),
	`outputSummary` varchar(500),
	`errorMessage` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`durationMs` int,
	CONSTRAINT `agent_runs_id` PRIMARY KEY(`id`)
);
