import { useCallback, useMemo } from 'react';
import { Button, Segmented, Space } from 'antd';
import {
    PlayCircleOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
    SearchOutlined,
    TranslationOutlined,
} from '@ant-design/icons';
import { useSermonStore, useSearchStore, selectActiveTabKey } from '@renderer/stores';
import type { SermonMeta, SermonMetaWithTraductions } from '@shared/types';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';

export default function SermonHeader({
    meta,
    zoom,
    sermonInfo,
    currentTranslationId,
}: {
    meta: SermonMeta;
    zoom: number;
    sermonInfo: SermonMetaWithTraductions | undefined;
    currentTranslationId: number;
}) {
    const updateTabZoom = useSermonStore((s) => s.updateTabZoom);
    const updateTabTranslationId = useSermonStore((s) => s.updateTabTranslationId);
    const openSearchBar = useSearchStore((s) => s.openSearchBar);
    const activeTabKey = useSermonStore(selectActiveTabKey);

    const availableTraductions = useMemo(
        () => sermonInfo?.availableTraductions ?? [],
        [sermonInfo?.availableTraductions],
    );
    const hasMultipleTraductions = availableTraductions.length > 1;

    const handleAudioPlay = useCallback(() => {
        if (!meta.audioLink) return;
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
                },
            }),
        );
    }, [meta]);

    const handleOtherTraductions = useCallback(() => {
        window.dispatchEvent(new Event(CHILD_PARENT_WINDOW_EVENT.openOtherTraductionsModal));
    }, []);

    const handleZoomIn = useCallback(() => {
        if (activeTabKey) updateTabZoom(activeTabKey, Math.min(zoom + 10, 200));
    }, [activeTabKey, zoom, updateTabZoom]);

    const handleZoomOut = useCallback(() => {
        if (activeTabKey) updateTabZoom(activeTabKey, Math.max(zoom - 10, 50));
    }, [activeTabKey, zoom, updateTabZoom]);

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
                    <Button
                        type="text"
                        size="small"
                        icon={<PlayCircleOutlined />}
                        onClick={handleAudioPlay}
                    />
                )}
                <Button
                    type="text"
                    size="small"
                    icon={<TranslationOutlined />}
                    onClick={handleOtherTraductions}
                />
                <Button
                    type="text"
                    size="small"
                    icon={<ZoomOutOutlined />}
                    onClick={handleZoomOut}
                />
                <span style={{ fontSize: '0.8em', minWidth: 50, textAlign: 'center' }}>
                    {zoom}%
                </span>
                <Button type="text" size="small" icon={<ZoomInOutlined />} onClick={handleZoomIn} />
                <Button
                    type="text"
                    size="small"
                    icon={<SearchOutlined />}
                    onClick={openSearchBar}
                />
            </Space>
        </div>
    );
}
