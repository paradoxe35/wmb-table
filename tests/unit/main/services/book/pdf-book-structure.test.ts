import { describe, expect, it } from 'vitest';
import { buildPdfBookStructure } from '@main/services/book/pdf-book-structure';
import { isUnreadableTextRun } from '@main/services/book/text-quality';
import {
    BODY_PAGES,
    CHAPTER_TITLES,
    FRONT_MATTER_PAGES,
    buildSyntheticBookLayouts,
    buildSyntheticTranscriptLayouts,
} from './book-fixtures';

const book = buildPdfBookStructure(buildSyntheticBookLayouts());

describe('pdf book structure', () => {
    it('detects a typeset book', () => {
        expect(book.detection.isBook).toBe(true);
        expect(book.detection.signals).toContain('printed-pages');
        expect(book.detection.signals).toContain('running-header');
        expect(book.detection.signals).toContain('indent-bimodal');
    });

    it('rejects a two-column transcript', () => {
        const transcript = buildPdfBookStructure(buildSyntheticTranscriptLayouts());
        expect(transcript.detection.isBook).toBe(false);
    });

    it('reads printed page numbers off the page instead of computing them', () => {
        const printed = book.structure.pages.filter((page) => page.printed);

        expect(printed).toHaveLength(BODY_PAGES);
        for (const page of printed) {
            expect(Number(page.printed)).toBe(page.index - FRONT_MATTER_PAGES);
        }
    });

    it('ignores numbers in the running footer that do not track the page sequence', () => {
        const printed = book.structure.pages.map((page) => page.printed);
        expect(printed).not.toContain('77');
        expect(printed).not.toContain('99');
    });

    it('excludes front matter from the chapters', () => {
        expect(book.structure.chapters).toHaveLength(CHAPTER_TITLES.length);
        expect(book.structure.chapters[0].page).toBe(FRONT_MATTER_PAGES + 1);
        expect(book.structure.chapters[0].title).toContain(CHAPTER_TITLES[0]);

        const frontMatter = book.structure.pages.filter((page) => page.frontMatter);
        expect(frontMatter).toHaveLength(FRONT_MATTER_PAGES);
        expect(
            book.structure.paragraphs.some((paragraph) =>
                frontMatter.some((page) => page.index === paragraph.page),
            ),
        ).toBe(true);
    });

    it('drops running headers, footers and broken-font runs from paragraph text', () => {
        for (const paragraph of book.structure.paragraphs) {
            expect(isUnreadableTextRun(paragraph.text)).toBe(false);
            expect(paragraph.text).not.toContain('REV #:');
            expect(paragraph.text.startsWith(CHAPTER_TITLES[0])).toBe(false);
        }
    });

    it('joins a paragraph that runs across a page break into the page it starts on', () => {
        const carried = book.structure.paragraphs.find((paragraph) =>
            paragraph.text.includes('carried over from the previous page'),
        );

        expect(carried).toBeDefined();
        expect(carried!.text).toMatch(/^Paragraph 3 of printed page/);
    });

    it('numbers paragraphs contiguously and per page', () => {
        const perPage = new Map<number, number>();

        book.structure.paragraphs.forEach((paragraph, position) => {
            expect(paragraph.index).toBe(position + 1);

            const expected = (perPage.get(paragraph.page) ?? 0) + 1;
            perPage.set(paragraph.page, expected);
            expect(paragraph.pageParagraph).toBe(expected);
        });
    });

    it('keeps every paragraph on exactly one known page and at most one chapter', () => {
        const pages = new Set(book.structure.pages.map((page) => page.index));
        const chapters = new Set(book.structure.chapters.map((chapter) => chapter.id));

        for (const paragraph of book.structure.paragraphs) {
            expect(pages.has(paragraph.page)).toBe(true);
            if (paragraph.chapterId) expect(chapters.has(paragraph.chapterId)).toBe(true);
        }
    });

    it('degrades to a non-book instead of throwing on degenerate documents', () => {
        const blank = { index: 1, width: 595, height: 842, rotate: 0, lines: [] };
        const rotated = buildSyntheticBookLayouts().map((layout) => ({ ...layout, rotate: 90 }));

        for (const layouts of [[], [blank], [blank, blank], rotated]) {
            const result = buildPdfBookStructure(layouts);

            expect(result.detection.confidence).toBeGreaterThanOrEqual(0);
            expect(result.structure.paragraphs.every((p, i) => p.index === i + 1)).toBe(true);
        }

        expect(buildPdfBookStructure([]).detection.isBook).toBe(false);
        expect(buildPdfBookStructure([blank]).structure.paragraphs).toEqual([]);
    });

    it('keeps printed page numbers monotonic', () => {
        const printed = book.structure.pages
            .filter((page) => page.printed)
            .map((page) => Number(page.printed));

        expect(printed).toEqual([...printed].sort((left, right) => left - right));
        expect(new Set(printed).size).toBe(printed.length);
    });
});

describe('the PDF outline as the chapter list', () => {
    const layouts = buildSyntheticBookLayouts();
    const outline = [
        { title: 'Первая глава', page: FRONT_MATTER_PAGES + 1, level: 1 },
        { title: 'Вторая глава', page: FRONT_MATTER_PAGES + 6, level: 1 },
        { title: 'Раздел', page: FRONT_MATTER_PAGES + 7, level: 2 },
    ];

    it('prefers the bookmarks over anything read off the page', () => {
        const withOutline = buildPdfBookStructure(layouts, outline);

        expect(withOutline.structure.chapters.map((chapter) => chapter.title)).toEqual([
            'Первая глава',
            'Вторая глава',
        ]);
        expect(withOutline.structure.chapters[1].page).toBe(FRONT_MATTER_PAGES + 6);
    });

    it('anchors each outline chapter to a real paragraph', () => {
        const { structure } = buildPdfBookStructure(layouts, outline);

        for (const chapter of structure.chapters) {
            const paragraph = structure.paragraphs[chapter.firstParagraph - 1];
            expect(paragraph).toBeDefined();
            expect(paragraph.page).toBeGreaterThanOrEqual(chapter.page);
        }
    });

    it('falls back to the page evidence when the outline fails its gate', () => {
        const unusable = buildPdfBookStructure(layouts, [{ title: 'Cover', page: 1, level: 1 }]);

        expect(unusable.structure.chapters.map((chapter) => chapter.title)).toEqual(
            book.structure.chapters.map((chapter) => chapter.title),
        );
    });
});
