import { describe, expect, it } from 'vitest';

describe('scripts/bible-db/content', () => {
    it('flattens helloao verse content into searchable plain text', async () => {
        const { flattenHelloaoContent } = await import('../../../../scripts/bible-db/content.mjs');

        const text = flattenHelloaoContent([
            'And God said, ',
            { text: 'Let there be light' },
            { noteId: 4 },
            '.',
            { lineBreak: true },
            { heading: 'The First Day' },
        ]);

        expect(text).toBe('And God said, Let there be light.\nThe First Day');
    });

    it('starts poem lines on their own lines when helloao marks them as poetry', async () => {
        const { flattenHelloaoContent } = await import('../../../../scripts/bible-db/content.mjs');

        const text = flattenHelloaoContent([
            'Lémec dit à ses femmes:',
            { text: 'Ada et Tsilla, écoutez ma voix!', poem: 1 },
            { lineBreak: true },
            { text: 'Femmes de Lémec, écoutez ma parole!', poem: 1 },
            { lineBreak: true },
            { text: 'J’ai tué un homme pour ma blessure,', poem: 1 },
            { lineBreak: true },
            { text: 'Et un jeune homme pour ma meurtrissure.', poem: 1 },
            { lineBreak: true },
        ]);

        expect(text).toBe(
            'Lémec dit à ses femmes:\nAda et Tsilla, écoutez ma voix!\nFemmes de Lémec, écoutez ma parole!\nJ’ai tué un homme pour ma blessure,\nEt un jeune homme pour ma meurtrissure.',
        );
    });

    it('ignores chapter-level headings, subtitles, and breaks when building verse rows', async () => {
        const { buildHelloaoChapterVerses } =
            await import('../../../../scripts/bible-db/content.mjs');

        const verses = buildHelloaoChapterVerses(
            [
                { type: 'heading', content: ['The', 'Creation'] },
                { type: 'line_break' },
                { type: 'hebrew_subtitle', content: ['A Psalm', { noteId: 4 }] },
                { type: 'line_break' },
                {
                    type: 'verse',
                    number: 1,
                    content: ['In the beginning', { noteId: 1 }, 'God created.'],
                },
                { type: 'line_break' },
                {
                    type: 'verse',
                    number: 2,
                    content: ['Now the earth was formless.'],
                },
            ],
            [
                { noteId: 1, text: 'Verse note', caller: '+' },
                { noteId: 4, text: 'Subtitle note', caller: '+' },
            ],
        );

        expect(verses).toEqual([
            {
                verse: '1',
                content: 'In the beginning God created.',
                footnotes: [{ noteId: 1, text: 'Verse note', caller: '+' }],
            },
            {
                verse: '2',
                content: 'Now the earth was formless.',
                footnotes: [],
            },
        ]);
    });

    it('collects only the footnotes referenced by a verse', async () => {
        const { selectHelloaoFootnotesForVerse } =
            await import('../../../../scripts/bible-db/content.mjs');

        const footnotes = selectHelloaoFootnotesForVerse(
            ['Start ', { noteId: 2 }, ' end', { noteId: 1 }],
            [
                { noteId: 1, text: 'First note', caller: '+' },
                { noteId: 2, text: 'Second note', caller: '+' },
                { noteId: 3, text: 'Unused note', caller: '+' },
            ],
        );

        expect(footnotes).toEqual([
            { noteId: 1, text: 'First note', caller: '+' },
            { noteId: 2, text: 'Second note', caller: '+' },
        ]);
    });
});
