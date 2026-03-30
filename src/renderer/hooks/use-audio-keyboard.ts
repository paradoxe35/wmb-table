import { useEffect } from 'react';
import { useAudioStore } from '@renderer/stores';
import type { useAudioControls } from './use-audio-controls';

type AudioControls = ReturnType<typeof useAudioControls>;

/**
 * Space / MediaPlayPause — play/pause
 * ArrowLeft / ArrowRight — skip -5s / +5s
 * ArrowUp / ArrowDown    — volume +5% / -5%
 */
export function useAudioKeyboard(controls: AudioControls, enabled: boolean): void {
    useEffect(() => {
        if (!enabled) return;

        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            switch (e.key) {
                case ' ':
                case 'MediaPlayPause':
                    e.preventDefault();
                    e.stopPropagation();
                    // Blur focused button so Space doesn't also trigger its click
                    if (tag === 'BUTTON') (e.target as HTMLElement).blur();
                    controls.playPause();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    controls.skipBack(5);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    controls.jumpForward(5);
                    break;
                case 'ArrowUp': {
                    e.preventDefault();
                    const vol = useAudioStore.getState().volume;
                    controls.changeVolume(Math.min(1, vol + 0.05));
                    break;
                }
                case 'ArrowDown': {
                    e.preventDefault();
                    const vol = useAudioStore.getState().volume;
                    controls.changeVolume(Math.max(0, vol - 0.05));
                    break;
                }
            }
        };

        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [enabled, controls]);
}
