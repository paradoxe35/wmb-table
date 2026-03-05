import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as documentsRepo from '@main/database/repositories/documents.repository';

describe('documents.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('custom documents CRUD', () => {
        const doc = documentsRepo.createCustomDocument('doc-1', 'My Custom Doc');
        expect(doc.title).toBe('My Custom Doc');

        expect(documentsRepo.getCustomDocuments()).toHaveLength(1);

        documentsRepo.deleteCustomDocument(doc.id);
        expect(documentsRepo.getCustomDocuments()).toHaveLength(0);
    });
});
