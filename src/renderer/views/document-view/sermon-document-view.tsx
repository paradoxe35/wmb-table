import { useEffect, useMemo, useRef, useState } from 'react';
import {
    useDocumentTabsStore,
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
    useSearchHighlight,
    useReferenceNavigation,
    useContextMenuItems,
    useMatchNavigation,
    useDocumentHighlights,
} from './hooks';
import { useTts } from '@renderer/hooks/use-tts';
import { useFormatSermonDate } from '@renderer/hooks';
import { buildSegmentAnnouncement, buildSermonIntroText } from '@shared/tts.types';
import type { AvailableTranslation } from '@shared/types';
import { getDocumentIdentityKey } from '@shared/types';

export default function SermonDocumentView() {
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

    useEffect(() => {
        if (!activeTabKey || !content?.meta.title) {
            return;
        }

        updateTabTitle(activeTabKey, content.meta.title);
    }, [activeTabKey, content?.meta.title, updateTabTitle]);

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

    const langCode = content?.meta.languageCode ?? '';
    const tts = useTts(ttsParagraphs, langCode, ttsDocumentKey, {
        introText: ttsIntroText,
        getSegmentLabel: (n) => buildSegmentAnnouncement('paragraph', n, langCode),
    });
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

    return (
        <DocumentBody
            loading={loading}
            ready={!!content}
            containerRef={containerRef}
            contextTargetRef={contextTargetRef}
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
                        tts={tts}
                    />
                )
            }
        >
            {content && <SermonContentHeader meta={content.meta} />}
            {content && (
                <ParagraphList
                    paragraphs={ttsParagraphs}
                    documentKey={ttsDocumentKey}
                    search={search}
                    activeParagraphIndex={activeParagraphIndex}
                    highlightsByParagraph={highlightsByParagraph}
                    onPlayFromHere={tts.playFromParagraph}
                    canSpeak={tts.canSpeak}
                    incompatibleMessage={tts.incompatibleMessage}
                />
            )}
        </DocumentBody>
    );
}
