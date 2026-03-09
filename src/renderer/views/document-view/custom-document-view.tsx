import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, Space, Spin, Tooltip } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, SearchOutlined } from '@ant-design/icons';
import {
    useSermonStore,
    useSearchStore,
    useCustomDocumentsStore,
    selectActiveTabTitle,
    selectActiveTabKey,
} from '@renderer/stores';
import type { CustomDocumentContent, SermonContent } from '@shared/types';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import InlineSearchBar from '../components/inline-search-bar';
import SermonParagraphView from './sermon-paragraph';
import {
    useScrollAndZoom,
    useSearchHighlight,
    useMatchNavigation,
    useContextMenuItems,
    useDocumentHighlights,
    useReferenceNavigation,
} from './hooks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DocumentParagraph {
    paragraphIndex: number;
    content: string;
}

/** Parse stored content into paragraphs. Handles both JSON array and legacy plain text. */
function parseContentToParagraphs(content: string): DocumentParagraph[] {
    let lines: string[];

    try {
        const parsed = JSON.parse(content);
        lines = Array.isArray(parsed) ? parsed : [];
    } catch {
        // Legacy: plain text split by newlines
        lines = content.split('\n').filter((l) => l.trim() !== '');
    }

    return lines.map((text, i) => ({
        paragraphIndex: i + 1,
        content: text,
    }));
}

// ---------------------------------------------------------------------------
// Custom Document View
// ---------------------------------------------------------------------------

export default function CustomDocumentView() {
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const customDocuments = useCustomDocumentsStore((s) => s.customDocuments);
    const updateTabZoom = useSermonStore((s) => s.updateTabZoom);
    const containerRef = useRef<HTMLDivElement>(null);
    const contextTargetRef = useRef<Element | null>(null);
    const { zoom } = useScrollAndZoom(containerRef);
    const [docContent, setDocContent] = useState<CustomDocumentContent | null>(null);
    const [loading, setLoading] = useState(false);
    const search = useSearchHighlight();
    const searchBarOpen = useSearchStore((s) => s.searchBarOpen);
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);

    useReferenceNavigation(containerRef);

    const customDoc = useMemo(
        () => customDocuments.find((d) => d.title === activeTitle),
        [customDocuments, activeTitle],
    );

    useEffect(() => {
        if (!customDoc) {
            setDocContent(null);
            return;
        }
        setLoading(true);
        window.api.app
            .getCustomDocumentContent(customDoc.id)
            .then((content) => setDocContent(content))
            .catch(() => setDocContent(null))
            .finally(() => setLoading(false));
    }, [customDoc?.id]);

    const handleZoomIn = useCallback(() => {
        if (activeTabKey) updateTabZoom(activeTabKey, Math.min(zoom + 10, 200));
    }, [activeTabKey, zoom, updateTabZoom]);

    const handleZoomOut = useCallback(() => {
        if (activeTabKey) updateTabZoom(activeTabKey, Math.max(zoom - 10, 50));
    }, [activeTabKey, zoom, updateTabZoom]);

    const paragraphs = useMemo(
        () => parseContentToParagraphs(docContent?.content ?? ''),
        [docContent?.content],
    );

    const paragraphTexts = useMemo(() => paragraphs.map((p) => p.content), [paragraphs]);
    const { matchOffsets } = useMatchNavigation(search, paragraphTexts);

    // Build a minimal SermonContent-like object for context menu
    const contentForMenu = useMemo((): SermonContent | null => {
        if (!docContent) return null;
        return {
            meta: {
                id: customDoc?.id ?? '',
                translationId: 0,
                languageCode: '',
                sermonId: customDoc?.sermonId ?? '',
                title: docContent.title,
                enTitle: docContent.title,
                audioLink: null,
                traductionName: null,
                dateMs: 0,
                minutes: 0,
                location: null,
                cityState: null,
            },
            paragraphs: paragraphs.map((p) => ({
                paragraphIndex: p.paragraphIndex,
                translationId: 0,
                sermonId: 0,
                content: p.content,
            })),
        };
    }, [docContent, paragraphs, customDoc]);

    const contextMenuItems = useContextMenuItems(contentForMenu, contextTargetRef, 'custom');
    const { highlightsByParagraph } = useDocumentHighlights(
        docContent?.title ?? null,
        customDoc?.sermonId,
    );

    const onContextMenu = useCallback((e: React.MouseEvent) => {
        contextTargetRef.current = e.target as Element;
    }, []);

    return (
        <div className="mock-browser-content">
            {loading && (
                <div className="flex flex-center" style={{ marginTop: '2rem' }}>
                    <Spin />
                </div>
            )}
            {!loading && docContent && (
                <>
                    <div className="sermon-header">
                        <div style={{ flex: 1 }} />
                        <Space size="small">
                            <Tooltip title="Zoom arrière">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<ZoomOutOutlined />}
                                    onClick={handleZoomOut}
                                    aria-label="Zoom arrière"
                                />
                            </Tooltip>
                            <span style={{ fontSize: '0.8em', minWidth: 50, textAlign: 'center' }}>
                                {zoom}%
                            </span>
                            <Tooltip title="Zoom avant">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<ZoomInOutlined />}
                                    onClick={handleZoomIn}
                                    aria-label="Zoom avant"
                                />
                            </Tooltip>
                            <Tooltip title="Rechercher">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<SearchOutlined />}
                                    onClick={() => openSearchBar()}
                                    aria-label="Rechercher"
                                />
                            </Tooltip>
                        </Space>
                    </div>
                    {searchBarOpen && <InlineSearchBar />}
                    <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
                        <div
                            ref={containerRef}
                            id={DOCUMENT_CONTAINER_ID}
                            className="sermon-body"
                            style={{ fontSize: `${1.2 * (zoom / 100)}em` }}
                            onContextMenu={onContextMenu}
                        >
                            <div className="sermon-content-header">
                                <h2 className="sermon-content-header__title">{docContent.title}</h2>
                            </div>
                            {paragraphs.map((p, i) => (
                                <SermonParagraphView
                                    key={p.paragraphIndex}
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
