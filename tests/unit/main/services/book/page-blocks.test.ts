import { describe, expect, it } from 'vitest';
import {
    analysePageStructure,
    countColumns,
    measureTypography,
} from '@main/services/book/page-blocks';
import type { PdfPageLayout, PositionedLine } from '@main/services/pdf-extract.service';

const PAGE: Omit<PdfPageLayout, 'lines'> = { index: 1, width: 400, height: 600, rotate: 0 };

interface LineOptions {
    width?: number;
    height?: number;
    font?: string;
    rtl?: boolean;
}

function line(text: string, x: number, y: number, options: LineOptions = {}): PositionedLine {
    return {
        text,
        x,
        y,
        width: options.width ?? 320 - (x - 40),
        height: options.height ?? 10,
        font: options.font ?? 'body',
        ...(options.rtl ? { rtl: true } : {}),
    };
}

/** Two indented openings around a wrapped continuation, in any script. */
function indentedPage(openings: [string, string], continuation: string): PositionedLine[] {
    return [
        line(openings[0], 52, 500),
        line(continuation, 40, 488),
        line(continuation, 40, 476),
        line(openings[1], 52, 464),
        line(continuation, 40, 452),
        line(continuation, 40, 440),
    ];
}

/** Flush-left lines evenly spaced, with wider gaps opening each block. */
function blockSpacedPage(blocks: number[][]): PositionedLine[] {
    const lines: PositionedLine[] = [];
    let y = 540;
    for (const block of blocks) {
        y -= 20;
        for (const width of block) {
            lines.push(line('a line of running text', 40, y, { width }));
            y -= 12;
        }
    }
    return lines;
}

function roles(lines: PositionedLine[], layout = PAGE): string[] {
    return analysePageStructure({ ...layout, lines: [] }, lines).blocks.map((block) => block.role);
}

describe('page block segmentation', () => {
    it('splits paragraphs on the first-line indent', () => {
        const structure = analysePageStructure(
            { ...PAGE, lines: [] },
            indentedPage(
                ['First opening line', 'Second opening line'],
                'wrapped continuation line',
            ),
        );

        expect(structure.indented).toBe(true);
        expect(structure.blocks.map((block) => block.role)).toEqual(['paragraph', 'paragraph']);
        expect(structure.blocks[0].lines).toHaveLength(3);
    });

    it('works the same on non-Latin scripts', () => {
        const structure = analysePageStructure(
            { ...PAGE, lines: [] },
            indentedPage(
                ['Первый абзац начинается', 'Второй абзац начинается'],
                'продолжение строки',
            ),
        );

        expect(structure.blocks).toHaveLength(2);
    });

    it('treats a page opening flush left as continuing the previous page', () => {
        expect(
            roles([
                line('continues from the page before', 40, 500),
                line('and wraps once more here', 40, 488),
                line('A new indented paragraph', 52, 476),
                line('wrapping onto a second line', 40, 464),
            ]),
        ).toEqual(['continuation', 'paragraph']);
    });

    it('does not mistake a short final line of a paragraph for a title', () => {
        const structure = analysePageStructure({ ...PAGE, lines: [] }, [
            line('An indented opening line', 52, 500),
            line('wrapped continuation line', 40, 488),
            line('short tail', 40, 476, { width: 60 }),
            line('Another indented opening', 52, 464),
        ]);

        expect(structure.blocks.every((block) => block.role !== 'heading')).toBe(true);
    });
});

describe('paragraphs separated by space instead of indent', () => {
    it('opens a paragraph on the wider gap', () => {
        const structure = analysePageStructure(
            { ...PAGE, lines: [] },
            blockSpacedPage([
                [320, 320, 200],
                [320, 320, 180],
                [320, 320, 240],
            ]),
        );

        expect(structure.indented).toBe(false);
        expect(structure.blockSpaced).toBe(true);
        expect(structure.blocks.map((block) => block.role)).toEqual([
            'continuation',
            'paragraph',
            'paragraph',
        ]);
    });

    it('does not read block spacing into an evenly leaded page', () => {
        const lines = Array.from({ length: 10 }, (_, position) =>
            line('an evenly leaded line', 40, 500 - position * 12),
        );

        expect(analysePageStructure({ ...PAGE, lines: [] }, lines).blockSpaced).toBe(false);
    });

    it('ignores spacing on a page with too few lines to judge it', () => {
        const structure = analysePageStructure({ ...PAGE, lines: [] }, [
            line('one line', 40, 500),
            line('another line far below', 40, 440),
        ]);

        expect(structure.blockSpaced).toBe(false);
    });
});

