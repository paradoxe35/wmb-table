import { useEffect, useMemo } from 'react';
import {
    useSearchStore,
    useSermonStore,
    selectActiveTab,
    selectActiveTabKey,
} from '@renderer/stores';
import { buildHighlightRegex, strNormalizeNoLower } from '@renderer/utils/searchable';
import { scrollToParagraph } from '@renderer/utils/scroll-to-paragraph';
import type { DocumentType, ParagraphReference, SearchMode } from '@shared/types';
import { isParagraphReference } from '@shared/types';

export function useSearchHighlight(): { term: string; mode: SearchMode } | null {
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const query = useSearchStore((s) =>
        activeTabKey ? s.documentViewQueries[activeTabKey] : null,
    );

    return useMemo(() => {
        if (!query?.term) return null;
        return { term: query.term, mode: query.mode };
    }, [query]);
}

function referenceMatchesCurrentDocument(
    documentType: DocumentType,
    ref: ParagraphReference,
    current: {
        title?: string;
        sermonId?: string;
        translationId?: number;
        languageCode?: string;
        bibleVersionAbbreviation?: string;
        customDocumentId?: string;
    },
): boolean {
    if (ref.documentType && ref.documentType !== documentType) return false;
    if (documentType === 'custom') {
        return !ref.customDocumentId || ref.customDocumentId === current.customDocumentId;
    }
    if (documentType === 'sermon') {
        if (ref.sermonId && current.sermonId && ref.sermonId !== current.sermonId) {
            return false;
        }
        return current.translationId == null || ref.translationId === current.translationId;
    }
    if (documentType === 'bible') {
        if (current.languageCode && ref.languageCode !== current.languageCode) {
            return false;
        }
        if (
            ref.bibleVersionAbbreviation &&
            current.bibleVersionAbbreviation &&
            ref.bibleVersionAbbreviation !== current.bibleVersionAbbreviation
        ) {
            return false;
        }
        return true;
    }
    return true;
}

export function useReferenceNavigation(
    containerRef: React.RefObject<HTMLDivElement | null>,
    options: {
        contentReady: boolean;
        documentType: DocumentType;
        title?: string;
        sermonId?: string;
        translationId?: number;
        languageCode?: string;
        bibleVersionAbbreviation?: string;
        customDocumentId?: string;
    },
) {
    const pendingNavigation = useSermonStore((s) => s.pendingNavigation);
    const setPendingNavigation = useSermonStore((s) => s.setPendingNavigation);
    const activeTab = useSermonStore(selectActiveTab);

    useEffect(() => {
        if (!pendingNavigation || !activeTab || !options.contentReady) return;
        if (pendingNavigation.documentTitle !== activeTab.title) return;
        if (!containerRef.current) return;

        const ref = pendingNavigation.documentHtmlTree;
        if (isParagraphReference(ref)) {
            const matchesCurrentDocument = referenceMatchesCurrentDocument(
                options.documentType,
                ref,
                {
                    title: options.title,
                    sermonId: options.sermonId,
                    translationId: options.translationId,
                    languageCode: options.languageCode,
                    bibleVersionAbbreviation: options.bibleVersionAbbreviation,
                    customDocumentId: options.customDocumentId,
                },
            );
            if (!matchesCurrentDocument) return;
        }

        const paragraphIndex = ref
            ? isParagraphReference(ref)
                ? ref.paragraphIndex
                : ref.tree?.[0]
            : undefined;
        if (paragraphIndex == null) {
            setPendingNavigation(null);
            return;
        }

        let raf = 0;
        let attemptsLeft = 120;

        const tryScroll = () => {
            if (scrollToParagraph(containerRef.current, paragraphIndex)) {
                setPendingNavigation(null);
                return;
            }
            if (attemptsLeft <= 0) return;
            attemptsLeft -= 1;
            raf = requestAnimationFrame(tryScroll);
        };

        raf = requestAnimationFrame(tryScroll);
        return () => cancelAnimationFrame(raf);
    }, [pendingNavigation, activeTab, options, setPendingNavigation, containerRef]);
}

export function useMatchNavigation(
    tabKey: string | null,
    search: { term: string; mode: SearchMode } | null,
    paragraphs: string[],
    enabled = true,
) {
    const setTotalMatches = useSearchStore((s) => s.setTotalMatches);
    const setCurrentMatchIndex = useSearchStore((s) => s.setCurrentMatchIndex);
    const requestState = useSearchStore((s) => (tabKey ? s.searchUiByTab[tabKey] : undefined));
    const currentMatchIndex = requestState?.currentMatchIndex ?? 0;
    const requestedMatchIndex = requestState?.requestedMatchIndex ?? null;
    const clearScrollToMatchRequest = useSearchStore((s) => s.clearScrollToMatchRequest);

    const { matchOffsets, total } = useMemo(() => {
        if (!enabled) return { matchOffsets: [] as number[], total: 0 };
        if (!search) return { matchOffsets: [] as number[], total: 0 };
        const regex = buildHighlightRegex(search.term, search.mode, false);
        if (!regex) return { matchOffsets: [] as number[], total: 0 };
        let cumulative = 0;
        const offsets: number[] = [];
        for (const text of paragraphs) {
            offsets.push(cumulative);
            regex.lastIndex = 0;
            const matches = [...strNormalizeNoLower(text).matchAll(regex)];
            cumulative += matches.length;
        }
        return { matchOffsets: offsets, total: cumulative };
    }, [enabled, search, paragraphs]);

    useEffect(() => {
        if (!tabKey) return;
        setTotalMatches(tabKey, total);
        if (total === 0) {
            setCurrentMatchIndex(tabKey, 0);
        }
    }, [tabKey, total, setTotalMatches, setCurrentMatchIndex]);

    useEffect(() => {
        if (!enabled || !tabKey) return;
        if (total === 0 || requestedMatchIndex == null) return;
        let raf = 0;
        let attemptsLeft = 120;
        const targetMatchIndex = Math.min(requestedMatchIndex, total - 1);

        if (targetMatchIndex !== currentMatchIndex) {
            setCurrentMatchIndex(tabKey, targetMatchIndex);
        }

        const tryScrollToMatch = () => {
            const el = document.querySelector(`[data-match-index="${targetMatchIndex}"]`);
            if (el) {
                clearScrollToMatchRequest(tabKey);
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            if (attemptsLeft <= 0) {
                return;
            }

            attemptsLeft -= 1;
            raf = requestAnimationFrame(tryScrollToMatch);
        };

        raf = requestAnimationFrame(tryScrollToMatch);
        return () => cancelAnimationFrame(raf);
    }, [
        enabled,
        tabKey,
        total,
        requestedMatchIndex,
        currentMatchIndex,
        setCurrentMatchIndex,
        clearScrollToMatchRequest,
    ]);

    return { matchOffsets, total };
}
