import { create } from 'zustand';
import type {
    TtsProviderInfo,
    TtsSettings,
    TtsPlaybackStatus,
    TtsPlaybackState,
    TtsSegment,
    TtsProviderType,
} from '@shared/tts.types';

interface TtsState {
    providers: TtsProviderInfo[];
    settings: TtsSettings | null;
    status: TtsPlaybackStatus;
    currentSegmentIndex: number;
    totalSegments: number;
    segments: TtsSegment[];
    activeProvider: TtsProviderType | null;
    error: string | null;
    documentId: string | null;
    languageSupported: boolean;

    setProviders(p: TtsProviderInfo[]): void;
    setSettings(s: TtsSettings): void;
    setPlaybackState(s: TtsPlaybackState): void;
    setSegments(s: TtsSegment[]): void;
    setDocumentId(id: string | null): void;
    setLanguageSupported(v: boolean): void;
    reset(): void;
}

export const useTtsStore = create<TtsState>((set) => ({
    providers: [],
    settings: null,
    status: 'idle',
    currentSegmentIndex: 0,
    totalSegments: 0,
    segments: [],
    activeProvider: null,
    error: null,
    documentId: null,
    languageSupported: false,

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
    setSegments: (segments) => set({ segments, totalSegments: segments.length }),
    setDocumentId: (documentId) => set({ documentId }),
    setLanguageSupported: (languageSupported) => set({ languageSupported }),
    reset: () =>
        set({
            status: 'idle',
            currentSegmentIndex: 0,
            totalSegments: 0,
            segments: [],
            error: null,
            documentId: null,
        }),
}));

export const selectCurrentTtsSegment = (s: TtsState) => s.segments[s.currentSegmentIndex] ?? null;
export const selectIsTtsPlaying = (s: TtsState) => s.status === 'playing' || s.status === 'loading';
