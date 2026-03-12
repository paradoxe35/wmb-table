import { useMemo, useRef } from 'react';
import { useSermonStore, useSearchStore, selectActiveTab } from '@renderer/stores';
import SermonHeader from './sermon-header';
import SermonContentHeader from './sermon-content-header';
import { ParagraphList } from './tts-controls';
import DocumentBody from './document-body';
import {
    useSermonContent,
    useScrollAndZoom,
    useSearchHighlight,
    useReferenceNavigation,
    useContextMenuItems,
    useMatchNavigation,
    useDocumentHighlights,
} from './hooks';
import { useTts } from '@renderer/hooks/use-tts';

export default function SermonDocumentView() {
    const { content, loading } = useSermonContent();
    const containerRef = useRef<HTMLDivElement>(null);
    const contextTargetRef = useRef<Element | null>(null);
    const { zoom } = useScrollAndZoom(containerRef, !!content);
    const search = useSearchHighlight();
    const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);
    useReferenceNavigation(containerRef);
    const contextMenuItems = useContextMenuItems(content, contextTargetRef);

    const activeTab = useSermonStore(selectActiveTab);
    const sermonsById = useSermonStore((s) => s.sermonsById);
    const sermonInfo = activeTab?.sermonId ? sermonsById[activeTab.sermonId] : undefined;
    const tabTranslationId = activeTab?.translationId;

    const paragraphTexts = useMemo(
        () => (content?.paragraphs ?? []).map((p) => p.content),
        [content?.paragraphs],
    );

    const ttsParagraphs = useMemo(
        () =>
            (content?.paragraphs ?? []).map((p) => ({
                paragraphIndex: p.paragraphIndex,
                content: p.content,
            })),
        [content?.paragraphs],
    );

    const tts = useTts(ttsParagraphs, content?.meta.languageCode ?? '', content?.meta.title ?? '');

    const { matchOffsets } = useMatchNavigation(search, paragraphTexts);
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
                    currentMatchIndex={currentMatchIndex}
                    matchOffsets={matchOffsets}
                    highlightsByParagraph={highlightsByParagraph}
                    onPlayFromHere={!content.meta.audioLink ? tts.playFromParagraph : undefined}
                    canSpeak={!content.meta.audioLink && tts.canSpeak}
                    incompatibleMessage={tts.incompatibleMessage}
                />
            )}
        </DocumentBody>
    );
}
