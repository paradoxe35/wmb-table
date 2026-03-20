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
import { ReadingModeToggle } from '@renderer/components/reading-mode-toggle';
import type { BibleBook, BibleIndex, SermonContent } from '@shared/types';
import { getTabKey } from '@shared/types';
import { TtsButton, ZoomControls, ParagraphList, type TtsControls } from './tts-controls';
import DocumentBody from './document-body';
import {
    buildBibleChapterKey,
    resolveBibleScrollPersistence,
    useBibleChapterContent,
    useScrollAndZoom,
    useSearchHighlight,
    useMatchNavigation,
    useContextMenuItems,
    useDocumentHighlights,
    useDocumentZoom,
    useReferenceNavigation,
} from './hooks';
import { useTts } from '@renderer/hooks/use-tts';
import {
    buildSegmentAnnouncement,
    buildBibleChapterIntro,
    getChapterLabel,
} from '@shared/tts.types';
import { useTtsStore } from '@renderer/stores/tts.store';

// ---------------------------------------------------------------------------
// Content header (inside body, like SermonContentHeader)
// ---------------------------------------------------------------------------

function BibleContentHeader({
    title,
    chapter,
    bibleLang,
}: {
    title?: string;
    chapter?: string;
    bibleLang: string;
}) {
    if (!title) return null;
    const bookName = chapter ? title.replace(new RegExp(`\\s+${chapter}$`), '') : title;
    const chapterLabel = chapter ? `${getChapterLabel(bibleLang)} ${chapter}` : null;

    return (
        <div className="sermon-content-header">
            <h2 className="sermon-content-header__title">{bookName}</h2>
            {chapterLabel && <div className="sermon-content-header__date">{chapterLabel}</div>}
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
    bibleLang: string,
): SermonContent | null {
    if (!tab) return null;
    return {
        meta: {
            id: tab.sermonId,
            translationId: 0,
            languageCode: bibleLang,
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
    const activeTabKey = useSermonStore(selectActiveTabKey);
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
                        onClick={() => activeTabKey && openSearchBar(activeTabKey)}
                        aria-label={t('Rechercher')}
                    />
                </Tooltip>
                <ReadingModeToggle />
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
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const currentMatchIndex = useSearchStore((s) =>
        activeTabKey ? (s.searchUiByTab[activeTabKey]?.currentMatchIndex ?? 0) : 0,
    );

    const [bibleLang, setBibleLang] = useState('');
    const [bibleVersionAbbreviation, setBibleVersionAbbreviation] = useState('');

    const bookCode = activeTab?.bibleBook;
    const chapter = activeTab?.bibleChapter;
    const { verses, loading } = useBibleChapterContent(bookCode, chapter);

    useEffect(() => {
        window.api.bible
            .getActiveVersion()
            .then((v) => {
                setBibleLang(v?.langCode ?? '');
                setBibleVersionAbbreviation(v?.abbreviation ?? '');
            })
            .catch(() => {
                setBibleLang('');
                setBibleVersionAbbreviation('');
            });
    }, []);

    const paragraphs = useMemo(() => versesToParagraphs(verses), [verses]);
    const loadedChapterKey = verses[0]
        ? buildBibleChapterKey(verses[0].book, verses[0].chapter)
        : null;
    const { restoreIdentity, readingPositionKey } = resolveBibleScrollPersistence(
        bookCode,
        chapter,
        loadedChapterKey,
    );
    useReferenceNavigation(containerRef, {
        contentReady: verses.length > 0 && !loading,
        documentType: 'bible',
        title: activeTab?.title,
        sermonId: activeTab?.sermonId,
        languageCode: bibleLang,
        bibleVersionAbbreviation,
    });

    const { zoom } = useScrollAndZoom(containerRef, {
        contentReady: verses.length > 0 && !loading,
        restoreIdentity,
        readingPositionKey,
    });

    const paragraphTexts = useMemo(() => paragraphs.map((p) => p.content), [paragraphs]);
    const { matchOffsets } = useMatchNavigation(
        activeTabKey,
        search,
        paragraphTexts,
        !!restoreIdentity,
    );

    const { hasPrev, hasNext, goPrev, goNext } = useChapterNavigation(activeTab);

    const introText = useMemo(() => {
        if (!activeTab?.title || !chapter) return undefined;
        const bookName = activeTab.title.replace(new RegExp(`\\s+${chapter}$`), '');
        return buildBibleChapterIntro(bookName, chapter, bibleLang);
    }, [activeTab?.title, chapter, bibleLang]);

    const tts = useTts(paragraphs, bibleLang, activeTab?.title ?? '', {
        introText,
        getSegmentLabel: (n) => buildSegmentAnnouncement('verse', n, bibleLang),
    });

    // Feature 3: Read entire book — auto-advance to next chapter on natural completion
    const ttsSettings = useTtsStore((s) => s.settings);
    const completedNaturally = useTtsStore((s) => s.completedNaturally);
    const autoStartTtsRef = useRef(false);

    useEffect(() => {
        if (completedNaturally && ttsSettings?.bibleReadEntireBook && hasNext) {
            useTtsStore.getState().clearCompletedNaturally();
            autoStartTtsRef.current = true;
            goNext();
        }
    }, [completedNaturally, ttsSettings?.bibleReadEntireBook, hasNext, goNext]);

    useEffect(() => () => useTtsStore.getState().clearCompletedNaturally(), []);

    useEffect(() => {
        if (autoStartTtsRef.current && paragraphs.length > 0 && !loading) {
            autoStartTtsRef.current = false;
            tts.play();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paragraphs.length, loading]);

    const contentForMenu = useMemo(
        () => buildContentForMenu(activeTab, paragraphs, bibleLang),
        [activeTab, paragraphs, bibleLang],
    );
    const contextMenuItems = useContextMenuItems(
        contentForMenu,
        contextTargetRef,
        'bible',
        verses,
        bibleVersionAbbreviation,
    );
    const { highlightsByParagraph } = useDocumentHighlights(
        activeTab?.title ?? null,
        activeTab?.sermonId,
    );

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
            <BibleContentHeader title={activeTab?.title} chapter={chapter} bibleLang={bibleLang} />
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
