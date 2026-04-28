CREATE TABLE `ai_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`language_code` text NOT NULL,
	`summary` text,
	`ai_title` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`tool_calls` text,
	`tool_results` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_messages_conversation_created_idx` ON `ai_messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`active_provider` text,
	`language_preference` text DEFAULT 'active' NOT NULL,
	`max_history_conversations` integer DEFAULT 50 NOT NULL,
	`providers` text NOT NULL,
	`custom_providers` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
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
	`last_check_backup_status` text DEFAULT (datetime('now')),
	`content_language` text,
	`active_bible_version_abbreviation` text,
	`remember_reading_position` integer DEFAULT true NOT NULL,
	`max_tabs` integer DEFAULT 10 NOT NULL,
	`ui_language` text,
	`sidebar_hidden` integer DEFAULT false NOT NULL,
	`theme_mode` text
);
--> statement-breakpoint
CREATE TABLE `custom_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`language_code` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `highlights` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text DEFAULT '' NOT NULL,
	`document_key` text DEFAULT '' NOT NULL,
	`document_title` text NOT NULL,
	`document_identity` text NOT NULL,
	`paragraph_index` integer NOT NULL,
	`start_offset` integer NOT NULL,
	`end_offset` integer NOT NULL,
	`text_snippet` text NOT NULL,
	`color` text DEFAULT '#FFFF00' NOT NULL,
	`comment` text,
	`language_code` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `highlights_document_key_idx` ON `highlights` (`document_key`);--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`milliseconds` integer NOT NULL,
	`language_code` text DEFAULT '' NOT NULL,
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
	`document_identity` text NOT NULL,
	`document_key` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`history_id`) REFERENCES `history`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `history_items_document_key_idx` ON `history_items` (`document_key`);--> statement-breakpoint
CREATE INDEX `history_items_history_created_idx` ON `history_items` (`history_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `installed_language_sources` (
	`lang_code` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_url` text NOT NULL,
	`file_name` text NOT NULL,
	`etag` text,
	`last_modified` text,
	`content_length` integer,
	`version_id` text,
	`update_available` integer DEFAULT false NOT NULL,
	`installed_at` text DEFAULT (datetime('now')),
	`last_checked_at` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `kv_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer
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
	`document_reference` text,
	`text_content` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reading_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`scroll_y` integer DEFAULT 0 NOT NULL,
	`scroll_x` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `subject_items` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`document_title` text NOT NULL,
	`document_reference` text NOT NULL,
	`text_content` text NOT NULL,
	`document_preview` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subject_items_subject_id_idx` ON `subject_items` (`subject_id`);--> statement-breakpoint
CREATE INDEX `subject_items_subject_order_idx` ON `subject_items` (`subject_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`active` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`search_text` text NOT NULL,
	`found` integer DEFAULT 0 NOT NULL,
	`language_code` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `tabs` (
	`id` text PRIMARY KEY NOT NULL,
	`language_code` text NOT NULL,
	`datas` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tts_cache_entries` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`mime_type` text NOT NULL,
	`last_accessed` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tts_cache_entries_last_accessed_idx` ON `tts_cache_entries` (`last_accessed`);--> statement-breakpoint
CREATE INDEX `tts_cache_entries_path_idx` ON `tts_cache_entries` (`path`);--> statement-breakpoint
CREATE TABLE `tts_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`active_provider` text NOT NULL,
	`highlight_mode` text NOT NULL,
	`auto_switch_voice` integer DEFAULT true NOT NULL,
	`rate` real DEFAULT 1 NOT NULL,
	`segment_gap_ms` integer,
	`cache_max_size_mb` integer NOT NULL,
	`provider_configs` text NOT NULL,
	`read_introduction` integer DEFAULT true,
	`announce_segment_numbers` integer DEFAULT false,
	`bible_read_entire_book` integer DEFAULT false,
	`auto_scroll_to_highlight` integer DEFAULT true,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
