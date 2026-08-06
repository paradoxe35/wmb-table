import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { buildImportedDocumentContent } from '@main/services/book/book-import.service';
import { parseDigits } from '@main/services/book/page-marginalia';
import { isUnreadableTextRun } from '@main/services/book/text-quality';
import { isStandalonePageNumber } from '@main/services/pdf-extract.service';
import { parseDocumentContent } from '@shared/book-content';
import type { StructuredDocumentContent } from '@shared/types';

/**
 * Accuracy gate against real files. The VGR books are copyrighted and the
 * third-party set is large, so nothing here is committed: run
 * `scripts/fetch-book-corpus.sh` and set CORPUS_DIR to enable.
 */
const CORPUS = process.env.CORPUS_DIR;
const VGR = ['ages-en.pdf', "FRNBK-AGES Expose du Sept ages de l'eglise VGR.pdf"];

const MIME: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.epub': 'application/epub+zip',
};

interface Expectation {
    /** Where the file sits under CORPUS_DIR/third-party. */
    file: string;
    script: string;
    /** False where the source defeats extraction and the plain reader must win. */
    book: boolean;
    /** Lower bound taken from the book's own table of contents. */
    chapters?: number;
    /** Share of pages that must carry a printed folio. */
    printed?: number;
}

/**
 * One row per third-party book, with the bound each figure has to clear. The
 * chapter counts come from each book's own contents page; where a source is
 * marked `book: false` the extractor must fall back rather than guess.
 */
const THIRD_PARTY: Expectation[] = [
    { file: 'latex-en-lshort.pdf', script: 'Latin', book: true, chapters: 8, printed: 0.85 },
    { file: 'latex-de-l2kurz.pdf', script: 'Latin', book: true, chapters: 6, printed: 0.85 },
    { file: 'latex-fr-lshort.pdf', script: 'Latin', book: true, chapters: 8, printed: 0.85 },
    { file: 'latex-es-lshort.pdf', script: 'Latin', book: true, chapters: 8, printed: 0.85 },
    { file: 'latex-it-lshort.pdf', script: 'Latin', book: true, chapters: 8, printed: 0.85 },
    { file: 'latex-pt-lshort.pdf', script: 'Latin', book: true, chapters: 6, printed: 0.85 },
    { file: 'latex-tr-lshort.pdf', script: 'Latin', book: true, chapters: 8, printed: 0.85 },
    { file: 'latex-vi-lshort.pdf', script: 'Latin', book: true, chapters: 8, printed: 0.85 },
    { file: 'latex-ru-lshort.pdf', script: 'Cyrillic', book: true, chapters: 6, printed: 0.85 },
    { file: 'latex-ko-lshort.pdf', script: 'Hangul', book: true, chapters: 8, printed: 0.9 },
    { file: 'latex-zh-lshort.pdf', script: 'Han', book: true, chapters: 8, printed: 0.9 },
    { file: 'latex-fa-lshort.pdf', script: 'Arabic (RTL)', book: true, chapters: 8, printed: 0.85 },
    // Legacy TIS-620 font with no usable ToUnicode map: neither text nor folios
    // survive extraction, so the plain reader has to take it.
    { file: 'latex-th-lshort.pdf', script: 'Thai', book: false },
    {
        file: 'ws-ru-crime-punishment.pdf',
        script: 'Cyrillic',
        book: true,
        chapters: 40,
        printed: 1,
    },
    { file: 'ws-el-iliad.pdf', script: 'Greek', book: true, chapters: 24, printed: 1 },
    { file: 'ws-el-fonissa.pdf', script: 'Greek', book: true, chapters: 15, printed: 1 },
    // The renderer embedded the CJK font with no usable ToUnicode map, so PDF.js
    // reads the body as NUL: structure over text that cannot be read is a trap.
    { file: 'ws-zh-laocan.pdf', script: 'Han', book: false },
    { file: 'ws-ja-neko.pdf', script: 'Kana', book: true, chapters: 2, printed: 1 },
    { file: 'ws-ar-kalila.pdf', script: 'Arabic (RTL)', book: true, chapters: 15, printed: 1 },
    { file: 'ws-he-or-hatzafon.pdf', script: 'Hebrew (RTL)', book: true, chapters: 2, printed: 1 },
    { file: 'ws-de-faust.pdf', script: 'Latin', book: true, chapters: 2, printed: 1 },
    { file: 'ws-fr-miserables.pdf', script: 'Latin', book: true, chapters: 40, printed: 1 },
    { file: 'scan-en-walden.pdf', script: 'Latin (OCR)', book: true, chapters: 2, printed: 0.55 },
    {
        file: 'scan-en-pride-prejudice.pdf',
        script: 'Latin (OCR)',
        book: true,
        chapters: 40,
        printed: 0.75,
    },
    // OCR recovers too few folios to cite from; structure without citations is
    // worse than none.
    { file: 'scan-en-mobydick.pdf', script: 'Latin (OCR)', book: false },
    { file: 'scan-fr-miserables.pdf', script: 'Latin (OCR)', book: false },
    { file: 'epub-en-pride.epub', script: 'Latin', book: true, chapters: 60 },
    { file: 'epub-ru-crime.epub', script: 'Cyrillic', book: true, chapters: 40 },
    { file: 'epub-zh-sanguo.epub', script: 'Han', book: true, chapters: 40 },
];

async function importDocument(file: string) {
    const bytes = new Uint8Array(await readFile(file));
    const { content } = await buildImportedDocumentContent(
        { fileName: basename(file), mimeType: MIME[extname(file)] ?? '', bytes },
        { structure: 'auto' },
    );
    return parseDocumentContent(content);
}

