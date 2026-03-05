import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DocumentTabs from '../components/document-tabs';
import { Button, Layout, message, Segmented, Space, Spin } from 'antd';
import {
    PlayCircleOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
    SearchOutlined,
    TranslationOutlined,
} from '@ant-design/icons';
import {
    useSermonStore,
    useSearchStore,
    useSubjectsStore,
    useAppStore,
    useCustomDocumentsStore,
    selectActiveTabTitle,
    selectActiveTab,
    selectActiveTabType,
} from '@renderer/stores';
import { debounce } from '@renderer/utils/functions';
import { simpleRegExp } from '@renderer/utils/searchable';
import {
    type SermonContent as SermonContentType,
    type SermonMeta,
    type SermonMetaWithTraductions,
    type SermonParagraph as SermonParagraphType,
    type ParagraphReference,
    type CustomDocumentContent,
    isParagraphReference,
} from '@shared/types';
import InlineSearchBar from './components/inline-search-bar';
import { CHILD_PARENT_WINDOW_EVENT, DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import { ContextMenu } from '@renderer/utils/context-menu';

const { Content } = Layout;

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useSermonContent() {
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const activeTab = useSermonStore(selectActiveTab);
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const sermonsByTitle = useSermonStore((s) => s.sermonsByTitle);
    const setActiveContent = useSermonStore((s) => s.setActiveContent);
    const activeContent = useSermonStore((s) => s.activeContent);
    const [loading, setLoading] = useState(false);

    // Use tab's translationId if set, otherwise fall back to sermon's default
    const tabTranslationId = activeTab?.translationId;

    useEffect(() => {
        if (!activeTitle) {
            setActiveContent(null);
            return;
        }
        const meta = sermonsByTitle[activeTitle];
        if (!meta) {
            setActiveContent(null);
            return;
        }
        const translationId = tabTranslationId ?? meta.translationId;
        setLoading(true);
        window.api.documents
            .getSermonContent(activeLanguage, translationId, meta.sermonDate)
            .then((content) => setActiveContent(content))
            .catch(() => setActiveContent(null))
            .finally(() => setLoading(false));
    }, [activeTitle, activeLanguage, sermonsByTitle, setActiveContent, tabTranslationId]);

    return { content: activeContent, loading };
}

function useScrollAndZoom(containerRef: React.RefObject<HTMLDivElement | null>) {
    const activeTab = useSermonStore(selectActiveTab);
    const updateTabScroll = useSermonStore((s) => s.updateTabScroll);
    const activeTitle = useSermonStore(selectActiveTabTitle);

    const zoom = activeTab?.zoom ?? 100;

    // Restore scroll position on tab change
    useEffect(() => {
        if (!containerRef.current || !activeTab) return;
        containerRef.current.scrollTop = activeTab.scrollY ?? 0;
    }, [activeTitle]);

    // Persist scroll position on scroll
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const handler = debounce(() => {
            if (activeTitle) {
                updateTabScroll(activeTitle, el.scrollTop);
            }
        }, 500);
        el.addEventListener('scroll', handler as EventListener);
        return () => el.removeEventListener('scroll', handler as EventListener);
    }, [activeTitle, updateTabScroll]);

    return { zoom };
}

function useSearchHighlight(): string | null {
    const documentViewQueries = useSearchStore((s) => s.documentViewQueries);
    const activeTitle = useSermonStore(selectActiveTabTitle);

    return useMemo(() => {
        if (!activeTitle) return null;
        const query = documentViewQueries.find((q) => q.documentTitle === activeTitle);
        return query?.term ?? null;
    }, [documentViewQueries, activeTitle]);
}

