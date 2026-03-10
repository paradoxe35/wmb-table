import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import {
    useSermonStore,
    useSearchStore,
    useCustomDocumentsStore,
    useAppStore,
    selectActiveTabTitle,
} from '@renderer/stores';
import type { CustomDocumentContent, SermonContent } from '@shared/types';
import { TtsButton, ZoomControls, ParagraphList } from './tts-controls';
import DocumentBody from './document-body';
import {
    useScrollAndZoom,
    useSearchHighlight,
    useMatchNavigation,
    useContextMenuItems,
    useDocumentHighlights,
    useReferenceNavigation,
    useDocumentZoom,
} from './hooks';
import { useTts } from '@renderer/hooks/use-tts';

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
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const { zoomIn, zoomOut } = useDocumentZoom(zoom);

    return (
        <div className="sermon-header">
            <div style={{ flex: 1 }} />
            <Space size="small">
                <TtsButton tts={tts} />
                <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} />
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

export default function CustomDocumentView() {
    const activeTitle = useSermonStore(selectActiveTabTitle);
    const customDocuments = useCustomDocumentsStore((s) => s.customDocuments);
    const containerRef = useRef<HTMLDivElement>(null);
    const contextTargetRef = useRef<Element | null>(null);
    const { zoom } = useScrollAndZoom(containerRef);
    const [docContent, setDocContent] = useState<CustomDocumentContent | null>(null);
    const [loading, setLoading] = useState(false);
    const search = useSearchHighlight();
    const currentMatchIndex = useSearchStore((s) => s.currentMatchIndex);

    useReferenceNavigation(containerRef);

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

    const paragraphs = useMemo(
        () => parseContentToParagraphs(docContent?.content ?? ''),
        [docContent?.content],
    );

    const paragraphTexts = useMemo(() => paragraphs.map((p) => p.content), [paragraphs]);
    const { matchOffsets } = useMatchNavigation(search, paragraphTexts);

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

    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const tts = useTts(paragraphs, activeLanguage ?? 'en', docContent?.title ?? '');

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
                currentMatchIndex={currentMatchIndex}
                matchOffsets={matchOffsets}
                highlightsByParagraph={highlightsByParagraph}
                onPlayFromHere={tts.playFromParagraph}
                canSpeak={tts.canSpeak}
            />
        </DocumentBody>
    );
}
