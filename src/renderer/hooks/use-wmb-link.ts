import { useCallback } from 'react';
import { buildPendingNavigation, useDocumentPresentation, useOpenDocumentRequest } from './index';
import { useDocumentTabsStore, useSermonsById } from '@renderer/stores';
import {
    buildParagraphReference,
    buildBibleDocumentTitle,
    buildSermonDocumentIdentity,
    type SermonDocumentIdentity,
} from '@shared/types';
export { parseWmbLink } from '@shared/wmb-link';
import { parseWmbLink } from '@shared/wmb-link';

/**
 * Reference link format: wmb://<type>/<...params>
 *
 * - wmb://sermon/<sermonId>/<languageCode>/<translationId>/<paragraphIndex>
 * - wmb://bible/<bookCode>/<chapter>/<verse>/<bibleVersionAbbreviation>/<bookName>
 * - wmb://doc/<documentId>/<title>
 * - wmb://book/<documentId>/<paragraphIndex>/<printedPage>/<pageParagraph>/<title>
 */

/**
 * Hook that returns a function to navigate to a wmb:// link.
 * Returns true if the link was handled, false otherwise.
 */
export function useWmbLinkNavigate(): (href: string) => boolean {
    const { buildOpenRequest } = useDocumentPresentation();
    const openDocumentRequest = useOpenDocumentRequest();
    const setPendingNavigation = useDocumentTabsStore((s) => s.setPendingNavigation);
    const sermonsById = useSermonsById();

    return useCallback(
        (href: string): boolean => {
            const ref = parseWmbLink(href);
            if (!ref) return false;

            switch (ref.type) {
                case 'sermon': {
                    const sermon = sermonsById[ref.sermonId];
                    const documentIdentity: SermonDocumentIdentity = buildSermonDocumentIdentity(
                        ref.sermonId,
                        ref.translationId,
                        ref.languageCode,
                    );

                    const fallbackTitle =
                        sermon?.translationId === ref.translationId &&
                        sermon.languageCode === ref.languageCode
                            ? sermon.title
                            : ref.sermonId;

                    const request = buildOpenRequest(fallbackTitle, documentIdentity);

                    setPendingNavigation(
                        buildPendingNavigation(
                            request,
                            buildParagraphReference(documentIdentity, ref.paragraphIndex),
                        ),
                    );
                    openDocumentRequest(request);
                    return true;
                }
                case 'bible': {
                    const request = {
                        title: buildBibleDocumentTitle(
                            ref.bookName,
                            ref.chapter,
                            ref.bibleVersionAbbreviation,
                        ),
                        documentType: 'bible',
                        bibleBook: ref.bookCode,
                        bibleChapter: ref.chapter,
                        bibleVersionAbbreviation: ref.bibleVersionAbbreviation,
                    } as const;

                    if (ref.verse) {
                        const verse = Number.parseInt(ref.verse, 10);
                        if (!Number.isNaN(verse)) {
                            setPendingNavigation(
                                buildPendingNavigation(request, {
                                    kind: 'tree',
                                    documentIdentity: request,
                                    tree: [verse],
                                }),
                            );
                        }
                    }

                    openDocumentRequest(request);
                    return true;
                }
                case 'doc':
                    openDocumentRequest({
                        title: ref.title,
                        documentType: 'custom',
                        customDocumentId: ref.documentId,
                    });
                    return true;
                case 'book': {
                    const request = {
                        title: ref.title,
                        documentType: 'custom',
                        customDocumentId: ref.documentId,
                    } as const;

                    // Anchored on the document-wide index; the printed page and the
                    // per-page ordinal in the link are for display, not for lookup.
                    setPendingNavigation(
                        buildPendingNavigation(request, {
                            kind: 'tree',
                            documentIdentity: request,
                            tree: [ref.paragraphIndex],
                        }),
                    );
                    openDocumentRequest(request);
                    return true;
                }
            }
        },
        [buildOpenRequest, sermonsById, setPendingNavigation, openDocumentRequest],
    );
}
