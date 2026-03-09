import React, { memo } from 'react';
import { strNormalizeNoLower, buildHighlightRegex } from '@renderer/utils/searchable';
import type { SermonParagraph as SermonParagraphType, SearchMode } from '@shared/types';

type ParagraphProp = Pick<SermonParagraphType, 'paragraphIndex' | 'content'>;

const SermonParagraphView = memo(function SermonParagraphView({
    paragraph,
    search,
    currentMatchIndex,
    matchOffset,
}: {
    paragraph: ParagraphProp;
    search: { term: string; mode: SearchMode } | null;
    currentMatchIndex: number;
    matchOffset: number;
}) {
    const renderContent = () => {
        if (!search) return paragraph.content;

        const regex = buildHighlightRegex(search.term, search.mode);
        if (!regex) return paragraph.content;

        const normalized = strNormalizeNoLower(paragraph.content);
        const matches = [...normalized.matchAll(regex)];
        if (matches.length === 0) return paragraph.content;

        const result: (string | React.ReactElement)[] = [];
        let lastIndex = 0;
        matches.forEach((m, i) => {
            const start = m.index!;
            const end = start + m[0].length;
            if (start > lastIndex) result.push(paragraph.content.slice(lastIndex, start));
            const globalIdx = matchOffset + i;
            const isCurrent = globalIdx === currentMatchIndex;
            result.push(
                <mark
                    key={i}
                    data-match-index={globalIdx}
                    className={isCurrent ? 'mark-current' : undefined}
                >
                    {paragraph.content.slice(start, end)}
                </mark>,
            );
            lastIndex = end;
        });
        if (lastIndex < paragraph.content.length) result.push(paragraph.content.slice(lastIndex));
        return result;
    };

    return (
        <p data-paragraph-index={paragraph.paragraphIndex} className="sermon-paragraph">
            <span className="line-number">{paragraph.paragraphIndex}</span>
            {renderContent()}
        </p>
    );
});

export default SermonParagraphView;
