import { useTtsStore, selectCurrentTtsSegment } from '@renderer/stores/tts.store';

export function useTtsHighlight(
    paragraphIndex: number,
    documentKey: string,
): {
    isActive: boolean;
    highlightRange: { start: number; end: number } | null;
} {
    const { isActive, startOffset, endOffset } = useTtsStore((s) => {
        const currentSegment = selectCurrentTtsSegment(s);
        const active =
            s.documentKey === documentKey &&
            (s.status === 'playing' || s.status === 'loading') &&
            currentSegment?.paragraphIndex === paragraphIndex;

        return {
            isActive: active,
            startOffset: active && currentSegment ? currentSegment.startOffset : null,
            endOffset: active && currentSegment ? currentSegment.endOffset : null,
        };
    });

    return {
        isActive,
        highlightRange:
            isActive && startOffset != null && endOffset != null
                ? { start: startOffset, end: endOffset }
                : null,
    };
}
