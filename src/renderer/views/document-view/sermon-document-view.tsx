import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    useDocumentTabsStore,
    useAppStore,
    selectActiveDocumentIdentity,
    selectActiveSermonTab,
    selectActiveTabKey,
} from '@renderer/stores';
import SermonHeader from './sermon-header';
import SermonContentHeader from './sermon-content-header';
import { ParagraphList } from './tts-controls';
import DocumentBody from './document-body';
import {
    resolveSermonScrollPersistence,
    useSermonContent,
    useScrollAndZoom,
    useScrolledPastTitle,
    useSearchHighlight,
    useReferenceNavigation,
    useContextMenuItems,
    useMatchNavigation,
    useDocumentHighlights,
} from './hooks';
import { useTts } from '@renderer/hooks/use-tts';
import { useFormatSermonDate, useFormatSermonDateShort } from '@renderer/hooks';
import {
    buildSegmentAnnouncement,
    buildSermonIntroText,
    getLanguageLabelNative,
} from '@shared/tts.types';
import type { AvailableTranslation } from '@shared/types';
import { getDocumentIdentityKey } from '@shared/types';

export default function SermonDocumentView() {
    const { t } = useTranslation();
    const { content, loading } = useSermonContent();
    const containerRef = useRef<HTMLDivElement>(null);
    const contextTargetRef = useRef<Element | null>(null);
    const search = useSearchHighlight();
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const updateTabTitle = useDocumentTabsStore((s) => s.updateTabTitle);
    const activeTab = useDocumentTabsStore(selectActiveSermonTab);
    const activeDocumentIdentity = useDocumentTabsStore(selectActiveDocumentIdentity);
    const tabTranslationId = activeTab?.translationId;
    const [availableTranslations, setAvailableTranslations] = useState<AvailableTranslation[]>([]);
    const ttsDocumentKey = activeDocumentIdentity
        ? getDocumentIdentityKey(activeDocumentIdentity)
        : '';
    const { restoreIdentity, readingPositionKey } = resolveSermonScrollPersistence(
        activeTab,
        content,
    );
    useReferenceNavigation(containerRef, {
        contentReady: !!content,
        documentIdentity: activeDocumentIdentity,
    });
    const { zoom } = useScrollAndZoom(containerRef, {
        contentReady: !!content,
        restoreIdentity,
        readingPositionKey,
    });

    const ttsParagraphs = useMemo(
        () =>
            (content?.paragraphs ?? []).map((p) => ({
                paragraphIndex: p.paragraphIndex,
                content: p.content,
            })),
        [content?.paragraphs],
    );

    const formatDate = useFormatSermonDate();
    const contentMatchesActiveTab =
        !!activeTab &&
        !!content &&
        content.meta.sermonId === activeTab.documentId &&
        content.meta.translationId === activeTab.translationId &&
        content.meta.languageCode === activeTab.languageCode;

    useEffect(() => {
        if (!activeTabKey || !content?.meta.title || !contentMatchesActiveTab) {
            return;
        }

        updateTabTitle(activeTabKey, content.meta.title);
    }, [activeTabKey, content?.meta.title, contentMatchesActiveTab, updateTabTitle]);

    useEffect(() => {
        if (!activeTab?.documentId || !activeTab.languageCode) {
            setAvailableTranslations([]);
            return;
        }

        let cancelled = false;
        window.api.documents
            .getTranslationsForSermonInLanguage(activeTab.documentId, activeTab.languageCode)
            .then((translations) => {
                if (cancelled) {
                    return;
                }

                setAvailableTranslations(
                    translations.map((translation) => ({
                        translationId: translation.translationId,
                        languageCode: translation.languageCode,
                        title: translation.title,
                        translationName: translation.translationName,
                    })),
                );
            })
            .catch(() => {
                if (!cancelled) {
                    setAvailableTranslations([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activeTab?.documentId, activeTab?.languageCode]);

    const headerTranslations = useMemo(() => {
        if (availableTranslations.length > 0) {
            return availableTranslations;
        }

        if (!content?.meta) {
            return [];
        }

        return [
            {
                translationId: content.meta.translationId,
                languageCode: content.meta.languageCode,
                title: content.meta.title,
                translationName: content.meta.translationName,
            },
        ];
    }, [availableTranslations, content?.meta]);

    const ttsIntroText = useMemo(() => {
        if (!content?.meta) return undefined;
        const { title, dateMs, location, languageCode } = content.meta;
        const dateStr = dateMs ? formatDate(dateMs) : null;
        return buildSermonIntroText(title, dateStr, location, languageCode);
    }, [content?.meta, formatDate]);

    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const langCode = content?.meta.languageCode ?? '';
    const tts = useTts(ttsParagraphs, langCode, ttsDocumentKey, {
        introText: ttsIntroText,
        getSegmentLabel: (n) => buildSegmentAnnouncement('paragraph', n, langCode),
    });
    const effectiveTts = useMemo(() => {
        const langMismatch =
            !!content?.meta.languageCode &&
            !!contentLanguage &&
            content.meta.languageCode !== contentLanguage;
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
    }, [tts, content?.meta.languageCode, contentLanguage, t]);
    const contextMenuContent = useMemo(() => {
        if (!content || !activeDocumentIdentity) {
            return null;
        }

        return {
            documentTitle: content.meta.title,
            documentIdentity: activeDocumentIdentity,
            languageCode: content.meta.languageCode,
            paragraphs: ttsParagraphs,
            sermonDateMs: content.meta.dateMs,
            sermonTranslationId: content.meta.translationId,
        };
    }, [content, activeDocumentIdentity, ttsParagraphs]);

    const contextMenuItems = useContextMenuItems(contextMenuContent, contextTargetRef);

    const { activeParagraphIndex } = useMatchNavigation(
        containerRef,
        activeTabKey,
        search,
        ttsParagraphs,
        !!restoreIdentity,
    );
    const { highlightsByParagraph } = useDocumentHighlights(activeDocumentIdentity ?? undefined);

    const showCompactTitle = useScrolledPastTitle(containerRef, !!content);
    const formatDateShort = useFormatSermonDateShort(content?.meta.languageCode);
    const compactTitle = useMemo(() => {
        if (!content?.meta.title) return '';
        const dateLabel = content.meta.dateMs ? formatDateShort(content.meta.dateMs) : '';
        return dateLabel ? `${content.meta.title} — ${dateLabel}` : content.meta.title;
    }, [content?.meta.title, content?.meta.dateMs, formatDateShort]);

    return (
        <DocumentBody
            loading={loading}
            ready={!!content}
            containerRef={containerRef}
            contextTargetRef={contextTargetRef}
            documentIdentity={activeDocumentIdentity}
            zoom={zoom}
            contextMenuItems={contextMenuItems}
            header={
                content && (
                    <SermonHeader
                        meta={content.meta}
                        zoom={zoom}
                        availableTranslations={headerTranslations}
                        currentTranslationId={tabTranslationId ?? content.meta.translationId}
                        paragraphs={content.paragraphs}
                        tts={effectiveTts}
                        compactTitle={compactTitle}
                        showCompactTitle={showCompactTitle}
                    />
                )
            }
        >
            {content && <SermonContentHeader meta={content.meta} />}
            {content && (
                <ParagraphList
                    paragraphs={ttsParagraphs}
                    documentKey={ttsDocumentKey}
                    documentIdentity={activeDocumentIdentity}
                    search={search}
                    activeParagraphIndex={activeParagraphIndex}
                    highlightsByParagraph={highlightsByParagraph}
                    onPlayFromHere={effectiveTts.playFromParagraph}
                    canSpeak={effectiveTts.canSpeak}
                    incompatibleMessage={effectiveTts.incompatibleMessage}
                />
            )}
        </DocumentBody>
    );
}
