import { useCallback, useEffect, useRef } from 'react';
import { message } from 'antd';
import i18next from 'i18next';
import { useTtsStore } from '@renderer/stores/tts.store';
import { browserTts } from '@renderer/services/browser-tts';
import { ttsAudioPlayer, stopAllTtsPlayback } from '@renderer/services/tts-audio-player';
import {
    type TtsHighlightMode,
    type TtsSegment,
    type TtsSettings,
    DEFAULT_TTS_PROVIDER,
    SEGMENT_GAP_MS,
} from '@shared/tts.types';

// ── Segmentation ──

async function segmentText(
    paragraphs: { paragraphIndex: number; content: string }[],
    mode: TtsHighlightMode,
    language: string,
): Promise<TtsSegment[]> {
    if (mode === 'paragraph') {
        let index = 0;
        const segments: TtsSegment[] = [];
        for (const p of paragraphs) {
            const text = p.content.replace(/[*^]/g, '').replace(/\s+/g, ' ').trim();
            if (!text) {
                continue;
            }
            segments.push({
                index: index++,
                text,
                paragraphIndex: p.paragraphIndex,
                startOffset: 0,
                endOffset: p.content.length,
            });
        }
        return segments;
    }
    return window.api.tts.segmentParagraphs(paragraphs, language);
}

// ── Browser TTS ──

let browserTtsGapTimer: ReturnType<typeof setTimeout> | null = null;

function clearBrowserTtsTimer(): void {
    if (browserTtsGapTimer != null) {
        clearTimeout(browserTtsGapTimer);
        browserTtsGapTimer = null;
    }
}

function playBrowserSegment(segments: TtsSegment[], index: number, settings: TtsSettings): void {
    clearBrowserTtsTimer();

    if (index >= segments.length) {
        useTtsStore.getState().reset();
        return;
    }

    useTtsStore.getState().setPlaybackState({
        status: 'playing',
        currentSegmentIndex: index,
        totalSegments: segments.length,
        provider: 'browser',
    });

    const cfg = settings.providers.browser;
    const gapMs = settings.segmentGapMs ?? SEGMENT_GAP_MS;

    browserTts.setOnSegmentEnd(() => {
        // Check if we were stopped while speaking
        if (useTtsStore.getState().status === 'idle') return;

        if (gapMs > 0) {
            browserTtsGapTimer = setTimeout(
                () => playBrowserSegment(segments, index + 1, settings),
                gapMs,
            );
        } else {
            playBrowserSegment(segments, index + 1, settings);
        }
    });
    browserTts.speak(segments[index].text, cfg?.voiceId, {
        rate: settings.rate,
        pitch: cfg?.pitch,
        volume: cfg?.volume,
    });
}

// ── Playback start ──

function startPlaybackAtIndex(
    segments: TtsSegment[],
    startIndex: number,
    settings: TtsSettings,
    language: string,
    documentId: string,
): void {
    const store = useTtsStore.getState();
    store.setSegments(segments);
    store.setDocumentId(documentId);
    // Set status eagerly so the mini-player subscriber pauses sermon audio
    store.setPlaybackState({
        status: 'loading',
        currentSegmentIndex: startIndex,
        totalSegments: segments.length,
        provider: settings.activeProvider,
    });

    if (settings.activeProvider === 'browser') {
        playBrowserSegment(segments, startIndex, settings);
    } else {
        window.api.tts.startPlayback(segments, language, startIndex).catch(() => {
            message.error(
                i18next.t('La lecture audio a échoué. Vérifiez la configuration du fournisseur.'),
            );
            useTtsStore.getState().reset();
        });
    }
}

// ── Hook (per-document playback controls) ──

