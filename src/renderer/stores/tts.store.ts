import type {
    TtsProviderInfo,
    TtsSettings,
    TtsPlaybackStatus,
    TtsPlaybackState,
    TtsSegment,
    TtsProviderType,
} from '@shared/tts.types';
import { createStore } from './create-store';

interface TtsState {
    providers: TtsProviderInfo[];
    settings: TtsSettings | null;
    status: TtsPlaybackStatus;
    currentSegmentIndex: number;
    totalSegments: number;
    segments: TtsSegment[];
    activeProvider: TtsProviderType | null;
    error: string | null;
    documentKey: string | null;
    languageSupported: boolean;
    incompatibleMessage: string | undefined;
    /** Remembered position for resume — preserved across stop/play cycles */
    lastStoppedDocumentKey: string | null;
    lastStoppedSegmentIndex: number;
    /** Bumped to force a compatibility recheck (e.g. after API key save) */
    recheckTrigger: number;
    /** true when TTS finished all segments naturally (not stopped by user) */
    completedNaturally: boolean;

    setProviders(p: TtsProviderInfo[]): void;
    setSettings(s: TtsSettings): void;
    setPlaybackState(s: TtsPlaybackState): void;
    setSegments(s: TtsSegment[]): void;
    setDocumentKey(key: string | null): void;
    setLanguageSupported(v: boolean): void;
    setIncompatibleMessage(msg: string | undefined): void;
    triggerRecheck(): void;
    clearCompletedNaturally(): void;
    markCompletedNaturally(): void;
    /** Save position before clearing playback state */
    stopAndRemember(): void;
    reset(): void;
}

export const useTtsStore = createStore<TtsState>((set, get) => ({
    providers: [],
    settings: null,
    status: 'idle',
    currentSegmentIndex: 0,
    totalSegments: 0,
    segments: [],
    activeProvider: null,
    error: null,
    documentKey: null,
    languageSupported: false,
    incompatibleMessage: undefined,
    lastStoppedDocumentKey: null,
    lastStoppedSegmentIndex: 0,
    recheckTrigger: 0,
    completedNaturally: false,

    setProviders: (providers) => set({ providers }),
    setSettings: (settings) => set({ settings }),
    setPlaybackState: (s) =>
        set({
            status: s.status,
            currentSegmentIndex: s.currentSegmentIndex,
            totalSegments: s.totalSegments,
            activeProvider: s.provider,
            error: s.error ?? null,
        }),
    setSegments: (segments) =>
        set({ segments, totalSegments: segments.length, completedNaturally: false }),
    setDocumentKey: (documentKey) => set({ documentKey }),
    setLanguageSupported: (languageSupported) => set({ languageSupported }),
    setIncompatibleMessage: (incompatibleMessage) => set({ incompatibleMessage }),
    triggerRecheck: () => set((s) => ({ recheckTrigger: s.recheckTrigger + 1 })),
    clearCompletedNaturally: () => set({ completedNaturally: false }),
    markCompletedNaturally: () =>
        set({
            completedNaturally: true,
            lastStoppedDocumentKey: null,
            lastStoppedSegmentIndex: 0,
        }),
    stopAndRemember: () => {
        const { documentKey, currentSegmentIndex } = get();
        set({
            status: 'idle',
            currentSegmentIndex: 0,
            totalSegments: 0,
            segments: [],
            error: null,
            documentKey: null,
            lastStoppedDocumentKey: documentKey,
            lastStoppedSegmentIndex: currentSegmentIndex,
            completedNaturally: false,
        });
    },
    reset: () =>
        set({
            status: 'idle',
            currentSegmentIndex: 0,
            totalSegments: 0,
            segments: [],
            error: null,
            documentKey: null,
            // Do NOT clear lastStoppedDocumentKey / lastStoppedSegmentIndex here.
            // reset() is called when the main process signals idle (natural end or
            // external stop). stopAndRemember() saves the resume position just before,
            // and wiping it here would break resume after a user stop on remote providers.
        }),
}));

export const selectCurrentTtsSegment = (s: TtsState) => s.segments[s.currentSegmentIndex] ?? null;
export const selectIsTtsPlaying = (s: TtsState) => s.status === 'playing' || s.status === 'loading';
