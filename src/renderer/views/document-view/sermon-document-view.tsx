import { useMemo, useRef } from 'react';
import { useAppStore, useSermonStore, selectActiveTab, selectActiveTabKey } from '@renderer/stores';
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

export default function SermonDocumentView() {
    const { content, loading } = useSermonContent();
    const containerRef = useRef<HTMLDivElement>(null);
    const contextTargetRef = useRef<Element | null>(null);
    const search = useSearchHighlight();
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const contextMenuItems = useContextMenuItems(content, contextTargetRef);

    const activeTab = useSermonStore(selectActiveTab);
    const sermonsById = useSermonStore((s) => s.sermonsById);
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const sermonInfo = activeTab?.sermonId ? sermonsById[activeTab.sermonId] : undefined;
    const tabTranslationId = activeTab?.translationId;
    const { restoreIdentity, readingPositionKey } = resolveSermonScrollPersistence(
        activeTab,
        sermonInfo,
        contentLanguage,
        content,
    );
    useReferenceNavigation(containerRef, {
        contentReady: !!content,
        documentType: 'sermon',
        title: activeTab?.title,
        sermonId: activeTab?.sermonId,
        translationId: tabTranslationId ?? content?.meta.translationId,
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

    const ttsIntroText = useMemo(() => {
        if (!content?.meta) return undefined;
        const { title, dateMs, location, languageCode } = content.meta;
        const dateStr = dateMs ? formatDate(dateMs) : null;
        return buildSermonIntroText(title, dateStr, location, languageCode);
    }, [content?.meta, formatDate]);

    const langCode = content?.meta.languageCode ?? '';
    const tts = useTts(ttsParagraphs, langCode, content?.meta.title ?? '', {
        introText: ttsIntroText,
        getSegmentLabel: (n) => buildSegmentAnnouncement('paragraph', n, langCode),
    });

    const { activeParagraphIndex } = useMatchNavigation(
        containerRef,
        activeTabKey,
        search,
        ttsParagraphs,
        !!restoreIdentity,
    );
    const { highlightsByParagraph } = useDocumentHighlights(
        content?.meta.title ?? null,
        activeTab?.sermonId,
    );

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
                        sermonInfo={sermonInfo}
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
                    documentId={content.meta.title}
                    search={search}
                    activeParagraphIndex={activeParagraphIndex}
                    highlightsByParagraph={highlightsByParagraph}
                    onPlayFromHere={!content.meta.audioLink ? tts.playFromParagraph : undefined}
                    canSpeak={!content.meta.audioLink && tts.canSpeak}
                    incompatibleMessage={tts.incompatibleMessage}
                />
            )}
        </DocumentBody>
    );
}
