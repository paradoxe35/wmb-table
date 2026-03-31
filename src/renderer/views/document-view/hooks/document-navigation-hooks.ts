import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useSearchStore, useSermonStore, selectActiveTabKey } from '@renderer/stores';
import type { CurrentDocumentIdentity } from '@renderer/utils/pending-navigation';
import { pendingNavigationMatchesDocument } from '@renderer/utils/pending-navigation';
import { paragraphHasMatch } from '@renderer/utils/searchable';
import { scrollToParagraph } from '@renderer/utils/scroll-to-paragraph';
import type { DocumentSearchParagraphMatch, HighlightRange, SearchMode } from '@shared/types';
import { isParagraphReference } from '@shared/types';

// ---------------------------------------------------------------------------
// Search highlight query
// ---------------------------------------------------------------------------

export interface SearchHighlightState {
    term: string;
    mode: SearchMode;
    matchedParagraphIndices: number[] | null;
    highlightsByParagraph: Map<number, HighlightRange[]>;
}

function buildSearchHighlightMaps(matches: DocumentSearchParagraphMatch[] | undefined) {
    if (!matches || matches.length === 0) {
        return {
            matchedParagraphIndices: null,
            highlightsByParagraph: new Map<number, HighlightRange[]>(),
        };
    }

    return {
        matchedParagraphIndices: matches.map((match) => match.paragraphIndex),
        highlightsByParagraph: new Map(
            matches.map((match) => [match.paragraphIndex, match.highlights ?? []]),
        ),
    };
}

export function useSearchHighlight(): SearchHighlightState | null {
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const query = useSearchStore((s) =>
        activeTabKey ? s.documentViewQueries[activeTabKey] : null,
    );
    return useMemo(() => {
        if (!query?.term) return null;
        const { matchedParagraphIndices, highlightsByParagraph } = buildSearchHighlightMaps(
            query.matchedParagraphs,
        );
        return {
            term: query.term,
            mode: query.mode,
            matchedParagraphIndices,
            highlightsByParagraph,
        };
    }, [query]);
}

// ---------------------------------------------------------------------------
// Reference navigation (highlights, notes, subjects, links)
// ---------------------------------------------------------------------------

export type ReferenceNavigationOptions = { contentReady: boolean } & CurrentDocumentIdentity;

export function useReferenceNavigation(
    containerRef: React.RefObject<HTMLDivElement | null>,
    options: ReferenceNavigationOptions,
) {
    const pendingNavigation = useSermonStore((s) => s.pendingNavigation);
    const clearPendingNavigation = useSermonStore((s) => s.setPendingNavigation);

    useLayoutEffect(() => {
        if (!pendingNavigation || !options.contentReady) return;
        if (!pendingNavigationMatchesDocument(pendingNavigation, options)) return;
        if (!containerRef.current) return;

        const ref = pendingNavigation.documentHtmlTree;
        const paragraphIndex = ref
            ? isParagraphReference(ref)
                ? ref.paragraphIndex
                : ref.tree?.[0]
            : undefined;
        if (paragraphIndex == null) {
            clearPendingNavigation(null);
            return;
        }

        // Try immediate scroll (before paint)
        scrollToParagraph(containerRef.current, paragraphIndex);

        // Fallback: retry with rAF if DOM isn't ready yet
        let raf = 0;
        let attemptsLeft = 120;
        const tryScroll = () => {
            if (scrollToParagraph(containerRef.current, paragraphIndex)) {
                clearPendingNavigation(null);
                return;
            }
            if (attemptsLeft <= 0) return;
            attemptsLeft -= 1;
            raf = requestAnimationFrame(tryScroll);
        };
        raf = requestAnimationFrame(tryScroll);
        return () => cancelAnimationFrame(raf);
    }, [pendingNavigation, options, clearPendingNavigation, containerRef]);
}

// ---------------------------------------------------------------------------
// Search match navigation (paragraph-based)
// ---------------------------------------------------------------------------

export function useMatchNavigation(
    containerRef: React.RefObject<HTMLDivElement | null>,
    tabKey: string | null,
    search: SearchHighlightState | null,
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
        if (search.matchedParagraphIndices) return search.matchedParagraphIndices;
        return paragraphs
            .filter((p) => paragraphHasMatch(p.content, search.term, search.mode))
            .map((p) => p.paragraphIndex);
    }, [enabled, search, paragraphs]);

    const total = matchingParagraphIndices.length;
    const currentMatchIndex = uiState?.currentMatchIndex ?? 0;
    const requestedParagraphIndex = uiState?.requestedParagraphIndex ?? null;
    const requestedMatchIndex = uiState?.requestedMatchIndex ?? null;

    const resolvedMatchIndex = useMemo(() => {
        if (requestedParagraphIndex != null) {
            const paragraphMatchIndex = matchingParagraphIndices.indexOf(requestedParagraphIndex);
            return paragraphMatchIndex >= 0 ? paragraphMatchIndex : null;
        }
        if (requestedMatchIndex != null) {
            return total > 0 ? Math.min(requestedMatchIndex, total - 1) : requestedMatchIndex;
        }
        return null;
    }, [requestedParagraphIndex, requestedMatchIndex, matchingParagraphIndices, total]);

    const requestedTargetParagraphIndex = useMemo(() => {
        if (requestedParagraphIndex != null) return requestedParagraphIndex;
        if (requestedMatchIndex == null || total === 0) return null;
        return matchingParagraphIndices[Math.min(requestedMatchIndex, total - 1)] ?? null;
    }, [requestedParagraphIndex, requestedMatchIndex, matchingParagraphIndices, total]);

    useEffect(() => {
        if (!enabled || !tabKey) return;
        setTotalMatches(tabKey, total);
    }, [enabled, tabKey, total, setTotalMatches]);

    useEffect(() => {
        if (!enabled || !tabKey || total === 0 || resolvedMatchIndex == null) return;
        if (currentMatchIndex !== resolvedMatchIndex) {
            setCurrentMatchIndex(tabKey, resolvedMatchIndex);
        }
    }, [enabled, tabKey, total, resolvedMatchIndex, currentMatchIndex, setCurrentMatchIndex]);

    useEffect(() => {
        if (
            !enabled ||
            !tabKey ||
            total === 0 ||
            resolvedMatchIndex == null ||
            requestedTargetParagraphIndex == null
        ) {
            return;
        }

        let raf = 0;
        let attemptsLeft = 120;
        let cancelled = false;

        const tryScroll = () => {
            if (cancelled) return;
            if (scrollToParagraph(containerRef.current, requestedTargetParagraphIndex)) {
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
        resolvedMatchIndex,
        requestedTargetParagraphIndex,
        clearScrollToMatchRequest,
        containerRef,
    ]);

    const activeParagraphIndex =
        requestedTargetParagraphIndex ?? matchingParagraphIndices[currentMatchIndex] ?? -1;

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
