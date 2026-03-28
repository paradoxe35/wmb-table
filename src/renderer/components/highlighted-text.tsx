import React, { memo, useMemo } from 'react';
import { getHighlightRanges, extractSnippetWindow } from '@shared/searchable';
import type { SearchMode, HighlightRange } from '@shared/types';

function buildPartsFromRanges(
    text: string,
    ranges: HighlightRange[],
    className?: string,
): (string | React.ReactElement)[] {
    if (ranges.length === 0) return [text];

    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;

    sorted.forEach((range, i) => {
        if (range.start > lastIndex) {
            parts.push(text.slice(lastIndex, range.start));
        }
        parts.push(
            <mark key={i} className={className}>
                {text.slice(range.start, range.end)}
            </mark>,
        );
        lastIndex = range.end;
    });

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }
    return parts;
}

function mergeRanges(ranges: HighlightRange[]): HighlightRange[] {
    if (ranges.length === 0) return [];
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged: HighlightRange[] = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = sorted[i];
        if (curr.start <= prev.end) {
            prev.end = Math.max(prev.end, curr.end);
        } else {
            merged.push({ ...curr });
        }
    }
    return merged;
}

/** Build a truncated window around the first range, adjusting positions. */
function truncateAroundRanges(
    text: string,
    ranges: HighlightRange[],
    maxChars: number,
): { text: string; ranges: HighlightRange[] } {
    if (text.length <= maxChars || ranges.length === 0) return { text, ranges };

    const center = Math.floor((ranges[0].start + ranges[0].end) / 2);
    let start = Math.max(0, center - 40);
    let end = Math.min(text.length, start + maxChars);

    if (start > 0) {
        const sp = text.indexOf(' ', start);
        if (sp !== -1 && sp < start + 20) start = sp + 1;
    }
    if (end < text.length) {
        const sp = text.lastIndexOf(' ', end);
        if (sp !== -1 && sp > end - 20) end = sp;
    }

    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';
    const windowText = prefix + text.slice(start, end) + suffix;
    const prefixLen = prefix.length;

    const adjusted = ranges
        .filter((r) => r.start >= start && r.end <= end)
        .map((r) => ({ start: r.start - start + prefixLen, end: r.end - start + prefixLen }));

    return { text: windowText, ranges: adjusted };
}

const HighlightedText = memo(function HighlightedText({
    text,
    query,
    mode,
    className,
    highlights,
    maxChars,
}: {
    text: string;
    query: string;
    mode: SearchMode;
    className?: string;
    highlights?: HighlightRange[];
    maxChars?: number;
}) {
    const parts = useMemo(() => {
        // 1. Mode-aware ranges (phrase spans for exact, individual words for all/any)
        let ranges: HighlightRange[];

        if (maxChars && text.length > maxChars) {
            const window = extractSnippetWindow(text, query, mode, maxChars);
            if (window.ranges.length > 0) {
                return buildPartsFromRanges(window.text, window.ranges, className);
            }
            ranges = [];
        } else {
            ranges = getHighlightRanges(text, query, mode);
        }

        // 2. Fallback to Tantivy highlights if our regex found nothing
        if (ranges.length === 0 && highlights && highlights.length > 0) {
            ranges = highlights;
        }

        if (ranges.length === 0) {
            return maxChars && text.length > maxChars ? [text.slice(0, maxChars) + '...'] : [text];
        }

        // 3. Truncate if needed, render
        if (maxChars && text.length > maxChars) {
            const window = truncateAroundRanges(text, mergeRanges(ranges), maxChars);
            return buildPartsFromRanges(window.text, window.ranges, className);
        }

        return buildPartsFromRanges(text, mergeRanges(ranges), className);
    }, [text, query, mode, className, highlights, maxChars]);

    return <>{parts}</>;
});

export default HighlightedText;
