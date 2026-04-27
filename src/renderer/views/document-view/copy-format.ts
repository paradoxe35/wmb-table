import type { DocumentType, HighlightParagraphRange } from '@shared/types';
import { formatSermonDateShort } from '@renderer/utils/sermon-utils';

export type CopyParagraph = {
    paragraphIndex: number;
    content: string;
};

export type CopyDocumentContext = {
    documentType: DocumentType;
    documentTitle: string;
    languageCode: string;
    sermonDateMs?: number;
    fallbackLanguage?: string | null;
};

function cleanCopyText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function formatCopyLine(paragraph: CopyParagraph, range: HighlightParagraphRange): string | null {
    const startOffset = Math.max(0, Math.min(range.startOffset, paragraph.content.length));
    const endOffset = Math.max(startOffset, Math.min(range.endOffset, paragraph.content.length));
    const selectedText = cleanCopyText(paragraph.content.slice(startOffset, endOffset));

    if (!selectedText) {
        return null;
    }

    const startsInsideParagraph = startOffset > 0;
    const endsInsideParagraph = endOffset < paragraph.content.length;
    const prefix = startsInsideParagraph ? '... ' : '';
    const suffix = endsInsideParagraph ? ' ...' : '';

    return `${paragraph.paragraphIndex}. ${prefix}${selectedText}${suffix}`;
}

function formatCopySource(context: CopyDocumentContext): string {
    const sourcePrefix = '— ';

    if (context.documentType !== 'sermon' || context.sermonDateMs == null) {
        return `${sourcePrefix}${context.documentTitle}`;
    }

    return `${sourcePrefix}${context.documentTitle} - ${formatSermonDateShort(
        context.sermonDateMs,
        context.languageCode,
        context.fallbackLanguage,
    )}`;
}

export function formatDocumentSelectionForClipboard({
    context,
    paragraphs,
    ranges,
}: {
    context: CopyDocumentContext;
    paragraphs: CopyParagraph[];
    ranges: HighlightParagraphRange[];
}): string {
    const paragraphsByIndex = new Map(paragraphs.map((p) => [p.paragraphIndex, p]));
    const lines = ranges
        .map((range) => {
            const paragraph = paragraphsByIndex.get(range.paragraphIndex);
            return paragraph ? formatCopyLine(paragraph, range) : null;
        })
        .filter((line): line is string => Boolean(line));

    const source = formatCopySource(context);

    if (lines.length === 0) {
        return source;
    }

    return source ? `${lines.join('\n')}\n\n${source}` : lines.join('\n');
}