describe('heading detection', () => {
    const body = (from: number, count = 8) =>
        Array.from({ length: count }, (_, position) =>
            line('a line of ordinary body text', 40, from - position * 12),
        );

    it('recognises a centred title and the wider line that wraps it', () => {
        const structure = analysePageStructure({ ...PAGE, lines: [] }, [
            line('CHAPTER ONE', 172, 540, { width: 56 }),
            line('THE LONGER TITLE THAT WRAPS', 92, 528, { width: 216 }),
            line('An indented opening line', 52, 500),
            line('wrapped continuation line', 40, 488),
            line('wrapped continuation line', 40, 476),
            line('Another indented opening', 52, 464),
        ]);

        expect(structure.blocks[0].role).toBe('heading');
        expect(structure.blocks[0].lines).toHaveLength(2);
    });

    it('recognises a heading set flush left in a larger size', () => {
        const structure = analysePageStructure({ ...PAGE, lines: [] }, [
            line('Chapter 1', 40, 540, { width: 90, height: 22 }),
            ...body(516),
        ]);

        expect(structure.blocks[0].role).toBe('heading');
        expect(structure.blocks[0].lines[0].text).toBe('Chapter 1');
    });

    it('recognises a heading set at body size in a different face', () => {
        const structure = analysePageStructure({ ...PAGE, lines: [] }, [
            line('A Section Of The Book', 40, 540, { width: 120, font: 'display' }),
            ...body(516),
        ]);

        expect(structure.blocks[0].role).toBe('heading');
    });

    it('refuses a heading when only white space and shortness suggest one', () => {
        const structure = analysePageStructure({ ...PAGE, lines: [] }, [
            line('a short line with nothing else to it', 40, 540, { width: 120 }),
            ...body(516),
        ]);

        expect(structure.blocks[0].role).not.toBe('heading');
    });

    it('never reads a line smaller than the body as a heading', () => {
        // Ruby, footnotes and marginal notes are short, spaced and differently set.
        const structure = analysePageStructure({ ...PAGE, lines: [] }, [
            ...body(540, 4),
            line('ふりがな', 40, 470, { width: 40, height: 5, font: 'ruby' }),
            ...body(450, 4),
        ]);

        expect(structure.blocks.every((block) => block.role !== 'heading')).toBe(true);
    });

    it('merges a chapter number and the title beneath it into one heading', () => {
        const structure = analysePageStructure({ ...PAGE, lines: [] }, [
            line('Chapter 1', 40, 560, { width: 70, height: 20 }),
            line('Things You Need To Know', 40, 530, { width: 200, height: 24 }),
            ...body(500),
        ]);

        expect(structure.blocks[0].role).toBe('heading');
        expect(structure.blocks[0].lines).toHaveLength(2);
    });

    it('finds nothing to head a page that has no headings at all', () => {
        expect(roles(body(540, 12)).filter((role) => role === 'heading')).toEqual([]);
    });
});

describe('right-to-left pages', () => {
    /** Mirrors an LTR page: the column edge is on the right, indents run inward. */
    function rtlPage(): PositionedLine[] {
        const right = 360;
        const at = (width: number, y: number, indent = 0) =>
            line('نص عربي في سطر', right - width - indent, y, { width, rtl: true });

        return [
            at(200, 500, 12),
            at(320, 488),
            at(320, 476),
            at(200, 464, 12),
            at(320, 452),
            at(320, 440),
        ];
    }

    it('reads the indent from the right edge', () => {
        const structure = analysePageStructure({ ...PAGE, lines: [] }, rtlPage());

        expect(structure.indented).toBe(true);
        expect(structure.blocks.map((block) => block.role)).toEqual(['paragraph', 'paragraph']);
    });

    it('recognises a heading set against the right edge', () => {
        const lines = rtlPage();
        const structure = analysePageStructure({ ...PAGE, lines: [] }, [
            line('الفصل الأول', 360 - 80, 540, { width: 80, height: 20, rtl: true }),
            ...lines,
        ]);

        expect(structure.blocks[0].role).toBe('heading');
    });
});

