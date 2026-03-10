import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, Space, Spin, Tooltip } from 'antd';
import {
    LeftOutlined,
    RightOutlined,
    SearchOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
} from '@ant-design/icons';
import {
    useSermonStore,
    useSearchStore,
    selectActiveTab,
    selectActiveTabKey,
} from '@renderer/stores';
import type { BibleBook, BibleIndex, SermonContent } from '@shared/types';
import { getTabKey } from '@shared/types';
import { DOCUMENT_CONTAINER_ID } from '@renderer/utils/events';
import InlineSearchBar from '../components/inline-search-bar';
import { TtsButton, TtsParagraph, type TtsControls } from './tts-controls';
import {
    useScrollAndZoom,
    useSearchHighlight,
    useMatchNavigation,
    useContextMenuItems,
    useDocumentHighlights,
} from './hooks';
import { useTts } from '@renderer/hooks/use-tts';

// ---------------------------------------------------------------------------
// Content header (inside body, like SermonContentHeader)
// ---------------------------------------------------------------------------

function BibleContentHeader({ title, chapter }: { title?: string; chapter?: string }) {
    if (!title) return null;
    // Title is "BookName Chapter" — extract book name by removing the chapter suffix
    const bookName = chapter ? title.replace(new RegExp(`\\s+${chapter}$`), '') : title;

    return (
        <div className="sermon-content-header">
            <h2 className="sermon-content-header__title">{bookName}</h2>
            <div className="sermon-content-header__date">Chapitre {chapter}</div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function versesToParagraphs(verses: BibleBook[]) {
    return verses
        .slice()
        .sort((a, b) => +a.verse - +b.verse)
        .map((v) => ({
            paragraphIndex: +v.verse,
            content: v.content,
        }));
}

function buildContentForMenu(
    tab: { title: string; sermonId: string } | null,
    paragraphs: { paragraphIndex: number; content: string }[],
): SermonContent | null {
    if (!tab) return null;
    return {
        meta: {
            id: tab.sermonId,
            translationId: 0,
            languageCode: '',
            sermonId: tab.sermonId,
            title: tab.title,
            enTitle: tab.title,
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
}

// ---------------------------------------------------------------------------
// Chapter navigation hook
// ---------------------------------------------------------------------------

function useChapterNavigation(activeTab: ReturnType<typeof selectActiveTab>) {
    const updateBibleTab = useSermonStore((s) => s.updateBibleTab);
    const activateTab = useSermonStore((s) => s.activateTab);
    const tabs = useSermonStore((s) => s.tabs);
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const [bibleIndex, setBibleIndex] = useState<BibleIndex>({});

    const bookCode = activeTab?.bibleBook;

    useEffect(() => {
        window.api.bible
            .getIndexes()
            .then((flat) => setBibleIndex(flat ?? {}))
            .catch(() => setBibleIndex({}));
    }, []);

    const bookEntry = useMemo(() => {
        if (!bookCode) return null;
        return Object.entries(bibleIndex).find(([, val]) => val.book === bookCode) ?? null;
    }, [bibleIndex, bookCode]);

    const chapterList = useMemo(() => {
        if (!bookEntry) return [];
        return bookEntry[1].chapters
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
            .sort((a, b) => +a - +b);
    }, [bookEntry]);

    const bookName = bookEntry?.[0] ?? '';
    const currentChapter = activeTab?.bibleChapter ?? '1';
    const currentIdx = chapterList.indexOf(currentChapter);
    const hasPrev = currentIdx > 0;
    const hasNext = currentIdx >= 0 && currentIdx < chapterList.length - 1;

    const navigateToChapter = useCallback(
        (chapter: string) => {
            if (!activeTabKey || !bookCode) return;
            const title = `${bookName} ${chapter}`;
            const sermonId = `${bookCode}:${chapter}`;
            // If a tab with this chapter already exists, activate it instead
            const existingTab = tabs.find(
                (t) => t.type === 'bible' && t.title === title && t.sermonId === sermonId,
            );
            if (existingTab) {
                activateTab(getTabKey(existingTab));
            } else {
                updateBibleTab(activeTabKey, title, sermonId, bookCode, chapter);
            }
        },
        [activeTabKey, bookCode, bookName, tabs, activateTab, updateBibleTab],
    );

    const goPrev = useCallback(() => {
        if (hasPrev) navigateToChapter(chapterList[currentIdx - 1]);
    }, [hasPrev, navigateToChapter, chapterList, currentIdx]);

    const goNext = useCallback(() => {
        if (hasNext) navigateToChapter(chapterList[currentIdx + 1]);
    }, [hasNext, navigateToChapter, chapterList, currentIdx]);

    return { hasPrev, hasNext, goPrev, goNext };
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function BibleHeader({
    title,
    zoom,
    hasPrev,
    hasNext,
    onPrev,
    onNext,
    onZoomIn,
    onZoomOut,
    tts,
}: {
    title: string;
    zoom: number;
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    tts?: TtsControls;
}) {
    const openSearchBar = useSearchStore((s) => s.openSearchBar);

    return (
        <div className="sermon-header">
            <div className="bible-chapter-nav">
                <Tooltip title="Chapitre précédent">
                    <Button
                        type="text"
                        size="small"
                        icon={<LeftOutlined />}
                        disabled={!hasPrev}
                        onClick={onPrev}
                        aria-label="Chapitre précédent"
                    />
                </Tooltip>
                <span className="bible-chapter-nav__title">{title}</span>
                <Tooltip title="Chapitre suivant">
                    <Button
                        type="text"
                        size="small"
                        icon={<RightOutlined />}
                        disabled={!hasNext}
                        onClick={onNext}
                        aria-label="Chapitre suivant"
                    />
                </Tooltip>
            </div>
            <div style={{ flex: 1 }} />
            <Space size="small">
                {tts && <TtsButton tts={tts} />}
                <Tooltip title="Zoom arrière">
                    <Button
                        type="text"
                        size="small"
                        icon={<ZoomOutOutlined />}
                        onClick={onZoomOut}
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
                        onClick={onZoomIn}
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
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BibleDocumentView() {
    const activeTab = useSermonStore(selectActiveTab);
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const updateTabZoom = useSermonStore((s) => s.updateTabZoom);
    const containerRef = useRef<HTMLDivElement>(null);
    const contextTargetRef = useRef<Element | null>(null);
    const { zoom } = useScrollAndZoom(containerRef);
    const search = useSearchHighlight();
    const searchBarOpen = useSearchStore((s) => s.searchBarOpen);
    const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);

    const [verses, setVerses] = useState<BibleBook[]>([]);
    const [loading, setLoading] = useState(false);
    const [bibleLang, setBibleLang] = useState('');

    const bookCode = activeTab?.bibleBook;
    const chapter = activeTab?.bibleChapter;

    useEffect(() => {
        if (!bookCode || !chapter) return;
        setLoading(true);
        window.api.bible
            .getBooks({ book: bookCode, chapter })
            .then(setVerses)
            .catch(() => setVerses([]))
            .finally(() => setLoading(false));
    }, [bookCode, chapter]);

    // Get Bible language from active version
    useEffect(() => {
        window.api.bible
            .getActiveVersion()
            .then((v) => setBibleLang(v?.langCode ?? ''))
            .catch(() => setBibleLang(''));
    }, []);

    const paragraphs = useMemo(() => versesToParagraphs(verses), [verses]);
    const paragraphTexts = useMemo(() => paragraphs.map((p) => p.content), [paragraphs]);
    const { matchOffsets } = useMatchNavigation(search, paragraphTexts);

    const tts = useTts(paragraphs, bibleLang, activeTab?.title ?? '');

    const contentForMenu = useMemo(
        () => buildContentForMenu(activeTab, paragraphs),
        [activeTab, paragraphs],
    );
    const contextMenuItems = useContextMenuItems(contentForMenu, contextTargetRef, 'bible', verses);
    const { highlightsByParagraph } = useDocumentHighlights(
        activeTab?.title ?? null,
        activeTab?.sermonId,
    );

    const { hasPrev, hasNext, goPrev, goNext } = useChapterNavigation(activeTab);

    const handleZoomIn = useCallback(() => {
        if (activeTabKey) updateTabZoom(activeTabKey, Math.min(zoom + 10, 200));
    }, [activeTabKey, zoom, updateTabZoom]);

    const handleZoomOut = useCallback(() => {
        if (activeTabKey) updateTabZoom(activeTabKey, Math.max(zoom - 10, 50));
    }, [activeTabKey, zoom, updateTabZoom]);

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
            {!loading && (
                <>
                    <BibleHeader
                        title={activeTab?.title ?? ''}
                        zoom={zoom}
                        hasPrev={hasPrev}
                        hasNext={hasNext}
                        onPrev={goPrev}
                        onNext={goNext}
                        onZoomIn={handleZoomIn}
                        onZoomOut={handleZoomOut}
                        tts={tts}
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
                            <BibleContentHeader title={activeTab?.title} chapter={chapter} />
                            {paragraphs.map((p, i) => (
                                <TtsParagraph
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
