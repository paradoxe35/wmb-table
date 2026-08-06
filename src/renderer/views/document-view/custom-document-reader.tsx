import { useState, type ReactNode } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { NumberOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useDocumentTabsStore, useSearchStore, selectActiveTabKey } from '@renderer/stores';
import { ReadingModeToggle } from '@renderer/components/reading-mode-toggle';
import { TtsButton, ZoomControls, ParagraphList } from './tts-controls';
import ParagraphNavigatorModal from './paragraph-navigator-modal';
import DocumentBody from './document-body';
import { DocumentHeaderTitle } from './document-header-title';
import { useDocumentZoom, type CustomDocumentReader } from './hooks';

type ReaderExtras = {
    /** Replaces the paragraph navigator when the document has a richer structure. */
    navigation?: ReactNode;
    /** Structural citation of the current selection, shown in the header. */
    citation?: ReactNode;
    renderBeforeParagraph?: (paragraphIndex: number) => ReactNode;
};

function CustomDocHeader({
    reader,
    navigation,
    citation,
}: { reader: CustomDocumentReader } & Pick<ReaderExtras, 'navigation' | 'citation'>) {
    const { t } = useTranslation();
    const [paragraphModalOpen, setParagraphModalOpen] = useState(false);
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const { zoomIn, zoomOut } = useDocumentZoom(reader.zoom);

    return (
        <>
            <div className="sermon-header">
                <div
                    className={`sermon-header__side sermon-header__side--left${
                        citation ? '' : ' sermon-header__side--placeholder'
                    }`}
                    aria-hidden={!citation}
                >
                    {citation}
                </div>
                <DocumentHeaderTitle title={reader.title} visible={reader.showCompactTitle} />
                <Space size="small" className="sermon-header__side sermon-header__side--right">
                    <TtsButton tts={reader.tts} />
                    <ZoomControls zoom={reader.zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} />
                    {navigation ?? (
                        <Tooltip title={t('Sélectionnez un paragraphe')}>
                            <Button
                                type="text"
                                size="small"
                                icon={<NumberOutlined />}
                                onClick={() => setParagraphModalOpen(true)}
                                aria-label={t('Sélectionnez un paragraphe')}
                            />
                        </Tooltip>
                    )}
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
            {!navigation && (
                <ParagraphNavigatorModal
                    open={paragraphModalOpen}
                    onClose={() => setParagraphModalOpen(false)}
                    paragraphs={reader.content.paragraphs}
                />
            )}
        </>
    );
}

/**
 * The custom-document reader itself. Both the plain and the book views render
 * through this so a capability can never exist in one and not the other.
 */
export function CustomDocumentReaderView({
    reader,
    navigation,
    citation,
    renderBeforeParagraph,
}: { reader: CustomDocumentReader } & ReaderExtras) {
    return (
        <DocumentBody
            loading={reader.loading}
            ready={reader.ready}
            containerRef={reader.containerRef}
            contextTargetRef={reader.contextTargetRef}
            documentIdentity={reader.documentIdentity}
            zoom={reader.zoom}
            contextMenuItems={reader.contextMenuItems}
            header={<CustomDocHeader reader={reader} navigation={navigation} citation={citation} />}
        >
            <div className="sermon-content-header">
                <h2 className="sermon-content-header__title">{reader.title}</h2>
            </div>
            <ParagraphList
                paragraphs={reader.content.paragraphs}
                documentKey={reader.ttsDocumentKey}
                documentIdentity={reader.documentIdentity}
                search={reader.search}
                activeParagraphIndex={reader.activeParagraphIndex}
                highlightsByParagraph={reader.highlightsByParagraph}
                renderBeforeParagraph={renderBeforeParagraph}
            />
        </DocumentBody>
    );
}
