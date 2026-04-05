import { normalizeBibleAbbreviation } from './types';

export interface SermonWmbRef {
    type: 'sermon';
    sermonId: string;
    languageCode: string;
    translationId: number;
    paragraphIndex: number;
}

export interface BibleWmbRef {
    type: 'bible';
    bookCode: string;
    chapter: string;
    verse?: string;
    bibleVersionAbbreviation: string;
    bookName: string;
}

export interface DocWmbRef {
    type: 'doc';
    documentId: string;
    title: string;
}

export type WmbRef = SermonWmbRef | BibleWmbRef | DocWmbRef;

function parseIntegerSegment(segment: string | undefined): number | null {
    if (!segment) {
        return null;
    }

    const value = Number.parseInt(segment, 10);
    return Number.isNaN(value) ? null : value;
}

export function buildSermonWmbLink(ref: SermonWmbRef): string {
    return [
        'wmb://sermon',
        encodeURIComponent(ref.sermonId),
        encodeURIComponent(ref.languageCode),
        String(ref.translationId),
        String(ref.paragraphIndex),
    ].join('/');
}

export function parseWmbLink(href: string): WmbRef | null {
    if (!href.startsWith('wmb://')) {
        return null;
    }

    const parts = href.slice(6).split('/').map(decodeURIComponent);
    const refType = parts[0];

    switch (refType) {
        case 'sermon': {
            const [, sermonId, languageCode, translationIdSegment, paragraphIndexSegment] = parts;
            if (!sermonId || !languageCode) {
                return null;
            }

            const translationId = parseIntegerSegment(translationIdSegment);
            const paragraphIndex = parseIntegerSegment(paragraphIndexSegment);
            if (translationId == null || paragraphIndex == null) {
                return null;
            }

            return {
                type: 'sermon',
                sermonId,
                languageCode,
                translationId,
                paragraphIndex,
            };
        }
        case 'bible': {
            const [, bookCode, chapter, verse, bibleVersionAbbreviation, ...bookNameParts] = parts;
            if (!bookCode || !chapter || !bibleVersionAbbreviation || bookNameParts.length === 0) {
                return null;
            }

            return {
                type: 'bible',
                bookCode,
                chapter,
                verse: verse || undefined,
                bibleVersionAbbreviation: normalizeBibleAbbreviation(bibleVersionAbbreviation),
                bookName: bookNameParts.join('/') || bookCode,
            };
        }
        case 'doc': {
            const [, documentId, ...titleParts] = parts;
            if (!documentId) {
                return null;
            }

            return {
                type: 'doc',
                documentId,
                title: titleParts.join('/') || documentId,
            };
        }
        default:
            return null;
    }
}
