import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as customDocsRepo from '@main/database/repositories/custom-documents.repository';

describe('custom-documents.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('custom documents CRUD', () => {
        const doc = customDocsRepo.createCustomDocument('My Custom Doc', 'Hello world content');
        expect(doc.title).toBe('My Custom Doc');
        expect((doc as Record<string, unknown>).sermonId).toBeUndefined();

        const docs = customDocsRepo.getCustomDocuments();
        expect(docs).toHaveLength(1);
        // getCustomDocuments should not include content
        expect((docs[0] as Record<string, unknown>).content).toBeUndefined();
        expect((docs[0] as Record<string, unknown>).sermonId).toBeUndefined();

        customDocsRepo.deleteCustomDocument(doc.id);
        expect(customDocsRepo.getCustomDocuments()).toHaveLength(0);
    });

    it('getCustomDocumentContent returns content', () => {
        const doc = customDocsRepo.createCustomDocument('Doc With Content', 'Extracted PDF text');
        const content = customDocsRepo.getCustomDocumentContent(doc.id);
        expect(content).not.toBeNull();
        expect(content!.title).toBe('Doc With Content');
        expect(content!.content).toBe('Extracted PDF text');
    });

    it('getCustomDocumentContent returns null for missing id', () => {
        expect(customDocsRepo.getCustomDocumentContent('nonexistent')).toBeNull();
    });

    it('searchCustomDocuments finds matching documents with snippets', () => {
        customDocsRepo.createCustomDocument(
            'Open Book Notes',
            ['The open book is mentioned here.', 'Another open book line.'].join('\n'),
            'en',
        );
        customDocsRepo.createCustomDocument(
            'Faith Study',
            'Faith and the open book are linked.',
            'en',
        );
        customDocsRepo.createCustomDocument('Other', 'Nothing relevant.', 'fr');

        const result = customDocsRepo.searchCustomDocuments({
            query: 'open book',
            mode: 'all',
            limit: 10,
            offset: 0,
        });

        expect(result.totalDocuments).toBe(2);
        expect(result.returned).toBe(2);
        expect(result.results[0].title).toBe('Open Book Notes');
        expect(result.results[0].totalMatches).toBe(2);
        expect(result.results[0].matches[0].lineIndex).toBe(0);
        expect(result.results[1].title).toBe('Faith Study');
    });

    it('searchCustomDocuments paginates results', () => {
        customDocsRepo.createCustomDocument('Doc A', 'alpha keyword', 'en');
        customDocsRepo.createCustomDocument('Doc B', 'keyword beta', 'en');

        const first = customDocsRepo.searchCustomDocuments({
            query: 'keyword',
            mode: 'exact',
            limit: 1,
            offset: 0,
        });
        const second = customDocsRepo.searchCustomDocuments({
            query: 'keyword',
            mode: 'exact',
            limit: 1,
            offset: 1,
        });

        expect(first.returned).toBe(1);
        expect(first.hasMore).toBe(true);
        expect(second.returned).toBe(1);
        expect(second.hasMore).toBe(false);
        expect(first.results[0].documentId).not.toBe(second.results[0].documentId);
    });
});
