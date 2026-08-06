import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Configurations (single-row)
// ---------------------------------------------------------------------------

export const configurations = sqliteTable('configurations', {
    id: text('id').primaryKey(),
    appId: text('app_id').notNull(),
    initialized: integer('initialized', { mode: 'boolean' }).notNull().default(false),
    lastCheckBackupStatus: text('last_check_backup_status').default(sql`(datetime('now'))`),
    contentLanguage: text('content_language'),
    activeBibleVersionAbbreviation: text('active_bible_version_abbreviation'),
    rememberReadingPosition: integer('remember_reading_position', { mode: 'boolean' })
        .notNull()
        .default(true),
    maxTabs: integer('max_tabs').notNull().default(10),
    uiLanguage: text('ui_language'),
    sidebarHidden: integer('sidebar_hidden', { mode: 'boolean' }).notNull().default(false),
    themeMode: text('theme_mode'),
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export const history = sqliteTable('history', {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    milliseconds: integer('milliseconds').notNull(),
    languageCode: text('language_code').notNull().default(''),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const historyItems = sqliteTable(
    'history_items',
    {
        id: text('id').primaryKey(),
        historyId: text('history_id')
            .notNull()
            .references(() => history.id, { onDelete: 'cascade' }),
        date: text('date').notNull(),
        time: text('time').notNull(),
        documentTitle: text('document_title').notNull(),
        documentIdentity: text('document_identity').notNull(),
        documentKey: text('document_key').notNull().default(''),
        createdAt: text('created_at').default(sql`(datetime('now'))`),
        updatedAt: text('updated_at').default(sql`(datetime('now'))`),
    },
    (table) => [
        index('history_items_document_key_idx').on(table.documentKey),
        index('history_items_history_created_idx').on(table.historyId, table.createdAt),
    ],
);

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export const subjects = sqliteTable('subjects', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    date: text('date').notNull(),
    active: integer('active', { mode: 'boolean' }).default(false),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const subjectItems = sqliteTable(
    'subject_items',
    {
        id: text('id').primaryKey(),
        subjectId: text('subject_id')
            .notNull()
            .references(() => subjects.id, { onDelete: 'cascade' }),
        sortOrder: integer('sort_order').notNull().default(0),
        documentTitle: text('document_title').notNull(),
        documentReference: text('document_reference').notNull(), // JSON
        textContent: text('text_content').notNull(),
        documentPreview: text('document_preview'), // JSON (nullable)
        createdAt: text('created_at').default(sql`(datetime('now'))`),
        updatedAt: text('updated_at').default(sql`(datetime('now'))`),
    },
    (table) => [
        index('subject_items_subject_id_idx').on(table.subjectId),
        index('subject_items_subject_order_idx').on(table.subjectId, table.sortOrder),
    ],
);

// ---------------------------------------------------------------------------
// Tabs (single-row)
// ---------------------------------------------------------------------------

export const tabs = sqliteTable('tabs', {
    id: text('id').primaryKey(),
    languageCode: text('language_code').notNull(),
    datas: text('datas').notNull(), // JSON DocumentTab[]
});

export const readingPositions = sqliteTable('reading_positions', {
    documentKey: text('id').primaryKey(),
    scrollY: integer('scroll_y').notNull().default(0),
    scrollX: integer('scroll_x').notNull().default(0),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// Local-only metadata for installed language archives. Never synced.
export const installedLanguageSources = sqliteTable('installed_language_sources', {
    langCode: text('lang_code').primaryKey(),
    sourceType: text('source_type').notNull(),
    sourceUrl: text('source_url').notNull(),
    fileName: text('file_name').notNull(),
    etag: text('etag'),
    lastModified: text('last_modified'),
    contentLength: integer('content_length'),
    versionId: text('version_id'),
    updateAvailable: integer('update_available', { mode: 'boolean' }).notNull().default(false),
    installedAt: text('installed_at').default(sql`(datetime('now'))`),
    lastCheckedAt: text('last_checked_at'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

export const suggestions = sqliteTable('suggestions', {
    id: text('id').primaryKey(),
    searchText: text('search_text').notNull(),
    found: integer('found').notNull().default(0),
    languageCode: text('language_code').notNull().default(''),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// Custom Documents
// ---------------------------------------------------------------------------

export const customDocuments = sqliteTable('custom_documents', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull().default(''),
    languageCode: text('language_code').notNull().default(''),
    /** `null` means a plain document, so existing rows need no backfill. */
    kind: text('kind'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export const notes = sqliteTable('notes', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    content: text('content'),
    defaultName: integer('default_name', { mode: 'boolean' }).notNull().default(true),
    created: integer('created', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const notesReferences = sqliteTable('notes_references', {
    id: text('id').primaryKey(),
    noteId: text('note_id')
        .notNull()
        .references(() => notes.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    documentTitle: text('document_title').notNull(),
    documentReference: text('document_reference'), // JSON (nullable)
    textContent: text('text_content').notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const notesBibleReferences = sqliteTable('notes_bible_references', {
    id: text('id').primaryKey(),
    noteId: text('note_id')
        .notNull()
        .references(() => notes.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    references: text('references').notNull(), // JSON string[]|BibleBook[]
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export const audioDocumentTimes = sqliteTable('audio_document_times', {
    id: text('id').primaryKey(),
    audioLink: text('audio_link').notNull().unique(),
    time: integer('time').notNull().default(0),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const audioDocumentLastPlay = sqliteTable('audio_document_last_play', {
    id: text('id').primaryKey(),
    reference: text('reference'), // document title string
    doc: text('doc'), // JSON Title
});

export const audioDownloads = sqliteTable('audio_downloads', {
    id: text('id').primaryKey(),
    localFile: text('local_file'),
    audioLink: text('audio_link').notNull().unique(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Highlights
// ---------------------------------------------------------------------------

export const highlights = sqliteTable(
    'highlights',
    {
        id: text('id').primaryKey(),
        groupId: text('group_id').notNull().default(''),
        documentKey: text('document_key').notNull().default(''),
        documentTitle: text('document_title').notNull(),
        documentIdentity: text('document_identity').notNull(),
        paragraphIndex: integer('paragraph_index').notNull(),
        startOffset: integer('start_offset').notNull(),
        endOffset: integer('end_offset').notNull(),
        textSnippet: text('text_snippet').notNull(),
        color: text('color').notNull().default('#FFFF00'),
        comment: text('comment'),
        languageCode: text('language_code').notNull().default(''),
        createdAt: text('created_at').default(sql`(datetime('now'))`),
        updatedAt: text('updated_at').default(sql`(datetime('now'))`),
    },
    (table) => [index('highlights_document_key_idx').on(table.documentKey)],
);

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export const backupDbReferences = sqliteTable('backup_db_references', {
    id: text('id').primaryKey(),
    filename: text('filename').notNull(),
    lines: text('lines').notNull(),
});

export const backupStatus = sqliteTable('backup_status', {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(false),
    access: integer('access', { mode: 'boolean' }).notNull().default(false),
    restored: integer('restored', { mode: 'boolean' }).notNull().default(false),
    lastUpdate: text('last_update').default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// TTS Settings (single-row)
// ---------------------------------------------------------------------------

export const ttsSettings = sqliteTable('tts_settings', {
    id: text('id').primaryKey(),
    activeProvider: text('active_provider').notNull(),
    highlightMode: text('highlight_mode').notNull(),
    autoSwitchVoice: integer('auto_switch_voice', { mode: 'boolean' }).notNull().default(true),
    rate: real('rate').notNull().default(1),
    segmentGapMs: integer('segment_gap_ms'),
    cacheMaxSizeMb: integer('cache_max_size_mb').notNull(),
    providerConfigs: text('provider_configs').notNull(), // JSON<Record<TtsProviderType, TtsProviderSettings>>
    readIntroduction: integer('read_introduction', { mode: 'boolean' }).default(true),
    announceSegmentNumbers: integer('announce_segment_numbers', { mode: 'boolean' }).default(false),
    bibleReadEntireBook: integer('bible_read_entire_book', { mode: 'boolean' }).default(false),
    autoScrollToHighlight: integer('auto_scroll_to_highlight', { mode: 'boolean' }).default(true),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// AI assistant
// ---------------------------------------------------------------------------

export const aiSettings = sqliteTable('ai_settings', {
    id: text('id').primaryKey(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    activeProvider: text('active_provider'),
    languagePreference: text('language_preference').notNull().default('active'),
    maxHistoryConversations: integer('max_history_conversations').notNull().default(50),
    providers: text('providers').notNull(),
    customProviders: text('custom_providers').notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const aiConversations = sqliteTable('ai_conversations', {
    id: text('id').primaryKey(),
    title: text('title'),
    languageCode: text('language_code').notNull(),
    summary: text('summary'),
    aiTitle: integer('ai_title').notNull().default(0),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const aiMessages = sqliteTable(
    'ai_messages',
    {
        id: text('id').primaryKey(),
        conversationId: text('conversation_id')
            .notNull()
            .references(() => aiConversations.id, { onDelete: 'cascade' }),
        role: text('role').notNull(),
        content: text('content').notNull().default(''),
        toolCalls: text('tool_calls'),
        toolResults: text('tool_results'),
        createdAt: text('created_at').default(sql`(datetime('now'))`),
    },
    (table) => [
        index('ai_messages_conversation_created_idx').on(table.conversationId, table.createdAt),
    ],
);

// ---------------------------------------------------------------------------
// Key-value cache (local only, not synced)
// ---------------------------------------------------------------------------

export const kvCache = sqliteTable('kv_cache', {
    key: text('key').primaryKey(),
    value: text('value').notNull(), // JSON-encoded
    expiresAt: integer('expires_at'), // Unix timestamp (ms), null = never expires
});

export const ttsCacheEntries = sqliteTable(
    'tts_cache_entries',
    {
        cacheKey: text('cache_key').primaryKey(),
        path: text('path').notNull(),
        sizeBytes: integer('size_bytes').notNull(),
        mimeType: text('mime_type').notNull(),
        lastAccessed: integer('last_accessed').notNull(),
        createdAt: integer('created_at').notNull(),
    },
    (table) => [
        index('tts_cache_entries_last_accessed_idx').on(table.lastAccessed),
        index('tts_cache_entries_path_idx').on(table.path),
    ],
);

// ---------------------------------------------------------------------------
// Synced tables — add a table here to include it in sync
// ---------------------------------------------------------------------------

export const syncedTables = [
    notes,
    notesReferences,
    notesBibleReferences,
    subjects,
    subjectItems,
    customDocuments,
    suggestions,
    highlights,
    aiConversations,
    aiMessages,
] as const;
