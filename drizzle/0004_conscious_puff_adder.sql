DROP INDEX `idx_sermon_meta_translation_lang`;--> statement-breakpoint
ALTER TABLE `sermon_metadata` ADD `traduction_name` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sermon_meta_translation_lang_date` ON `sermon_metadata` (`translation_id`,`language_code`,`sermon_date`);