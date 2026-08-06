import {
    buildParagraphsFromPageLayouts,
    extractPdfDocument,
    serializeParagraphs,
} from '../pdf-extract.service';
import {
    extractHtmlFromImportedDocument,
    extractTextFromImportedDocument,
    htmlToHeadingOutline,
    resolveDocumentImportFormat,
} from '../document-import.service';
import { buildPdfBookStructure } from './pdf-book-structure';
import { scoreDocumentOutline } from './book-detection';
import { serializeStructuredContent } from '@shared/book-content';
import {
    STRUCTURED_DOCUMENT_VERSION,
    type BookChapter,
    type BookParagraph,
    type CustomDocumentImportInput,
    type CustomDocumentImportOptions,
    type CustomDocumentKind,
    type StructuredDocumentContent,
} from '@shared/types';

export interface ImportedDocumentContent {
    content: string;
    kind: CustomDocumentKind | null;
}

/**
 * Row content for an imported document: structured when the source carries enough
 * to cite from, otherwise byte for byte what previous versions produced.
 */
export async function buildImportedDocumentContent(
    input: CustomDocumentImportInput,
    options: CustomDocumentImportOptions = {},
): Promise<ImportedDocumentContent> {
    const format = resolveDocumentImportFormat(input.fileName, input.mimeType);
    const plainOnly = options.structure === 'plain' || format === 'txt';

    if (format === 'pdf' && !plainOnly) return importPdf(input, options);

    const structure = plainOnly ? null : await importOutline(input, options);
    return structure
        ? finish(structure, options)
        : { content: await extractTextFromImportedDocument(input), kind: null };
}

/** A book with no paragraphs reads back as nothing, so the plain path wins — override included. */
function hasStructure(structure: StructuredDocumentContent): boolean {
    return structure.paragraphs.length > 0;
}

async function finish(
    structure: StructuredDocumentContent,
    options: CustomDocumentImportOptions,
): Promise<ImportedDocumentContent> {
    // Loaded on demand: importing keeps working with no AI provider installed.
    const refined = options.aiRefinement
        ? await import('./book-ai-refinement').then((module) =>
              module.refineChapterTitles(structure),
          )
        : structure;

    return { content: serializeStructuredContent(refined), kind: 'book' };
}

async function importPdf(
    input: CustomDocumentImportInput,
    options: CustomDocumentImportOptions,
): Promise<ImportedDocumentContent> {
    const { layouts, outline } = await extractPdfDocument(input.bytes);
    const { structure, detection } = buildPdfBookStructure(layouts, outline);
    if (hasStructure(structure) && (detection.isBook || options.structure === 'book')) {
        return finish(structure, options);
    }

    // The pages are already parsed, so the plain fallback reuses them rather
    // than reading the whole file a second time.
    return { content: serializeParagraphs(buildParagraphsFromPageLayouts(layouts)), kind: null };
}

/**
 * EPUB, DOCX and Markdown carry no page geometry, but they do carry heading
 * elements — a real chapter division that survives the existing HTML conversion.
 */
async function importOutline(
    input: CustomDocumentImportInput,
    options: CustomDocumentImportOptions,
): Promise<StructuredDocumentContent | null> {
    const texts = (await extractTextFromImportedDocument(input)).split('\n').filter(Boolean);
    const headings = htmlToHeadingOutline(await extractHtmlFromImportedDocument(input));

    const chapters: BookChapter[] = [];
    const chapterByParagraph = new Map<number, string>();
    let cursor = 0;

    for (const heading of headings) {
        const position = texts.indexOf(heading.title, cursor);
        if (position === -1) continue;
        cursor = position + 1;

        const id = `c${chapters.length + 1}`;
        chapters.push({
            id,
            title: heading.title,
            page: 1,
            firstParagraph: position + 1,
            level: heading.level,
        });
        chapterByParagraph.set(position, id);
    }

    const detection = scoreDocumentOutline({
        chapterCount: chapters.filter((chapter) => chapter.level <= 2).length,
        paragraphCount: texts.length,
    });
    if (texts.length === 0 || (!detection.isBook && options.structure !== 'book')) return null;

    let chapterId: string | undefined;
    const paragraphs: BookParagraph[] = texts.map((text, position) => {
        const opened = chapterByParagraph.get(position);
        if (opened) chapterId = opened;
        return {
            index: position + 1,
            text,
            page: 1,
            pageParagraph: position + 1,
            ...(chapterId ? { chapterId } : {}),
            ...(opened ? { heading: true as const } : {}),
        };
    });

    return {
        version: STRUCTURED_DOCUMENT_VERSION,
        kind: 'book',
        paragraphs,
        pages: [{ index: 1, firstParagraph: 1 }],
        chapters,
        detection: {
            confidence: detection.confidence,
            signals: detection.signals,
            aiAssisted: false,
        },
    };
}
