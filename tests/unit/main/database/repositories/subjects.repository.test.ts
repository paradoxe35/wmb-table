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
            { tree: [1] },
            'text content',
        );
        expect(item.subject).toBe(subject.id);
        expect(item.documentHtmlTree).toEqual({ tree: [1] });

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
        const item = subjectsRepo.createItem(subject.id, 'Doc', { tree: [] }, 'text', bible);
        expect(item.bible?.bookName).toBe('Genesis');
    });

    it('deleteSubject removes subject and items', () => {
        const subject = subjectsRepo.create('ToDelete');
        subjectsRepo.createItem(subject.id, 'Doc', { tree: [] }, 'text');

        subjectsRepo.deleteSubject(subject.id);
        expect(subjectsRepo.getAll()).toHaveLength(0);
        expect(subjectsRepo.getItems(subject.id)).toHaveLength(0);
    });

    it('deleteItem removes single item', () => {
        const subject = subjectsRepo.create('Topic');
        const item = subjectsRepo.createItem(subject.id, 'Doc', { tree: [] }, 'text');
        subjectsRepo.deleteItem(item.id);
        expect(subjectsRepo.getItems(subject.id)).toHaveLength(0);
    });
});
