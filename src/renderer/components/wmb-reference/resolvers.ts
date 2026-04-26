import type { BibleWmbRef, DocWmbRef, SermonWmbRef } from '@shared/wmb-link';

import type { BibleReferenceContent, DocReferenceContent, SermonReferenceContent } from './content';

const DOC_PREVIEW_MAX_CHARS = 500;

function truncate(content: string, max: number): string {
    return content.length > max ? `${content.slice(0, max).trimEnd()}…` : content;
}

export async function resolveSermonFromWmb(ref: SermonWmbRef): Promise<SermonReferenceContent> {
    try {
        const sermon = await window.api.documents.getSermonContent(
            ref.languageCode,
            ref.translationId,
            ref.sermonId,
        );
        const meta = sermon?.meta ?? null;
        const paragraph =
            sermon?.paragraphs?.find((p) => p.paragraphIndex === ref.paragraphIndex) ?? null;
        return {
            type: 'sermon',
            title: meta?.title ?? ref.sermonId,
            dateMs: meta?.dateMs ?? null,
            location: meta?.location ?? null,
            paragraphIndex: paragraph?.paragraphIndex ?? ref.paragraphIndex,
            paragraphText: paragraph?.content ?? null,
        };
    } catch {
        return {
            type: 'sermon',
            title: ref.sermonId,
            dateMs: null,
            location: null,
            paragraphIndex: ref.paragraphIndex,
            paragraphText: null,
        };
    }
}

export async function resolveBibleFromWmb(ref: BibleWmbRef): Promise<BibleReferenceContent> {
    const label = `${ref.bookName} ${ref.chapter}${ref.verse ? `:${ref.verse}` : ''}`;
    try {
        const verses = await window.api.bible.getBooks({
            book: ref.bookCode,
            chapter: ref.chapter,
            verse: ref.verse,
            bibleVersionAbbreviation: ref.bibleVersionAbbreviation,
        });
        return {
            type: 'bible',
            label,
            versionAbbreviation: ref.bibleVersionAbbreviation,
            verses: verses ?? [],
        };
    } catch {
        return {
            type: 'bible',
            label,
            versionAbbreviation: ref.bibleVersionAbbreviation,
            verses: [],
        };
    }
}

export async function resolveDocFromWmb(ref: DocWmbRef): Promise<DocReferenceContent> {
    try {
        const document = await window.api.app.getCustomDocumentContent(ref.documentId);
        return {
            type: 'doc',
            title: document?.title || ref.title,
            contentSnippet: document ? truncate(document.content, DOC_PREVIEW_MAX_CHARS) : null,
        };
    } catch {
        return { type: 'doc', title: ref.title, contentSnippet: null };
    }
}

export { DOC_PREVIEW_MAX_CHARS, truncate };
