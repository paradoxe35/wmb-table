import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as highlightsRepo from '@main/database/repositories/highlights.repository';

describe('highlights.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('create inserts multiple paragraphs in one call', () => {
        const items = highlightsRepo.create({
            documentTitle: 'Sermon A',
            documentIdentity: { documentType: 'sermon', sermonId: 'S-001', translationId: 0 },
            textSnippet: 'some text',
            color: '#FF0000',
            languageCode: 'en',
            paragraphs: [
                { paragraphIndex: 1, startOffset: 0, endOffset: 10 },
                { paragraphIndex: 2, startOffset: 5, endOffset: 15 },
                { paragraphIndex: 3, startOffset: 0, endOffset: 20 },
            ],
        });

        expect(items).toHaveLength(3);
        // All share the same groupId
        const groupId = items[0].groupId;
        expect(items.every((i) => i.groupId === groupId)).toBe(true);
    });

    it('create returns correct fields', () => {
        const items = highlightsRepo.create({
            documentTitle: 'Doc',
            documentIdentity: { documentType: 'sermon', sermonId: 'S-002', translationId: 1 },
            textSnippet: 'snippet',
            color: '#00FF00',
            comment: 'a comment',
            languageCode: 'fr',
            paragraphs: [{ paragraphIndex: 5, startOffset: 2, endOffset: 8 }],
        });

        expect(items).toHaveLength(1);
        const item = items[0];
        expect(item.documentTitle).toBe('Doc');
        expect(item.documentIdentity).toEqual({
            documentType: 'sermon',
            sermonId: 'S-002',
            translationId: 1,
        });
        expect(item.color).toBe('#00FF00');
        expect(item.comment).toBe('a comment');
        expect(item.paragraphIndex).toBe(5);
    });

    it('getByDocument retrieves created highlights', () => {
        highlightsRepo.create({
            documentTitle: 'Sermon A',
            documentIdentity: { documentType: 'sermon', sermonId: 'S-001', translationId: 0 },
            textSnippet: 'text',
            color: '#FF0000',
            languageCode: 'en',
            paragraphs: [{ paragraphIndex: 1, startOffset: 0, endOffset: 10 }],
        });

        const results = highlightsRepo.getByDocument({
            documentType: 'sermon',
            sermonId: 'S-001',
            translationId: 0,
        });
        expect(results).toHaveLength(1);
    });

    it('deleteHighlight removes entire group', () => {
        const items = highlightsRepo.create({
            documentTitle: 'Doc',
            documentIdentity: { documentType: 'sermon', sermonId: 'S-001', translationId: 0 },
            textSnippet: 'text',
            color: '#FF0000',
            languageCode: 'en',
            paragraphs: [
                { paragraphIndex: 1, startOffset: 0, endOffset: 10 },
                { paragraphIndex: 2, startOffset: 0, endOffset: 10 },
            ],
        });

        highlightsRepo.deleteHighlight(items[0].id);
        const remaining = highlightsRepo.getByDocument({
            documentType: 'sermon',
            sermonId: 'S-001',
            translationId: 0,
        });
        expect(remaining).toHaveLength(0);
    });

    it('update changes color and comment', () => {
        const items = highlightsRepo.create({
            documentTitle: 'Doc',
            documentIdentity: { documentType: 'sermon', sermonId: 'S-001', translationId: 0 },
            textSnippet: 'text',
            color: '#FF0000',
            languageCode: 'en',
            paragraphs: [{ paragraphIndex: 1, startOffset: 0, endOffset: 10 }],
        });

        const updated = highlightsRepo.update(items[0].id, { color: '#0000FF', comment: 'new' });
        expect(updated).not.toBeNull();
        expect(updated!.color).toBe('#0000FF');
        expect(updated!.comment).toBe('new');
    });

    it('search paginates by group', () => {
        // Create 3 separate highlight groups
        for (let i = 0; i < 3; i++) {
            highlightsRepo.create({
                documentTitle: `Doc ${i}`,
                documentIdentity: {
                    documentType: 'sermon',
                    sermonId: `S-00${i}`,
                    translationId: 0,
                },
                textSnippet: `text ${i}`,
                color: '#FF0000',
                languageCode: 'en',
                paragraphs: [{ paragraphIndex: 0, startOffset: 0, endOffset: 5 }],
            });
        }

        const result = highlightsRepo.search('', 0, 2, 'en');
        expect(result.total).toBe(3);
        expect(result.hasMore).toBe(true);
    });
});
