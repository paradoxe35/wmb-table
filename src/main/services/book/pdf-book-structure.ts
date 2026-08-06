import {
    isLikelyTocLine,
    joinWrappedLines,
    normalizeInlineWhitespace,
    type PdfOutlineEntry,
    type PdfPageLayout,
    type PositionedLine,
} from '../pdf-extract.service';
import {
    analysePageMarginalia,
    type MarginaliaAnalysis,
    type RunningHeaderBand,
} from './page-marginalia';
import {
    analysePageStructure,
    measureDocumentTypography,
    type DocumentTypography,
    type PageBlock,
} from './page-blocks';
import { chaptersFromOutline } from './pdf-outline';
import { isUnreadableTextRun } from './text-quality';
import { scoreBookEvidence, type BookDetectionResult } from './book-detection';
import {
    STRUCTURED_DOCUMENT_VERSION,
    type BookChapter,
    type BookPage,
    type BookParagraph,
    type StructuredDocumentContent,
} from '@shared/types';

/** Above this share of multi-column pages, indent-based segmentation is meaningless. */
const MAX_MULTI_COLUMN_RATIO = 0.2;
/** Above this share of unreadable lines the document cannot be cited from at all. */
const MAX_UNREADABLE_RATIO = 0.5;
const MAX_CHAPTER_TITLE_CHARS = 90;
/** A chapter's running header may only start on the page after its title page. */
const CHAPTER_BAND_TOLERANCE = 1;

/** Sermon-style inline numbering: a bare ordinal opening the paragraph. */
const LEADING_ORDINAL = /^\p{Nd}+[.)]?\s/u;

interface PageDraft {
    index: number;
    printed?: string;
    frontMatter: boolean;
    blocks: PageBlock[];
    indented: boolean;
    blockSpaced: boolean;
    columns: number;
    /** Lines whose text extracted as glyph codes and had to be discarded. */
    dropped: number;
}

export interface PdfBookExtraction {
    structure: StructuredDocumentContent;
    detection: BookDetectionResult;
}

/**
 * Builds the structured content model from already-extracted page layouts.
 * Returns the detection result even when it falls short of the book threshold so
 * the caller can decide to fall back to the existing plain import.
 */
export function buildPdfBookStructure(
    layouts: PdfPageLayout[],
    outline: PdfOutlineEntry[] = [],
): PdfBookExtraction {
    const typography = measureDocumentTypography(layouts);
    const marginalia = analysePageMarginalia(layouts, typography);
    const drafts = layouts.map((layout) => buildPageDraft(layout, marginalia, typography));

    const populated = layouts.filter((layout) => layout.lines.length > 0).length;
    const multiColumn = drafts.filter((draft) => draft.columns > 1).length;
    const body = drafts.filter((draft) => !draft.frontMatter && draft.blocks.length > 0);

    const { paragraphs, pages, chapters } = assemble(
        drafts,
        marginalia.chapterBands,
        chaptersFromOutline(outline, layouts.length),
    );

    const scored = scoreBookEvidence({
        pageCount: layouts.length,
        printedCoverage: marginalia.printedCoverage,
        runningCoverage: marginalia.runningCoverage,
        indentCoverage: ratioOf(body, (draft) => draft.indented),
        blockSpacingCoverage: ratioOf(body, (draft) => draft.blockSpaced),
        chapterCount: chapters.length,
        tocLineCount: countTocLines(layouts, marginalia),
        numberedParagraphRatio: ratioOf(paragraphs, (paragraph) =>
            LEADING_ORDINAL.test(paragraph.text),
        ),
    });

    // Indent clustering cannot segment a multi-column page, and text that
    // extracted as glyph codes cannot be cited: either way, plain is the only
    // honest answer whatever the layout scores.
    const multiColumnDocument = populated > 0 && multiColumn / populated > MAX_MULTI_COLUMN_RATIO;
    const lineCount = layouts.reduce((total, layout) => total + layout.lines.length, 0);
    const dropped = drafts.reduce((total, draft) => total + draft.dropped, 0);
    const unreadable = lineCount > 0 && dropped / lineCount > MAX_UNREADABLE_RATIO;

    const detection: BookDetectionResult =
        multiColumnDocument || unreadable ? { confidence: 0, signals: [], isBook: false } : scored;

    return {
        structure: {
            version: STRUCTURED_DOCUMENT_VERSION,
            kind: 'book',
            paragraphs,
            pages,
            chapters,
            detection: {
                confidence: detection.confidence,
                signals: detection.signals,
                aiAssisted: false,
            },
        },
        detection,
    };
}

