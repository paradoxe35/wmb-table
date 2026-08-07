import { describe, expect, it } from 'vitest';
import {
    buildParagraphsFromLines,
    detectRepeatedMarginLines,
    groupPdfItemsIntoLines,
    reorderPageLinesForReading,
} from '@main/services/pdf-extract.service';

describe('pdf-extract.service', () => {
    it('merges wrapped lines into a single paragraph', () => {
        const paragraphs = buildParagraphsFromLines([
            'This is a wrapped paragraph that continues',
            'on the next line without a blank separator.',
            '',
            'This starts a second paragraph.',
        ]);

        expect(paragraphs).toEqual([
            'This is a wrapped paragraph that continues on the next line without a blank separator.',
            'This starts a second paragraph.',
        ]);
    });

    it('keeps bullets as separate paragraphs', () => {
        const paragraphs = buildParagraphsFromLines([
            '- First point',
            '- Second point',
            'A normal paragraph follows here.',
        ]);

        expect(paragraphs).toEqual([
            '- First point',
            '- Second point',
            'A normal paragraph follows here.',
        ]);
    });

    it('separates headings from the following body paragraph', () => {
        const paragraphs = buildParagraphsFromLines([
            'THE WORST BIRTHDAY',
            'Not for the first time, an argument had broken out over breakfast.',
        ]);

        expect(paragraphs).toEqual([
            'THE WORST BIRTHDAY',
            'Not for the first time, an argument had broken out over breakfast.',
        ]);
    });

    it('does not treat interrupted dialogue dashes as soft hyphenation', () => {
        const paragraphs = buildParagraphsFromLines([
            `"I meant 'please'!" said Harry quickly. "I didn't mean -"`,
            `"WHAT HAVE I TOLD YOU," thundered his uncle.`,
        ]);

        expect(paragraphs).toEqual([
            `"I meant 'please'!" said Harry quickly. "I didn't mean -"`,
            `"WHAT HAVE I TOLD YOU," thundered his uncle.`,
        ]);
    });

    it('still merges true word hyphenation across line breaks', () => {
        const paragraphs = buildParagraphsFromLines([
            'Dynamic languages are more difficult to com-',
            'pile than statically typed ones.',
        ]);

        expect(paragraphs).toEqual([
            'Dynamic languages are more difficult to compile than statically typed ones.',
        ]);
    });

    it('splits short Chinese dialogue lines into separate paragraphs', () => {
        const paragraphs = buildParagraphsFromLines([
            '谁呀？',
            '是我，王朋，还有李友。',
            '请进，请进，快进来！',
            '来，我介绍一下，这是我姐姐，高小音。',
        ]);

        expect(paragraphs).toEqual([
            '谁呀？',
            '是我，王朋，还有李友。',
            '请进，请进，快进来！',
            '来，我介绍一下，这是我姐姐，高小音。',
        ]);
    });

    it('splits quoted Chinese dialogue into separate paragraphs', () => {
        const paragraphs = buildParagraphsFromLines(['她说：“欢迎你。”', '他回答：“谢谢。”']);

        expect(paragraphs).toEqual(['她说：“欢迎你。”', '他回答：“谢谢。”']);
    });

    it('preserves table-like tab separators as standalone lines', () => {
        const paragraphs = buildParagraphsFromLines([
            'Chapter\tPage',
            'Algebra\t1',
            'A normal paragraph follows here.',
        ]);

        expect(paragraphs).toEqual([
            'Chapter\tPage',
            'Algebra\t1',
            'A normal paragraph follows here.',
        ]);
    });

    it('keeps TOC-like lines separate in structured mode', () => {
        const paragraphs = buildParagraphsFromLines(
            ['Chapter 1 Numbers 1', 'Chapter 2 Linear Equations 35', 'Chapter 3 Real Numbers 79'],
            'structured',
        );

        expect(paragraphs).toEqual([
            'Chapter 1 Numbers 1',
            'Chapter 2 Linear Equations 35',
            'Chapter 3 Real Numbers 79',
        ]);
    });

    it('splits same-baseline content when the horizontal gap suggests separate columns', () => {
        const lines = groupPdfItemsIntoLines([
            {
                str: 'Left column text',
                width: 60,
                height: 10,
                transform: [10, 0, 0, 10, 50, 500],
                hasEOL: false,
            },
            {
                str: 'Right column text',
                width: 70,
                height: 10,
                transform: [10, 0, 0, 10, 260, 500],
                hasEOL: false,
            },
        ]);

        expect(lines).toHaveLength(2);
        expect(lines[0]?.text).toBe('Left column text');
        expect(lines[1]?.text).toBe('Right column text');
    });

    it('does not force a fake two-column reading order when clusters do not overlap vertically', () => {
        const lines = reorderPageLinesForReading([
            { text: 'Centered title', x: 220, y: 700, height: 10 },
            { text: 'Centered subtitle', x: 220, y: 680, height: 10 },
            { text: 'Centered author', x: 220, y: 660, height: 10 },
            { text: 'Centered publisher', x: 220, y: 640, height: 10 },
            { text: 'Body line 1', x: 50, y: 600, height: 10 },
            { text: 'Body line 2', x: 50, y: 580, height: 10 },
            { text: 'Body line 3', x: 50, y: 560, height: 10 },
            { text: 'Body line 4', x: 50, y: 540, height: 10 },
        ]);

        expect(lines).toEqual([
            'Centered title',
            'Centered subtitle',
            'Centered author',
            'Centered publisher',
            'Body line 1',
            'Body line 2',
            'Body line 3',
            'Body line 4',
        ]);
    });

    it('does not drop repeated margin text that appears on only two pages', () => {
        const repeated = detectRepeatedMarginLines([
            [
                { text: 'Shared Header', x: 50, y: 700, height: 10 },
                { text: 'Body 1', x: 50, y: 600, height: 10 },
            ],
            [
                { text: 'Shared Header', x: 50, y: 700, height: 10 },
                { text: 'Body 2', x: 50, y: 600, height: 10 },
            ],
        ]);

        expect(repeated.size).toBe(0);
    });
});

