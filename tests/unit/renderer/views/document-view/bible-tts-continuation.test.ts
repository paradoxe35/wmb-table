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
                sermonId: 'LUK:1',
                active: false,
                type: 'bible',
                bibleBook: 'LUK',
                bibleChapter: '1',
            },
            'Luke 1::LUK:1',
        );

        const nextTarget = resolveNextBibleChapterTarget(lukeOne, {
            Luke: { book: 'LUK', chapters: '1,2,3' },
            Revelation: { book: 'REV', chapters: '1,2,3,10,11' },
        });

        expect(nextTarget).toEqual({
            title: 'Luke 2',
            sermonId: 'LUK:2',
            bibleBook: 'LUK',
            bibleChapter: '2',
        });
    });

    it('does not continue when the current chapter is the last one in the book', () => {
        const revelationTwentyTwo = captureBiblePlaybackSource(
            {
                title: 'Revelation 22',
                sermonId: 'REV:22',
                active: true,
                type: 'bible',
                bibleBook: 'REV',
                bibleChapter: '22',
            },
            'Revelation 22::REV:22',
        );

        const nextTarget = resolveNextBibleChapterTarget(revelationTwentyTwo, {
            Revelation: { book: 'REV', chapters: '1,2,22' },
        });

        expect(nextTarget).toBeNull();
    });
});
