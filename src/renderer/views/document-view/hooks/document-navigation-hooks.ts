import { useEffect, useMemo } from 'react';
import {
    useSearchStore,
    useSermonStore,
    selectActiveTab,
    selectActiveTabKey,
} from '@renderer/stores';
import { paragraphHasMatch } from '@renderer/utils/searchable';
import { scrollToParagraph } from '@renderer/utils/scroll-to-paragraph';
import type { DocumentType, ParagraphReference, SearchMode } from '@shared/types';
import { isParagraphReference } from '@shared/types';

// ---------------------------------------------------------------------------
// Search highlight query
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Reference navigation (highlights, notes, subjects, links)
// ---------------------------------------------------------------------------

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
        if (ref.sermonId && current.sermonId && ref.sermonId !== current.sermonId) return false;
        return current.translationId == null || ref.translationId === current.translationId;
    }
    if (documentType === 'bible') {
        if (current.languageCode && ref.languageCode !== current.languageCode) return false;
        if (
            ref.bibleVersionAbbreviation &&
            current.bibleVersionAbbreviation &&
            ref.bibleVersionAbbreviation !== current.bibleVersionAbbreviation
        )
            return false;
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
            if (!referenceMatchesCurrentDocument(options.documentType, ref, options)) return;
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

// ---------------------------------------------------------------------------
// Search match navigation (paragraph-based)
// ---------------------------------------------------------------------------

export function useMatchNavigation(
    containerRef: React.RefObject<HTMLDivElement | null>,
    tabKey: string | null,
    search: { term: string; mode: SearchMode } | null,
    paragraphs: { paragraphIndex: number; content: string }[],
    enabled = true,
) {
    const setTotalMatches = useSearchStore((s) => s.setTotalMatches);
    const setCurrentMatchIndex = useSearchStore((s) => s.setCurrentMatchIndex);
    const setCurrentParagraphIndex = useSearchStore((s) => s.setCurrentParagraphIndex);
    const clearScrollToMatchRequest = useSearchStore((s) => s.clearScrollToMatchRequest);
    const uiState = useSearchStore((s) => (tabKey ? s.searchUiByTab[tabKey] : undefined));

    const matchingParagraphIndices = useMemo(() => {
        if (!enabled || !search || paragraphs.length === 0) return [] as number[];
        return paragraphs
            .filter((p) => paragraphHasMatch(p.content, search.term, search.mode))
            .map((p) => p.paragraphIndex);
    }, [enabled, search, paragraphs]);

    const total = matchingParagraphIndices.length;
    const currentMatchIndex = uiState?.currentMatchIndex ?? 0;
    const requestedParagraphIndex = uiState?.requestedParagraphIndex ?? null;
    const requestedMatchIndex = uiState?.requestedMatchIndex ?? null;

    const pendingMatchIndex = useMemo(() => {
        if (requestedParagraphIndex != null) {
            const paragraphMatchIndex = matchingParagraphIndices.indexOf(requestedParagraphIndex);
            return paragraphMatchIndex >= 0 ? paragraphMatchIndex : null;
        }
        if (requestedMatchIndex != null) {
            return total > 0 ? Math.min(requestedMatchIndex, total - 1) : requestedMatchIndex;
        }
        return null;
    }, [requestedParagraphIndex, requestedMatchIndex, matchingParagraphIndices, total]);

    const pendingParagraphIndex = useMemo(() => {
        if (requestedParagraphIndex != null) return requestedParagraphIndex;
        if (requestedMatchIndex == null || total === 0) return null;
        return matchingParagraphIndices[Math.min(requestedMatchIndex, total - 1)] ?? null;
    }, [requestedParagraphIndex, requestedMatchIndex, matchingParagraphIndices, total]);

    useEffect(() => {
        if (!enabled || !tabKey) return;
        setTotalMatches(tabKey, total);
    }, [enabled, tabKey, total, setTotalMatches]);

    useEffect(() => {
        if (!enabled || !tabKey || total === 0 || pendingMatchIndex == null) return;
        if (currentMatchIndex !== pendingMatchIndex) {
            setCurrentMatchIndex(tabKey, pendingMatchIndex);
        }
    }, [enabled, tabKey, total, pendingMatchIndex, currentMatchIndex, setCurrentMatchIndex]);

    useEffect(() => {
        if (
            !enabled ||
            !tabKey ||
            total === 0 ||
            pendingMatchIndex == null ||
            pendingParagraphIndex == null
        ) {
            return;
        }

        let raf = 0;
        let attemptsLeft = 120;
        let cancelled = false;

        const tryScroll = () => {
            if (cancelled) return;
            if (scrollToParagraph(containerRef.current, pendingParagraphIndex)) {
                clearScrollToMatchRequest(tabKey);
                return;
            }
            if (attemptsLeft <= 0) return;
            attemptsLeft -= 1;
            raf = requestAnimationFrame(tryScroll);
        };

        raf = requestAnimationFrame(tryScroll);
        return () => {
            cancelled = true;
            cancelAnimationFrame(raf);
        };
    }, [
        enabled,
        tabKey,
        total,
        pendingMatchIndex,
        pendingParagraphIndex,
        clearScrollToMatchRequest,
        containerRef,
    ]);

    const activeParagraphIndex =
        pendingParagraphIndex ?? matchingParagraphIndices[currentMatchIndex] ?? -1;

    useEffect(() => {
        if (!enabled || !tabKey) return;
        const nextParagraphIndex = activeParagraphIndex >= 0 ? activeParagraphIndex : null;
        if (uiState?.currentParagraphIndex !== nextParagraphIndex) {
            setCurrentParagraphIndex(tabKey, nextParagraphIndex);
        }
    }, [
        enabled,
        tabKey,
        activeParagraphIndex,
        uiState?.currentParagraphIndex,
        setCurrentParagraphIndex,
    ]);

    return { activeParagraphIndex };
}
