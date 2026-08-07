/**
 * Scores structural evidence that a document is a typeset book rather than a
 * transcript. Layout signals only — never a title, filename or publisher.
 */

/** Above the sum of every signal but `printed-pages`: without folios there is nothing to cite. */
export const BOOK_CONFIDENCE_THRESHOLD = 0.7;

const SIGNAL_WEIGHTS = {
    'printed-pages': 0.32,
    'running-header': 0.24,
    'indent-bimodal': 0.24,
    /** The other paragraph convention, weighted like the indent it replaces. */
    'block-spacing': 0.24,
    'chapter-partition': 0.1,
    'table-of-contents': 0.05,
    'page-count': 0.05,
} as const;

export type BookSignal = keyof typeof SIGNAL_WEIGHTS;

/** Inline numbering is how sermon transcripts are cited; books do not carry it. */
const SERMON_NUMBERING_PENALTY = 0.5;

const MIN_PRINTED_COVERAGE = 0.5;
const MIN_RUNNING_COVERAGE = 0.4;
const MIN_INDENT_COVERAGE = 0.5;
const MIN_BOOK_PAGES = 40;
const MIN_TOC_LINES = 3;
const MAX_SERMON_NUMBERING_RATIO = 0.3;

export interface BookEvidence {
    pageCount: number;
    printedCoverage: number;
    runningCoverage: number;
    indentCoverage: number;
    blockSpacingCoverage: number;
    chapterCount: number;
    tocLineCount: number;
    numberedParagraphRatio: number;
}

export interface BookDetectionResult {
    confidence: number;
    signals: BookSignal[];
    isBook: boolean;
}

/** EPUB and DOCX carry no page geometry, so headings are the only evidence. */
const MIN_OUTLINE_CHAPTERS = 3;
const MIN_OUTLINE_PARAGRAPHS = 20;

export function scoreDocumentOutline(outline: {
    chapterCount: number;
    paragraphCount: number;
}): BookDetectionResult {
    const isBook =
        outline.chapterCount >= MIN_OUTLINE_CHAPTERS &&
        outline.paragraphCount >= MIN_OUTLINE_PARAGRAPHS;

    return {
        confidence: isBook ? BOOK_CONFIDENCE_THRESHOLD : 0,
        signals: isBook ? ['chapter-partition'] : [],
        isBook,
    };
}

export function scoreBookEvidence(evidence: BookEvidence): BookDetectionResult {
    const signals: BookSignal[] = [];

    if (evidence.printedCoverage >= MIN_PRINTED_COVERAGE) signals.push('printed-pages');
    if (evidence.runningCoverage >= MIN_RUNNING_COVERAGE) signals.push('running-header');
    if (evidence.indentCoverage >= MIN_INDENT_COVERAGE) signals.push('indent-bimodal');
    else if (evidence.blockSpacingCoverage >= MIN_INDENT_COVERAGE) signals.push('block-spacing');
    if (evidence.chapterCount >= 2) signals.push('chapter-partition');
    if (evidence.tocLineCount >= MIN_TOC_LINES) signals.push('table-of-contents');
    if (evidence.pageCount >= MIN_BOOK_PAGES) signals.push('page-count');

    const positive = signals.reduce((total, signal) => total + SIGNAL_WEIGHTS[signal], 0);
    const penalty =
        evidence.numberedParagraphRatio >= MAX_SERMON_NUMBERING_RATIO
            ? SERMON_NUMBERING_PENALTY
            : 0;
    const confidence = Math.max(0, Math.min(1, positive - penalty));

    return { confidence, signals, isBook: confidence >= BOOK_CONFIDENCE_THRESHOLD };
}
