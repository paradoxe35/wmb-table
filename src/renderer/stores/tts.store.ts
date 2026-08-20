import type {
    TtsProviderInfo,
    TtsSettings,
    TtsPlaybackStatus,
    TtsPlaybackState,
    TtsSegment,
    TtsProviderType,
    TtsLastPosition,
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
    /** Last document that completed naturally, used by continuations */
    lastCompletedDocumentKey: string | null;
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
    restoreLastPosition(position: TtsLastPosition | null): void;
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
    lastCompletedDocumentKey: null,
    recheckTrigger: 0,
    completedNaturally: false,

    setProviders: (providers) => set({ providers }),
    setSettings: (settings) => set({ settings }),
    setPlaybackState: (s) =>
        set((state) => ({
            status: s.status,
            currentSegmentIndex: s.currentSegmentIndex,
            totalSegments: s.totalSegments,
            activeProvider: s.provider,
            error: s.error ?? null,
            // The resume slot follows the document being played, so it never describes a
            // document the session has moved on from.
            ...(state.documentKey
                ? {
                      lastStoppedDocumentKey: state.documentKey,
                      lastStoppedSegmentIndex: s.currentSegmentIndex,
                  }
                : {}),
        })),
    setSegments: (segments) =>
        set({ segments, totalSegments: segments.length, completedNaturally: false }),
    setDocumentKey: (documentKey) => set({ documentKey }),
    setLanguageSupported: (languageSupported) => set({ languageSupported }),
    setIncompatibleMessage: (incompatibleMessage) => set({ incompatibleMessage }),
    triggerRecheck: () => set((s) => ({ recheckTrigger: s.recheckTrigger + 1 })),
    clearCompletedNaturally: () =>
        set({ completedNaturally: false, lastCompletedDocumentKey: null }),
    markCompletedNaturally: () =>
        set({
            completedNaturally: true,
            lastCompletedDocumentKey: get().documentKey,
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
    restoreLastPosition: (position) =>
        set({
            lastStoppedDocumentKey: position?.documentKey ?? null,
            lastStoppedSegmentIndex: position?.segmentIndex ?? 0,
        }),
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

export function selectLastPosition(s: TtsState): TtsLastPosition | null {
    if (s.documentKey && (s.status === 'playing' || s.status === 'paused')) {
        return { documentKey: s.documentKey, segmentIndex: s.currentSegmentIndex };
    }
    if (s.lastStoppedDocumentKey && s.lastStoppedSegmentIndex > 0) {
        return {
            documentKey: s.lastStoppedDocumentKey,
            segmentIndex: s.lastStoppedSegmentIndex,
        };
    }
    return null;
}

/** Only when the session is free: another document holding it will overwrite the saved slot. */
export function selectCanResume(s: TtsState, documentKey: string): boolean {
    return (
        s.documentKey === null &&
        s.lastStoppedDocumentKey === documentKey &&
        s.lastStoppedSegmentIndex > 0
    );
}
