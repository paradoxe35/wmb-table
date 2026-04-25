import { describe, expect, it } from 'vitest';

describe('scripts/bible-db/sources', () => {
    it('builds verse rows from the getBible full translation payload shape', async () => {
        const { buildGetBibleRowsFromBooks } =
            await import('../../../../scripts/bible-db/sources.mjs');

        const { verseRows, chapterRows } = buildGetBibleRowsFromBooks(
            [
                {
                    nr: 1,
                    name: 'Génesis',
                    chapters: [
                        {
                            chapter: 1,
                            name: 'Génesis 1',
                            verses: [
                                {
                                    chapter: 1,
                                    verse: 1,
                                    name: 'Génesis 1:1',
                                    text: 'EN el principio crió Dios los cielos y la tierra. ',
                                },
                                {
                                    chapter: 1,
                                    verse: 2,
                                    name: 'Génesis 1:2',
                                    text: 'Y la tierra estaba desordenada y vacía. ',
                                },
                            ],
                        },
                    ],
                },
            ],
            'rv1858',
        );

        expect(chapterRows).toEqual([
            {
                bookName: 'Génesis',
                book: '01O',
                chapter: '1',
                contentJson: null,
                footnotesJson: null,
                audioLinksJson: null,
            },
        ]);

        expect(verseRows).toEqual([
            expect.objectContaining({
                bookName: 'Génesis',
                book: '01O',
                testament: 'O',
                chapter: '1',
                verse: '1',
                content: 'EN el principio crió Dios los cielos y la tierra.',
            }),
            expect.objectContaining({
                bookName: 'Génesis',
                book: '01O',
                testament: 'O',
                chapter: '1',
                verse: '2',
                content: 'Y la tierra estaba desordenada y vacía.',
            }),
        ]);
        expect(verseRows[0].id).toHaveLength(16);
    });
});
