import React, { memo } from 'react';
import { Tooltip } from 'antd';
import { strNormalizeNoLower, buildHighlightRegex } from '@renderer/utils/searchable';
import type {
    SermonParagraph as SermonParagraphType,
    SearchMode,
    HighlightItem,
} from '@shared/types';

type ParagraphProp = Pick<SermonParagraphType, 'paragraphIndex' | 'content'>;

interface HighlightRange {
    start: number;
    end: number;
    color: string;
    comment?: string;
    type: 'search' | 'persistent';
    matchIndex?: number;
    isCurrent?: boolean;
}

function mergeRanges(
    searchRanges: HighlightRange[],
    persistentRanges: HighlightRange[],
): HighlightRange[] {
    const all = [...searchRanges, ...persistentRanges];
    all.sort((a, b) => a.start - b.start || a.end - b.end);
    return all;
}

function renderWithRanges(
    content: string,
    ranges: HighlightRange[],
): (string | React.ReactElement)[] {
    if (ranges.length === 0) return [content];

    const result: (string | React.ReactElement)[] = [];
    let lastIndex = 0;

    for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        const start = Math.max(range.start, lastIndex);
        const end = range.end;
        if (start >= end) continue;

        if (start > lastIndex) {
            result.push(content.slice(lastIndex, start));
        }

        const text = content.slice(start, end);
        if (range.type === 'search') {
            result.push(
                <mark
                    key={`s-${i}`}
                    data-match-index={range.matchIndex}
                    className={range.isCurrent ? 'mark-current' : undefined}
                >
                    {text}
                </mark>,
            );
        } else {
            const el = (
                <mark key={`h-${i}`} style={{ backgroundColor: range.color, borderRadius: 2 }}>
                    {text}
                </mark>
            );
            result.push(
                range.comment ? (
                    <Tooltip key={`ht-${i}`} title={range.comment}>
                        {el}
                    </Tooltip>
                ) : (
                    el
                ),
            );
        }
        lastIndex = end;
    }

    if (lastIndex < content.length) {
        result.push(content.slice(lastIndex));
    }

    return result;
}

const SermonParagraphView = memo(function SermonParagraphView({
    paragraph,
    search,
    currentMatchIndex,
    matchOffset,
    highlights,
}: {
    paragraph: ParagraphProp;
    search: { term: string; mode: SearchMode } | null;
    currentMatchIndex: number;
    matchOffset: number;
    highlights?: HighlightItem[];
}) {
    const renderContent = () => {
        const searchRanges: HighlightRange[] = [];
        const persistentRanges: HighlightRange[] = [];

        // Build search ranges
        if (search) {
            const regex = buildHighlightRegex(search.term, search.mode);
            if (regex) {
                const normalized = strNormalizeNoLower(paragraph.content);
                const matches = [...normalized.matchAll(regex)];
                matches.forEach((m, i) => {
                    const globalIdx = matchOffset + i;
                    searchRanges.push({
                        start: m.index!,
                        end: m.index! + m[0].length,
                        color: '',
                        type: 'search',
                        matchIndex: globalIdx,
                        isCurrent: globalIdx === currentMatchIndex,
                    });
                });
            }
        }

        // Build persistent highlight ranges
        if (highlights?.length) {
            for (const h of highlights) {
                persistentRanges.push({
                    start: h.startOffset,
                    end: Math.min(h.endOffset, paragraph.content.length),
                    color: h.color,
                    comment: h.comment,
                    type: 'persistent',
                });
            }
        }

        const allRanges = mergeRanges(searchRanges, persistentRanges);
        if (allRanges.length === 0) return paragraph.content;

        return renderWithRanges(paragraph.content, allRanges);
    };

    return (
        <p data-paragraph-index={paragraph.paragraphIndex} className="sermon-paragraph">
            <span className="line-number">{paragraph.paragraphIndex}</span>
            {renderContent()}
        </p>
    );
});

export default SermonParagraphView;
