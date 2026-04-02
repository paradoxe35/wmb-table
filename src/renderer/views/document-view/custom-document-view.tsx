import { useMemo, useRef } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
    useDocumentTabsStore,
    useSearchStore,
    useCustomDocumentsStore,
    useAppStore,
    selectActiveDocumentIdentity,
    selectActiveCustomTab,
    selectActiveTabKey,
} from '@renderer/stores';
import { ReadingModeToggle } from '@renderer/components/reading-mode-toggle';
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

function CustomDocHeader({ zoom, tts }: { zoom: number; tts: ReturnType<typeof useTts> }) {
    const { t } = useTranslation();
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
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

export default function CustomDocumentView() {
    const activeTab = useDocumentTabsStore(selectActiveCustomTab);
    const activeDocumentIdentity = useDocumentTabsStore(selectActiveDocumentIdentity);
    const customDocuments = useCustomDocumentsStore((s) => s.customDocuments);
    const containerRef = useRef<HTMLDivElement>(null);
    const contextTargetRef = useRef<Element | null>(null);
    const search = useSearchHighlight();
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const customDoc = useMemo(
        () => (activeTab ? customDocuments.find((d) => d.id === activeTab.documentId) : undefined),
        [customDocuments, activeTab],
    );
    const { content: docContent, loading } = useCustomDocumentContent(customDoc?.id);
    const { restoreIdentity, readingPositionKey } = resolveCustomDocumentScrollPersistence(
        customDoc?.id,
        docContent?.id,
    );
    useReferenceNavigation(containerRef, {
        contentReady: !!docContent,
        documentIdentity: customDoc ? activeDocumentIdentity : null,
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

    const contextMenuContent = useMemo(() => {
        if (!docContent || !customDoc || !activeDocumentIdentity) {
            return null;
        }

        return {
            documentTitle: docContent.title,
            documentIdentity: activeDocumentIdentity,
            languageCode: docContent.languageCode || '',
            paragraphs,
        };
    }, [docContent, customDoc, activeDocumentIdentity, paragraphs]);

    const contextMenuItems = useContextMenuItems(contextMenuContent, contextTargetRef, 'custom');
    const { highlightsByParagraph } = useDocumentHighlights(
        customDoc ? (activeDocumentIdentity ?? undefined) : undefined,
    );

    const { t } = useTranslation();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const docLang = docContent?.languageCode || contentLanguage || 'en';
    const tts = useTts(paragraphs, docLang, activeTabKey ?? '', {
        introText: docContent?.title,
        getSegmentLabel: (n) => buildSegmentAnnouncement('paragraph', n, docLang),
    });

    // Disable TTS when document language doesn't match the active content language
    const effectiveTts = useMemo(() => {
        const langMismatch = docContent?.languageCode !== contentLanguage;
        if (!langMismatch) {
            return tts;
        }

        return {
            ...tts,
            canSpeak: false,
            incompatibleMessage: t(
                'La langue du document ne correspond pas à la langue active. Changez la langue dans les paramètres.',
            ),
        };
    }, [tts, docContent?.languageCode, contentLanguage, t]);

    return (
        <DocumentBody
            loading={loading}
            ready={!!docContent}
            containerRef={containerRef}
            contextTargetRef={contextTargetRef}
            zoom={zoom}
            contextMenuItems={contextMenuItems}
            header={<CustomDocHeader zoom={zoom} tts={effectiveTts} />}
        >
            <div className="sermon-content-header">
                <h2 className="sermon-content-header__title">{docContent?.title}</h2>
            </div>
            <ParagraphList
                paragraphs={paragraphs}
                documentId={activeTabKey ?? ''}
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
