import { useCallback, useEffect, useRef } from 'react';
import { Button, Slider, Dropdown, Tooltip } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, SoundOutlined } from '@ant-design/icons';
import { useAudioStore } from '@renderer/stores';
import { useTtsStore } from '@renderer/stores/tts.store';
import { stopAllTtsPlayback } from '@renderer/services/tts-audio-player';
import { useAudioRef } from './audio-context';
import { CHILD_PARENT_WINDOW_EVENT } from '@renderer/utils/events';
import { throttle, formatTime } from '@renderer/utils/functions';
import { AUDIO_SPEEDS, THROTTLE_MS } from '@renderer/utils/constants';

export default function MiniPlayerBar() {
    const audioRef = useAudioRef();
    const audioSrc = useAudioStore((s) => s.audioSrc);
    const title = useAudioStore((s) => s.title);
    const currentTime = useAudioStore((s) => s.currentTime);
    const duration = useAudioStore((s) => s.duration);
    const playbackRate = useAudioStore((s) => s.playbackRate);
    const volume = useAudioStore((s) => s.volume);
    const currentPlay = useAudioStore((s) => s.currentPlay);
    const originAudioLink = useAudioStore((s) => s.originAudioLink);

    const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
    const setDuration = useAudioStore((s) => s.setDuration);
    const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate);
    const setVolume = useAudioStore((s) => s.setVolume);
    const setCurrentPlay = useAudioStore((s) => s.setCurrentPlay);
    const loadAudio = useAudioStore((s) => s.loadAudio);
    const openModal = useAudioStore((s) => s.openModal);

    const autoplayRef = useRef(true);
    const originAudioLinkRef = useRef(originAudioLink);
    originAudioLinkRef.current = originAudioLink;
    const titleRef = useRef(title);
    titleRef.current = title;

    // Throttled time save
    const saveTime = useCallback(
        throttle((link: string, time: number) => {
            window.api.audio.setTime(link, time);
        }, THROTTLE_MS),
        [],
    );

    // Audio event listeners
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;

        const onTimeUpdate = () => {
            setCurrentTime(el.currentTime);
            if (originAudioLinkRef.current) {
                saveTime(originAudioLinkRef.current, el.currentTime);
            }
        };
        const onLoadedMetadata = () => setDuration(el.duration);
        const onPlay = () => {
            setCurrentPlay({
                documentTitle: titleRef.current ?? '',
                status: 'play',
            });
        };
        const onPause = () => {
            setCurrentPlay({
                documentTitle: titleRef.current ?? '',
                status: 'pause',
            });
        };
        const onEnded = () => {
            setCurrentPlay({
                documentTitle: titleRef.current ?? '',
                status: 'pause',
            });
        };

        el.addEventListener('timeupdate', onTimeUpdate);
        el.addEventListener('loadedmetadata', onLoadedMetadata);
        el.addEventListener('play', onPlay);
        el.addEventListener('pause', onPause);
        el.addEventListener('ended', onEnded);

        return () => {
            el.removeEventListener('timeupdate', onTimeUpdate);
            el.removeEventListener('loadedmetadata', onLoadedMetadata);
            el.removeEventListener('play', onPlay);
            el.removeEventListener('pause', onPause);
            el.removeEventListener('ended', onEnded);
        };
    }, [audioRef, setCurrentTime, setDuration, setCurrentPlay, saveTime]);

    // Handle audio play events from document header
    useEffect(() => {
        const handleAudioPlay = async (event: CustomEventInit<any>) => {
            const detail = event.detail;
            if (!detail?.audio_link) return;
            const el = audioRef.current;
            if (!el) return;

            // Stop TTS playback if active
            const ttsState = useTtsStore.getState();
            if (ttsState.status !== 'idle') {
                stopAllTtsPlayback();
                ttsState.reset();
            }

            // Same title → toggle play/pause
            if (titleRef.current === detail.title) {
                if (!autoplayRef.current) {
                    openModal();
                    autoplayRef.current = true;
                }
                if (el.paused) {
                    el.play();
                } else {
                    el.pause();
                }
                return;
            }

            if (detail.autoplay || (titleRef.current && titleRef.current !== detail.title)) {
                autoplayRef.current = true;
            }

            window.api.audio.setLastPlay(detail.title);

            const result = await window.api.audio.getTimeAndLocalFile(detail.audio_link);
            const ctime = typeof result.time?.time === 'number' ? result.time.time : 0;
            const localFile = result.download?.local_file;
            const src = localFile?.replaceAll('#', '%23') || detail.audio_link;

            loadAudio(
                src,
                detail.audio_link,
                detail.title,
                detail.traduction ?? '',
                ctime,
                detail.sermonId ?? '',
            );

            el.src = src;
            el.load();
            el.currentTime = ctime;
            el.playbackRate = useAudioStore.getState().playbackRate;
            el.volume = useAudioStore.getState().volume;

            if (autoplayRef.current) {
                el.play().catch(() => {});
                openModal();
            }

            setCurrentPlay({
                documentTitle: detail.title ?? '',
                status: autoplayRef.current ? 'play' : 'pause',
            });
        };

        window.addEventListener(CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay, handleAudioPlay);
        return () => {
            window.removeEventListener(
                CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay,
                handleAudioPlay,
            );
        };
    }, [audioRef, loadAudio, setCurrentPlay, openModal]);

    // Restore last played on mount
    useEffect(() => {
        window.api.audio.getLastPlay().then((data) => {
            if (data) {
                autoplayRef.current = false;
                window.dispatchEvent(
                    new CustomEvent(CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay, {
                        detail: data,
                    }),
                );
            }
        });
    }, []);

    if (!audioSrc) return null;

    const isPlaying = currentPlay?.status === 'play';

    const handlePlayPause = () => {
        const el = audioRef.current;
        if (!el) return;
        if (el.paused) {
            el.play().catch(() => {});
        } else {
            el.pause();
        }
    };

    const handleSeek = (value: number) => {
        const el = audioRef.current;
        if (!el) return;
        el.currentTime = value;
        setCurrentTime(value);
    };

    const handleSpeedChange = (rate: number) => {
        const el = audioRef.current;
        if (!el) return;
        el.playbackRate = rate;
        setPlaybackRate(rate);
    };

    const handleVolumeChange = (value: number) => {
        const el = audioRef.current;
        if (!el) return;
        el.volume = value;
        setVolume(value);
    };

    const speedMenuItems = AUDIO_SPEEDS.map((s) => ({
        key: String(s),
        label: `${s}x`,
        onClick: () => handleSpeedChange(s),
    }));

    return (
        <div className="mini-player-bar">
            <Button
                type="text"
                shape="circle"
                icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={handlePlayPause}
                style={{ fontSize: 22 }}
            />
            <span className="mini-player-title" onClick={openModal} title={title ?? ''}>
                {title}
            </span>
            <Slider
                min={0}
                max={duration || 1}
                step={1}
                value={currentTime}
                onChange={handleSeek}
                tooltip={{ formatter: (v) => formatTime(v ?? 0) }}
                style={{ flex: 1, margin: '0 8px' }}
            />
            <span
                style={{
                    fontSize: '0.8em',
                    color: 'var(--ant-color-text-secondary)',
                    minWidth: 80,
                    textAlign: 'center',
                }}
            >
                {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <Dropdown menu={{ items: speedMenuItems }} trigger={['click']}>
                <Button type="text" size="small" style={{ fontSize: '0.8em', minWidth: 36 }}>
                    {playbackRate}x
                </Button>
            </Dropdown>
            <Dropdown
                trigger={['click']}
                dropdownRender={() => (
                    <div
                        style={{
                            padding: '8px 12px',
                            background: 'var(--ant-color-bg-container)',
                            borderRadius: 6,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        }}
                    >
                        <Slider
                            vertical
                            min={0}
                            max={1}
                            step={0.05}
                            value={volume}
                            onChange={handleVolumeChange}
                            style={{ height: 80 }}
                            tooltip={{ formatter: (v) => `${Math.round((v ?? 0) * 100)}%` }}
                        />
                    </div>
                )}
            >
                <Tooltip title="Volume">
                    <Button type="text" size="small" icon={<SoundOutlined />} aria-label="Volume" />
                </Tooltip>
            </Dropdown>
        </div>
    );
}
