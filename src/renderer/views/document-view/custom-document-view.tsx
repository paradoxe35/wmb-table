import { useMemo, useRef } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
    useSermonStore,
    useSearchStore,
    useCustomDocumentsStore,
    useAppStore,
    selectActiveTabKey,
    selectActiveTabTitle,
} from '@renderer/stores';
import { ReadingModeToggle } from '@renderer/components/reading-mode-toggle';
import type { SermonContent } from '@shared/types';
import { TtsButton, ZoomControls, ParagraphList } from './tts-controls';
import DocumentBody from './document-body';
import {
    resolveCustomDocumentScrollPersistence,
    useCustomDocumentContent,
    useScrollAndZoom,
    useSearchHighlight,
    useMatchNavigation,
    useContextMenuItems,
    useDocumentHighlights,
    useReferenceNavigation,
    useDocumentZoom,
} from './hooks';
import { useTts } from '@renderer/hooks/use-tts';
import { buildSegmentAnnouncement } from '@shared/tts.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DocumentParagraph {
    paragraphIndex: number;
    content: string;
}

/** Parse stored content into paragraphs. Handles both JSON array and legacy plain text. */
function parseContentToParagraphs(content: string): DocumentParagraph[] {
    let lines: string[];

    try {
        const parsed = JSON.parse(content);
        lines = Array.isArray(parsed) ? parsed : [];
    } catch {
        lines = content.split('\n').filter((l) => l.trim() !== '');
    }

    return lines.map((text, i) => ({
        paragraphIndex: i + 1,
        content: text,
    }));
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function CustomDocHeader({ zoom, tts }: { zoom: number; tts: ReturnType<typeof useTts> }) {
    const { t } = useTranslation();
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const { zoomIn, zoomOut } = useDocumentZoom(zoom);

    return (
        <div className="sermon-header">
            <div style={{ flex: 1 }} />
            <Space size="small">
                <TtsButton tts={tts} />
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

export default function CustomDocumentView() {
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const customDocuments = useCustomDocumentsStore((s) => s.customDocuments);
    const containerRef = useRef<HTMLDivElement>(null);
    const contextTargetRef = useRef<Element | null>(null);
    const search = useSearchHighlight();
    const activeTabKey = useSermonStore(selectActiveTabKey);
    const customDoc = useMemo(
        () => customDocuments.find((d) => d.title === activeTitle),
        [customDocuments, activeTitle],
    );
    const { content: docContent, loading } = useCustomDocumentContent(customDoc?.id);
    const { restoreIdentity, readingPositionKey } = resolveCustomDocumentScrollPersistence(
        customDoc?.id,
        docContent?.id,
    );
    useReferenceNavigation(containerRef, {
        contentReady: !!docContent,
        documentType: 'custom',
        sermonId: customDoc?.sermonId,
        customDocumentId: customDoc?.id,
    });
    const { zoom } = useScrollAndZoom(containerRef, {
        contentReady: !!docContent,
        restoreIdentity,
        readingPositionKey,
    });

    const paragraphs = useMemo(
        () => parseContentToParagraphs(docContent?.content ?? ''),
        [docContent?.content],
    );

    const { activeParagraphIndex } = useMatchNavigation(
        containerRef,
        activeTabKey,
        search,
        paragraphs,
        !!restoreIdentity,
    );

    // Build a minimal SermonContent-like object for context menu
    const contentForMenu = useMemo((): SermonContent | null => {
        if (!docContent) return null;
        return {
            meta: {
                id: customDoc?.id ?? '',
                translationId: 0,
                languageCode: '',
                sermonId: customDoc?.sermonId ?? '',
                title: docContent.title,
                enTitle: docContent.title,
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
    }, [docContent, paragraphs, customDoc]);

    const contextMenuItems = useContextMenuItems(contentForMenu, contextTargetRef, 'custom');
    const { highlightsByParagraph } = useDocumentHighlights(
        docContent?.title ?? null,
        customDoc?.sermonId,
    );

    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const docLang = docContent?.languageCode || contentLanguage || 'en';
    const tts = useTts(paragraphs, docLang, docContent?.title ?? '', {
        introText: docContent?.title,
        getSegmentLabel: (n) => buildSegmentAnnouncement('paragraph', n, docLang),
    });

    return (
        <DocumentBody
            loading={loading}
            ready={!!docContent}
            containerRef={containerRef}
            contextTargetRef={contextTargetRef}
            zoom={zoom}
            contextMenuItems={contextMenuItems}
            header={<CustomDocHeader zoom={zoom} tts={tts} />}
        >
            <div className="sermon-content-header">
                <h2 className="sermon-content-header__title">{docContent?.title}</h2>
            </div>
            <ParagraphList
                paragraphs={paragraphs}
                documentId={docContent?.title ?? ''}
                search={search}
                activeParagraphIndex={activeParagraphIndex}
                highlightsByParagraph={highlightsByParagraph}
                onPlayFromHere={tts.playFromParagraph}
                canSpeak={tts.canSpeak}
                incompatibleMessage={tts.incompatibleMessage}
            />
        </DocumentBody>
    );
}
