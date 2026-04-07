import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as schema from '@main/database/schema';
import * as syncSchema from '@main/database/sync-schema';
import { _setDbForTesting, _setSyncDbForTesting } from '@main/database';
import * as subjectsRepo from '@main/database/repositories/subjects.repository';
import * as customDocumentsRepo from '@main/database/repositories/custom-documents.repository';
import * as aiRepo from '@main/database/repositories/ai.repository';
import { getAllChangeLogs } from '@main/services/sync/change-log.service';
import { SYNCED_TABLE_NAMES } from '@main/database/sync-tables';

type SqliteDb = InstanceType<typeof Database>;

let mainSqlite: SqliteDb;
let syncSqlite: SqliteDb;

function createMainSchema(db: SqliteDb): void {
    db.exec(`
        CREATE TABLE subjects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            active INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        );
        CREATE TABLE subject_items (
            id TEXT PRIMARY KEY,
            subject_id TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            document_title TEXT NOT NULL,
            document_reference TEXT NOT NULL,
            text_content TEXT NOT NULL,
            document_preview TEXT,
            created_at TEXT,
            updated_at TEXT
        );
        CREATE TABLE custom_documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            language_code TEXT NOT NULL DEFAULT '',
            created_at TEXT,
            updated_at TEXT
        );
        CREATE TABLE ai_conversations (
            id TEXT PRIMARY KEY,
            title TEXT,
            language_code TEXT NOT NULL,
            summary TEXT,
            ai_title INTEGER NOT NULL DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        );
        CREATE TABLE ai_messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            tool_calls TEXT,
            tool_results TEXT,
            created_at TEXT
        );
    `);
}

function createSyncSchema(db: SqliteDb): void {
    db.exec(`
        CREATE TABLE change_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            change_id TEXT NOT NULL UNIQUE,
            table_name TEXT NOT NULL,
            row_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            new_data TEXT NOT NULL,
            synced INTEGER NOT NULL DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        );
        CREATE TABLE sync_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sync_time_offset TEXT NOT NULL
        );
        CREATE TABLE processed_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id TEXT NOT NULL UNIQUE,
            created_at TEXT
        );
        CREATE TABLE apply_failures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id TEXT NOT NULL UNIQUE,
            count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT
        );
    `);
}

function getLatestChangeFor(tableName: string, rowId: string): Record<string, unknown> {
    const row = getAllChangeLogs()
        .filter((entry) => entry.tableName === tableName && entry.rowId === rowId)
        .at(-1);

    expect(row).toBeTruthy();
    return JSON.parse(row!.newData) as Record<string, unknown>;
}

beforeEach(() => {
    mainSqlite = new Database(':memory:');
    syncSqlite = new Database(':memory:');
    createMainSchema(mainSqlite);
    createSyncSchema(syncSqlite);

    _setDbForTesting(drizzle(mainSqlite, { schema }), mainSqlite);
    _setSyncDbForTesting(drizzle(syncSqlite, { schema: syncSchema }), syncSqlite);
});

afterEach(() => {
    syncSqlite.close();
    mainSqlite.close();
});

describe('repository sync payloads', () => {
    it('logs the full subjects row on rename', () => {
        const subject = subjectsRepo.create('Sermon prep');

        subjectsRepo.rename(subject.id, 'Study prep');

        const change = getLatestChangeFor('subjects', subject.id);
        expect(change).toMatchObject({
            id: subject.id,
            name: 'Study prep',
        });
        expect(change['date']).toEqual(subject.date);
        expect(change).toHaveProperty('created_at');
        expect(change).toHaveProperty('updated_at');
    });

    it('logs the full subject_items row on reorder', () => {
        const subject = subjectsRepo.create('Topic');
        const first = subjectsRepo.createItem(
            subject.id,
            'Doc A',
            { documentType: 'sermon', translationId: 't1', sermonId: 's1' },
            'alpha',
        );
        const second = subjectsRepo.createItem(
            subject.id,
            'Doc B',
            { documentType: 'sermon', translationId: 't2', sermonId: 's2' },
            'beta',
        );

        subjectsRepo.reorderItems(subject.id, [second.id, first.id]);

        const change = getLatestChangeFor('subject_items', second.id);
        expect(change).toMatchObject({
            id: second.id,
            subject_id: subject.id,
            sort_order: 0,
            document_title: 'Doc B',
            text_content: 'beta',
        });
        expect(change['document_reference']).toEqual(
            JSON.stringify({ documentType: 'sermon', translationId: 't2', sermonId: 's2' }),
        );
        expect(change).toHaveProperty('updated_at');
    });

    it('logs the full custom_documents row when language changes', () => {
        const doc = customDocumentsRepo.createCustomDocument('Doc', 'Body', 'fr');

        customDocumentsRepo.updateCustomDocumentLanguage(doc.id, 'en');

        const change = getLatestChangeFor('custom_documents', doc.id);
        expect(change).toMatchObject({
            id: doc.id,
            title: 'Doc',
            content: 'Body',
            language_code: 'en',
        });
    });

    it('syncs ai conversation updates when messages change', () => {
        const conversation = aiRepo.createConversation('en', 'Chat');

        const userMessage = aiRepo.createMessage({
            conversationId: conversation.id,
            role: 'user',
            content: 'hello',
        });

        const conversationAfterUserMessage = getLatestChangeFor(
            'ai_conversations',
            conversation.id,
        );
        expect(conversationAfterUserMessage['id']).toEqual(conversation.id);
        expect(conversationAfterUserMessage).toHaveProperty('updated_at');

        const assistantMessage = aiRepo.createMessage({
            conversationId: conversation.id,
            role: 'assistant',
            content: 'draft',
        });
        aiRepo.updateMessage(assistantMessage.id, { content: 'final answer' });
        aiRepo.syncMessage(assistantMessage.id);

        const syncedAssistant = getLatestChangeFor('ai_messages', assistantMessage.id);
        expect(syncedAssistant).toMatchObject({
            id: assistantMessage.id,
            conversation_id: conversation.id,
            role: 'assistant',
            content: 'final answer',
        });

        const conversationAfterAssistantSync = getLatestChangeFor(
            'ai_conversations',
            conversation.id,
        );
        expect(conversationAfterAssistantSync['id']).toEqual(conversation.id);

        const syncedUser = getLatestChangeFor('ai_messages', userMessage.id);
        expect(syncedUser).toMatchObject({
            id: userMessage.id,
            conversation_id: conversation.id,
            role: 'user',
            content: 'hello',
        });
    });

    it('does not include reading_positions in synced tables', () => {
        expect(SYNCED_TABLE_NAMES.has('reading_positions')).toBe(false);
    });
});
