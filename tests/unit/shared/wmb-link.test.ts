import { describe, expect, it } from 'vitest';
import {
    buildBibleWmbLink,
    buildBookWmbLink,
    buildDocWmbLink,
    buildSermonWmbLink,
    parseWmbLink,
    type BookWmbRef,
} from '@shared/wmb-link';

describe('wmb:// links', () => {
    it('round-trips a book reference', () => {
        const ref: BookWmbRef = {
            type: 'book',
            documentId: 'doc-1',
            paragraphIndex: 412,
            printedPage: '37',
            pageParagraph: 3,
            title: 'An Exposition of the Seven Church Ages',
        };

        const href = buildBookWmbLink(ref);
        expect(href).toBe(
            'wmb://book/doc-1/412/37/3/An%20Exposition%20of%20the%20Seven%20Church%20Ages',
        );
        expect(parseWmbLink(href)).toEqual(ref);
    });

    it('round-trips a book reference on a page that carries no printed number', () => {
        const ref: BookWmbRef = {
            type: 'book',
            documentId: 'doc-1',
            paragraphIndex: 4,
            pageParagraph: 1,
            title: 'Front matter',
        };

        expect(parseWmbLink(buildBookWmbLink(ref))).toEqual(ref);
    });

    it('round-trips titles containing slashes and non-Latin scripts', () => {
        const ref: BookWmbRef = {
            type: 'book',
            documentId: 'doc-2',
            paragraphIndex: 1,
            printedPage: 'xii',
            pageParagraph: 2,
            title: 'Семь / Церковных Веков',
        };

        expect(parseWmbLink(buildBookWmbLink(ref))).toEqual(ref);
    });

    it('rejects a book link without usable numbering', () => {
        expect(parseWmbLink('wmb://book/doc-1/notanumber/12/3/Title')).toBeNull();
        expect(parseWmbLink('wmb://book//1/12/3/Title')).toBeNull();
    });

    it('leaves the other link types parsing exactly as before', () => {
        const doc = buildDocWmbLink({ type: 'doc', documentId: 'doc-1', title: 'My notes' });
        expect(parseWmbLink(doc)).toEqual({
            type: 'doc',
            documentId: 'doc-1',
            title: 'My notes',
        });

        const sermon = buildSermonWmbLink({
            type: 'sermon',
            sermonId: '63-0319',
            languageCode: 'en',
            translationId: 0,
            paragraphIndex: 12,
        });
        expect(parseWmbLink(sermon)).toEqual({
            type: 'sermon',
            sermonId: '63-0319',
            languageCode: 'en',
            translationId: 0,
            paragraphIndex: 12,
        });

        const bible = buildBibleWmbLink({
            type: 'bible',
            bookCode: 'REV',
            chapter: '3',
            verse: '14',
            bibleVersionAbbreviation: 'KJV',
            bookName: 'Revelation',
        });
        expect(parseWmbLink(bible)).toEqual({
            type: 'bible',
            bookCode: 'REV',
            chapter: '3',
            verse: '14',
            bibleVersionAbbreviation: 'kjv',
            bookName: 'Revelation',
        });
    });
});
