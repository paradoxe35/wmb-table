import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Space, Spin } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, SearchOutlined } from '@ant-design/icons';
import {
    useSermonStore,
    useSearchStore,
    useCustomDocumentsStore,
    selectActiveTabTitle,
    selectActiveTabKey,
} from '@renderer/stores';
import { strNormalizeNoLower, buildHighlightRegex } from '@renderer/utils/searchable';
import type { CustomDocumentContent } from '@shared/types';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import InlineSearchBar from '../components/inline-search-bar';
import { useScrollAndZoom, useSearchHighlight, useMatchNavigation } from './hooks';

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
        () => (docContent?.content ?? '').split('\n').filter((line) => line.trim() !== ''),
        [docContent?.content],
    );

    const { matchOffsets } = useMatchNavigation(search, paragraphs);

    const renderParagraph = useCallback(
        (text: string, i: number) => {
            if (!search) {
                return (
                    <p key={i} data-paragraph-index={i} className="sermon-paragraph">
                        {text}
                    </p>
                );
            }

            const regex = buildHighlightRegex(search.term, search.mode);
            if (!regex) {
                return (
                    <p key={i} data-paragraph-index={i} className="sermon-paragraph">
                        {text}
                    </p>
                );
            }

            const normalized = strNormalizeNoLower(text);
            const matches = [...normalized.matchAll(regex)];
            if (matches.length === 0) {
                return (
                    <p key={i} data-paragraph-index={i} className="sermon-paragraph">
                        {text}
                    </p>
                );
            }

            const result: (string | React.ReactElement)[] = [];
            const offset = matchOffsets[i] ?? 0;
            let lastIdx = 0;
            matches.forEach((m, j) => {
                const start = m.index!;
                const end = start + m[0].length;
                if (start > lastIdx) result.push(text.slice(lastIdx, start));
                const globalIdx = offset + j;
                const isCurrent = globalIdx === currentMatchIndex;
                result.push(
                    <mark
                        key={j}
                        data-match-index={globalIdx}
                        className={isCurrent ? 'mark-current' : undefined}
                    >
                        {text.slice(start, end)}
                    </mark>,
                );
                lastIdx = end;
            });
            if (lastIdx < text.length) result.push(text.slice(lastIdx));

            return (
                <p key={i} data-paragraph-index={i} className="sermon-paragraph">
                    {result}
                </p>
            );
        },
        [search, matchOffsets, currentMatchIndex],
    );

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
                            <Button
                                type="text"
                                size="small"
                                icon={<ZoomOutOutlined />}
                                onClick={handleZoomOut}
                            />
                            <span style={{ fontSize: '0.8em', minWidth: 50, textAlign: 'center' }}>
                                {zoom}%
                            </span>
                            <Button
                                type="text"
                                size="small"
                                icon={<ZoomInOutlined />}
                                onClick={handleZoomIn}
                            />
                            <Button
                                type="text"
                                size="small"
                                icon={<SearchOutlined />}
                                onClick={() => openSearchBar()}
                            />
                        </Space>
                    </div>
                    {searchBarOpen && <InlineSearchBar />}
                    <div
                        ref={containerRef}
                        id={DOCUMENT_CONTAINER_ID}
                        className="sermon-body"
                        style={{ fontSize: `${1.2 * (zoom / 100)}em` }}
                    >
                        {paragraphs.map(renderParagraph)}
                    </div>
                </>
            )}
        </div>
    );
}