describe('marginal numbers', () => {
    it('drops verse numbers printed outside the text column', () => {
        const lines: PositionedLine[] = [];
        for (let position = 0; position < 10; position += 1) {
            lines.push(
                line('a line of verse in the column', 40, 500 - position * 15, { width: 220 }),
            );
            if (position % 5 === 0) {
                lines.push(line(String(570 + position), 340, 502 - position * 15, { width: 14 }));
            }
        }

        const structure = analysePageStructure({ ...PAGE, lines: [] }, lines);
        const text = structure.blocks.flatMap((block) => block.lines).map((l) => l.text);

        expect(text).not.toContain('570');
        expect(text).not.toContain('575');
    });

    it('keeps them when one over-wide line reaches into the margin', () => {
        // The column measure must ignore the outlier, or the margin hides inside it.
        const lines: PositionedLine[] = [];
        for (let position = 0; position < 20; position += 1) {
            lines.push(
                line('a line of verse in the column', 40, 500 - position * 15, { width: 220 }),
            );
        }
        lines.push(line('a line that ran into the number\t225', 40, 190, { width: 314 }));
        lines.push(line('570', 340, 502, { width: 14 }));

        const text = analysePageStructure({ ...PAGE, lines: [] }, lines)
            .blocks.flatMap((block) => block.lines)
            .map((l) => l.text);

        expect(text).not.toContain('570');
    });
});

describe('columns', () => {
    function twoColumnLines(): PositionedLine[] {
        const lines: PositionedLine[] = [];
        for (let position = 0; position < 12; position += 1) {
            const y = 500 - position * 12;
            lines.push(line('left column text', 40, y, { width: 140 }));
            lines.push(line('right column text', 220, y, { width: 140 }));
        }
        return lines;
    }

    it('counts the columns of a two-column page', () => {
        expect(countColumns({ ...PAGE, lines: [] }, twoColumnLines())).toBe(2);
    });

    it('segments each column on its own rather than losing the page', () => {
        const lines = twoColumnLines();
        const structure = analysePageStructure({ ...PAGE, lines: [] }, lines);

        expect(structure.columns).toBe(2);
        expect(structure.indented).toBe(false);
        expect(structure.blocks.flatMap((block) => block.lines)).toHaveLength(lines.length);
    });

    it('does not call the ragged edge of a paragraph a column break', () => {
        const lines = Array.from({ length: 14 }, (_, position) =>
            line('justified body text', 40, 500 - position * 12, {
                width: position % 3 === 0 ? 250 : 320,
            }),
        );

        expect(countColumns({ ...PAGE, lines: [] }, lines)).toBe(1);
    });

    it('measures a rotated page across its visual width', () => {
        const rotated: Omit<PdfPageLayout, 'lines'> = {
            index: 1,
            width: 600,
            height: 800,
            rotate: 90,
        };
        const lines: PositionedLine[] = [];
        for (let position = 0; position < 12; position += 1) {
            const y = 500 - position * 12;
            lines.push(line('left column text', 60, y, { width: 300 }));
            lines.push(line('right column text', 440, y, { width: 300 }));
        }

        expect(countColumns({ ...rotated, lines: [] }, lines)).toBe(2);
    });
});

describe('degenerate pages', () => {
    it('returns nothing for a blank page', () => {
        const structure = analysePageStructure({ ...PAGE, lines: [] }, []);

        expect(structure.blocks).toEqual([]);
        expect(structure.indented).toBe(false);
        expect(structure.blockSpaced).toBe(false);
    });

    it('handles a page holding a single line', () => {
        const structure = analysePageStructure({ ...PAGE, lines: [] }, [
            line('the only line on the page', 40, 500),
        ]);

        expect(structure.blocks).toHaveLength(1);
        expect(structure.columns).toBe(1);
    });
});

describe('document typography', () => {
    it('takes the em and the leading from the commonest line', () => {
        const typography = measureTypography([
            [
                line('title', 40, 540, { height: 22 }),
                ...Array.from({ length: 9 }, (_, position) =>
                    line('body', 40, 500 - position * 14),
                ),
            ],
        ]);

        expect(typography.em).toBe(10);
        expect(typography.leading).toBe(14);
    });

    it('counts only the faces the body is actually set in', () => {
        const typography = measureTypography([
            [
                ...Array.from({ length: 20 }, (_, position) =>
                    line('body', 40, 500 - position * 12),
                ),
                line('A Heading At Body Size', 40, 240, { font: 'display' }),
            ],
        ]);

        expect([...typography.bodyFonts]).toEqual(['body']);
    });

    it('reports the document direction', () => {
        const rtl = measureTypography([
            Array.from({ length: 6 }, (_, position) =>
                line('نص', 40, 500 - position * 12, { rtl: true }),
            ),
        ]);

        expect(rtl.rtl).toBe(true);
        expect(measureTypography([[line('text', 40, 500)]]).rtl).toBe(false);
    });

    it('survives a document with no lines', () => {
        const typography = measureTypography([[]]);

        expect(typography.em).toBeGreaterThan(0);
        expect(typography.leading).toBeGreaterThan(0);
    });
});
