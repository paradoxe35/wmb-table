import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Space, Tooltip } from 'antd';
import { LeftOutlined, NumberOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import {
    useDocumentTabsStore,
    useSearchStore,
    selectActiveDocumentIdentity,
    selectActiveBibleTab,
    selectActiveTabKey,
} from '@renderer/stores';
import { usePrepareTabIdentityChange } from '@renderer/hooks';
import { ReadingModeToggle } from '@renderer/components/reading-mode-toggle';
import type { BibleBook, BibleIndex, BibleTab, BibleVersionInfo } from '@shared/types';
import {
    buildBibleDocumentId,
    buildBibleDocumentTitle,
    getDocumentIdentityKey,
    getBibleIndexEntry,
    getTabKey,
    normalizeBibleAbbreviation,
} from '@shared/types';
import { TtsButton, ZoomControls, ParagraphList, type TtsControls } from './tts-controls';
import ParagraphNavigatorModal from './paragraph-navigator-modal';
import DocumentBody from './document-body';
import { DocumentHeaderTitle } from './document-header-title';
import {
    buildBibleChapterKey,
    resolveBibleScrollPersistence,
    useBibleChapterContent,
    useScrollAndZoom,
    useScrolledPastTitle,
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
    getLanguageLabelNative,
} from '@shared/tts.types';
import { useAppStore } from '@renderer/stores';

// ---------------------------------------------------------------------------
// Content header (inside body, like SermonContentHeader)
// ---------------------------------------------------------------------------

function BibleContentHeader({
    bookName,
    chapter,
    bibleLang,
    versionName,
}: {
    bookName?: string;
    chapter?: string;
    bibleLang: string;
    versionName?: string;
}) {
    if (!bookName) return null;
    const chapterLabel = chapter ? `${getChapterLabel(bibleLang)} ${chapter}` : null;

    return (
        <div className="sermon-content-header">
            <h2 className="sermon-content-header__title">{bookName}</h2>
            {chapterLabel && <div className="sermon-content-header__date">{chapterLabel}</div>}
            {versionName && (
                <div
                    style={{
                        color: 'var(--ant-color-text-quaternary)',
                        fontSize: 'var(--fs-rel-lg)',
                        marginTop: 2,
                    }}
                >
                    {versionName}
                </div>
            )}
        </div>
    );
}

function versesToParagraphs(verses: BibleBook[]) {
    return verses
        .slice()
        .sort((a, b) => +a.verse - +b.verse)
        .map((v) => ({
            paragraphIndex: +v.verse,
            content: v.content,
        }));
}

let cachedBibleVersions: BibleVersionInfo[] | null = null;

// ---------------------------------------------------------------------------
// Chapter navigation hook
// ---------------------------------------------------------------------------

function useChapterNavigation(activeTab: BibleTab | null) {
    const updateBibleTab = useDocumentTabsStore((s) => s.updateBibleTab);
    const activateTab = useDocumentTabsStore((s) => s.activateTab);
    const tabs = useDocumentTabsStore((s) => s.tabs);
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const prepareTabIdentityChange = usePrepareTabIdentityChange();
    const [bibleIndex, setBibleIndex] = useState<BibleIndex>({});

    const bookCode = activeTab?.bibleBook;

    useEffect(() => {
        window.api.bible
            .getIndexes(activeTab?.bibleVersionAbbreviation)
            .then((flat) => setBibleIndex(flat ?? {}))
            .catch(() => setBibleIndex({}));
    }, [activeTab?.bibleVersionAbbreviation]);

    const bookEntry = useMemo(() => {
        if (!bookCode) return null;
        return getBibleIndexEntry(bibleIndex, bookCode);
    }, [bibleIndex, bookCode]);

    const chapterList = useMemo(() => {
        if (!bookEntry) return [];
        return bookEntry.value.chapters
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
            .sort((a, b) => +a - +b);
    }, [bookEntry]);

    const bookName = bookEntry?.bookName ?? '';
    const currentChapter = activeTab?.bibleChapter ?? '1';
    const currentIdx = chapterList.indexOf(currentChapter);
    const hasPrev = currentIdx > 0;
    const hasNext = currentIdx >= 0 && currentIdx < chapterList.length - 1;

    const navigateToChapter = useCallback(
        (chapter: string) => {
            if (!activeTabKey || !bookCode) {
                return;
            }

            const title = buildBibleDocumentTitle(
                bookName,
                chapter,
                activeTab?.bibleVersionAbbreviation,
            );

            const documentId = buildBibleDocumentId(bookCode, chapter);
            const existingTab = tabs.find((t) => {
                return (
                    t.type === 'bible' &&
                    t.documentId === documentId &&
                    t.bibleVersionAbbreviation ===
                        normalizeBibleAbbreviation(activeTab.bibleVersionAbbreviation)
                );
            });

            if (existingTab) {
                activateTab(getTabKey(existingTab));
            } else {
                prepareTabIdentityChange(activeTabKey, { stopTts: true });
                updateBibleTab(activeTabKey, {
                    title,
                    documentId,
                    bibleBook: bookCode,
                    bibleChapter: chapter,
                    bibleVersionAbbreviation: activeTab.bibleVersionAbbreviation,
                });
            }
        },
        [
            activeTab,
            activeTabKey,
            bookCode,
            bookName,
            tabs,
            activateTab,
            prepareTabIdentityChange,
            updateBibleTab,
        ],
    );

    const goPrev = useCallback(() => {
        if (hasPrev) navigateToChapter(chapterList[currentIdx - 1]);
    }, [hasPrev, navigateToChapter, chapterList, currentIdx]);

    const goNext = useCallback(() => {
        if (hasNext) navigateToChapter(chapterList[currentIdx + 1]);
    }, [hasNext, navigateToChapter, chapterList, currentIdx]);

    return { bibleIndex, hasPrev, hasNext, goPrev, goNext };
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
    paragraphs,
    tts,
    compactTitle,
    showCompactTitle,
}: {
    title: string;
    zoom: number;
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    paragraphs: { paragraphIndex: number }[];
    tts?: TtsControls;
    compactTitle: string;
    showCompactTitle: boolean;
}) {
    const { t } = useTranslation();
    const [paragraphModalOpen, setParagraphModalOpen] = useState(false);
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const { zoomIn, zoomOut } = useDocumentZoom(zoom);

    return (
        <>
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
                <DocumentHeaderTitle title={compactTitle} visible={showCompactTitle} />
                <Space size="small">
                    {tts && <TtsButton tts={tts} />}
                    <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} />
                    <Tooltip title={t('Sélectionnez un verset')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<NumberOutlined />}
                            onClick={() => setParagraphModalOpen(true)}
                            aria-label={t('Sélectionnez un verset')}
                        />
                    </Tooltip>
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
            <ParagraphNavigatorModal
                open={paragraphModalOpen}
                onClose={() => setParagraphModalOpen(false)}
                paragraphs={paragraphs}
                title={t('Sélectionnez un verset')}
                emptyText={t('Aucun verset')}
            />
        </>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BibleDocumentView() {
    const { t } = useTranslation();
    const activeTab = useDocumentTabsStore(selectActiveBibleTab);
    const activeDocumentIdentity = useDocumentTabsStore(selectActiveDocumentIdentity);
    const containerRef = useRef<HTMLDivElement>(null);
    const contextTargetRef = useRef<Element | null>(null);
    const search = useSearchHighlight();
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const activeBibleVersion = useAppStore((s) => s.activeBibleVersion);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const [allBibleVersions, setAllBibleVersions] = useState<BibleVersionInfo[]>(
        cachedBibleVersions ?? [],
    );

    const bookCode = activeTab?.bibleBook;
    const chapter = activeTab?.bibleChapter;
    const bibleVersionAbbreviation = activeTab?.bibleVersionAbbreviation ?? '';
    const ttsDocumentKey = activeDocumentIdentity
        ? getDocumentIdentityKey(activeDocumentIdentity)
        : '';

    const activeTabVersion = useMemo(() => {
        if (!bibleVersionAbbreviation) {
            return null;
        }

        return (
            allBibleVersions.find((version) => version.abbreviation === bibleVersionAbbreviation) ??
            (activeBibleVersion?.abbreviation === bibleVersionAbbreviation
                ? activeBibleVersion
                : null)
        );
    }, [activeBibleVersion, allBibleVersions, bibleVersionAbbreviation]);

    const bibleLang =
        activeTabVersion?.langCode ?? activeBibleVersion?.langCode ?? contentLanguage ?? '';

    const { verses, loading: chapterLoading } = useBibleChapterContent(
        bookCode,
        chapter,
        bibleVersionAbbreviation,
    );

    const loading = chapterLoading && verses.length === 0;

    const paragraphs = useMemo(() => versesToParagraphs(verses), [verses]);
    const loadedChapterKey =
        verses.length > 0 && bookCode && chapter && bibleVersionAbbreviation
            ? buildBibleChapterKey(bookCode, chapter, bibleVersionAbbreviation)
            : null;
    const { restoreIdentity, readingPositionKey } = resolveBibleScrollPersistence(
        bookCode,
        chapter,
        loadedChapterKey,
        bibleVersionAbbreviation,
    );

    useEffect(() => {
        if (cachedBibleVersions) {
            return;
        }

        window.api.bible.getAllVersions().then((versions) => {
            cachedBibleVersions = versions;
            setAllBibleVersions(versions);
        });
    }, []);
    useReferenceNavigation(containerRef, {
        contentReady: verses.length > 0 && !loading,
        documentIdentity: activeDocumentIdentity,
    });

    const { zoom } = useScrollAndZoom(containerRef, {
        contentReady: verses.length > 0 && !loading,
        restoreIdentity,
        readingPositionKey,
    });

    const { activeParagraphIndex } = useMatchNavigation(
        containerRef,
        activeTabKey,
        search,
        paragraphs,
        !!restoreIdentity,
    );

    const { bibleIndex, hasPrev, hasNext, goPrev, goNext } = useChapterNavigation(activeTab);
    const bookName = useMemo(() => {
        if (!bookCode) {
            return '';
        }

        return getBibleIndexEntry(bibleIndex, bookCode)?.bookName ?? '';
    }, [bibleIndex, bookCode]);

    // Gate on bookName too — the `.sermon-content-header` only renders once the
    // book name resolves (separate async fetch from `verses`), so the observer
    // must wait for that element to actually exist in the DOM.
    const showCompactTitle = useScrolledPastTitle(
        containerRef,
        verses.length > 0 && !loading && !!bookName,
    );
    const compactTitle = useMemo(() => {
        if (!bookName) return '';
        if (!chapter) return bookName;
        return `${bookName} — ${getChapterLabel(bibleLang)} ${chapter}`;
    }, [bookName, chapter, bibleLang]);

    const introText = useMemo(() => {
        if (!bookName || !chapter) return undefined;
        return buildBibleChapterIntro(bookName, chapter, bibleLang);
    }, [bookName, chapter, bibleLang]);

    const tts = useTts(paragraphs, bibleLang, ttsDocumentKey, {
        introText,
        getSegmentLabel: (n) => buildSegmentAnnouncement('verse', n, bibleLang),
    });
    const effectiveTts = useMemo(() => {
        const langMismatch = !!bibleLang && !!contentLanguage && bibleLang !== contentLanguage;
        const activeLanguageLabel = contentLanguage
            ? getLanguageLabelNative(contentLanguage)
            : undefined;

        if (!langMismatch) {
            return tts;
        }

        return {
            ...tts,
            canSpeak: false,
            incompatibleMessage: t(
                'La langue du document ne correspond pas à la langue active ({{language}}). Changez la langue dans les paramètres.',
                { language: activeLanguageLabel ?? contentLanguage ?? '' },
            ),
        };
    }, [tts, bibleLang, contentLanguage, t]);

    // Read entire book: keep following the chapter that started playback,
    // even if the user switches to another Bible tab while it is still reading.
    const contextMenuContent = useMemo(() => {
        if (!activeTab || !activeDocumentIdentity) {
            return null;
        }

        return {
            documentTitle: activeTab.title,
            documentIdentity: activeDocumentIdentity,
            languageCode: bibleLang,
            paragraphs,
        };
    }, [activeTab, activeDocumentIdentity, bibleLang, paragraphs]);
    const contextMenuItems = useContextMenuItems(
        contextMenuContent,
        contextTargetRef,
        'bible',
        verses,
    );
    const { highlightsByParagraph } = useDocumentHighlights(activeDocumentIdentity ?? undefined);

    return (
        <DocumentBody
            loading={loading}
            ready
            containerRef={containerRef}
            contextTargetRef={contextTargetRef}
            documentIdentity={activeDocumentIdentity}
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
                    paragraphs={paragraphs}
                    tts={effectiveTts}
                    compactTitle={compactTitle}
                    showCompactTitle={showCompactTitle}
                />
            }
        >
            <BibleContentHeader
                bookName={bookName}
                chapter={chapter}
                bibleLang={bibleLang}
                versionName={activeTabVersion?.name}
            />

            <ParagraphList
                paragraphs={paragraphs}
                documentKey={ttsDocumentKey}
                documentIdentity={activeDocumentIdentity}
                search={search}
                activeParagraphIndex={activeParagraphIndex}
                highlightsByParagraph={highlightsByParagraph}
                onPlayFromHere={effectiveTts.playFromParagraph}
                canSpeak={effectiveTts.canSpeak}
                incompatibleMessage={effectiveTts.incompatibleMessage}
            />
        </DocumentBody>
    );
}
