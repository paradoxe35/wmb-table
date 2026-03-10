CREATE TABLE `tts_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`active_provider` text NOT NULL,
	`fallback_order` text NOT NULL,
	`highlight_mode` text NOT NULL,
	`auto_play` integer NOT NULL,
	`rate` real DEFAULT 1 NOT NULL,
	`cache_max_size_mb` integer NOT NULL,
	`provider_configs` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
