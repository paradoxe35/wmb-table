import React, { memo, useMemo } from 'react';
import { strNormalizeNoLower, buildHighlightRegex } from '@shared/searchable';
import type { SearchMode } from '@shared/types';

/**
 * Renders text with `<mark>` highlights around regex matches.
 * Matching is accent-aware (NFD-normalized) while preserving original text for display.
 */
const HighlightedText = memo(function HighlightedText({
    text,
    query,
    mode,
    className,
}: {
    text: string;
    query: string;
    mode: SearchMode;
    className?: string;
}) {
    const parts = useMemo(() => {
        const regex = buildHighlightRegex(query, mode);
        if (!regex) return [text];

        const normalized = strNormalizeNoLower(text);
        const matches = [...normalized.matchAll(regex)];
        if (matches.length === 0) return [text];

        const result: (string | React.ReactElement)[] = [];
        let lastIndex = 0;
        matches.forEach((m, i) => {
            const start = m.index!;
            const end = start + m[0].length;
            if (start > lastIndex) {
                result.push(text.slice(lastIndex, start));
            }
            result.push(
                <mark key={i} className={className}>
                    {text.slice(start, end)}
                </mark>,
            );
            lastIndex = end;
        });
        if (lastIndex < text.length) {
            result.push(text.slice(lastIndex));
        }
        return result;
    }, [text, query, mode, className]);

    return <>{parts}</>;
});

export default HighlightedText;
