import { useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { getDocumentIdentityKey, type DocumentIdentity } from '@shared/types';
import { selectCurrentTtsSegment, useTtsStore } from '@renderer/stores/tts.store';

interface ParagraphAnchor {
    documentKey: string;
    paragraphIndex: number;
    offset: number;
}

interface UseDocumentParagraphAnchorOptions {
    containerRef: RefObject<HTMLDivElement | null>;
    documentIdentity: DocumentIdentity | null;
    pendingParagraphIndex: number | null;
    readingMode: boolean;
    ready: boolean;
    zoom: number;
}

function findParagraphElement(
    container: HTMLDivElement,
    paragraphIndex: number,
): HTMLElement | null {
    return container.querySelector<HTMLElement>(`[data-paragraph-index="${paragraphIndex}"]`);
}

function findFirstVisibleParagraph(container: HTMLDivElement): HTMLElement | null {
    const containerTop = container.getBoundingClientRect().top;
    return (
        Array.from(container.querySelectorAll<HTMLElement>('[data-paragraph-index]')).find(
            (paragraph) => paragraph.getBoundingClientRect().bottom > containerTop,
        ) ?? null
    );
}

function captureAnchor(
    container: HTMLDivElement,
    documentKey: string | null,
    pendingParagraphIndex: number | null,
    ttsParagraphIndex: number | null,
): ParagraphAnchor | null {
    if (!documentKey) {
        return null;
    }

    const anchorParagraph =
        (pendingParagraphIndex != null
            ? findParagraphElement(container, pendingParagraphIndex)
            : null) ??
        (ttsParagraphIndex != null ? findParagraphElement(container, ttsParagraphIndex) : null) ??
        findFirstVisibleParagraph(container);

    const paragraphIndex = Number(anchorParagraph?.dataset.paragraphIndex);
    if (!anchorParagraph || !Number.isFinite(paragraphIndex)) {
        return null;
    }

    return {
        documentKey,
        paragraphIndex,
        offset: anchorParagraph.getBoundingClientRect().top - container.getBoundingClientRect().top,
    };
}

function restoreAnchor(container: HTMLDivElement, anchor: ParagraphAnchor): void {
    const target = findParagraphElement(container, anchor.paragraphIndex);
    if (!target) {
        return;
    }

    const containerTop = container.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    container.scrollTop += targetTop - containerTop - anchor.offset;
}

export function useDocumentParagraphAnchor({
    containerRef,
    documentIdentity,
    pendingParagraphIndex,
    readingMode,
    ready,
    zoom,
}: UseDocumentParagraphAnchorOptions): void {
    const documentKey = useMemo(
        () => (documentIdentity ? getDocumentIdentityKey(documentIdentity) : null),
        [documentIdentity],
    );
    const ttsParagraphIndex = useTtsStore((state) => {
        const currentSegment = selectCurrentTtsSegment(state);
        const isCurrentDocument = documentKey != null && state.documentKey === documentKey;
        const hasActivePosition =
            state.status === 'playing' || state.status === 'loading' || state.status === 'paused';

        if (!isCurrentDocument || !hasActivePosition || currentSegment?.paragraphIndex == null) {
            return null;
        }

        return currentSegment.paragraphIndex;
    });

    const anchorRef = useRef<ParagraphAnchor | null>(null);
    const initializedDocumentKeyRef = useRef<string | null>(null);

    // Sync capture during render reads the DOM before the new layout commits,
    // so the anchor reflects the pre-shift offset by the time useLayoutEffect runs.
    const container = containerRef.current;
    if (ready && container && documentKey) {
        const captured = captureAnchor(
            container,
            documentKey,
            pendingParagraphIndex,
            ttsParagraphIndex,
        );
        if (captured) {
            anchorRef.current = captured;
        }
    }

    useLayoutEffect(() => {
        const el = containerRef.current;
        const anchor = anchorRef.current;

        if (!ready || !el || !documentKey) {
            return;
        }

        if (initializedDocumentKeyRef.current !== documentKey) {
            initializedDocumentKeyRef.current = documentKey;
            return;
        }

        if (!anchor || anchor.documentKey !== documentKey) {
            return;
        }

        restoreAnchor(el, anchor);

        const frameId = requestAnimationFrame(() => {
            const currentAnchor = anchorRef.current;
            if (currentAnchor && currentAnchor.documentKey === documentKey) {
                restoreAnchor(el, currentAnchor);
            }
        });

        return () => cancelAnimationFrame(frameId);
    }, [containerRef, documentKey, readingMode, ready, zoom]);
}