function useSubjectNavigation(containerRef: React.RefObject<HTMLDivElement | null>) {
    const selectedSubjectItem = useSubjectsStore((s) => s.selectedSubjectItem);
    const setSelectedSubjectItem = useSubjectsStore((s) => s.setSelectedSubjectItem);
    const activeTitle = useSermonStore(selectActiveTabTitle);

    useEffect(() => {
        if (!selectedSubjectItem || !containerRef.current) return;
        if (selectedSubjectItem.documentTitle !== activeTitle) return;

        const ref = selectedSubjectItem.documentHtmlTree;
        const paragraphIndex = ref
            ? isParagraphReference(ref)
                ? ref.paragraphIndex
                : ref.tree?.[0]
            : undefined;
        if (paragraphIndex == null) return;

        const el = containerRef.current.querySelector(`[data-paragraph-index="${paragraphIndex}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setSelectedSubjectItem(null);
    }, [selectedSubjectItem, activeTitle, setSelectedSubjectItem]);
}

function useContextMenu(
    containerRef: React.RefObject<HTMLDivElement | null>,
    content: SermonContentType | null,
) {
    useEffect(() => {
        if (!containerRef.current || !content) return;
        const menu = new ContextMenu(containerRef.current, [
            {
                text: 'Ajouter au sujet',
                onclick: () => {
                    const sel = window.getSelection();
                    if (!sel || sel.isCollapsed) {
                        message.warning('Aucun texte sélectionné');
                        return;
                    }
                    const anchor = sel.anchorNode?.parentElement?.closest('[data-paragraph-index]');
                    const idx = anchor ? parseInt(anchor.getAttribute('data-paragraph-index')!) : 0;
                    const paragraphRef: ParagraphReference = {
                        paragraphIndex: idx,
                        translationId: content.meta.translationId,
                        languageCode: content.meta.languageCode,
                        textSnippet: sel.toString().slice(0, 200),
                    };
                    window.dispatchEvent(
                        new CustomEvent(CHILD_PARENT_WINDOW_EVENT.addDocumentRefSubject, {
                            detail: {
                                documentHtmlTree: paragraphRef,
                                textContent: sel.toString(),
                            },
                        }),
                    );
                },
            },
            {
                text: 'Ajouter à la note',
                onclick: () => {
                    const sel = window.getSelection();
                    if (!sel || sel.isCollapsed) {
                        message.warning('Aucun texte sélectionné');
                        return;
                    }
                    const anchor = sel.anchorNode?.parentElement?.closest('[data-paragraph-index]');
                    const idx = anchor ? parseInt(anchor.getAttribute('data-paragraph-index')!) : 0;
                    const paragraphRef: ParagraphReference = {
                        paragraphIndex: idx,
                        translationId: content.meta.translationId,
                        languageCode: content.meta.languageCode,
                        textSnippet: sel.toString().slice(0, 200),
                    };
                    window.dispatchEvent(
                        new CustomEvent(CHILD_PARENT_WINDOW_EVENT.addDocumentRefNote, {
                            detail: {
                                documentHtmlTree: paragraphRef,
                                textContent: sel.toString(),
                            },
                        }),
                    );
                },
            },
        ]);
        menu.install();
        return () => menu.uninstall();
    }, [content]);
}

// ---------------------------------------------------------------------------
// Match counting & navigation
// ---------------------------------------------------------------------------

function useMatchNavigation(searchTerm: string | null, paragraphs: string[]) {
    const setTotalMatches = useSearchStore((s) => s.setTotalMatches);
    const setCurrentMatchIndex = useSearchStore((s) => s.setCurrentMatchIndex);
    const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);

    // Compute cumulative match offsets per paragraph
    const { matchOffsets, total } = useMemo(() => {
        if (!searchTerm) return { matchOffsets: [] as number[], total: 0 };
        const regex = simpleRegExp(searchTerm);
        let cumulative = 0;
        const offsets: number[] = [];
        for (const text of paragraphs) {
            offsets.push(cumulative);
            const matches = text.match(regex);
            cumulative += matches?.length ?? 0;
        }
        return { matchOffsets: offsets, total: cumulative };
    }, [searchTerm, paragraphs]);

    useEffect(() => {
        setTotalMatches(total);
        if (total === 0) setCurrentMatchIndex(0);
    }, [total, setTotalMatches, setCurrentMatchIndex]);

    // Scroll to current match
    useEffect(() => {
        if (total === 0) return;
        const el = document.querySelector(`[data-match-index="${currentMatchIndex}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [currentMatchIndex, total]);

    return { matchOffsets, total };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SermonHeader({
    meta,
    zoom,
    sermonInfo,
}: {
    meta: SermonMeta;
    zoom: number;
    sermonInfo: SermonMetaWithTraductions | undefined;
}) {
    const updateTabZoom = useSermonStore((s) => s.updateTabZoom);
    const updateTabTranslationId = useSermonStore((s) => s.updateTabTranslationId);
    const openSearchBar = useSearchStore((s) => s.openSearchBar);

    const availableTraductions = sermonInfo?.availableTraductions ?? [];
    const hasMultipleTraductions = availableTraductions.length > 1;

    const handleAudioPlay = useCallback(() => {
        if (!meta.audioLink) return;
        window.dispatchEvent(
            new CustomEvent(CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay, {
                detail: {
                    id: meta.id,
                    title: meta.title,
                    frTitle: meta.title,
                    enTitle: meta.enTitle ?? '',
                    traduction: meta.languageCode,
                    audio_link: meta.audioLink,
                    date: meta.sermonDate,
                },
            }),
        );
    }, [meta]);

    const handleOtherTraductions = useCallback(() => {
        window.dispatchEvent(new Event(CHILD_PARENT_WINDOW_EVENT.openOtherTraductionsModal));
    }, []);

    const handleZoomIn = useCallback(() => {
        updateTabZoom(meta.title, Math.min(zoom + 10, 200));
    }, [meta.title, zoom, updateTabZoom]);

    const handleZoomOut = useCallback(() => {
        updateTabZoom(meta.title, Math.max(zoom - 10, 50));
    }, [meta.title, zoom, updateTabZoom]);

    const handleTraductionChange = useCallback(
        (value: string | number) => {
            updateTabTranslationId(meta.title, Number(value));
        },
        [meta.title, updateTabTranslationId],
    );

    const traductionOptions = useMemo(
        () =>
            availableTraductions.map((t) => ({
                label: t.traductionName ?? `T${t.translationId}`,
                value: t.translationId,
            })),
        [availableTraductions],
    );

    return (
        <div className="sermon-header">
            <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{meta.title}</strong>
                {meta.location && <span className="sermon-meta-detail">{meta.location}</span>}
                {meta.minutes > 0 && (
                    <span className="sermon-meta-detail">({meta.minutes} min)</span>
                )}
            </div>
            <Space size="small">
                {hasMultipleTraductions && (
                    <Segmented
                        size="small"
                        options={traductionOptions}
                        value={meta.translationId}
                        onChange={handleTraductionChange}
                    />
                )}
                {meta.audioLink && (
                    <Button
                        type="text"
                        size="small"
                        icon={<PlayCircleOutlined />}
                        onClick={handleAudioPlay}
                    />
                )}
                <Button
                    type="text"
                    size="small"
                    icon={<TranslationOutlined />}
                    onClick={handleOtherTraductions}
                />
                <Button
                    type="text"
                    size="small"
                    icon={<ZoomOutOutlined />}
                    onClick={handleZoomOut}
                />
                <span style={{ fontSize: '0.8em', minWidth: 35, textAlign: 'center' }}>
                    {zoom}%
                </span>
                <Button type="text" size="small" icon={<ZoomInOutlined />} onClick={handleZoomIn} />
                <Button
                    type="text"
                    size="small"
                    icon={<SearchOutlined />}
                    onClick={openSearchBar}
                />
            </Space>
        </div>
    );
}

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
            <span className="line-number">{paragraph.lineIndex}</span>
            {renderContent()}
        </p>
    );
});

// ---------------------------------------------------------------------------
// Sermon document view
// ---------------------------------------------------------------------------

function SermonDocumentView() {
    const { content, loading } = useSermonContent();
    const containerRef = useRef<HTMLDivElement>(null);
    const { zoom } = useScrollAndZoom(containerRef);
    const searchTerm = useSearchHighlight();
    const searchBarOpen = useSearchStore((s) => s.searchBarOpen);
    const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);
    useSubjectNavigation(containerRef);
    useContextMenu(containerRef, content);
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const sermonsByTitle = useSermonStore((s) => s.sermonsByTitle);
    const sermonInfo = activeTitle ? sermonsByTitle[activeTitle] : undefined;

    const paragraphTexts = useMemo(
        () => (content?.paragraphs ?? []).map((p) => p.content),
        [content?.paragraphs],
    );

    const { matchOffsets } = useMatchNavigation(searchTerm, paragraphTexts);

    return (
        <Content className="mock-browser-content">
            {loading && (
                <div className="flex flex-center" style={{ marginTop: '2rem' }}>
                    <Spin />
                </div>
            )}
            {!loading && content && (
                <>
                    <SermonHeader meta={content.meta} zoom={zoom} sermonInfo={sermonInfo} />
                    {searchBarOpen && <InlineSearchBar />}
                    <div
                        ref={containerRef}
                        id={DOCUMENT_CONTAINER_ID}
                        className="sermon-body"
                        style={{ zoom: `${zoom}%` }}
                    >
                        {content.paragraphs.map((p, i) => (
                            <SermonParagraphView
                                key={p.paragraphIndex}
                                paragraph={p}
                                searchTerm={searchTerm}
                                currentMatchIndex={currentMatchIndex}
                                matchOffset={matchOffsets[i] ?? 0}
                            />
                        ))}
                    </div>
                </>
            )}
        </Content>
    );
}

// ---------------------------------------------------------------------------
// Custom document view
// ---------------------------------------------------------------------------

function CustomDocumentView() {
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const customDocuments = useCustomDocumentsStore((s) => s.customDocuments);
    const updateTabZoom = useSermonStore((s) => s.updateTabZoom);
    const containerRef = useRef<HTMLDivElement>(null);
    const { zoom } = useScrollAndZoom(containerRef);
    const [docContent, setDocContent] = useState<CustomDocumentContent | null>(null);
    const [loading, setLoading] = useState(false);
    const searchTerm = useSearchHighlight();
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
        if (activeTitle) updateTabZoom(activeTitle, Math.min(zoom + 10, 200));
    }, [activeTitle, zoom, updateTabZoom]);

    const handleZoomOut = useCallback(() => {
        if (activeTitle) updateTabZoom(activeTitle, Math.max(zoom - 10, 50));
    }, [activeTitle, zoom, updateTabZoom]);

    const paragraphs = useMemo(
        () => (docContent?.content ?? '').split('\n').filter((line) => line.trim() !== ''),
        [docContent?.content],
    );

    const { matchOffsets } = useMatchNavigation(searchTerm, paragraphs);

    const renderParagraph = useCallback(
        (text: string, i: number) => {
            if (!searchTerm) {
                return (
                    <p key={i} data-paragraph-index={i} className="sermon-paragraph">
                        {text}
                    </p>
                );
            }

            const regex = simpleRegExp(searchTerm);
            const parts = text.split(regex);
            if (parts.length <= 1) {
                return (
                    <p key={i} data-paragraph-index={i} className="sermon-paragraph">
                        {text}
                    </p>
                );
            }

            const matches = text.match(regex) || [];
            const result: (string | React.ReactElement)[] = [];
            const offset = matchOffsets[i] ?? 0;
            parts.forEach((part, j) => {
                result.push(part);
                if (j < matches.length) {
                    const globalIdx = offset + j;
                    const isCurrent = globalIdx === currentMatchIndex;
                    result.push(
                        <mark
                            key={j}
                            data-match-index={globalIdx}
                            className={isCurrent ? 'mark-current' : undefined}
                        >
                            {matches[j]}
                        </mark>,
                    );
                }
            });

            return (
                <p key={i} data-paragraph-index={i} className="sermon-paragraph">
                    {result}
                </p>
            );
        },
        [searchTerm, matchOffsets, currentMatchIndex],
    );

    return (
        <Content className="mock-browser-content">
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
                            <span style={{ fontSize: '0.8em', minWidth: 35, textAlign: 'center' }}>
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
                                onClick={openSearchBar}
                            />
                        </Space>
                    </div>
                    {searchBarOpen && <InlineSearchBar />}
                    <div
                        ref={containerRef}
                        id={DOCUMENT_CONTAINER_ID}
                        className="sermon-body"
                        style={{ zoom: `${zoom}%` }}
                    >
                        {paragraphs.map(renderParagraph)}
                    </div>
                </>
            )}
        </Content>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DocumentView() {
    const tabType = useSermonStore(selectActiveTabType);
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const closeSearchBar = useSearchStore((s) => s.closeSearchBar);
    const searchBarOpen = useSearchStore((s) => s.searchBarOpen);
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const clearSearch = useSearchStore((s) => s.clearSearch);

    // Ctrl+F / Cmd+F to open, Escape to close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                openSearchBar();
            } else if (e.key === 'Escape' && searchBarOpen) {
                if (activeTitle) clearSearch(activeTitle);
                closeSearchBar();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [openSearchBar, closeSearchBar, searchBarOpen, activeTitle, clearSearch]);

    return (
        <>
            <DocumentTabs />
            {tabType === 'custom' ? <CustomDocumentView /> : <SermonDocumentView />}
        </>
    );
}
