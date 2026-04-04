import { useCallback, useEffect, useRef } from 'react';
import { Button, Slider, Dropdown, Tooltip } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, SoundOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore, useAudioStore } from '@renderer/stores';
import { useTtsStore } from '@renderer/stores/tts.store';
import { stopAllTtsPlayback } from '@renderer/services/tts-audio-player';
import { useAudioRef } from './audio-context';
import { useAudioControls } from '@renderer/hooks/use-audio-controls';
import { CHILD_PARENT_WINDOW_EVENT, type AudioDocumentPlayDetail } from '@renderer/utils/events';
import { throttle, formatTime } from '@renderer/utils/functions';
import { AUDIO_SPEEDS, THROTTLE_MS } from '@renderer/utils/constants';

function isSameAudioDocument(
    current: {
        audioLink: string | null;
        sermonId: string | null;
        translationId: number | null;
        languageCode: string | null;
    },
    next: AudioDocumentPlayDetail,
): boolean {
    if (current.audioLink && current.audioLink === next.audioLink) {
        return true;
    }

    if (!current.sermonId || !next.sermonId) {
        return false;
    }

    if (current.sermonId !== next.sermonId) {
        return false;
    }

    if (current.translationId == null || next.translationId == null) {
        return current.languageCode == null || next.languageCode == null
            ? true
            : current.languageCode === next.languageCode;
    }

    if (current.translationId !== next.translationId) {
        return false;
    }

    if (current.languageCode == null || next.languageCode == null) {
        return true;
    }

    return current.languageCode === next.languageCode;
}

