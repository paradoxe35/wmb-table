import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Configurations (single-row)
// ---------------------------------------------------------------------------

export const configurations = sqliteTable('configurations', {
    id: text('id').primaryKey(),
    appId: text('app_id').notNull(),
    initialized: integer('initialized', { mode: 'boolean' }).notNull().default(false),
    lastCheckBackupStatus: text('last_check_backup_status').default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export const history = sqliteTable('history', {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    milliseconds: integer('milliseconds').notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const historyItems = sqliteTable('history_items', {
    id: text('id').primaryKey(),
    historyId: text('history_id')
        .notNull()
        .references(() => history.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    time: text('time').notNull(),
    documentTitle: text('document_title').notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export const subjects = sqliteTable('subjects', {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    date: text('date').notNull(),
    active: integer('active', { mode: 'boolean' }).default(false),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const subjectItems = sqliteTable('subject_items', {
    id: text('id').primaryKey(),
    subjectName: text('subject_name').notNull(),
    documentTitle: text('document_title').notNull(),
    documentHtmlTree: text('document_html_tree').notNull(), // JSON
    textContent: text('text_content').notNull(),
    bible: text('bible'), // JSON (nullable)
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Tabs (single-row)
// ---------------------------------------------------------------------------

export const tabs = sqliteTable('tabs', {
    id: text('id').primaryKey(),
    datas: text('datas').notNull(), // JSON DocumentTab[]
});

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

export const suggestions = sqliteTable('suggestions', {
    id: text('id').primaryKey(),
    searchText: text('search_text').notNull().unique(),
    found: integer('found').notNull().default(0),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Sidebar Status (single-row)
// ---------------------------------------------------------------------------

export const sidebarStatus = sqliteTable('sidebar_status', {
    id: text('id').primaryKey(),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Custom Documents
// ---------------------------------------------------------------------------

export const customDocuments = sqliteTable('custom_documents', {
    id: text('id').primaryKey(),
    documentId: text('document_id').notNull(),
    title: text('title').notNull().unique(),
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
    documentHtmlTree: text('document_html_tree').notNull(), // JSON
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
// Documents Title
// ---------------------------------------------------------------------------

export const documentsTitle = sqliteTable('documents_title', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    frTitle: text('fr_title').notNull(),
    enTitle: text('en_title').notNull(),
    traduction: text('traduction'),
    webLink: text('web_link'),
    pdfLink: text('pdf_link'),
    audioLink: text('audio_link'),
    date: text('date'),
    dateLong: text('date_long'),
    otherTraductions: text('other_traductions'), // JSON OtherTraduction[]
});

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
