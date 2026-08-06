import { describe, expect, it } from 'vitest';
import { chaptersFromOutline } from '@main/services/book/pdf-outline';
import type { PdfOutlineEntry } from '@main/services/pdf-extract.service';

function entry(title: string, page: number, level = 1): PdfOutlineEntry {
    return { title, page, level };
}

describe('chapters from the PDF outline', () => {
    it('takes the top level of a well-formed outline', () => {
        const chapters = chaptersFromOutline(
            [
                entry('Preface', 5),
                entry('Chapter One', 11),
                entry('A section', 13, 2),
                entry('Chapter Two', 40),
            ],
            120,
        );

        expect(chapters?.map((chapter) => chapter.title)).toEqual([
            'Preface',
            'Chapter One',
            'Chapter Two',
        ]);
        expect(chapters?.map((chapter) => chapter.page)).toEqual([5, 11, 40]);
        expect(chapters?.every((chapter) => chapter.level === 1)).toBe(true);
    });

    it('keeps titles in their own script', () => {
        const chapters = chaptersFromOutline(
            [entry('الفصل الأول', 3), entry('第一回', 20), entry('Глава первая', 44)],
            120,
        );

        expect(chapters).toHaveLength(3);
        expect(chapters?.[1].title).toBe('第一回');
    });

    it('accepts a coarse outline of only a few entries', () => {
        expect(
            chaptersFromOutline([entry('Part one', 1), entry('Part two', 300)], 636),
        ).toHaveLength(2);
    });

    it('refuses an outline with a single entry', () => {
        expect(chaptersFromOutline([entry('Cover', 1)], 120)).toBeNull();
    });

    it('refuses an outline that does not advance through the book', () => {
        expect(
            chaptersFromOutline([entry('One', 40), entry('Two', 11), entry('Three', 90)], 120),
        ).toBeNull();
    });

    it('refuses an outline pointing outside the document', () => {
        expect(chaptersFromOutline([entry('One', 11), entry('Two', 900)], 120)).toBeNull();
    });

    it('refuses an outline dense enough to be indexing paragraphs', () => {
        const dense = Array.from({ length: 40 }, (_, position) =>
            entry(`Entry ${position}`, position + 1),
        );

        expect(chaptersFromOutline(dense, 120)).toBeNull();
    });

    it('refuses a document that carries no outline', () => {
        expect(chaptersFromOutline([], 120)).toBeNull();
        expect(chaptersFromOutline([entry('Deep', 4, 2), entry('Deeper', 9, 3)], 120)).toBeNull();
    });
});
