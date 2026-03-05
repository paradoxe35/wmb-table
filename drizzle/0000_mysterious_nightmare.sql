CREATE TABLE `audio_document_last_play` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text,
	`doc` text
);
--> statement-breakpoint
CREATE TABLE `audio_document_times` (
	`id` text PRIMARY KEY NOT NULL,
	`audio_link` text NOT NULL,
	`time` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audio_document_times_audio_link_unique` ON `audio_document_times` (`audio_link`);--> statement-breakpoint
CREATE TABLE `audio_downloads` (
	`id` text PRIMARY KEY NOT NULL,
	`local_file` text,
	`audio_link` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audio_downloads_audio_link_unique` ON `audio_downloads` (`audio_link`);--> statement-breakpoint
CREATE TABLE `backup_db_references` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`lines` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `backup_status` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`access` integer DEFAULT false NOT NULL,
	`restored` integer DEFAULT false NOT NULL,
	`last_update` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`initialized` integer DEFAULT false NOT NULL,
	`last_check_backup_status` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `custom_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_documents_title_unique` ON `custom_documents` (`title`);--> statement-breakpoint
CREATE TABLE `documents_title` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`fr_title` text NOT NULL,
	`en_title` text NOT NULL,
	`traduction` text,
	`web_link` text,
	`pdf_link` text,
	`audio_link` text,
	`date` text,
	`date_long` text,
	`other_traductions` text
);
--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`milliseconds` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `history_items` (
	`id` text PRIMARY KEY NOT NULL,
	`history_id` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`document_title` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`history_id`) REFERENCES `history`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`content` text,
	`default_name` integer DEFAULT true NOT NULL,
	`created` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `notes_bible_references` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`label` text NOT NULL,
	`references` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notes_references` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`label` text NOT NULL,
	`document_title` text NOT NULL,
	`document_html_tree` text NOT NULL,
	`text_content` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sidebar_status` (
	`id` text PRIMARY KEY NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `subject_items` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_name` text NOT NULL,
	`document_title` text NOT NULL,
	`document_html_tree` text NOT NULL,
	`text_content` text NOT NULL,
	`bible` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`active` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_name_unique` ON `subjects` (`name`);--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`search_text` text NOT NULL,
	`found` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suggestions_search_text_unique` ON `suggestions` (`search_text`);--> statement-breakpoint
CREATE TABLE `tabs` (
	`id` text PRIMARY KEY NOT NULL,
	`datas` text NOT NULL
);
