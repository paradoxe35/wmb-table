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

        const docs = customDocsRepo.getCustomDocuments();
        expect(docs).toHaveLength(1);
        // getCustomDocuments should not include content
        expect((docs[0] as Record<string, unknown>).content).toBeUndefined();

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
});
