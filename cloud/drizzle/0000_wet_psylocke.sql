CREATE TABLE `planner_state` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`document` text NOT NULL,
	`backup` text
);
