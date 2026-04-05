import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Segmented, Space, Tooltip } from 'antd';
import {
    NumberOutlined,
    PlayCircleOutlined,
    PauseCircleOutlined,
    TranslationOutlined,
    SearchOutlined,
} from '@ant-design/icons';
import {
    useDocumentTabsStore,
    useSearchStore,
    useAudioStore,
    selectActiveTabKey,
} from '@renderer/stores';
import { usePrepareTabIdentityChange } from '@renderer/hooks';
import { ReadingModeToggle } from '@renderer/components/reading-mode-toggle';
import type {
    AvailableTranslation,
    AudioDocumentPlayRequest,
    SermonMeta,
    SermonParagraph,
} from '@shared/types';
import {
    CHILD_PARENT_WINDOW_EVENT,
    type AudioDocumentPlayDetail,
    type OpenOtherTranslationsModalDetail,
} from '@renderer/utils/events';
import { getLanguageDisplayName } from '@shared/tts.types';
import ParagraphNavigatorModal from './paragraph-navigator-modal';
import { TtsButton, ZoomControls, type TtsControls } from './tts-controls';
import { useDocumentZoom } from './hooks';

export default function SermonHeader({
    meta,
    zoom,
    availableTranslations,
    currentTranslationId,
    paragraphs,
    tts,
}: {
    meta: SermonMeta;
    zoom: number;
    availableTranslations: AvailableTranslation[];
    currentTranslationId: number;
    paragraphs: SermonParagraph[];
    tts?: TtsControls;
}) {
    const { t } = useTranslation();
    const [paragraphModalOpen, setParagraphModalOpen] = useState(false);
    const updateSermonTab = useDocumentTabsStore((s) => s.updateSermonTab);
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const prepareTabIdentityChange = usePrepareTabIdentityChange();
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const { zoomIn, zoomOut } = useDocumentZoom(zoom);

    const currentPlay = useAudioStore((s) => s.currentPlay);
    const audioSermonId = useAudioStore((s) => s.sermonId);
    const audioTranslationId = useAudioStore((s) => s.translationId);
    const audioLanguageCode = useAudioStore((s) => s.languageCode);
    const isCurrentDocument =
        audioSermonId === meta.sermonId &&
        audioTranslationId === meta.translationId &&
        audioLanguageCode === meta.languageCode;
    const isPlaying = isCurrentDocument && currentPlay?.status === 'play';

    const hasMultipleTranslations = availableTranslations.length > 1;

    const handleAudioPlay = useCallback(() => {
        if (!meta.audioLink) return;

        const detail: AudioDocumentPlayRequest = {
            title: meta.title,
            audioLink: meta.audioLink,
            languageLabel: getLanguageDisplayName(meta.languageCode),
            languageCode: meta.languageCode,
            sermonId: meta.sermonId,
            translationId: meta.translationId,
            autoplay: true,
        };

        window.dispatchEvent(
            new CustomEvent<AudioDocumentPlayDetail>(CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay, {
                detail,
            }),
        );
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

            prepareTabIdentityChange(activeTabKey);
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

    const translationOptions = useMemo(() => {
        return availableTranslations.map((translation) => ({
            label: translation.translationName ?? `T${translation.translationId}`,
            value: translation.translationId,
        }));
    }, [availableTranslations]);

    const canOpenTranslations = Boolean(meta.sermonId);

    return (
        <div className="sermon-header">
            {hasMultipleTranslations && (
                <Segmented
                    size="small"
                    options={translationOptions}
                    value={currentTranslationId}
                    onChange={handleTranslationChange}
                />
            )}
            <div style={{ flex: 1 }} />
            <Space size="small">
                {meta.audioLink && (
                    <Tooltip title={isPlaying ? t('Pause audio') : t("Écouter l'audio")}>
                        <Button
                            type="text"
                            size="small"
                            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                            onClick={handleAudioPlay}
                            aria-label={isPlaying ? t('Pause audio') : t("Écouter l'audio")}
                            style={
                                isCurrentDocument
                                    ? {
                                          color: 'var(--ant-color-primary)',
                                          backgroundColor: 'var(--ant-color-primary-bg)',
                                      }
                                    : undefined
                            }
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
