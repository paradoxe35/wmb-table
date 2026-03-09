import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Space, Spin, Tooltip } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, SearchOutlined } from '@ant-design/icons';
import {
    useSermonStore,
    useSearchStore,
    useCustomDocumentsStore,
    selectActiveTabTitle,
    selectActiveTabKey,
} from '@renderer/stores';
import type { CustomDocumentContent } from '@shared/types';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import InlineSearchBar from '../components/inline-search-bar';
import SermonParagraphView from './sermon-paragraph';
import { useScrollAndZoom, useSearchHighlight, useMatchNavigation } from './hooks';

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
    const { zoom } = useScrollAndZoom(containerRef);
    const [docContent, setDocContent] = useState<CustomDocumentContent | null>(null);
    const [loading, setLoading] = useState(false);
    const search = useSearchHighlight();
    const searchBarOpen = useSearchStore((s) => s.searchBarOpen);
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);

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
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <strong>{docContent.title}</strong>
                        </div>
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
                    <div
                        ref={containerRef}
                        id={DOCUMENT_CONTAINER_ID}
                        className="sermon-body"
                        style={{ fontSize: `${1.2 * (zoom / 100)}em` }}
                    >
                        {paragraphs.map((p, i) => (
                            <SermonParagraphView
                                key={p.paragraphIndex}
                                paragraph={p}
                                search={search}
                                currentMatchIndex={currentMatchIndex}
                                matchOffset={matchOffsets[i] ?? 0}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
