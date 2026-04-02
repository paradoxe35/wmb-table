import { useCallback } from 'react';
import { buildPendingNavigation, useDocumentPresentation, useOpenDocumentRequest } from './index';
import { useDocumentTabsStore, useSermonStore } from '@renderer/stores';
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
 */

/**
 * Hook that returns a function to navigate to a wmb:// link.
 * Returns true if the link was handled, false otherwise.
 */
export function useWmbLinkNavigate(): (href: string) => boolean {
    const { buildOpenRequest } = useDocumentPresentation();
    const openDocumentRequest = useOpenDocumentRequest();
    const setPendingNavigation = useDocumentTabsStore((s) => s.setPendingNavigation);
    const sermonsById = useSermonStore((s) => s.sermonsById);

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
                    openDocumentRequest({
                        title: buildBibleDocumentTitle(
                            ref.bookName,
                            ref.chapter,
                            ref.bibleVersionAbbreviation,
                        ),
                        documentType: 'bible',
                        bibleBook: ref.bookCode,
                        bibleChapter: ref.chapter,
                        bibleVersionAbbreviation: ref.bibleVersionAbbreviation,
                    });
                    return true;
                }
                case 'doc':
                    openDocumentRequest({
                        title: ref.title,
                        documentType: 'custom',
                        customDocumentId: ref.documentId,
                    });
                    return true;
            }
        },
        [buildOpenRequest, sermonsById, setPendingNavigation, openDocumentRequest],
    );
}
