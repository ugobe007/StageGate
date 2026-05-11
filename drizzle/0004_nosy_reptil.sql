ALTER TABLE `trade_shows` ADD `description` text;--> statement-breakpoint
ALTER TABLE `trade_shows` ADD `roboticsRelevance` int DEFAULT 3;--> statement-breakpoint
ALTER TABLE `trade_shows` ADD `estimatedExhibitors` int;--> statement-breakpoint
ALTER TABLE `trade_shows` ADD `roboticsExhibitors` int;