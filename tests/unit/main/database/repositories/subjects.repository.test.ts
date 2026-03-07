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
        subjectsRepo.create('Topic');
        const item = subjectsRepo.createItem('Topic', 'Doc Title', { tree: [1] }, 'text content');
        expect(item.subject).toBe('Topic');
        expect(item.documentHtmlTree).toEqual({ tree: [1] });

        const items = subjectsRepo.getItems('Topic');
        expect(items).toHaveLength(1);
    });

    it('createItem with bible', () => {
        subjectsRepo.create('Topic');
        const bible = {
            id: 'b1',
            bookName: 'Genesis',
            book: 'gen',
            testament: 'OT',
            chapter: '1',
            verse: '1',
            content: 'In the beginning...',
        };
        const item = subjectsRepo.createItem('Topic', 'Doc', { tree: [] }, 'text', bible);
        expect(item.bible?.bookName).toBe('Genesis');
    });

    it('deleteSubject removes subject and items', () => {
        subjectsRepo.create('ToDelete');
        subjectsRepo.createItem('ToDelete', 'Doc', { tree: [] }, 'text');

        subjectsRepo.deleteSubject('ToDelete');
        expect(subjectsRepo.getAll()).toHaveLength(0);
        expect(subjectsRepo.getItems('ToDelete')).toHaveLength(0);
    });

    it('deleteItem removes single item', () => {
        subjectsRepo.create('Topic');
        const item = subjectsRepo.createItem('Topic', 'Doc', { tree: [] }, 'text');
        subjectsRepo.deleteItem(item.id);
        expect(subjectsRepo.getItems('Topic')).toHaveLength(0);
    });
});
