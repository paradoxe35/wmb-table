import React, { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, message, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { getHighlightRanges } from '@renderer/utils/searchable';
import { HIGHLIGHT_EVENT } from '@renderer/utils/events';
import { hexToRgba } from '@renderer/utils/functions';
import type { SearchHighlightState } from './hooks';
import type { SermonParagraph as SermonParagraphType, HighlightItem } from '@shared/types';

type ParagraphProp = Pick<SermonParagraphType, 'paragraphIndex' | 'content'>;

interface HighlightRange {
    start: number;
    end: number;
    color: string;
    comment?: string;
    highlightId?: string;
    type: 'search' | 'persistent' | 'tts';
}

function mergeRanges(
    searchRanges: HighlightRange[],
    persistentRanges: HighlightRange[],
): HighlightRange[] {
    const all = [...searchRanges, ...persistentRanges];
    all.sort((a, b) => a.start - b.start || a.end - b.end);
    return all;
}

// ---------------------------------------------------------------------------
// Persistent highlight with context menu to delete
// ---------------------------------------------------------------------------

function PersistentHighlight({
    text,
    color,
    comment,
    highlightId,
    reactKey,
}: {
    text: string;
    color: string;
    comment?: string;
    highlightId?: string;
    reactKey: string;
}) {
    const { t } = useTranslation();
    const handleDelete = useCallback(async () => {
        if (!highlightId) return;
        try {
            await window.api.highlights.delete(highlightId);
            window.dispatchEvent(new Event(HIGHLIGHT_EVENT.highlightsUpdated));
            message.success(t('Surlignage supprimé'));
        } catch {
            message.error(t('Erreur lors de la suppression'));
        }
    }, [highlightId, t]);

    const menuItems: MenuProps['items'] = [
        ...(comment
            ? [
                  {
                      key: 'comment',
                      label: comment,
                      disabled: true,
                      style: {
                          fontSize: 'var(--fs-rel-xl)',
                          fontStyle: 'italic',
                          whiteSpace: 'normal' as const,
                          maxWidth: 250,
                      },
                  },
                  { type: 'divider' as const, key: 'divider' },
              ]
            : []),
        {
            key: 'delete',
            label: t('Supprimer le surlignage'),
            danger: true,
            onClick: handleDelete,
        },
    ];

    const stopPropagation = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
    }, []);

    const bgColor = hexToRgba(color, 0.4);

    const markEl = (
        <mark
            key={reactKey}
            style={{
                backgroundColor: bgColor,
                borderRadius: 2,
                cursor: 'pointer',
            }}
        >
            {text}
        </mark>
    );

    const wrapped = comment ? <Tooltip title={comment}>{markEl}</Tooltip> : markEl;

    return (
        <span key={`dd-${reactKey}`} onContextMenu={stopPropagation}>
            <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
                {wrapped}
            </Dropdown>
        </span>
    );
}

// ---------------------------------------------------------------------------
// Render ranges
// ---------------------------------------------------------------------------

function renderWithRanges(
    content: string,
    ranges: HighlightRange[],
    activeSearch = false,
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
        if (range.type === 'tts') {
            result.push(
                <mark key={`tts-${i}`} className="tts-active-sentence">
                    {text}
                </mark>,
            );
        } else if (range.type === 'search') {
            result.push(
                <mark key={`s-${i}`} className={activeSearch ? 'mark-current' : undefined}>
                    {text}
                </mark>,
            );
        } else {
            result.push(
                <PersistentHighlight
                    key={`h-${i}`}
                    reactKey={`h-${i}`}
                    text={text}
                    color={range.color}
                    comment={range.comment}
                    highlightId={range.highlightId}
                />,
            );
        }
        lastIndex = end;
    }

    if (lastIndex < content.length) {
        result.push(content.slice(lastIndex));
    }

    return result;
}

// ---------------------------------------------------------------------------
// Paragraph view
// ---------------------------------------------------------------------------

const SermonParagraphView = memo(function SermonParagraphView({
    paragraph,
    search,
    isActiveMatch,
    highlights,
    ttsHighlight,
    playFromHereButton,
}: {
    paragraph: ParagraphProp;
    search: SearchHighlightState | null;
    isActiveMatch?: boolean;
    highlights?: HighlightItem[];
    ttsHighlight?: { isActive: boolean; highlightRange: { start: number; end: number } | null };
    playFromHereButton?: React.ReactNode;
}) {
    const renderContent = () => {
        const searchRanges: HighlightRange[] = [];
        const persistentRanges: HighlightRange[] = [];
        const ttsRanges: HighlightRange[] = [];

        if (ttsHighlight?.isActive && ttsHighlight.highlightRange) {
            ttsRanges.push({
                start: ttsHighlight.highlightRange.start,
                end: Math.min(ttsHighlight.highlightRange.end, paragraph.content.length),
                color: '',
                type: 'tts',
            });
        }

        if (search) {
            const paragraphSearchRanges =
                search.highlightsByParagraph.get(paragraph.paragraphIndex) ??
                getHighlightRanges(paragraph.content, search.term, search.mode);

            for (const r of paragraphSearchRanges) {
                searchRanges.push({ start: r.start, end: r.end, color: '', type: 'search' });
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
                    highlightId: h.id,
                    type: 'persistent',
                });
            }
        }

        const allRanges = mergeRanges(searchRanges, [...persistentRanges, ...ttsRanges]);
        if (allRanges.length === 0) return paragraph.content;

        return renderWithRanges(paragraph.content, allRanges, isActiveMatch);
    };

    const className = ttsHighlight?.isActive
        ? 'sermon-paragraph tts-active-paragraph'
        : 'sermon-paragraph';

    return (
        <p data-paragraph-index={paragraph.paragraphIndex} className={className}>
            <span className="line-number">
                {paragraph.paragraphIndex}
                {playFromHereButton}
            </span>
            <span className="paragraph-content">{renderContent()}</span>
        </p>
    );
});

export default SermonParagraphView;
