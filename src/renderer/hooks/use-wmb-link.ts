import { useCallback } from 'react';
import { buildPendingNavigation, useOpenDocumentRequest } from './index';
import { useSermonStore } from '@renderer/stores/sermon.store';

/**
 * Reference link format: wmb://<type>/<...params>
 *
 * - wmb://sermon/<sermonId>/<translationId>/<paragraphIndex>
 * - wmb://bible/<bookCode>/<chapter>/<verse>/<bookName>
 * - wmb://doc/<documentId>/<title>
 */

interface SermonRef {
    type: 'sermon';
    sermonId: string;
    translationId: number;
    paragraphIndex: number;
}

interface BibleRef {
    type: 'bible';
    bookCode: string;
    chapter: string;
    verse?: string;
    bookName: string;
}

interface DocRef {
    type: 'doc';
    documentId: string;
    title: string;
}

export type WmbRef = SermonRef | BibleRef | DocRef;

export function parseWmbLink(href: string): WmbRef | null {
    if (!href.startsWith('wmb://')) return null;

    const parts = href.slice(6).split('/').map(decodeURIComponent);
    const refType = parts[0];

    switch (refType) {
        case 'sermon': {
            const [, sermonId, translationId, paragraphIndex] = parts;
            if (!sermonId) return null;
            return {
                type: 'sermon',
                sermonId,
                translationId: parseInt(translationId ?? '0', 10),
                paragraphIndex: parseInt(paragraphIndex ?? '0', 10),
            };
        }
        case 'bible': {
            const [, bookCode, chapter, verse, ...bookNameParts] = parts;
            if (!bookCode || !chapter) return null;
            return {
                type: 'bible',
                bookCode,
                chapter,
                verse: verse || undefined,
                bookName: bookNameParts.join('/') || bookCode,
            };
        }
        case 'doc': {
            const [, documentId, ...titleParts] = parts;
            if (!documentId) return null;
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

/**
 * Hook that returns a function to navigate to a wmb:// link.
 * Returns true if the link was handled, false otherwise.
 */
export function useWmbLinkNavigate(): (href: string) => boolean {
    const openDocumentRequest = useOpenDocumentRequest();
    const setPendingNavigation = useSermonStore((s) => s.setPendingNavigation);
    const sermonsById = useSermonStore((s) => s.sermonsById);

    return useCallback(
        (href: string): boolean => {
            const ref = parseWmbLink(href);
            if (!ref) return false;

            switch (ref.type) {
                case 'sermon': {
                    const sermon = sermonsById[ref.sermonId];
                    const title = sermon?.title ?? ref.sermonId;
                    const translationId = sermon?.translationId || ref.translationId || 0;
                    const request = {
                        title,
                        sermonId: ref.sermonId,
                        documentType: 'sermon' as const,
                        translationId,
                    };
                    setPendingNavigation(
                        buildPendingNavigation(request, {
                            paragraphIndex: ref.paragraphIndex,
                            translationId,
                            languageCode: '',
                            sermonId: ref.sermonId,
                            documentType: 'sermon',
                        }),
                    );
                    openDocumentRequest(request);
                    return true;
                }
                case 'bible':
                    openDocumentRequest({
                        title: `${ref.bookName} ${ref.chapter}`,
                        sermonId: `${ref.bookCode}:${ref.chapter}`,
                        documentType: 'bible',
                        bibleBook: ref.bookCode,
                        bibleChapter: ref.chapter,
                    });
                    return true;
                case 'doc':
                    openDocumentRequest({
                        title: ref.title,
                        sermonId: ref.documentId,
                        documentType: 'custom',
                    });
                    return true;
            }
        },
        [sermonsById, setPendingNavigation, openDocumentRequest],
    );
}
