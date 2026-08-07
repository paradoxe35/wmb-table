import type { PdfPageLayout, PositionedLine } from '@main/services/pdf-extract.service';

/**
 * A synthetic book reproducing the layout invariants measured on the real
 * corpus — mirrored margins, a running header carrying the chapter title, a
 * decoy-bearing footer, first-line indents and a broken-font title page —
 * without reproducing any copyrighted text.
 */

const PAGE_WIDTH = 387;
const PAGE_HEIGHT = 603;
const HEADER_Y = 564;
const FOOTER_Y = 3;
const BODY_TOP_Y = 540;
const LINE_HEIGHT = 10.5;
const LINE_STEP = 12;
const INDENT = 12;
const CHAR_WIDTH = 5;

/** Printed folios start at 1 on the fifth PDF page: the offset is never zero. */
export const FRONT_MATTER_PAGES = 4;
export const BODY_PAGES = 10;
export const CHAPTER_TITLES = ['THE FIRST MATTER', 'THE SECOND MATTER'];
export const CARRIED_TEXT = 'carried over from the previous page and ending here';

function line(
    text: string,
    x: number,
    y: number,
    height = LINE_HEIGHT,
    width = text.length * CHAR_WIDTH,
): PositionedLine {
    return { text, x, y, width, height };
}

function centred(text: string, y: number, height = LINE_HEIGHT): PositionedLine {
    const width = text.length * CHAR_WIDTH;
    return line(text, (PAGE_WIDTH - width) / 2, y, height, width);
}

function page(index: number, lines: PositionedLine[]): PdfPageLayout {
    return { index, width: PAGE_WIDTH, height: PAGE_HEIGHT, rotate: 0, lines };
}

/** Left margin alternates between verso and recto, as in the measured books. */
function textLeft(index: number): number {
    return index % 2 === 0 ? 38 : 49;
}

function frontMatter(): PdfPageLayout[] {
    return [
        // Glyph codes read as characters: capitals land on ASCII punctuation.
        page(1, [centred('4HE 3YNTHETIC "OOK', 400, 30), centred('!N !UTHOR', 300, 20)]),
        page(2, [
            line('Copyright of nobody at all. Reprinted for testing purposes.', 46, 300, 8),
            line('All rights reserved by the imaginary publisher.', 46, 288, 8),
        ]),
        page(3, [
            centred('TABLE OF CONTENTS', 500),
            line('1. The First Matter ................... 1', 48, 460),
            line('2. The Second Matter ................. 6', 48, 440),
            line('3. An Afterword ...................... 9', 48, 420),
        ]),
        page(4, []),
    ];
}

function bodyLine(index: number, text: string, y: number, indented: boolean): PositionedLine {
    const left = textLeft(index);
    const x = indented ? left + INDENT : left;
    return line(text, x, y, LINE_HEIGHT, PAGE_WIDTH - left - x);
}

function paragraph(index: number, from: number, opening: string): PositionedLine[] {
    return [
        bodyLine(index, opening, from, true),
        ...Array.from({ length: 3 }, (_, position) =>
            bodyLine(
                index,
                `continuation line ${position + 1} of the same paragraph`,
                from - (position + 1) * LINE_STEP,
                false,
            ),
        ),
    ];
}

export function buildSyntheticBookLayouts(): PdfPageLayout[] {
    const pages = frontMatter();

    for (let offset = 0; offset < BODY_PAGES; offset += 1) {
        const index = FRONT_MATTER_PAGES + 1 + offset;
        const printed = offset + 1;
        const chapter = CHAPTER_TITLES[printed <= 5 ? 0 : 1];
        const lines: PositionedLine[] = [];
        let y = BODY_TOP_Y;

        if (printed === 1 || printed === 6) {
            lines.push(centred(`CHAPTER ${printed === 1 ? 'ONE' : 'TWO'}`, y));
            lines.push(centred(chapter, y - LINE_STEP));
            y -= LINE_STEP * 3;
        } else {
            // Opens flush left: the paragraph carried over from the page before.
            lines.push(bodyLine(index, CARRIED_TEXT, y, false));
            y -= LINE_STEP;
        }

        for (let count = 0; count < 3; count += 1) {
            lines.push(
                ...paragraph(index, y, `Paragraph ${count + 1} of printed page ${printed}.`),
            );
            y -= LINE_STEP * 4;
        }

        pages.push(
            page(index, [
                line(chapter, 49, HEADER_Y, 7),
                line(String(printed), 339, HEADER_Y, 10),
                ...lines,
                // Two numbers that are not folios: neither tracks the page sequence.
                line(`REF. ${chapter} P77 REV #: 99`, 133, FOOTER_Y, 7),
            ]),
        );
    }

    return pages;
}

/**
 * A transcript: two columns, no folios, no running header — the negative class
 * the detector must reject.
 */
export function buildSyntheticTranscriptLayouts(): PdfPageLayout[] {
    return Array.from({ length: 12 }, (_, offset) => {
        const lines: PositionedLine[] = [];
        for (let position = 0; position < 20; position += 1) {
            const y = 700 - position * LINE_STEP;
            lines.push(line(`${position + 1} spoken sentence on the left column`, 60, y));
            lines.push(line(`${position + 21} spoken sentence on the right column`, 320, y));
        }
        return { index: offset + 1, width: 595, height: 842, rotate: 0, lines };
    });
}
