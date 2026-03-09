CREATE TABLE `highlights` (
	`id` text PRIMARY KEY NOT NULL,
	`document_title` text NOT NULL,
	`sermon_id` text DEFAULT '' NOT NULL,
	`paragraph_index` integer NOT NULL,
	`start_offset` integer NOT NULL,
	`end_offset` integer NOT NULL,
	`text_snippet` text NOT NULL,
	`color` text DEFAULT '#FFFF00' NOT NULL,
	`comment` text,
	`document_type` text DEFAULT 'sermon' NOT NULL,
	`translation_id` integer DEFAULT 0 NOT NULL,
	`language_code` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
