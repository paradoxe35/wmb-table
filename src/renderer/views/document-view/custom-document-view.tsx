import { useMemo, useRef, useState } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { NumberOutlined, SearchOutlined } from '@ant-design/icons';
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
import ParagraphNavigatorModal from './paragraph-navigator-modal';
import DocumentBody from './document-body';
import { DocumentHeaderTitle } from './document-header-title';
import {
    resolveCustomDocumentScrollPersistence,
    useCustomDocumentContent,
    useScrollAndZoom,
    useScrolledPastTitle,
    useSearchHighlight,
    useMatchNavigation,
    useContextMenuItems,
    useDocumentHighlights,
    useReferenceNavigation,
    useDocumentZoom,
} from './hooks';
import { useTts } from '@renderer/hooks/use-tts';
import { buildSegmentAnnouncement, getLanguageLabelNative } from '@shared/tts.types';
import { getDocumentIdentityKey } from '@shared/types';

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

function CustomDocHeader({
    zoom,
    tts,
    paragraphs,
    compactTitle,
    showCompactTitle,
}: {
    zoom: number;
    tts: ReturnType<typeof useTts>;
    paragraphs: DocumentParagraph[];
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
                <div
                    className="sermon-header__side sermon-header__side--left sermon-header__side--placeholder"
                    aria-hidden
                />
                <DocumentHeaderTitle title={compactTitle} visible={showCompactTitle} />
                <Space size="small" className="sermon-header__side sermon-header__side--right">
                    <TtsButton tts={tts} />
                    <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} />
                    <Tooltip title={t('Sélectionnez un paragraphe')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<NumberOutlined />}
                            onClick={() => setParagraphModalOpen(true)}
                            aria-label={t('Sélectionnez un paragraphe')}
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
            />
        </>
    );
}

export default function CustomDocumentView() {
    const activeTab = useDocumentTabsStore(selectActiveCustomTab);
    const activeDocumentIdentity = useDocumentTabsStore(selectActiveDocumentIdentity);
    const containerRef = useRef<HTMLDivElement>(null);
    const contextTargetRef = useRef<Element | null>(null);
    const search = useSearchHighlight();
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const activeCustomDocumentId = activeTab?.documentId;
    const customDoc = useCustomDocumentsStore((s) =>
        activeCustomDocumentId
            ? s.customDocuments.find((document) => document.id === activeCustomDocumentId)
            : undefined,
    );

    const ttsDocumentKey = activeDocumentIdentity
        ? getDocumentIdentityKey(activeDocumentIdentity)
        : '';

    const { content: docContent, loading } = useCustomDocumentContent(
        customDoc?.id,
        customDoc?.languageCode,
    );
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

    const { t } = useTranslation();
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const docLang = docContent?.languageCode ?? contentLanguage ?? 'en';

    const contextMenuContent = useMemo(() => {
        if (!docContent || !customDoc || !activeDocumentIdentity) {
            return null;
        }

        return {
            documentTitle: docContent.title,
            documentIdentity: activeDocumentIdentity,
            languageCode: docLang,
            paragraphs,
        };
    }, [docContent, customDoc, activeDocumentIdentity, docLang, paragraphs]);

    const contextMenuItems = useContextMenuItems(contextMenuContent, contextTargetRef, 'custom');
    const { highlightsByParagraph } = useDocumentHighlights(
        customDoc ? (activeDocumentIdentity ?? undefined) : undefined,
    );

    const tts = useTts(paragraphs, docLang, ttsDocumentKey, {
        introText: docContent?.title,
        getSegmentLabel: (n) => buildSegmentAnnouncement('paragraph', n, docLang),
    });

    const showCompactTitle = useScrolledPastTitle(containerRef, !!docContent);
    const compactTitle = docContent?.title ?? '';

    // Disable TTS when document language doesn't match the active content language
    const effectiveTts = useMemo(() => {
        const langMismatch =
            !!docContent?.languageCode &&
            !!contentLanguage &&
            docContent.languageCode !== contentLanguage;
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
    }, [tts, docContent?.languageCode, contentLanguage, t]);

    return (
        <DocumentBody
            loading={loading}
            ready={!!docContent}
            containerRef={containerRef}
            contextTargetRef={contextTargetRef}
            documentIdentity={activeDocumentIdentity}
            zoom={zoom}
            contextMenuItems={contextMenuItems}
            header={
                <CustomDocHeader
                    zoom={zoom}
                    tts={effectiveTts}
                    paragraphs={paragraphs}
                    compactTitle={compactTitle}
                    showCompactTitle={showCompactTitle}
                />
            }
        >
            <div className="sermon-content-header">
                <h2 className="sermon-content-header__title">{docContent?.title}</h2>
            </div>
            <ParagraphList
                paragraphs={paragraphs}
                documentKey={ttsDocumentKey}
                documentIdentity={activeDocumentIdentity}
                search={search}
                activeParagraphIndex={activeParagraphIndex}
                highlightsByParagraph={highlightsByParagraph}
                onPlayFromHere={effectiveTts.playFromParagraph}
                canSpeak={effectiveTts.canSpeak}
            />
        </DocumentBody>
    );
}
