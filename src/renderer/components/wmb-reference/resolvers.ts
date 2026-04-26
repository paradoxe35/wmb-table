import type { BibleBook, CustomDocumentContent, SermonMeta, SermonParagraph } from '@shared/types';
import type { BibleWmbRef, DocWmbRef, SermonWmbRef } from '@shared/wmb-link';

export type SermonReferenceData = {
    type: 'sermon';
    ref: SermonWmbRef;
    meta: SermonMeta | null;
    paragraph: SermonParagraph | null;
};

export type BibleReferenceData = {
    type: 'bible';
    ref: BibleWmbRef;
    verses: BibleBook[];
};

export type DocReferenceData = {
    type: 'doc';
    ref: DocWmbRef;
    document: CustomDocumentContent | null;
};

export type WmbReferenceData = SermonReferenceData | BibleReferenceData | DocReferenceData;

export async function resolveSermonReference(ref: SermonWmbRef): Promise<SermonReferenceData> {
    try {
        const content = await window.api.documents.getSermonContent(
            ref.languageCode,
            ref.translationId,
            ref.sermonId,
        );
        const paragraph =
            content?.paragraphs?.find((p) => p.paragraphIndex === ref.paragraphIndex) ?? null;
        return { type: 'sermon', ref, meta: content?.meta ?? null, paragraph };
    } catch {
        return { type: 'sermon', ref, meta: null, paragraph: null };
    }
}

export async function resolveBibleReference(ref: BibleWmbRef): Promise<BibleReferenceData> {
    try {
        const verses = await window.api.bible.getBooks({
            book: ref.bookCode,
            chapter: ref.chapter,
            verse: ref.verse,
            bibleVersionAbbreviation: ref.bibleVersionAbbreviation,
        });
        return { type: 'bible', ref, verses: verses ?? [] };
    } catch {
        return { type: 'bible', ref, verses: [] };
    }
}

export async function resolveDocReference(ref: DocWmbRef): Promise<DocReferenceData> {
    try {
        const document = await window.api.app.getCustomDocumentContent(ref.documentId);
        return { type: 'doc', ref, document };
    } catch {
        return { type: 'doc', ref, document: null };
    }
}
