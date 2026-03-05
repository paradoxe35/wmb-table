CREATE TABLE `sermon_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`translation_id` integer NOT NULL,
	`language_code` text NOT NULL,
	`sermon_date` text NOT NULL,
	`title` text NOT NULL,
	`en_title` text,
	`audio_link` text,
	`pdf_link` text,
	`web_link` text,
	`date_long` text,
	`paragraph_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sermon_meta_translation_lang` ON `sermon_metadata` (`translation_id`,`language_code`);--> statement-breakpoint
CREATE INDEX `idx_sermon_meta_lang` ON `sermon_metadata` (`language_code`);--> statement-breakpoint
CREATE INDEX `idx_sermon_meta_date` ON `sermon_metadata` (`sermon_date`);