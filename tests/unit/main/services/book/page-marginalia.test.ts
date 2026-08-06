import { describe, expect, it } from 'vitest';
import { analysePageMarginalia, parseDigits } from '@main/services/book/page-marginalia';
import type { PdfPageLayout, PositionedLine } from '@main/services/pdf-extract.service';

const HEADER_Y = 560;
const BODY_Y = 500;

function line(text: string, x: number, y: number): PositionedLine {
    return { text, x, y, width: text.length * 5, height: 10 };
}

const BODY_SENTENCES = [
    'The morning wind carried the smell of rain across the valley.',
    'Nobody had expected the letter to arrive quite so early.',
    'She counted the steps twice before opening the heavy door.',
    'A single lamp burned in the window of the empty house.',
    'They spoke of harvests, of weather, and of little else.',
    'The river had changed its course again during the winter.',
    'He kept the map folded inside his coat for safety.',
    'Every summer the same birds returned to the same eaves.',
    'It was said that the road had once run further north.',
    'The clock in the hall struck an hour that did not exist.',
    'Her answer was shorter than anyone in the room expected.',
    'By evening the fields were quiet and the lanterns were lit.',
];

function pages(header: (index: number) => PositionedLine[], count = 12): PdfPageLayout[] {
    return Array.from({ length: count }, (_, offset) => ({
        index: offset + 1,
        width: 400,
        height: 600,
        rotate: 0,
        lines: [
            ...header(offset + 1),
            line(BODY_SENTENCES[offset % BODY_SENTENCES.length], 40, BODY_Y),
            line(BODY_SENTENCES[(offset + 5) % BODY_SENTENCES.length], 40, BODY_Y - 12),
        ],
    }));
}

/** Digits of `value` rendered in the Unicode block starting at `zero`. */
function digitsIn(zero: number, value: number): string {
    return String(value)
        .split('')
        .map((digit) => String.fromCodePoint(zero + Number(digit)))
        .join('');
}

describe('running header analysis', () => {
    it('recovers a printed number at a constant non-zero offset', () => {
        const analysis = analysePageMarginalia(
            pages((index) => [line(`${index + 20}\tTHE BOOK TITLE`, 40, HEADER_Y)]),
        );

        expect(analysis.printedCoverage).toBe(1);
        expect(analysis.byPage.get(1)?.printed).toBe('21');
        expect(analysis.byPage.get(12)?.printed).toBe('32');
        expect(analysis.firstPrintedPage).toBe(1);
    });

    it('takes the whole baseline, not just the outermost fragment', () => {
        // The head and its folio are separate PDF.js items on one baseline; reading
        // only the first would lose the folio on every page that puts it right.
        const analysis = analysePageMarginalia(
            pages((index) => [
                line('THE BOOK TITLE', 40, HEADER_Y),
                line(String(index), 340, HEADER_Y - 1),
            ]),
        );

        expect(analysis.byPage.get(9)?.printed).toBe('9');
    });

    it('reads digits in any script', () => {
        for (const zero of [0x0660, 0x06f0, 0x0966, 0xff10]) {
            const analysis = analysePageMarginalia(
                pages((index) => [line(`${digitsIn(zero, index)}\tعنوان الكتاب`, 40, HEADER_Y)]),
            );

            expect(analysis.byPage.get(7)?.printed).toBe(digitsIn(zero, 7));
        }
    });

    it('ignores a number that does not track the page sequence', () => {
        const analysis = analysePageMarginalia(
            pages((index) => [
                line('EDITION 77 REVISION 99', 40, HEADER_Y),
                line(String(index), 340, HEADER_Y),
            ]),
        );

        expect(analysis.byPage.get(4)?.printed).toBe('4');
        const printed = [...analysis.byPage.values()].map((page) => page.printed);
        expect(printed).not.toContain('77');
        expect(printed).not.toContain('99');
    });

    it('never strips body text as marginalia', () => {
        const analysis = analysePageMarginalia(pages(() => []));

        expect(analysis.byPage.size).toBe(0);
        expect(analysis.printedCoverage).toBe(0);
    });

    it('reports the chapter-scoped headers as bands', () => {
        const analysis = analysePageMarginalia(
            pages((index) => [
                line(index <= 6 ? 'FIRST CHAPTER TITLE' : 'SECOND CHAPTER TITLE', 40, HEADER_Y),
                line(String(index), 340, HEADER_Y),
            ]),
        );

        expect(analysis.chapterBands.map((band) => band.startPage)).toEqual([1, 7]);
        expect(analysis.chapterBands[1].label).toBe('SECOND CHAPTER TITLE');
    });

    it('finds the head of a scan whose baseline wanders', () => {
        const jitter = [0, 7, -5, 4, -8, 2, 6, -3, 8, -6, 5, -7];
        const analysis = analysePageMarginalia(
            pages((index) => [line(`${index}\tTHE BOOK TITLE`, 40, HEADER_Y + jitter[index - 1])]),
        );

        expect(analysis.printedCoverage).toBe(1);
        expect(analysis.byPage.get(5)?.printed).toBe('5');
    });

    it('refuses a sequence too short to be a folio', () => {
        const analysis = analysePageMarginalia(
            pages((index) => [line(`${index}\tTHE BOOK TITLE`, 40, HEADER_Y)], 4),
        );

        expect(analysis.printedCoverage).toBe(0);
    });
});

describe('folio sequences that restart', () => {
    it('reads both volumes of a file that numbers each from one', () => {
        const analysis = analysePageMarginalia(
            pages(
                (index) => [
                    line(`${index <= 12 ? index : index - 12}\tTHE BOOK TITLE`, 40, HEADER_Y),
                ],
                24,
            ),
        );

        expect(analysis.byPage.get(5)?.printed).toBe('5');
        expect(analysis.byPage.get(17)?.printed).toBe('5');
        expect(analysis.printedCoverage).toBe(1);
    });

    it('leaves roman front matter unnumbered rather than guessing', () => {
        const roman = ['i', 'ii', 'iii', 'iv', 'v', 'vi'];
        const analysis = analysePageMarginalia(
            pages(
                (index) => [
                    line(
                        `${index <= 6 ? roman[index - 1] : index - 6}\tTHE BOOK TITLE`,
                        40,
                        HEADER_Y,
                    ),
                ],
                18,
            ),
        );

        expect(analysis.byPage.get(3)?.printed).toBeUndefined();
        expect(analysis.byPage.get(10)?.printed).toBe('4');
        expect(analysis.firstPrintedPage).toBe(7);
    });

    it('fills a page the head numbered inside an established run', () => {
        // One page carries only its folio; the run around it is what confirms it.
        const analysis = analysePageMarginalia(
            pages((index) =>
                index === 6
                    ? [line('6', 340, HEADER_Y)]
                    : [line(`${index}\tTHE BOOK TITLE`, 40, HEADER_Y)],
            ),
        );

        expect(analysis.byPage.get(6)?.printed).toBe('6');
    });
});

describe('digit parsing', () => {
    it('reads a run of decimal digits in any script', () => {
        expect(parseDigits('42')).toBe(42);
        expect(parseDigits(digitsIn(0x06f0, 128))).toBe(128);
        expect(parseDigits(digitsIn(0x0966, 7))).toBe(7);
    });

    it('refuses anything that is not a decimal digit', () => {
        expect(parseDigits('iv')).toBeNull();
        expect(parseDigits('4a')).toBeNull();
        expect(parseDigits('')).toBe(0);
    });
});
