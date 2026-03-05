import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as documentsRepo from '@main/database/repositories/documents.repository';

describe('documents.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('getAllTitles returns empty array initially', () => {
        expect(documentsRepo.getAllTitles()).toEqual([]);
    });

    it('insertTitle inserts and retrieves a title', () => {
        const title = documentsRepo.insertTitle({
            title: 'Test',
            frTitle: 'Test FR',
            enTitle: 'Test EN',
            traduction: 'fr',
            web_link: null,
            pdf_link: null,
            audio_link: null,
            date: '2024-01-01',
            date_long: null,
            other_traductions: [{ title: 'Alt', traduction: 'en', web_link: '' }],
        });
        expect(title.id).toBeTruthy();

        const all = documentsRepo.getAllTitles();
        expect(all).toHaveLength(1);
        expect(all[0].other_traductions).toHaveLength(1);
    });

    it('custom documents CRUD', () => {
        const doc = documentsRepo.createCustomDocument('doc-1', 'My Custom Doc');
        expect(doc.title).toBe('My Custom Doc');

        expect(documentsRepo.getCustomDocuments()).toHaveLength(1);

        documentsRepo.deleteCustomDocument(doc.id);
        expect(documentsRepo.getCustomDocuments()).toHaveLength(0);
    });
});
