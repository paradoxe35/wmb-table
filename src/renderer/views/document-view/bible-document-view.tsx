import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Space, Tooltip } from 'antd';
import { LeftOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import {
    useSermonStore,
    useSearchStore,
    selectActiveTab,
    selectActiveTabKey,
} from '@renderer/stores';
import type { BibleBook, BibleIndex, SermonContent } from '@shared/types';
import { getTabKey } from '@shared/types';
import { TtsButton, ZoomControls, ParagraphList, type TtsControls } from './tts-controls';
import DocumentBody from './document-body';
import {
    useScrollAndZoom,
    useSearchHighlight,
    useMatchNavigation,
    useContextMenuItems,
    useDocumentHighlights,
    useDocumentZoom,
} from './hooks';
import { useTts } from '@renderer/hooks/use-tts';

// ---------------------------------------------------------------------------
// Content header (inside body, like SermonContentHeader)
// ---------------------------------------------------------------------------

function BibleContentHeader({ title, chapter }: { title?: string; chapter?: string }) {
    const { t } = useTranslation();
    if (!title) return null;
    const bookName = chapter ? title.replace(new RegExp(`\\s+${chapter}$`), '') : title;

    return (
        <div className="sermon-content-header">
            <h2 className="sermon-content-header__title">{bookName}</h2>
            <div className="sermon-content-header__date">
                {t('Chapitre {{chapter}}', { chapter })}
            </div>
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
    tts,
}: {
    title: string;
    zoom: number;
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    tts?: TtsControls;
}) {
    const { t } = useTranslation();
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const { zoomIn, zoomOut } = useDocumentZoom(zoom);

    return (
        <div className="sermon-header">
            <div className="bible-chapter-nav">
                <Tooltip title={t('Chapitre précédent')}>
                    <Button
                        type="text"
                        size="small"
                        icon={<LeftOutlined />}
                        disabled={!hasPrev}
                        onClick={onPrev}
                        aria-label={t('Chapitre précédent')}
                    />
                </Tooltip>
                <span className="bible-chapter-nav__title">{title}</span>
                <Tooltip title={t('Chapitre suivant')}>
                    <Button
                        type="text"
                        size="small"
                        icon={<RightOutlined />}
                        disabled={!hasNext}
                        onClick={onNext}
                        aria-label={t('Chapitre suivant')}
                    />
                </Tooltip>
            </div>
            <div style={{ flex: 1 }} />
            <Space size="small">
                {tts && <TtsButton tts={tts} />}
                <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} />
                <Tooltip title={t('Rechercher')}>
                    <Button
                        type="text"
                        size="small"
                        icon={<SearchOutlined />}
                        onClick={() => openSearchBar()}
                        aria-label={t('Rechercher')}
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
    const containerRef = useRef<HTMLDivElement>(null);
    const contextTargetRef = useRef<Element | null>(null);
    const search = useSearchHighlight();
    const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);

    const [verses, setVerses] = useState<BibleBook[]>([]);
    const [loading, setLoading] = useState(false);
    const { zoom } = useScrollAndZoom(containerRef, verses.length > 0 && !loading);
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

    return (
        <DocumentBody
            loading={loading}
            ready
            containerRef={containerRef}
            contextTargetRef={contextTargetRef}
            zoom={zoom}
            contextMenuItems={contextMenuItems}
            header={
                <BibleHeader
                    title={activeTab?.title ?? ''}
                    zoom={zoom}
                    hasPrev={hasPrev}
                    hasNext={hasNext}
                    onPrev={goPrev}
                    onNext={goNext}
                    tts={tts}
                />
            }
        >
            <BibleContentHeader title={activeTab?.title} chapter={chapter} />
            <ParagraphList
                paragraphs={paragraphs}
                documentId={activeTab?.title ?? ''}
                search={search}
                currentMatchIndex={currentMatchIndex}
                matchOffsets={matchOffsets}
                highlightsByParagraph={highlightsByParagraph}
                onPlayFromHere={tts.playFromParagraph}
                canSpeak={tts.canSpeak}
                incompatibleMessage={tts.incompatibleMessage}
            />
        </DocumentBody>
    );
}
