import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Slider, Space } from 'antd';
import {
    PlayCircleOutlined,
    PauseCircleOutlined,
    StepBackwardOutlined,
    StepForwardOutlined,
    SoundOutlined,
} from '@ant-design/icons';
import { useAudioStore } from '@renderer/stores';
import { useDocumentViewOpen } from '@renderer/components/viewer/document-viewer';
import { useAudioControls } from '@renderer/hooks/use-audio-controls';
import { useAudioKeyboard } from '@renderer/hooks/use-audio-keyboard';
import { formatTime } from '@renderer/utils/functions';
import { AUDIO_SPEEDS } from '@renderer/utils/constants';

// ── Sub-components ──

function TrackInfo({
    title,
    traduction,
    onTitleClick,
}: {
    title: string;
    traduction: string | null;
    onTitleClick: () => void;
}) {
    const { t } = useTranslation();
    return (
        <>
            <h3
                style={{ cursor: 'pointer', marginBottom: 4 }}
                className="hover-underline"
                onClick={onTitleClick}
            >
                {title}
            </h3>
            {traduction && (
                <div
                    style={{
                        color: 'var(--ant-color-text-secondary)',
                        fontSize: 'var(--fs-rel-3xl)',
                        marginBottom: 16,
                    }}
                >
                    {t('Langue: {{name}}', { name: traduction })}
                </div>
            )}
        </>
    );
}

function SeekBar({
    currentTime,
    duration,
    onSeek,
}: {
    currentTime: number;
    duration: number;
    onSeek: (v: number) => void;
}) {
    return (
        <>
            <Slider
                min={0}
                max={duration || 1}
                step={1}
                value={currentTime}
                onChange={onSeek}
                tooltip={{ formatter: (v) => formatTime(v ?? 0) }}
                style={{ margin: '0 0 8px' }}
            />
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 'var(--fs-rel-lg)',
                    color: 'var(--ant-color-text-secondary)',
                }}
            >
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
            </div>
        </>
    );
}

function PlaybackControls({
    isPlaying,
    onPlayPause,
    onSkipBack,
    onJumpForward,
}: {
    isPlaying: boolean;
    onPlayPause: () => void;
    onSkipBack: () => void;
    onJumpForward: () => void;
}) {
    return (
        <Space size="large" style={{ marginTop: 16 }}>
            <Button type="text" icon={<StepBackwardOutlined />} onClick={onSkipBack} title="-15s" />
            <Button
                type="primary"
                shape="circle"
                size="large"
                icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={onPlayPause}
            />
            <Button
                type="text"
                icon={<StepForwardOutlined />}
                onClick={onJumpForward}
                title="+15s"
            />
        </Space>
    );
}

function SpeedAndVolume({
    playbackRate,
    volume,
    onSpeedChange,
    onVolumeChange,
}: {
    playbackRate: number;
    volume: number;
    onSpeedChange: (rate: number) => void;
    onVolumeChange: (v: number) => void;
}) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                marginTop: 16,
            }}
        >
            <Space>
                {AUDIO_SPEEDS.map((s) => (
                    <Button
                        key={s}
                        type={playbackRate === s ? 'primary' : 'default'}
                        size="small"
                        onClick={() => onSpeedChange(s)}
                    >
                        {s}x
                    </Button>
                ))}
            </Space>
            <Space>
                <SoundOutlined />
                <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={onVolumeChange}
                    style={{ width: 80 }}
                    tooltip={{ formatter: (v) => `${Math.round((v ?? 0) * 100)}%` }}
                />
            </Space>
        </div>
    );
}

// ── Main component ──

export default function DocumentAudioPlayer() {
    const modalOpen = useAudioStore((s) => s.modalOpen);
    const closeModal = useAudioStore((s) => s.closeModal);
    const title = useAudioStore((s) => s.title);
    const traduction = useAudioStore((s) => s.traduction);
    const currentTime = useAudioStore((s) => s.currentTime);
    const duration = useAudioStore((s) => s.duration);
    const playbackRate = useAudioStore((s) => s.playbackRate);
    const volume = useAudioStore((s) => s.volume);
    const currentPlay = useAudioStore((s) => s.currentPlay);
    const sermonId = useAudioStore((s) => s.sermonId);
    const translationId = useAudioStore((s) => s.translationId);
    const languageCode = useAudioStore((s) => s.languageCode);
    const viewDocument = useDocumentViewOpen();

    const controls = useAudioControls();
    useAudioKeyboard(controls, modalOpen);

    const isPlaying = currentPlay?.status === 'play';

    const handleTitleClick = useCallback(() => {
        if (!title || !sermonId || translationId == null || !languageCode) {
            return;
        }

        viewDocument({
            title,
            sermonId,
            translationId,
            languageCode,
        });
        closeModal();
    }, [title, sermonId, translationId, languageCode, viewDocument, closeModal]);

    return (
        <Modal title={null} footer={null} width={500} open={modalOpen} onCancel={closeModal}>
            {title && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <TrackInfo
                        title={title}
                        traduction={traduction}
                        onTitleClick={handleTitleClick}
                    />
                    <SeekBar currentTime={currentTime} duration={duration} onSeek={controls.seek} />
                    <PlaybackControls
                        isPlaying={isPlaying}
                        onPlayPause={controls.playPause}
                        onSkipBack={() => controls.skipBack()}
                        onJumpForward={() => controls.jumpForward()}
                    />
                    <SpeedAndVolume
                        playbackRate={playbackRate}
                        volume={volume}
                        onSpeedChange={controls.changeSpeed}
                        onVolumeChange={controls.changeVolume}
                    />
                </div>
            )}
        </Modal>
    );
}
