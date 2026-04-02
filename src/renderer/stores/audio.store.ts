import type { CurrentAudioDocumentPlay } from '@shared/types';
import { createStore } from './create-store';

interface AudioState {
    currentPlay: CurrentAudioDocumentPlay | null;
    audioSrc: string | null;
    originAudioLink: string | null;
    title: string | null;
    sermonId: string | null;
    translationId: number | null;
    languageCode: string | null;
    traduction: string | null;
    currentTime: number;
    duration: number;
    playbackRate: number;
    volume: number;
    defaultTime: number;
    modalOpen: boolean;

    loadAudio(
        src: string,
        originLink: string,
        title: string,
        traduction: string,
        defaultTime: number,
        sermonId: string,
        translationId: number | null,
        languageCode: string | null,
    ): void;
    setCurrentTime(t: number): void;
    setDuration(d: number): void;
    setPlaybackRate(r: number): void;
    setVolume(v: number): void;
    openModal(): void;
    closeModal(): void;
    stopAudio(): void;
    setCurrentPlay(play: CurrentAudioDocumentPlay | null): void;
    error: string | null;
    setError(error: string | null): void;
}

export const useAudioStore = createStore<AudioState>((set) => ({
    currentPlay: null,
    audioSrc: null,
    originAudioLink: null,
    title: null,
    sermonId: null,
    translationId: null,
    languageCode: null,
    traduction: null,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    volume: 0.5,
    defaultTime: 0,
    modalOpen: false,
    error: null,

    loadAudio: (
        src,
        originLink,
        title,
        traduction,
        defaultTime,
        sermonId,
        translationId,
        languageCode,
    ) =>
        set({
            audioSrc: src,
            originAudioLink: originLink,
            title,
            sermonId,
            translationId,
            languageCode,
            traduction,
            defaultTime,
            currentTime: defaultTime,
        }),

    setCurrentTime: (t) => set({ currentTime: t }),
    setDuration: (d) => set({ duration: d }),
    setPlaybackRate: (r) => set({ playbackRate: r }),
    setVolume: (v) => set({ volume: v }),
    openModal: () => set({ modalOpen: true }),
    closeModal: () => set({ modalOpen: false }),
    stopAudio: () =>
        set({
            audioSrc: null,
            originAudioLink: null,
            title: null,
            sermonId: null,
            translationId: null,
            languageCode: null,
            traduction: null,
            currentTime: 0,
            duration: 0,
            defaultTime: 0,
            currentPlay: null,
        }),
    setCurrentPlay: (play) => set({ currentPlay: play }),
    setError: (error) => set({ error }),
}));