describe('line metadata', () => {
    const item = (
        str: string,
        x: number,
        y: number,
        extra: { width?: number; fontName?: string; dir?: string; height?: number } = {},
    ) => ({
        str,
        transform: [extra.height ?? 10, 0, 0, extra.height ?? 10, x, y],
        width: extra.width ?? str.length * 5,
        height: extra.height ?? 10,
        fontName: extra.fontName ?? 'g_d0_f2',
        dir: extra.dir ?? 'ltr',
        hasEOL: false,
    });

    it('carries the font most of the line is set in', () => {
        const [line] = groupPdfItemsIntoLines([
            item('A long stretch of body text', 40, 500),
            item('!', 180, 500, { width: 4, fontName: 'g_d0_f5' }),
        ]);

        expect(line.font).toBe('g_d0_f2');
    });

    it('reads a right-to-left line back into reading order', () => {
        // Items are laid out visually, so the first word sits furthest right.
        const [line] = groupPdfItemsIntoLines([
            item('ثالث', 40, 500, { width: 30, dir: 'rtl' }),
            item('ثاني', 80, 500, { width: 30, dir: 'rtl' }),
            item('أول', 120, 500, { width: 30, dir: 'rtl' }),
        ]);

        expect(line.rtl).toBe(true);
        expect(line.text).toBe('أول ثاني ثالث');
    });

    it('keeps an embedded left-to-right run in its own order', () => {
        const [line] = groupPdfItemsIntoLines([
            item('العربية', 40, 500, { width: 40, dir: 'rtl' }),
            item('LaTeX', 90, 500, { width: 30 }),
            item('نص', 130, 500, { width: 20, dir: 'rtl' }),
        ]);

        expect(line.text).toBe('نص LaTeX العربية');
    });

    it('measures a line from its outermost edges', () => {
        const [line] = groupPdfItemsIntoLines([
            item('right', 200, 500, { width: 40 }),
            item('left', 40, 500, { width: 40 }),
        ]);

        expect(line.x).toBe(40);
        expect(line.width).toBe(200);
    });

    it('leaves a left-to-right line untouched', () => {
        const [line] = groupPdfItemsIntoLines([
            item('first', 40, 500, { width: 30 }),
            item('second', 80, 500, { width: 40 }),
        ]);

        expect(line.rtl).toBeFalsy();
        expect(line.text).toBe('first second');
    });
});