function buildPageDraft(
    layout: PdfPageLayout,
    marginalia: MarginaliaAnalysis,
    typography: DocumentTypography,
): PageDraft {
    const page = marginalia.byPage.get(layout.index);
    const margins = new Set(page?.lines ?? []);
    const frontMatter =
        marginalia.firstPrintedPage !== null && layout.index < marginalia.firstPrintedPage;

    const body = layout.lines.filter((line) => !margins.has(line));
    const readable = body.filter((line) => !isUnreadableTextRun(line.text));

    // Front matter is decorative and never cited, so a page that extracts even
    // partly as garbage is dropped whole rather than half-rendered.
    if (frontMatter && readable.length < body.length) {
        return {
            index: layout.index,
            frontMatter,
            blocks: [],
            indented: false,
            blockSpaced: false,
            columns: 1,
            dropped: body.length - readable.length,
        };
    }

    const structure = analysePageStructure(layout, readable, typography);
    return {
        index: layout.index,
        ...(page?.printed ? { printed: page.printed } : {}),
        frontMatter,
        blocks: structure.blocks,
        indented: structure.indented,
        blockSpaced: structure.blockSpaced,
        columns: structure.columns,
        dropped: body.length - readable.length,
    };
}

function assemble(
    drafts: PageDraft[],
    bands: RunningHeaderBand[],
    outline: BookChapter[] | null,
): {
    paragraphs: BookParagraph[];
    pages: BookPage[];
    chapters: BookChapter[];
} {
    // Chapter-scoped running heads give the boundaries up front, which keeps a
    // section title at the top of a page out of the chapter list.
    const unclaimedBands = new Set(bands.map((band) => band.startPage));
    const opensChapter = (pageIndex: number): boolean => {
        if (bands.length < 2) return true;

        const claimed = [...unclaimedBands].find(
            (startPage) => Math.abs(startPage - pageIndex) <= CHAPTER_BAND_TOLERANCE,
        );
        if (claimed === undefined) return false;

        unclaimedBands.delete(claimed);
        return true;
    };

    const paragraphs: BookParagraph[] = [];
    const pages: BookPage[] = [];
    const chapters: BookChapter[] = [];
    const perPageCount = new Map<number, number>();

    let openParagraph: BookParagraph | null = null;
    let chapterId: string | null = null;

    for (const draft of drafts) {
        const carried = openParagraph;
        let firstOnPage: number | null = null;

        // The file's own bookmarks settle it; the page is not consulted.
        for (const entry of outline?.filter((chapter) => chapter.page === draft.index) ?? []) {
            chapterId = entry.id;
            chapters.push({ ...entry, firstParagraph: paragraphs.length + 1 });
        }

        for (const [position, block] of draft.blocks.entries()) {
            const text = joinWrappedLines(block.lines.map((line) => line.text));
            if (!text) continue;

            if (block.role === 'continuation' && openParagraph) {
                openParagraph.text = joinWrappedLines([openParagraph.text, text]);
                firstOnPage ??= openParagraph.index;
                continue;
            }

            // Only a title at the very top of a body page opens a chapter; the
            // same shape further down the page is a section within one.
            if (
                outline === null &&
                block.role === 'heading' &&
                position === 0 &&
                !draft.frontMatter &&
                opensChapter(draft.index)
            ) {
                chapterId = `c${chapters.length + 1}`;
                chapters.push({
                    id: chapterId,
                    title: text.slice(0, MAX_CHAPTER_TITLE_CHARS).trim(),
                    page: draft.index,
                    firstParagraph: paragraphs.length + 1,
                    level: 1,
                });
            }

            const pageParagraph = (perPageCount.get(draft.index) ?? 0) + 1;
            perPageCount.set(draft.index, pageParagraph);
            openParagraph = {
                index: paragraphs.length + 1,
                text,
                page: draft.index,
                pageParagraph,
                ...(chapterId && !draft.frontMatter ? { chapterId } : {}),
                ...(block.role === 'heading' ? { heading: true as const } : {}),
            };
            paragraphs.push(openParagraph);
            firstOnPage ??= openParagraph.index;
        }

        pages.push({
            index: draft.index,
            ...(draft.printed ? { printed: draft.printed } : {}),
            firstParagraph: Math.max(1, firstOnPage ?? carried?.index ?? paragraphs.length),
            ...(draft.frontMatter ? { frontMatter: true as const } : {}),
        });
    }

    return { paragraphs, pages, chapters };
}

function countTocLines(layouts: PdfPageLayout[], marginalia: MarginaliaAnalysis): number {
    const frontMatter = layouts.filter(
        (layout) =>
            marginalia.firstPrintedPage !== null && layout.index < marginalia.firstPrintedPage,
    );

    return Math.max(
        0,
        ...frontMatter.map((layout) => layout.lines.filter((line) => isTocEntry(line)).length),
    );
}

function isTocEntry(line: PositionedLine): boolean {
    const text = normalizeInlineWhitespace(line.text);
    return text.length > 0 && isLikelyTocLine(text) && !isUnreadableTextRun(text);
}

function ratioOf<T>(items: T[], predicate: (item: T) => boolean): number {
    return items.length === 0 ? 0 : items.filter(predicate).length / items.length;
}
