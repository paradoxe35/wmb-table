import {
    STRUCTURED_DOCUMENT_VERSION,
    type BookChapter,
    type BookPage,
    type BookParagraph,
    type DocumentStructureDetection,
    type StructuredDocumentContent,
} from './types';

/**
 * `custom_documents.content` has carried three shapes over the life of the app:
 * newline-joined plain text, a JSON array of paragraphs, and — since books —
 * a versioned structure object. Everything that reads a document goes through
 * here so the three branches exist exactly once.
 */
export type ParsedDocumentContent =
    | { kind: 'plain'; paragraphs: string[] }
    | { kind: 'book'; structure: StructuredDocumentContent };

export function serializeStructuredContent(structure: StructuredDocumentContent): string {
    return JSON.stringify(structure);
}

export function parseDocumentContent(content: string): ParsedDocumentContent {
    const trimmed = content.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = tryParseJson(trimmed);
        if (Array.isArray(parsed)) {
            return { kind: 'plain', paragraphs: parsed.map((line) => String(line)) };
        }
        if (typeof parsed === 'object' && parsed !== null) {
            const structure = readStructuredContent(parsed);
            // The content is a serialized object either way, so splitting it by
            // line would show the reader raw JSON rather than a document.
            return structure ? { kind: 'book', structure } : { kind: 'plain', paragraphs: [] };
        }
    }

    return {
        kind: 'plain',
        paragraphs: content.split('\n').filter((line) => line.trim() !== ''),
    };
}

/** Paragraph texts in reading order, whatever shape the content is stored in. */
export function documentContentToParagraphTexts(content: string): string[] {
    const parsed = parseDocumentContent(content);
    return parsed.kind === 'book'
        ? parsed.structure.paragraphs.map((paragraph) => paragraph.text)
        : parsed.paragraphs;
}

export type BookCitation = {
    /** Document-wide anchor, always present. */
    paragraphIndex: number;
    /** Absent when the source page carries no number — never invented. */
    printedPage?: string;
    pageParagraph: number;
};

const CITATION_SEPARATOR = ' · ';
const PARAGRAPH_SIGN = '¶';

/**
 * How a book passage is quoted: `page · paragraph`, matching how a reader counts
 * from the printed page. Without a printed number there is no page to cite, so
 * the document-wide index stands in.
 */
export function formatBookCitation(citation: BookCitation): string {
    return citation.printedPage
        ? `${citation.printedPage}${CITATION_SEPARATOR}${citation.pageParagraph}`
        : `${PARAGRAPH_SIGN}${citation.paragraphIndex}`;
}

/** Citation of every paragraph of a book, keyed by its document-wide index. */
export function bookCitationsByParagraph(
    structure: StructuredDocumentContent,
): Map<number, BookCitation> {
    const printedByPage = new Map<number, string>(
        structure.pages.flatMap((page) => (page.printed ? [[page.index, page.printed]] : [])),
    );

    return new Map(
        structure.paragraphs.map((paragraph) => {
            const printedPage = printedByPage.get(paragraph.page);
            return [
                paragraph.index,
                {
                    paragraphIndex: paragraph.index,
                    pageParagraph: paragraph.pageParagraph,
                    ...(printedPage ? { printedPage } : {}),
                },
            ];
        }),
    );
}

function tryParseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

function readStructuredContent(value: unknown): StructuredDocumentContent | null {
    if (typeof value !== 'object' || value === null) return null;

    const candidate = value as Partial<StructuredDocumentContent>;
    if (candidate.version !== STRUCTURED_DOCUMENT_VERSION || candidate.kind !== 'book') {
        return null;
    }

    const paragraphs = readParagraphs(candidate.paragraphs);
    if (paragraphs.length === 0) return null;

    return {
        version: STRUCTURED_DOCUMENT_VERSION,
        kind: 'book',
        paragraphs,
        pages: readPages(candidate.pages),
        chapters: readChapters(candidate.chapters),
        detection: readDetection(candidate.detection),
    };
}

function readParagraphs(value: unknown): BookParagraph[] {
    if (!Array.isArray(value)) return [];

    return value.flatMap((entry, position) => {
        if (typeof entry !== 'object' || entry === null) return [];
        const paragraph = entry as Partial<BookParagraph>;
        const text = typeof paragraph.text === 'string' ? paragraph.text : '';
        if (!text) return [];

        return [
            {
                index: toPositiveInteger(paragraph.index, position + 1),
                text,
                page: toPositiveInteger(paragraph.page, 1),
                pageParagraph: toPositiveInteger(paragraph.pageParagraph, 1),
                ...(typeof paragraph.chapterId === 'string'
                    ? { chapterId: paragraph.chapterId }
                    : {}),
                ...(paragraph.heading ? { heading: true as const } : {}),
            },
        ];
    });
}

function readPages(value: unknown): BookPage[] {
    if (!Array.isArray(value)) return [];

    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return [];
        const page = entry as Partial<BookPage>;
        return [
            {
                index: toPositiveInteger(page.index, 1),
                ...(typeof page.printed === 'string' ? { printed: page.printed } : {}),
                firstParagraph: toPositiveInteger(page.firstParagraph, 1),
                ...(page.frontMatter ? { frontMatter: true as const } : {}),
            },
        ];
    });
}

function readChapters(value: unknown): BookChapter[] {
    if (!Array.isArray(value)) return [];

    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return [];
        const chapter = entry as Partial<BookChapter>;
        if (typeof chapter.id !== 'string' || typeof chapter.title !== 'string') return [];
        return [
            {
                id: chapter.id,
                title: chapter.title,
                page: toPositiveInteger(chapter.page, 1),
                firstParagraph: toPositiveInteger(chapter.firstParagraph, 1),
                level: toPositiveInteger(chapter.level, 1),
            },
        ];
    });
}

function readDetection(value: unknown): DocumentStructureDetection {
    const detection = (value ?? {}) as Partial<DocumentStructureDetection>;
    return {
        confidence: typeof detection.confidence === 'number' ? detection.confidence : 0,
        signals: Array.isArray(detection.signals) ? detection.signals.map(String) : [],
        aiAssisted: detection.aiAssisted === true,
    };
}

function toPositiveInteger(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? Math.trunc(value)
        : fallback;
}
