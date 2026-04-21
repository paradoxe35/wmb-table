import { describe, expect, it, vi } from 'vitest';
import { TtsAudioPlayer } from '@renderer/services/tts-audio-player';

class MockAudioElement {
    playbackRate = 1;
    preservesPitch = false;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    pause = vi.fn();
    play = vi.fn().mockResolvedValue(undefined);
    removeAttribute = vi.fn();
}

describe('TtsAudioPlayer', () => {
    it('updates the active audio element playback rate immediately', () => {
        const player = new TtsAudioPlayer();
        const audio = new MockAudioElement();
        const internal = player as unknown as {
            audio: MockAudioElement | null;
            currentRate: number;
        };

        internal.audio = audio;

        player.setRate(1.6);

        expect(internal.currentRate).toBe(1.6);
        expect(audio.playbackRate).toBe(1.6);
    });

    it('uses the last live-updated rate when resuming playback', () => {
        const player = new TtsAudioPlayer();
        const audio = new MockAudioElement();
        const internal = player as unknown as {
            audio: MockAudioElement | null;
            isPaused: boolean;
        };

        internal.audio = audio;
        internal.isPaused = true;

        player.setRate(1.4);
        player.resume();

        expect(audio.playbackRate).toBe(1.4);
        expect(audio.play).toHaveBeenCalledTimes(1);
    });

    it('prefers a direct audio URL over base64 blob creation for playback', async () => {
        const player = new TtsAudioPlayer();
        const audio = new MockAudioElement();
        const createObjectURL = vi.spyOn(URL, 'createObjectURL');
        const audioCtor = vi.fn(function MockAudio() {
            return audio;
        }) as unknown as typeof Audio;

        vi.stubGlobal('Audio', audioCtor);

        await player.play(undefined, 'audio/mpeg', 1, 'file:///tmp/tts-cache/test.mp3');

        expect(createObjectURL).not.toHaveBeenCalled();
        expect(audioCtor).toHaveBeenCalledWith('file:///tmp/tts-cache/test.mp3');
        expect(audio.play).toHaveBeenCalledTimes(1);

        createObjectURL.mockRestore();
        vi.unstubAllGlobals();
    });
});
