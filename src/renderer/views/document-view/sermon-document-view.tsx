import { useCallback, useMemo, useRef } from 'react';
import { Dropdown, Spin } from 'antd';
import { useSermonStore, useSearchStore, selectActiveTab } from '@renderer/stores';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import InlineSearchBar from '../components/inline-search-bar';
import SermonHeader from './sermon-header';
import SermonContentHeader from './sermon-content-header';
import SermonParagraphView from './sermon-paragraph';
import {
    useSermonContent,
    useScrollAndZoom,
    useSearchHighlight,
    useReferenceNavigation,
    useContextMenuItems,
    useMatchNavigation,
    useDocumentHighlights,
} from './hooks';

export default function SermonDocumentView() {
    const { content, loading } = useSermonContent();
    const containerRef = useRef<HTMLDivElement>(null);
    const contextTargetRef = useRef<Element | null>(null);
    const { zoom } = useScrollAndZoom(containerRef);
    const search = useSearchHighlight();
    const searchBarOpen = useSearchStore((s) => s.searchBarOpen);
    const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);
    useReferenceNavigation(containerRef);
    const contextMenuItems = useContextMenuItems(content, contextTargetRef);

    const onContextMenu = useCallback((e: React.MouseEvent) => {
        contextTargetRef.current = e.target as Element;
    }, []);
    const activeTab = useSermonStore(selectActiveTab);
    const sermonsById = useSermonStore((s) => s.sermonsById);
    const sermonInfo = activeTab?.sermonId ? sermonsById[activeTab.sermonId] : undefined;
    const tabTranslationId = activeTab?.translationId;

    const paragraphTexts = useMemo(
        () => (content?.paragraphs ?? []).map((p) => p.content),
        [content?.paragraphs],
    );

    const { matchOffsets } = useMatchNavigation(search, paragraphTexts);
    const { highlightsByParagraph } = useDocumentHighlights(
        content?.meta.title ?? null,
        activeTab?.sermonId,
    );

    return (
        <div className="mock-browser-content">
            {loading && (
                <div className="flex flex-center" style={{ marginTop: '2rem' }}>
                    <Spin />
                </div>
            )}
            {!loading && content && (
                <>
                    <SermonHeader
                        meta={content.meta}
                        zoom={zoom}
                        sermonInfo={sermonInfo}
                        currentTranslationId={tabTranslationId ?? content.meta.translationId}
                        paragraphs={content.paragraphs}
                    />
                    {searchBarOpen && <InlineSearchBar />}
                    <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
                        <div
                            ref={containerRef}
                            id={DOCUMENT_CONTAINER_ID}
                            className="sermon-body"
                            style={{ fontSize: `${1.2 * (zoom / 100)}em` }}
                            onContextMenu={onContextMenu}
                        >
                            <SermonContentHeader meta={content.meta} />
                            {content.paragraphs.map((p, i) => (
                                <SermonParagraphView
                                    key={`${p.paragraphIndex}-${i}`}
                                    paragraph={p}
                                    search={search}
                                    currentMatchIndex={currentMatchIndex}
                                    matchOffset={matchOffsets[i] ?? 0}
                                    highlights={highlightsByParagraph.get(p.paragraphIndex)}
                                />
                            ))}
                        </div>
                    </Dropdown>
                </>
            )}
        </div>
    );
}
