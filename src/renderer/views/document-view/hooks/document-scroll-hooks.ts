import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppStore, useSermonStore, selectActiveTab, selectActiveTabKey } from '@renderer/stores';
import { debounce } from '@renderer/utils/functions';
import type { ReadingPosition } from '@shared/types';

type ScrollRestoreOptions = {
    contentReady?: boolean;
    restoreIdentity?: string | null;
    readingPositionKey?: string | null;
};

type ResolvedScrollRestoreOptions = {
    contentReady: boolean;
    restoreIdentity: string | null;
    readingPositionKey: string | null;
};

type RestoreState = {
    restoreScrollTop: number;
    restoreToken: string | null;
    saveToken: string | null;
};

function resolveScrollRestoreOptions(
    options: ScrollRestoreOptions,
    rememberReadingPosition: boolean,
): ResolvedScrollRestoreOptions {
    return {
        contentReady: options.contentReady ?? true,
        restoreIdentity: options.restoreIdentity ?? null,
        readingPositionKey: rememberReadingPosition ? (options.readingPositionKey ?? null) : null,
    };
}

function buildRestoreState({
    activeTabKey,
    activeTabScrollY,
    contentReady,
    rememberReadingPosition,
    readingPositionKey,
    restoreIdentity,
    savedPosition,
    savedPositionLoaded,
}: {
    activeTabKey: string | null;
    activeTabScrollY: number | undefined;
    contentReady: boolean;
    rememberReadingPosition: boolean;
    readingPositionKey: string | null;
    restoreIdentity: string | null;
    savedPosition: ReadingPosition | null;
    savedPositionLoaded: boolean;
}): RestoreState {
    const restoreScrollTop = rememberReadingPosition
        ? (savedPosition?.scrollY ?? activeTabScrollY ?? 0)
        : (activeTabScrollY ?? 0);
    const hasImmediateScroll = activeTabScrollY != null;
    const waitingOnPersistedPosition = !!readingPositionKey && !savedPositionLoaded;
    const canRestore =
        contentReady && !!restoreIdentity && (hasImmediateScroll || !waitingOnPersistedPosition);

    return {
        restoreScrollTop,
        restoreToken:
            canRestore && activeTabKey && restoreIdentity
                ? `${activeTabKey}::${restoreIdentity}::${hasImmediateScroll ? 'tab' : 'saved'}`
                : null,
        saveToken:
            contentReady && activeTabKey && restoreIdentity
                ? `${activeTabKey}::${restoreIdentity}`
                : null,
    };
}

export function useDocumentZoom(zoom: number) {
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const updateTabZoom = useSermonStore((s) => s.updateTabZoom);

    const zoomIn = useCallback(() => {
        if (activeTabKey) updateTabZoom(activeTabKey, Math.min(zoom + 10, 200));
    }, [activeTabKey, zoom, updateTabZoom]);

    const zoomOut = useCallback(() => {
        if (activeTabKey) updateTabZoom(activeTabKey, Math.max(zoom - 10, 50));
    }, [activeTabKey, zoom, updateTabZoom]);

    return { zoomIn, zoomOut };
}

export function useScrollAndZoom(
    containerRef: React.RefObject<HTMLDivElement | null>,
    options: ScrollRestoreOptions = {},
) {
    const activeTab = useSermonStore(selectActiveTab);
    const updateTabScroll = useSermonStore((s) => s.updateTabScroll);
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const rememberReadingPosition = useAppStore((s) => s.rememberReadingPosition);
    const lastRestoredKeyRef = useRef<string | null>(null);
    const [savedPosition, setSavedPosition] = useState<ReadingPosition | null>(null);
    const [savedPositionLoaded, setSavedPositionLoaded] = useState(false);
    const resolvedOptions = resolveScrollRestoreOptions(options, rememberReadingPosition);
    const { contentReady, restoreIdentity, readingPositionKey } = resolvedOptions;

    const zoom = activeTab?.zoom ?? 100;
    const { restoreScrollTop, restoreToken, saveToken } = buildRestoreState({
        activeTabKey,
        activeTabScrollY: activeTab?.scrollY,
        contentReady,
        rememberReadingPosition,
        readingPositionKey,
        restoreIdentity,
        savedPosition,
        savedPositionLoaded,
    });

    useEffect(() => {
        if (!readingPositionKey) {
            setSavedPosition(null);
            setSavedPositionLoaded(true);
            return;
        }

        let cancelled = false;
        setSavedPosition(null);
        setSavedPositionLoaded(false);

        window.api.documents
            .getReadingPosition(readingPositionKey)
            .then((position) => {
                if (!cancelled) setSavedPosition(position);
            })
            .catch(() => {
                if (!cancelled) setSavedPosition(null);
            })
            .finally(() => {
                if (!cancelled) setSavedPositionLoaded(true);
            });

        return () => {
            cancelled = true;
        };
    }, [readingPositionKey]);

    // Reset the restore guard when the active tab changes so scroll is
    // re-applied when the user switches back to a previously viewed tab.
    useEffect(() => {
        lastRestoredKeyRef.current = null;
    }, [activeTabKey]);

    useLayoutEffect(() => {
        if (!restoreToken || !containerRef.current || !activeTab) {
            return;
        }
        if (lastRestoredKeyRef.current === restoreToken) {
            return;
        }

        lastRestoredKeyRef.current = restoreToken;

        // Skip scroll restoration when a pending navigation will handle scrolling.
        // Read as snapshot to avoid re-running this effect when pendingNavigation clears.
        const pending = useSermonStore.getState().pendingNavigation;
        if (pending && pending.documentTitle === activeTab.title) {
            return;
        }
        const el = containerRef.current;
        const targetScrollTop = restoreScrollTop;
        let frameId = 0;
        let attemptsLeft = 12;

        const restoreScroll = () => {
            el.scrollTop = targetScrollTop;

            if (Math.abs(el.scrollTop - targetScrollTop) <= 1 || attemptsLeft <= 0) {
                return;
            }

            attemptsLeft -= 1;
            frameId = requestAnimationFrame(restoreScroll);
        };

        restoreScroll();
        return () => cancelAnimationFrame(frameId);
    }, [activeTab, restoreScrollTop, restoreToken, containerRef]);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el || !saveToken || !activeTabKey) return;
        let lastScrollTop = el.scrollTop;
        const handler = debounce(() => {
            if (readingPositionKey) {
                void window.api.documents.saveReadingPosition(readingPositionKey, lastScrollTop);
            }
        }, 500);
        const onScroll = () => {
            // Ignore scroll resets caused by parent becoming display:none
            if (!el.offsetParent) return;
            lastScrollTop = el.scrollTop;
            updateTabScroll(activeTabKey, lastScrollTop);
            handler();
        };
        el.addEventListener('scroll', onScroll);
        return () => {
            handler.cancel();
            el.removeEventListener('scroll', onScroll);
            updateTabScroll(activeTabKey, lastScrollTop);
            if (readingPositionKey) {
                void window.api.documents.saveReadingPosition(readingPositionKey, lastScrollTop);
            }
        };
    }, [activeTabKey, readingPositionKey, saveToken, updateTabScroll, containerRef]);

    return { zoom };
}