export default function MiniPlayerBar() {
    const { t } = useTranslation();
    const audioRef = useAudioRef();
    const audioSrc = useAudioStore((s) => s.audioSrc);
    const title = useAudioStore((s) => s.title);
    const currentTime = useAudioStore((s) => s.currentTime);
    const duration = useAudioStore((s) => s.duration);
    const playbackRate = useAudioStore((s) => s.playbackRate);
    const volume = useAudioStore((s) => s.volume);
    const currentPlay = useAudioStore((s) => s.currentPlay);
    const originAudioLink = useAudioStore((s) => s.originAudioLink);
    const sermonId = useAudioStore((s) => s.sermonId);
    const translationId = useAudioStore((s) => s.translationId);
    const languageCode = useAudioStore((s) => s.languageCode);

    const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
    const setDuration = useAudioStore((s) => s.setDuration);
    const setCurrentPlay = useAudioStore((s) => s.setCurrentPlay);
    const loadAudio = useAudioStore((s) => s.loadAudio);
    const openModal = useAudioStore((s) => s.openModal);
    const resetTts = useTtsStore((s) => s.reset);

    const controls = useAudioControls();

    const autoplayRef = useRef(true);

    const originAudioLinkRef = useRef(originAudioLink);
    originAudioLinkRef.current = originAudioLink;

    const sermonIdRef = useRef(sermonId);
    sermonIdRef.current = sermonId;

    const translationIdRef = useRef(translationId);
    translationIdRef.current = translationId;

    const languageCodeRef = useRef(languageCode);
    languageCodeRef.current = languageCode;

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
        if (!el) {
            return;
        }

        const onTimeUpdate = () => {
            setCurrentTime(el.currentTime);
            if (originAudioLinkRef.current) {
                saveTime(originAudioLinkRef.current, el.currentTime);
            }
        };
        const onLoadedMetadata = () => setDuration(el.duration);
        const onPlay = () => {
            // Stop TTS when sermon audio starts
            if (useTtsStore.getState().status !== 'idle') {
                stopAllTtsPlayback();
                resetTts();
            }

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
    }, [audioRef, resetTts, setCurrentTime, setDuration, setCurrentPlay, saveTime]);

    // Pause sermon audio when TTS starts
    useEffect(() => {
        return useTtsStore.subscribe((state, prev) => {
            const ttsActive = state.status === 'playing' || state.status === 'loading';
            const wasActive = prev.status === 'playing' || prev.status === 'loading';
            if (ttsActive && !wasActive) {
                const el = audioRef.current;
                if (el && !el.paused) {
                    el.pause();
                }
                setCurrentPlay(null);
            }
        });
    }, [audioRef, setCurrentPlay]);

    // Handle audio play events from document header
    useEffect(() => {
        const handleAudioPlay = async (event: CustomEventInit<AudioDocumentPlayDetail>) => {
            const detail = event.detail;
            if (!detail?.audioLink) {
                return;
            }
            const el = audioRef.current;
            if (!el) {
                return;
            }

            const isSameDocument = isSameAudioDocument(
                {
                    audioLink: originAudioLinkRef.current,
                    sermonId: sermonIdRef.current,
                    translationId: translationIdRef.current,
                    languageCode: languageCodeRef.current,
                },
                detail,
            );

            if (isSameDocument) {
                if (!autoplayRef.current) {
                    openModal();
                    autoplayRef.current = true;
                }
                if (el.paused) {
                    el.play().catch(() => {});
                } else {
                    el.pause();
                }
                return;
            }

            if (detail.autoplay || (titleRef.current && !isSameDocument)) {
                autoplayRef.current = true;
            }

            const documentTitle = detail.title;

            window.api.audio.setLastPlay(detail);

            const result = await window.api.audio.getTimeAndLocalFile(detail.audioLink);
            const ctime = typeof result.time?.time === 'number' ? result.time.time : 0;
            const localFile = result.download?.local_file;

            const src = localFile
                ? `audio-cache://file/${localFile.split('/').pop()}`
                : detail.audioLink;

            // Cache the audio file in the background for next time
            if (!localFile) {
                window.api.audio.cacheAudio(detail.audioLink);
            }

            loadAudio(
                src,
                detail.audioLink,
                documentTitle,
                detail.languageLabel ?? '',
                ctime,
                detail.sermonId,
                detail.translationId,
                detail.languageCode,
            );

            el.src = src;
            el.load();
            el.playbackRate = useAudioStore.getState().playbackRate;
            el.volume = useAudioStore.getState().volume;

            if (autoplayRef.current) {
                // Wait for the element to be ready before playing
                el.addEventListener(
                    'canplay',
                    () => {
                        el.currentTime = ctime;
                        el.play().catch(() => {});
                    },
                    { once: true },
                );
                openModal();
            } else {
                el.addEventListener(
                    'canplay',
                    () => {
                        el.currentTime = ctime;
                    },
                    { once: true },
                );
            }

            setCurrentPlay({
                documentTitle,
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

    // Stop sermon audio when the content language changes
    const contentLanguage = useAppStore((s) => s.contentLanguage);
    const prevLangRef = useRef(contentLanguage);

    useEffect(() => {
        if (prevLangRef.current !== contentLanguage) {
            prevLangRef.current = contentLanguage;
            const el = audioRef.current;
            if (el && !el.paused) el.pause();
        }
    }, [contentLanguage, audioRef]);

    // Restore last played on mount
    useEffect(() => {
        window.api.audio.getLastPlay().then((data) => {
            if (data) {
                autoplayRef.current = false;
                window.dispatchEvent(
                    new CustomEvent<AudioDocumentPlayDetail>(
                        CHILD_PARENT_WINDOW_EVENT.audioDocumentPlay,
                        {
                            detail: {
                                ...data,
                                autoplay: false,
                            },
                        },
                    ),
                );
            }
        });
    }, []);

    if (!audioSrc) return null;

    const isPlaying = currentPlay?.status === 'play';

    const speedMenuItems = AUDIO_SPEEDS.map((s) => ({
        key: String(s),
        label: `${s}x`,
        onClick: () => controls.changeSpeed(s),
    }));

    return (
        <div className="mini-player-bar">
            <Button
                type="text"
                shape="circle"
                icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={controls.playPause}
                style={{ fontSize: 'var(--fs-5xl)' }}
            />
            <span className="mini-player-title" onClick={openModal} title={title ?? ''}>
                {title}
            </span>
            <Slider
                min={0}
                max={duration || 1}
                step={1}
                value={currentTime}
                onChange={controls.seek}
                tooltip={{ formatter: (v) => formatTime(v ?? 0) }}
                style={{ flex: 1, margin: '0 8px' }}
            />
            <span
                style={{
                    fontSize: 'var(--fs-rel-lg)',
                    color: 'var(--ant-color-text-secondary)',
                    minWidth: 80,
                    textAlign: 'center',
                }}
            >
                {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <Dropdown menu={{ items: speedMenuItems }} trigger={['click']}>
                <Button
                    type="text"
                    size="small"
                    style={{ fontSize: 'var(--fs-rel-lg)', minWidth: 36 }}
                >
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
                            boxShadow:
                                'var(--ant-box-shadow-secondary, 0 2px 8px rgba(0,0,0,0.15))',
                        }}
                    >
                        <Slider
                            vertical
                            min={0}
                            max={1}
                            step={0.05}
                            value={volume}
                            onChange={controls.changeVolume}
                            style={{ height: 80 }}
                            tooltip={{ formatter: (v) => `${Math.round((v ?? 0) * 100)}%` }}
                        />
                    </div>
                )}
            >
                <Tooltip title={t('Volume')}>
                    <Button
                        type="text"
                        size="small"
                        icon={<SoundOutlined />}
                        aria-label={t('Volume')}
                    />
                </Tooltip>
            </Dropdown>
        </div>
    );
}