/** Every paragraph belongs to one known page, numbered contiguously and per page. */
function expectStructuralInvariants(structure: StructuredDocumentContent): void {
    const knownPages = new Set(structure.pages.map((page) => page.index));
    const knownChapters = new Set(structure.chapters.map((chapter) => chapter.id));
    const perPage = new Map<number, number>();

    structure.paragraphs.forEach((paragraph, position) => {
        expect(paragraph.index).toBe(position + 1);
        expect(knownPages.has(paragraph.page)).toBe(true);
        if (paragraph.chapterId) expect(knownChapters.has(paragraph.chapterId)).toBe(true);

        const expected = (perPage.get(paragraph.page) ?? 0) + 1;
        perPage.set(paragraph.page, expected);
        expect(paragraph.pageParagraph).toBe(expected);
    });

    for (const chapter of structure.chapters) {
        expect(structure.paragraphs[chapter.firstParagraph - 1]).toBeDefined();
    }
}

/**
 * Folios advance by one per page. A book may restart them — roman front matter,
 * or two volumes in one file — so the run is allowed to break, but never to
 * wander: a folio that neither continues its run nor starts a new one is a
 * misread number and would cite the wrong page.
 */
function folioRunLengths(structure: StructuredDocumentContent): number[] {
    const numbered = structure.pages
        .filter((page) => page.printed != null)
        .map((page) => ({ page: page.index, value: parseDigits(page.printed!) }))
        .filter((entry): entry is { page: number; value: number } => entry.value !== null);

    const runs: number[] = [];
    let offset: number | null = null;
    for (const entry of numbered) {
        const current = entry.value - entry.page;
        if (current === offset) runs[runs.length - 1] += 1;
        else runs.push(1);
        offset = current;
    }
    return runs;
}

function printedCoverage(structure: StructuredDocumentContent): number {
    const body = structure.pages.filter((page) => !page.frontMatter);
    return body.length === 0 ? 0 : body.filter((page) => page.printed != null).length / body.length;
}

function junkRatio(structure: StructuredDocumentContent): number {
    if (structure.paragraphs.length === 0) return 0;
    const junk = structure.paragraphs.filter(
        (paragraph) =>
            isUnreadableTextRun(paragraph.text) || isStandalonePageNumber(paragraph.text.trim()),
    );
    return junk.length / structure.paragraphs.length;
}

describe.skipIf(!CORPUS)('book accuracy (real corpus)', () => {
    it.each(VGR)('%s parses with full page attribution', { timeout: 300_000 }, async (file) => {
        const parsed = await importDocument(join(CORPUS!, file));
        expect(parsed.kind).toBe('book');
        if (parsed.kind !== 'book') return;

        const { paragraphs, pages, chapters, detection } = parsed.structure;
        const knownPages = new Set(pages.map((page) => page.index));
        const attributed = paragraphs.filter((p) => p.page != null && knownPages.has(p.page));
        const printed = pages.map((page) => Number(page.printed)).filter(Number.isFinite);

        expect(detection.confidence).toBeGreaterThanOrEqual(0.7);
        expect(attributed.length / paragraphs.length).toBe(1);
        expect(printed.every((v, i) => i === 0 || v > printed[i - 1])).toBe(true);
        expect(printedCoverage(parsed.structure)).toBeGreaterThanOrEqual(0.98);
        expect(chapters).toHaveLength(10);
        expectStructuralInvariants(parsed.structure);
    });

    it('classifies no sermon as a book', { timeout: 1_800_000 }, async () => {
        const sermons: string[] = [];
        async function walk(dir: string) {
            for (const entry of await readdir(dir, { withFileTypes: true })) {
                const path = join(dir, entry.name);
                if (entry.isDirectory()) await walk(path);
                else if (/^\d{2}-\d{4}.*\.pdf$/.test(entry.name)) sermons.push(path);
            }
        }
        await walk(CORPUS!);
        expect(sermons.length).toBeGreaterThan(0);

        const falsePositives: string[] = [];
        for (const sermon of sermons) {
            if ((await importDocument(sermon)).kind === 'book')
                falsePositives.push(basename(sermon));
        }
        expect(falsePositives).toEqual([]);
    });
});

const thirdParty = CORPUS
    ? THIRD_PARTY.filter((expectation) => existsSync(join(CORPUS, 'third-party', expectation.file)))
    : [];

describe.skipIf(thirdParty.length === 0)('third-party accuracy', () => {
    it.each(thirdParty)(
        '$file ($script)',
        { timeout: 600_000 },
        async (expectation: Expectation) => {
            const parsed = await importDocument(join(CORPUS!, 'third-party', expectation.file));

            if (!expectation.book) {
                expect(parsed.kind).toBe('plain');
                return;
            }

            expect(parsed.kind).toBe('book');
            if (parsed.kind !== 'book') return;

            expectStructuralInvariants(parsed.structure);
            expect(parsed.structure.paragraphs.length).toBeGreaterThan(100);
            expect(parsed.structure.chapters.length).toBeGreaterThanOrEqual(
                expectation.chapters ?? 0,
            );
            expect(junkRatio(parsed.structure)).toBeLessThan(0.03);

            if (expectation.printed !== undefined) {
                expect(printedCoverage(parsed.structure)).toBeGreaterThanOrEqual(
                    expectation.printed,
                );
                // Long runs mean the folios really are a sequence; a handful of
                // short ones would mean the numbers were noise.
                const runs = folioRunLengths(parsed.structure);
                expect(Math.max(...runs)).toBeGreaterThan(20);
                expect(runs.filter((length) => length > 1).length).toBeLessThan(6);
            }
        },
    );
});
