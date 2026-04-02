import { describe, expect, it } from 'vitest';
import {
    captureBiblePlaybackSource,
    resolveNextBibleChapterTarget,
} from '@renderer/views/document-view/bible-tts-continuation';

describe('Bible TTS continuation', () => {
    it('keeps the original Bible reading context when another tab becomes active', () => {
        const lukeOne = captureBiblePlaybackSource(
            {
                title: 'Luke 1',
                documentId: 'LUK:1',
                active: false,
                type: 'bible',
                bibleBook: 'LUK',
                bibleChapter: '1',
                bibleVersionAbbreviation: 'KJV',
            },
            'bible:LUK:1:kjv',
        );

        const nextTarget = resolveNextBibleChapterTarget(lukeOne, {
            Luke: { book: 'LUK', chapters: '1,2,3', verses: '', testament: 'N' },
            Revelation: { book: 'REV', chapters: '1,2,3,10,11', verses: '', testament: 'N' },
        });

        expect(nextTarget).toEqual({
            title: 'Luke 2',
            documentId: 'LUK:2',
            bibleBook: 'LUK',
            bibleChapter: '2',
            bibleVersionAbbreviation: 'KJV',
        });
    });

    it('does not continue when the current chapter is the last one in the book', () => {
        const revelationTwentyTwo = captureBiblePlaybackSource(
            {
                title: 'Revelation 22',
                documentId: 'REV:22',
                active: true,
                type: 'bible',
                bibleBook: 'REV',
                bibleChapter: '22',
                bibleVersionAbbreviation: 'KJV',
            },
            'bible:REV:22:kjv',
        );

        const nextTarget = resolveNextBibleChapterTarget(revelationTwentyTwo, {
            Revelation: { book: 'REV', chapters: '1,2,22', verses: '', testament: 'N' },
        });

        expect(nextTarget).toBeNull();
    });
});
