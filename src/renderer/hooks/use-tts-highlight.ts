import { useTtsStore, selectCurrentTtsSegment } from '@renderer/stores/tts.store';

export function useTtsHighlight(
    paragraphIndex: number,
    documentId: string,
): {
    isActive: boolean;
    highlightRange: { start: number; end: number } | null;
} {
    const currentSegment = useTtsStore(selectCurrentTtsSegment);
    const status = useTtsStore((s) => s.status);
    const storeDocumentId = useTtsStore((s) => s.documentId);
    const isActive =
        storeDocumentId === documentId &&
        (status === 'playing' || status === 'loading') &&
        currentSegment?.paragraphIndex === paragraphIndex;
    const highlightRange =
        isActive && currentSegment
            ? { start: currentSegment.startOffset, end: currentSegment.endOffset }
            : null;
    return { isActive, highlightRange };
}
