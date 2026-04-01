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
import { ReadingModeToggle } from '@renderer/components/reading-mode-toggle';
import type { SermonMeta, SermonMetaWithTraductions, SermonParagraph } from '@shared/types';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';
import ParagraphNavigatorModal from './paragraph-navigator-modal';
import { TtsButton, ZoomControls, type TtsControls } from './tts-controls';
import { useDocumentZoom } from './hooks';

export default function SermonHeader({
    meta,
    zoom,
    sermonInfo,
    currentTranslationId,
    paragraphs,
    tts,
}: {
    meta: SermonMeta;
    zoom: number;
    sermonInfo: SermonMetaWithTraductions | undefined;
    currentTranslationId: number;
    paragraphs: SermonParagraph[];
    tts?: TtsControls;
}) {
    const { t } = useTranslation();
    const [paragraphModalOpen, setParagraphModalOpen] = useState(false);
    const updateTabTranslationId = useDocumentTabsStore((s) => s.updateTabTranslationId);
    const activeTabKey = useDocumentTabsStore(selectActiveTabKey);
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const { zoomIn, zoomOut } = useDocumentZoom(zoom);

    const currentPlay = useAudioStore((s) => s.currentPlay);
    const audioSermonId = useAudioStore((s) => s.sermonId);
    const isCurrentDocument = audioSermonId === meta.sermonId;
    const isPlaying = isCurrentDocument && currentPlay?.status === 'play';

    const availableTraductions = useMemo(
        () => sermonInfo?.availableTraductions ?? [],
        [sermonInfo?.availableTraductions],
    );
    const hasMultipleTraductions = availableTraductions.length > 1;

    const openAudioModal = useAudioStore((s) => s.openModal);

    const handleAudioPlay = useCallback(() => {
        if (!meta.audioLink) return;

        // Open modal for new documents or when audio is paused
        if (!isCurrentDocument || !isPlaying) {
            openAudioModal();
        }

        window.dispatchEvent(
            new CustomEvent(CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay, {
                detail: {
                    id: meta.id,
                    title: meta.title,
                    frTitle: meta.title,
                    enTitle: meta.enTitle ?? '',
                    traduction: meta.languageCode,
                    audio_link: meta.audioLink,
                    sermonId: meta.sermonId,
                    autoplay: true,
                },
            }),
        );
    }, [meta, isCurrentDocument, isPlaying, openAudioModal]);

    const handleOtherTraductions = useCallback(() => {
        window.dispatchEvent(new Event(CHILD_PARENT_WINDOW_EVENT.openOtherTraductionsModal));
    }, []);

    const handleTraductionChange = useCallback(
        (value: string | number) => {
            if (activeTabKey) updateTabTranslationId(activeTabKey, Number(value));
        },
        [activeTabKey, updateTabTranslationId],
    );

    const traductionOptions = useMemo(
        () =>
            availableTraductions.map((t) => ({
                label: t.traductionName ?? `T${t.translationId}`,
                value: t.translationId,
            })),
        [availableTraductions],
    );

    return (
        <div className="sermon-header">
            {hasMultipleTraductions && (
                <Segmented
                    size="small"
                    options={traductionOptions}
                    value={currentTranslationId}
                    onChange={handleTraductionChange}
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
                <Tooltip title={t('Traductions')}>
                    <Button
                        type="text"
                        size="small"
                        icon={<TranslationOutlined />}
                        onClick={handleOtherTraductions}
                        aria-label={t('Traductions')}
                    />
                </Tooltip>
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
