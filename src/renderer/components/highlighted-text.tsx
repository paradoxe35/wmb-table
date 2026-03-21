import React, { memo, useMemo } from 'react';
import { strNormalizeNoLower, buildHighlightRegex } from '@shared/searchable';
import type { SearchMode, HighlightRange } from '@shared/types';

/**
 * Build React elements from pre-computed highlight ranges (from Tantivy).
 * Used for search results where Tantivy provides fuzzy-aware positions.
 */
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

/**
 * Build React elements from regex matching (for Ctrl+F, Bible search).
 * Accent-aware (NFD-normalized) while preserving original text for display.
 */
function buildPartsFromRegex(
    text: string,
    query: string,
    mode: SearchMode,
    className?: string,
): (string | React.ReactElement)[] {
    const regex = buildHighlightRegex(query, mode);
    if (!regex) return [text];

    const normalized = strNormalizeNoLower(text);
    const matches = [...normalized.matchAll(regex)];
    if (matches.length === 0) return [text];

    const ranges: HighlightRange[] = matches.map((m) => ({
        start: m.index!,
        end: m.index! + m[0].length,
    }));

    return buildPartsFromRanges(text, ranges, className);
}

/**
 * Renders text with `<mark>` highlights.
 *
 * Two modes:
 * - **Tantivy highlights** (when `highlights` prop is provided): uses pre-computed
 *   ranges from Tantivy's SnippetGenerator — fuzzy-aware, handles edit distance matches.
 * - **Regex fallback** (when no `highlights`): uses `buildHighlightRegex` for exact
 *   matching — used by Ctrl+F inline search and Bible search.
 */
const HighlightedText = memo(function HighlightedText({
    text,
    query,
    mode,
    className,
    highlights,
}: {
    text: string;
    query: string;
    mode: SearchMode;
    className?: string;
    highlights?: HighlightRange[];
}) {
    const parts = useMemo(() => {
        if (highlights && highlights.length > 0) {
            return buildPartsFromRanges(text, highlights, className);
        }
        return buildPartsFromRegex(text, query, mode, className);
    }, [text, query, mode, className, highlights]);

    return <>{parts}</>;
});

export default HighlightedText;
