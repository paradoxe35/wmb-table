import {
    bookCitationsByParagraph,
    parseDocumentContent,
    type BookCitation,
} from '@shared/book-content';
import type { BookChapter, CustomDocumentKind, StructuredDocumentContent } from '@shared/types';
import { buildBookWmbLink } from '@shared/wmb-link';

/** What the paragraph list needs, whatever shape the stored content had. */
export type ReaderParagraph = {
    paragraphIndex: number;
    content: string;
    /** Gutter number. Books count per printed page, so it is not the index. */
    label?: string;
    heading?: boolean;
};

export type BookPageBreak = {
    /** First paragraph of the page; the marker is drawn just above it. */
    paragraphIndex: number;
    printedPage: string;
};

export type BookViewModel = {
    citations: Map<number, BookCitation>;
    pageBreaks: Map<number, BookPageBreak>;
    chapters: BookChapter[];
};

export type ReaderContent = {
    paragraphs: ReaderParagraph[];
    /** `null` for plain documents and for books whose content failed to parse. */
    book: BookViewModel | null;
};

/**
 * Which reader a custom document opens in. Driven by the stored `kind` alone so
 * the choice is made before the content is loaded.
 */
export function selectCustomDocumentReader(kind: CustomDocumentKind | undefined): 'book' | 'plain' {
    return kind === 'book' ? 'book' : 'plain';
}

export function parseCustomDocumentContent(content: string): ReaderContent {
    const parsed = parseDocumentContent(content);

    if (parsed.kind === 'plain') {
        return {
            paragraphs: parsed.paragraphs.map((text, position) => ({
                paragraphIndex: position + 1,
                content: text,
            })),
            book: null,
        };
    }

    return buildBookReaderContent(parsed.structure);
}

function buildBookReaderContent(structure: StructuredDocumentContent): ReaderContent {
    const citations = bookCitationsByParagraph(structure);
    const pageBreaks = new Map<number, BookPageBreak>();
    const paragraphs: ReaderParagraph[] = [];

    let previousPage: number | null = null;

    for (const paragraph of structure.paragraphs) {
        const citation = citations.get(paragraph.index)!;

        if (paragraph.page !== previousPage) {
            previousPage = paragraph.page;
            if (citation.printedPage) {
                pageBreaks.set(paragraph.index, {
                    paragraphIndex: paragraph.index,
                    printedPage: citation.printedPage,
                });
            }
        }

        paragraphs.push({
            paragraphIndex: paragraph.index,
            content: paragraph.text,
            label: formatGutterLabel(citation),
            ...(paragraph.heading ? { heading: true as const } : {}),
        });
    }

    return {
        paragraphs,
        book: { citations, pageBreaks, chapters: structure.chapters },
    };
}

/** The number printed beside the paragraph — the one a reader counts on the page. */
function formatGutterLabel(citation: BookCitation): string {
    return citation.printedPage ? String(citation.pageParagraph) : String(citation.paragraphIndex);
}

export function buildBookCitationLink(
    documentId: string,
    title: string,
    citation: BookCitation,
): string {
    return buildBookWmbLink({
        type: 'book',
        documentId,
        title,
        paragraphIndex: citation.paragraphIndex,
        pageParagraph: citation.pageParagraph,
        ...(citation.printedPage ? { printedPage: citation.printedPage } : {}),
    });
}
