import { useCallback, useMemo } from 'react';
import { useAudioRef } from '@renderer/components/audio-context';
import { useAudioStore } from '@renderer/stores';

export function useAudioControls() {
    const audioRef = useAudioRef();
    const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
    const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate);
    const setVolume = useAudioStore((s) => s.setVolume);

    const playPause = useCallback(() => {
        const el = audioRef.current;
        if (!el) return;
        if (el.paused) el.play().catch(() => {});
        else el.pause();
    }, [audioRef]);

    const seek = useCallback(
        (value: number) => {
            const el = audioRef.current;
            if (!el) return;
            el.currentTime = value;
            setCurrentTime(value);
        },
        [audioRef, setCurrentTime],
    );

    const skipBack = useCallback(
        (seconds = 15) => {
            const el = audioRef.current;
            if (!el) return;
            el.currentTime = Math.max(0, el.currentTime - seconds);
        },
        [audioRef],
    );

    const jumpForward = useCallback(
        (seconds = 15) => {
            const el = audioRef.current;
            if (!el) return;
            el.currentTime = Math.min(el.duration || 0, el.currentTime + seconds);
        },
        [audioRef],
    );

    const changeSpeed = useCallback(
        (rate: number) => {
            const el = audioRef.current;
            if (!el) return;
            el.playbackRate = rate;
            setPlaybackRate(rate);
        },
        [audioRef, setPlaybackRate],
    );

    const changeVolume = useCallback(
        (value: number) => {
            const el = audioRef.current;
            if (!el) return;
            el.volume = value;
            setVolume(value);
        },
        [audioRef, setVolume],
    );

    return useMemo(
        () => ({ playPause, seek, skipBack, jumpForward, changeSpeed, changeVolume }),
        [playPause, seek, skipBack, jumpForward, changeSpeed, changeVolume],
    );
}
