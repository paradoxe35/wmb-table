import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as subjectsRepo from '@main/database/repositories/subjects.repository';

describe('subjects.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('create and getAll', () => {
        const subject = subjectsRepo.create('Topic 1');
        expect(subject.name).toBe('Topic 1');
        expect(subject.active).toBe(true);

        const all = subjectsRepo.getAll();
        expect(all).toHaveLength(1);
        expect(all[0].documents).toEqual([]);
    });

    it('createItem adds item to subject', () => {
        const subject = subjectsRepo.create('Topic');
        const item = subjectsRepo.createItem(
            subject.id,
            'Doc Title',
            {
                kind: 'tree',
                documentIdentity: { documentType: 'custom', customDocumentId: 'doc-1' },
                tree: [1],
            },
            'text content',
        );
        expect(item.subjectId).toBe(subject.id);
        expect(item.documentReference).toEqual({
            kind: 'tree',
            documentIdentity: { documentType: 'custom', customDocumentId: 'doc-1' },
            tree: [1],
        });

        const items = subjectsRepo.getItems(subject.id);
        expect(items).toHaveLength(1);
    });

    it('createItem with bible', () => {
        const subject = subjectsRepo.create('Topic');
        const bible = {
            id: 'b1',
            bookName: 'Genesis',
            book: 'gen',
            testament: 'OT',
            chapter: '1',
            verse: '1',
            content: 'In the beginning...',
        };
        const item = subjectsRepo.createItem(
            subject.id,
            'Doc',
            {
                kind: 'tree',
                documentIdentity: {
                    documentType: 'bible',
                    bibleBook: 'gen',
                    bibleChapter: '1',
                    bibleVersionAbbreviation: 'KJV',
                },
                tree: [],
            },
            'text',
            { kind: 'bible-verse', bibleVerse: bible },
        );
        expect(item.documentPreview?.kind).toBe('bible-verse');
    });

    it('deleteSubject removes subject and items', () => {
        const subject = subjectsRepo.create('ToDelete');
        subjectsRepo.createItem(
            subject.id,
            'Doc',
            {
                kind: 'tree',
                documentIdentity: { documentType: 'custom', customDocumentId: 'doc-1' },
                tree: [],
            },
            'text',
        );

        subjectsRepo.deleteSubject(subject.id);
        expect(subjectsRepo.getAll()).toHaveLength(0);
        expect(subjectsRepo.getItems(subject.id)).toHaveLength(0);
    });

    it('deleteItem removes single item', () => {
        const subject = subjectsRepo.create('Topic');
        const item = subjectsRepo.createItem(
            subject.id,
            'Doc',
            {
                kind: 'tree',
                documentIdentity: { documentType: 'custom', customDocumentId: 'doc-1' },
                tree: [],
            },
            'text',
        );
        subjectsRepo.deleteItem(item.id);
        expect(subjectsRepo.getItems(subject.id)).toHaveLength(0);
    });

    it('getAll returns items correctly for multiple subjects', () => {
        const s1 = subjectsRepo.create('Subject A');
        const s2 = subjectsRepo.create('Subject B');
        const s3 = subjectsRepo.create('Subject C');

        subjectsRepo.createItem(
            s1.id,
            'Doc 1',
            {
                kind: 'tree',
                documentIdentity: { documentType: 'custom', customDocumentId: 'doc-1' },
                tree: [1],
            },
            'text 1',
        );
        subjectsRepo.createItem(
            s1.id,
            'Doc 2',
            {
                kind: 'tree',
                documentIdentity: { documentType: 'custom', customDocumentId: 'doc-2' },
                tree: [2],
            },
            'text 2',
        );
        subjectsRepo.createItem(
            s2.id,
            'Doc 3',
            {
                kind: 'tree',
                documentIdentity: { documentType: 'custom', customDocumentId: 'doc-3' },
                tree: [3],
            },
            'text 3',
        );
        // s3 has no items

        const all = subjectsRepo.getAll();
        expect(all).toHaveLength(3);

        const a = all.find((s) => s.name === 'Subject A')!;
        const b = all.find((s) => s.name === 'Subject B')!;
        const c = all.find((s) => s.name === 'Subject C')!;

        expect(a.documents).toHaveLength(2);
        expect(a.documents[0].documentTitle).toBe('Doc 1');
        expect(a.documents[1].documentTitle).toBe('Doc 2');

        expect(b.documents).toHaveLength(1);
        expect(b.documents[0].documentTitle).toBe('Doc 3');

        expect(c.documents).toHaveLength(0);
    });

    it('getAll items have correct fields', () => {
        const subject = subjectsRepo.create('Topic');
        const bible = {
            id: 'b1',
            bookName: 'Genesis',
            book: 'gen',
            testament: 'OT',
            chapter: '1',
            verse: '1',
            content: 'In the beginning...',
        };
        subjectsRepo.createItem(
            subject.id,
            'Doc',
            {
                kind: 'tree',
                documentIdentity: { documentType: 'sermon', sermonId: 'S-001', translationId: 0 },
                tree: [1, 2],
            },
            'sample text',
            { kind: 'bible-verse', bibleVerse: bible },
        );

        const all = subjectsRepo.getAll();
        const item = all[0].documents[0];
        expect(item.subjectId).toBe(subject.id);
        expect(item.documentTitle).toBe('Doc');
        expect(item.documentReference).toEqual({
            kind: 'tree',
            documentIdentity: { documentType: 'sermon', sermonId: 'S-001', translationId: 0 },
            tree: [1, 2],
        });
        expect(item.textContent).toBe('sample text');
        expect(item.documentPreview?.kind).toBe('bible-verse');
        expect(item.createdAt).toBeInstanceOf(Date);
        expect(item.updatedAt).toBeInstanceOf(Date);
    });

    it('getAllSummary returns lightweight list', () => {
        subjectsRepo.create('Topic A');
        subjectsRepo.create('Topic B');

        const summaries = subjectsRepo.getAllSummary();
        expect(summaries).toHaveLength(2);
        expect(summaries[0]).toHaveProperty('id');
        expect(summaries[0]).toHaveProperty('name');
        expect(summaries[0]).toHaveProperty('date');
    });

    it('rename updates subject name', () => {
        const subject = subjectsRepo.create('Old Name');
        subjectsRepo.rename(subject.id, 'New Name');
        const updated = subjectsRepo.getById(subject.id);
        expect(updated?.name).toBe('New Name');
    });

    it('rename rejects duplicate name', () => {
        subjectsRepo.create('Taken');
        const other = subjectsRepo.create('Original');
        expect(() => subjectsRepo.rename(other.id, 'Taken')).toThrow();
    });
});
