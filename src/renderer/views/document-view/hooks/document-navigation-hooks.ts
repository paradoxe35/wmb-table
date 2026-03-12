import { useEffect, useMemo } from 'react';
import {
    useSearchStore,
    useSermonStore,
    selectActiveTab,
    selectActiveTabTitle,
} from '@renderer/stores';
import { buildHighlightRegex, strNormalizeNoLower } from '@renderer/utils/searchable';
import { scrollToParagraph } from '@renderer/utils/scroll-to-paragraph';
import type { SearchMode } from '@shared/types';
import { isParagraphReference } from '@shared/types';

export function useSearchHighlight(): { term: string; mode: SearchMode } | null {
    const documentViewQueries = useSearchStore((s) => s.documentViewQueries);
    const activeTitle = useSermonStore(selectActiveTabTitle);

    return useMemo(() => {
        if (!activeTitle) return null;
        const query = documentViewQueries.find((q) => q.documentTitle === activeTitle);
        if (!query?.term) return null;
        return { term: query.term, mode: query.mode };
    }, [documentViewQueries, activeTitle]);
}

export function useReferenceNavigation(containerRef: React.RefObject<HTMLDivElement | null>) {
    const pendingNavigation = useSermonStore((s) => s.pendingNavigation);
    const setPendingNavigation = useSermonStore((s) => s.setPendingNavigation);
    const activeTab = useSermonStore(selectActiveTab);
    const activeContent = useSermonStore((s) => s.activeContent);

    useEffect(() => {
        if (!pendingNavigation || !activeTab) return;
        if (pendingNavigation.documentTitle !== activeTab.title) return;
        if (!activeContent || activeContent.meta.sermonId !== activeTab.sermonId) return;
        if (!containerRef.current) return;

        const ref = pendingNavigation.documentHtmlTree;
        const paragraphIndex = ref
            ? isParagraphReference(ref)
                ? ref.paragraphIndex
                : ref.tree?.[0]
            : undefined;
        if (paragraphIndex == null) {
            setPendingNavigation(null);
            return;
        }

        const tryScroll = () => scrollToParagraph(containerRef.current, paragraphIndex);
        if (tryScroll()) {
            setPendingNavigation(null);
            return;
        }

        const timer = setTimeout(() => {
            tryScroll();
            setPendingNavigation(null);
        }, 300);
        return () => clearTimeout(timer);
    }, [pendingNavigation, activeTab, activeContent, setPendingNavigation, containerRef]);
}

export function useMatchNavigation(
    search: { term: string; mode: SearchMode } | null,
    paragraphs: string[],
) {
    const setTotalMatches = useSearchStore((s) => s.setTotalMatches);
    const setCurrentMatchIndex = useSearchStore((s) => s.setCurrentMatchIndex);
    const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);
    const scrollToMatchRequested = useSearchStore((s) => s.scrollToMatchRequested);
    const clearScrollToMatchRequest = useSearchStore((s) => s.clearScrollToMatchRequest);

    const { matchOffsets, total } = useMemo(() => {
        if (!search) return { matchOffsets: [] as number[], total: 0 };
        const regex = buildHighlightRegex(search.term, search.mode);
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
    }, [search, paragraphs]);

    useEffect(() => {
        setTotalMatches(total);
        setCurrentMatchIndex(0);
    }, [total, setTotalMatches, setCurrentMatchIndex]);

    useEffect(() => {
        if (total === 0 || !scrollToMatchRequested) return;
        clearScrollToMatchRequest();
        const raf = requestAnimationFrame(() => {
            const el = document.querySelector(`[data-match-index="${currentMatchIndex}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return () => cancelAnimationFrame(raf);
    }, [currentMatchIndex, total, scrollToMatchRequested, clearScrollToMatchRequest]);

    return { matchOffsets, total };
}
