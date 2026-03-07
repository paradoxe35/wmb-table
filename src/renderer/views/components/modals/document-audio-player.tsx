import { useCallback } from 'react';
import { Button, Modal, Slider, Space } from 'antd';
import {
    PlayCircleOutlined,
    PauseCircleOutlined,
    StepBackwardOutlined,
    StepForwardOutlined,
    SoundOutlined,
} from '@ant-design/icons';
import { useAudioStore } from '@renderer/stores';
import { useAudioRef } from '@renderer/components/audio-context';
import { useDocumentViewOpen } from '@renderer/components/viewer/document-viewer';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function DocumentAudioPlayer() {
    const audioRef = useAudioRef();
    const modalOpen = useAudioStore((s) => s.modalOpen);
    const closeModal = useAudioStore((s) => s.closeModal);
    const title = useAudioStore((s) => s.title);
    const traduction = useAudioStore((s) => s.traduction);
    const currentTime = useAudioStore((s) => s.currentTime);
    const duration = useAudioStore((s) => s.duration);
    const playbackRate = useAudioStore((s) => s.playbackRate);
    const volume = useAudioStore((s) => s.volume);
    const currentPlay = useAudioStore((s) => s.currentPlay);
    const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate);
    const setVolume = useAudioStore((s) => s.setVolume);
    const setCurrentTime = useAudioStore((s) => s.setCurrentTime);

    const sermonId = useAudioStore((s) => s.sermonId);
    const viewDocument = useDocumentViewOpen();

    const isPlaying = currentPlay?.status === 'play';

    const handlePlayPause = useCallback(() => {
        const el = audioRef.current;
        if (!el) return;
        if (el.paused) {
            el.play().catch(() => {});
        } else {
            el.pause();
        }
    }, [audioRef]);

    const handleSeek = useCallback(
        (value: number) => {
            const el = audioRef.current;
            if (!el) return;
            el.currentTime = value;
            setCurrentTime(value);
        },
        [audioRef, setCurrentTime],
    );

    const handleSkipBack = useCallback(() => {
        const el = audioRef.current;
        if (!el) return;
        el.currentTime = Math.max(0, el.currentTime - 15);
    }, [audioRef]);

    const handleJumpForward = useCallback(() => {
        const el = audioRef.current;
        if (!el) return;
        el.currentTime = Math.min(el.duration || 0, el.currentTime + 15);
    }, [audioRef]);

    const handleSpeedChange = useCallback(
        (rate: number) => {
            const el = audioRef.current;
            if (!el) return;
            el.playbackRate = rate;
            setPlaybackRate(rate);
        },
        [audioRef, setPlaybackRate],
    );

    const handleVolumeChange = useCallback(
        (value: number) => {
            const el = audioRef.current;
            if (!el) return;
            el.volume = value;
            setVolume(value);
        },
        [audioRef, setVolume],
    );

    const handleTitleClick = useCallback(() => {
        if (title) {
            viewDocument(title, undefined, sermonId ?? undefined);
            closeModal();
        }
    }, [title, sermonId, viewDocument, closeModal]);

    return (
        <Modal title={null} footer={null} width={500} open={modalOpen} onCancel={closeModal}>
            {title && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <h3
                        style={{ cursor: 'pointer', marginBottom: 4 }}
                        className="hover-underline"
                        onClick={handleTitleClick}
                    >
                        {title}
                    </h3>
                    {traduction && (
                        <div
                            style={{
                                color: 'var(--ant-color-text-secondary)',
                                fontSize: '0.9em',
                                marginBottom: 16,
                            }}
                        >
                            Langue: <i>{traduction}</i>
                        </div>
                    )}

                    <Slider
                        min={0}
                        max={duration || 1}
                        step={1}
                        value={currentTime}
                        onChange={handleSeek}
                        tooltip={{ formatter: (v) => formatTime(v ?? 0) }}
                        style={{ margin: '0 0 8px' }}
                    />
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.8em',
                            color: 'var(--ant-color-text-secondary)',
                        }}
                    >
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>

                    <Space size="large" style={{ marginTop: 16 }}>
                        <Button
                            type="text"
                            icon={<StepBackwardOutlined />}
                            onClick={handleSkipBack}
                            title="-15s"
                        />
                        <Button
                            type="primary"
                            shape="circle"
                            size="large"
                            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                            onClick={handlePlayPause}
                        />
                        <Button
                            type="text"
                            icon={<StepForwardOutlined />}
                            onClick={handleJumpForward}
                            title="+15s"
                        />
                    </Space>

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
                            {SPEEDS.map((s) => (
                                <Button
                                    key={s}
                                    type={playbackRate === s ? 'primary' : 'default'}
                                    size="small"
                                    onClick={() => handleSpeedChange(s)}
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
                                onChange={handleVolumeChange}
                                style={{ width: 80 }}
                                tooltip={{
                                    formatter: (v) => `${Math.round((v ?? 0) * 100)}%`,
                                }}
                            />
                        </Space>
                    </div>
                </div>
            )}
        </Modal>
    );
}
