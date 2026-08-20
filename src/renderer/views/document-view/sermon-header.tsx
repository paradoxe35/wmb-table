import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Segmented, Space, Tooltip } from 'antd';
import {
    NumberOutlined,
    PlayCircleOutlined,
    PauseCircleOutlined,
    TranslationOutlined,
    SearchOutlined,
    CustomerServiceOutlined,
} from '@ant-design/icons';
import {
    useDocumentTabsStore,
    useSearchStore,
    useAudioStore,
    selectActiveTabKey,
} from '@renderer/stores';
import { isSermonAudioLoaded } from '@renderer/stores/audio.store';
import { usePrepareTabIdentityChange } from '@renderer/hooks';
import { ReadingModeToggle } from '@renderer/components/reading-mode-toggle';
import type { AvailableTranslation, SermonMeta, SermonParagraph } from '@shared/types';
import {
    CHILD_PARENT_WINDOW_EVENT,
    requestAudioDocumentPlay,
    type OpenOtherTranslationsModalDetail,
} from '@renderer/utils/events';
import { getTranslationLabel, toAudioPlayRequest } from '@renderer/utils/sermon-utils';
import ParagraphNavigatorModal from './paragraph-navigator-modal';
import { TtsButton, ZoomControls, type TtsControls } from './tts-controls';
import { useDocumentZoom } from './hooks';
import { DocumentHeaderTitle } from './document-header-title';

function TranslationOption({
    translation,
    playing,
}: {
    translation: AvailableTranslation;
    playing: boolean;
}) {
    return (
        <Space size={4} align="center">
            {getTranslationLabel(translation)}
            {translation.hasAudio && (
                <CustomerServiceOutlined
                    style={{
                        color: playing ? 'var(--ant-color-primary)' : undefined,
                        fontSize: 'var(--fs-md)',
                    }}
                />
            )}
        </Space>
    );
}

const audioActiveStyle = {
    color: 'var(--ant-color-primary)',
    backgroundColor: 'var(--ant-color-primary-bg)',
};

export default function SermonHeader({
    meta,
    zoom,
    availableTranslations,
    currentTranslationId,
    paragraphs,
    tts,
    compactTitle,
    showCompactTitle,
}: {
    meta: SermonMeta;
    zoom: number;
    availableTranslations: AvailableTranslation[];
    currentTranslationId: number;
    paragraphs: SermonParagraph[];
    tts?: TtsControls;
    compactTitle: string;
    showCompactTitle: boolean;
}) {
    const { t } = useTranslation();
    const [paragraphModalOpen, setParagraphModalOpen] = useState(false);
    const [audioTooltipOpen, setAudioTooltipOpen] = useState(false);
    const [audioTooltipSuppressed, setAudioTooltipSuppressed] = useState(false);
    const updateSermonTab = useDocumentTabsStore((s) => s.updateSermonTab);
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const prepareTabIdentityChange = usePrepareTabIdentityChange();
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const { zoomIn, zoomOut } = useDocumentZoom(zoom);

    const currentPlay = useAudioStore((s) => s.currentPlay);
    const audioTranslationId = useAudioStore((s) => s.translationId);
    const isSermonAudio = useAudioStore((s) => isSermonAudioLoaded(s, meta));
    const isAudioPlaying = currentPlay?.status === 'play';
    const isCurrentDocument = isSermonAudio && audioTranslationId === meta.translationId;
    const isPlaying = isCurrentDocument && isAudioPlaying;
    const playingTranslationId = isSermonAudio && isAudioPlaying ? audioTranslationId : null;

    const hasMultipleTranslations = availableTranslations.length > 1;

    const handleAudioPlay = useCallback(() => {
        const request = toAudioPlayRequest(meta, true);
        if (!request) return;

        setAudioTooltipOpen(false);
        setAudioTooltipSuppressed(true);
        requestAudioDocumentPlay(request);
    }, [meta]);

    const handleOtherTranslations = useCallback(() => {
        if (!activeTabKey) {
            return;
        }

        const detail: OpenOtherTranslationsModalDetail = {
            tabKey: activeTabKey,
            sermonId: meta.sermonId,
            title: meta.title,
            currentTranslationId: meta.translationId,
            currentLanguageCode: meta.languageCode,
        };

        window.dispatchEvent(
            new CustomEvent<OpenOtherTranslationsModalDetail>(
                CHILD_PARENT_WINDOW_EVENT.openOtherTranslationsModal,
                { detail },
            ),
        );
    }, [activeTabKey, meta.languageCode, meta.sermonId, meta.title, meta.translationId]);

    const handleTranslationChange = useCallback(
        (value: string | number) => {
            if (!activeTabKey) {
                return;
            }

            const nextTranslation = availableTranslations.find(
                (tr) => tr.translationId === Number(value),
            );
            if (!nextTranslation) {
                return;
            }

            prepareTabIdentityChange(activeTabKey, {
                stopTts: true,
                ttsStopMode: 'remember',
            });
            updateSermonTab(activeTabKey, {
                title: nextTranslation.title,
                documentId: meta.sermonId,
                translationId: nextTranslation.translationId,
                languageCode: nextTranslation.languageCode,
            });
        },
        [
            activeTabKey,
            availableTranslations,
            meta.sermonId,
            prepareTabIdentityChange,
            updateSermonTab,
        ],
    );

    const translationOptions = useMemo(
        () =>
            availableTranslations.map((translation) => ({
                label: (
                    <TranslationOption
                        translation={translation}
                        playing={translation.translationId === playingTranslationId}
                    />
                ),
                value: translation.translationId,
            })),
        [availableTranslations, playingTranslationId],
    );

    const canOpenTranslations = Boolean(meta.sermonId);
    const leftSlotClass = [
        'sermon-header__side',
        'sermon-header__side--left',
        !hasMultipleTranslations ? 'sermon-header__side--placeholder' : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className="sermon-header">
            <div className={leftSlotClass} aria-hidden={!hasMultipleTranslations || undefined}>
                {hasMultipleTranslations && (
                    <Segmented
                        size="small"
                        options={translationOptions}
                        value={currentTranslationId}
                        onChange={handleTranslationChange}
                    />
                )}
            </div>
            <DocumentHeaderTitle title={compactTitle} visible={showCompactTitle} />
            <Space size="small" className="sermon-header__side sermon-header__side--right">
                {meta.audioLink && (
                    <Tooltip
                        title={isPlaying ? t('Pause audio') : t("Écouter l'audio")}
                        open={audioTooltipOpen}
                        onOpenChange={(open) => {
                            setAudioTooltipOpen(open && !audioTooltipSuppressed);
                        }}
                    >
                        <Button
                            type="text"
                            size="small"
                            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                            onClick={handleAudioPlay}
                            onMouseLeave={() => {
                                setAudioTooltipSuppressed(false);
                            }}
                            aria-label={isPlaying ? t('Pause audio') : t("Écouter l'audio")}
                            style={isPlaying ? audioActiveStyle : undefined}
                        />
                    </Tooltip>
                )}
                {tts && <TtsButton tts={tts} />}
                {canOpenTranslations && (
                    <Tooltip title={t('Traductions')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<TranslationOutlined />}
                            onClick={handleOtherTranslations}
                            aria-label={t('Traductions')}
                        />
                    </Tooltip>
                )}
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
            <ParagraphNavigatorModal
                open={paragraphModalOpen}
                onClose={() => setParagraphModalOpen(false)}
                paragraphs={paragraphs}
            />
        </div>
    );
}