export function useTts(
    paragraphs: { paragraphIndex: number; content: string }[],
    language: string,
    documentId: string,
) {
    const settings = useTtsStore((s) => s.settings);
    const status = useTtsStore((s) => s.status);
    const currentDocId = useTtsStore((s) => s.documentId);
    const setPlaybackState = useTtsStore((s) => s.setPlaybackState);
    const languageSupported = useTtsStore((s) => s.languageSupported);
    const incompatibleMessage = useTtsStore((s) => s.incompatibleMessage);
    const activeProvider = settings?.activeProvider;

    // Stop TTS on language change (ignore empty transitions during tab switches)
    const prevLanguageRef = useRef(language);
    useEffect(() => {
        if (!language || prevLanguageRef.current === language) {
            return;
        }

        const hadLanguage = !!prevLanguageRef.current;
        prevLanguageRef.current = language;
        if (hadLanguage && useTtsStore.getState().status !== 'idle') {
            stopAllTtsPlayback();
            useTtsStore.getState().reset();
        }
    }, [language]);

    const play = useCallback(async () => {
        if (!settings || !paragraphs.length) {
            return;
        }
        const segments = await segmentText(paragraphs, settings.highlightMode, language);
        if (!segments.length) {
            return;
        }

        // Resume from last position if same document
        const store = useTtsStore.getState();
        let startIndex = 0;
        if (
            store.lastStoppedDocumentId === documentId &&
            store.lastStoppedSegmentIndex > 0 &&
            store.lastStoppedSegmentIndex < segments.length
        ) {
            startIndex = store.lastStoppedSegmentIndex;
        }

        startPlaybackAtIndex(segments, startIndex, settings, language, documentId);
    }, [paragraphs, language, documentId, settings]);

    const pause = useCallback(() => {
        const state = useTtsStore.getState();
        if (activeProvider === 'browser') {
            browserTts.pause();
        } else {
            window.api.tts.pausePlayback();
            ttsAudioPlayer.pause();
        }
        setPlaybackState({
            status: 'paused',
            currentSegmentIndex: state.currentSegmentIndex,
            totalSegments: state.totalSegments,
            provider: activeProvider ?? DEFAULT_TTS_PROVIDER,
        });
    }, [activeProvider, setPlaybackState]);

    const resume = useCallback(() => {
        const state = useTtsStore.getState();
        if (activeProvider === 'browser') {
            browserTts.resume();
        } else {
            window.api.tts.resumePlayback();
            ttsAudioPlayer.resume();
        }
        setPlaybackState({
            status: 'playing',
            currentSegmentIndex: state.currentSegmentIndex,
            totalSegments: state.totalSegments,
            provider: activeProvider ?? DEFAULT_TTS_PROVIDER,
        });
    }, [activeProvider, setPlaybackState]);

    const stop = useCallback(() => {
        clearBrowserTtsTimer();
        browserTts.cancel();
        stopAllTtsPlayback();
        useTtsStore.getState().stopAndRemember();
    }, []);

    const seekToSegment = useCallback(
        (i: number) => {
            if (activeProvider === 'browser') {
                browserTts.cancel();
                const segs = useTtsStore.getState().segments;
                if (segs.length && settings) playBrowserSegment(segs, i, settings);
            } else {
                window.api.tts.seekToSegment(i);
            }
        },
        [activeProvider, settings],
    );

    const playFromParagraph = useCallback(
        async (paragraphIndex: number) => {
            if (!settings || !paragraphs.length) {
                return;
            }
            const segments = await segmentText(paragraphs, settings.highlightMode, language);
            if (!segments.length) {
                return;
            }

            const startIndex = segments.findIndex((s) => s.paragraphIndex >= paragraphIndex);
            if (startIndex < 0) {
                return;
            }

            startPlaybackAtIndex(segments, startIndex, settings, language, documentId);
        },
        [paragraphs, language, documentId, settings],
    );

    const isThisDocument = currentDocId === documentId;
    const isPlaying = isThisDocument && (status === 'playing' || status === 'loading');
    const isPaused = isThisDocument && status === 'paused';

    return {
        canSpeak: languageSupported,
        incompatibleMessage,
        isPlaying,
        isPaused,
        play,
        pause,
        resume,
        stop,
        seekToSegment,
        playFromParagraph,
    };
}
