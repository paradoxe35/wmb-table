import React, { memo } from 'react';
import { simpleRegExp } from '@renderer/utils/searchable';
import type { SermonParagraph as SermonParagraphType } from '@shared/types';

const SermonParagraphView = memo(function SermonParagraphView({
    paragraph,
    searchTerm,
    currentMatchIndex,
    matchOffset,
}: {
    paragraph: SermonParagraphType;
    searchTerm: string | null;
    currentMatchIndex: number;
    matchOffset: number;
}) {
    const renderContent = () => {
        if (!searchTerm) return paragraph.content;

        const regex = simpleRegExp(searchTerm);
        const parts = paragraph.content.split(regex);
        if (parts.length <= 1) return paragraph.content;

        const matches = paragraph.content.match(regex) || [];
        const result: (string | React.ReactElement)[] = [];
        parts.forEach((part, i) => {
            result.push(part);
            if (i < matches.length) {
                const globalIdx = matchOffset + i;
                const isCurrent = globalIdx === currentMatchIndex;
                result.push(
                    <mark
                        key={i}
                        data-match-index={globalIdx}
                        className={isCurrent ? 'mark-current' : undefined}
                    >
                        {matches[i]}
                    </mark>,
                );
            }
        });
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
