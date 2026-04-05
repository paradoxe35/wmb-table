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
    type TtsPlaybackState,
    DEFAULT_TTS_PROVIDER,
    SEGMENT_GAP_MS,
    hasSpeakableContent,
} from '@shared/tts.types';

// ── Per-document TTS options ──

export interface UseTtsOptions {
    introText?: string;
    getSegmentLabel?: (paragraphIndex: number) => string;
}

type BrowserPlaybackActions = {
    markCompletedNaturally(): void;
    reset(): void;
    setPlaybackState(state: TtsPlaybackState): void;
};

type PlaybackActions = BrowserPlaybackActions & {
    setDocumentKey(documentKey: string | null): void;
    setSegments(segments: TtsSegment[]): void;
};

// ── Segmentation ──

async function segmentText(
    paragraphs: { paragraphIndex: number; content: string }[],
    mode: TtsHighlightMode,
    language: string,
    getSegmentLabel?: (paragraphIndex: number) => string,
    announceEnabled?: boolean,
): Promise<TtsSegment[]> {
    let contentSegments: TtsSegment[];

    if (mode === 'paragraph') {
        let index = 0;
        contentSegments = [];
        for (const p of paragraphs) {
            const text = p.content.replace(/[*^]/g, '').replace(/\s+/g, ' ').trim();
            if (!text || !hasSpeakableContent(text)) {
                continue;
            }
            contentSegments.push({
                index: index++,
                text,
                paragraphIndex: p.paragraphIndex,
                startOffset: 0,
                endOffset: p.content.length,
            });
        }
    } else {
        contentSegments = await window.api.tts.segmentParagraphs(paragraphs, language);
    }

    if (!announceEnabled || !getSegmentLabel) {
        return contentSegments;
    }

    // Insert announcement segment before the first content segment of each paragraph
    const result: TtsSegment[] = [];
    let lastAnnouncedParagraph: number | null = null;
    for (const seg of contentSegments) {
        if (seg.paragraphIndex !== lastAnnouncedParagraph) {
            lastAnnouncedParagraph = seg.paragraphIndex;
            result.push({
                index: result.length,
                text: getSegmentLabel(seg.paragraphIndex),
                paragraphIndex: seg.paragraphIndex,
                startOffset: 0,
                endOffset: 0,
            });
        }
        result.push({ ...seg, index: result.length });
    }
    return result;
}

function buildPlaybackSegments(
    contentSegments: TtsSegment[],
    options?: UseTtsOptions,
    readIntroduction?: boolean,
): TtsSegment[] {
    const allSegments: TtsSegment[] = [];
    if (options?.introText && readIntroduction) {
        allSegments.push({
            index: 0,
            text: options.introText,
            paragraphIndex: -1,
            startOffset: 0,
            endOffset: 0,
        });
    }
    for (const seg of contentSegments) {
        allSegments.push({ ...seg, index: allSegments.length });
    }
    return allSegments;
}

export async function startTtsPlayback(
    paragraphs: { paragraphIndex: number; content: string }[],
    language: string,
    documentKey: string,
    options?: UseTtsOptions,
    startParagraphIndex?: number,
): Promise<void> {
    const settings = useTtsStore.getState().settings;
    if (!settings || !paragraphs.length) {
        return;
    }

    const contentSegments = await segmentText(
        paragraphs,
        settings.highlightMode,
        language,
        options?.getSegmentLabel,
        settings.announceSegmentNumbers,
    );
    if (!contentSegments.length) {
        return;
    }

    const allSegments = buildPlaybackSegments(contentSegments, options, settings.readIntroduction);
    const state = useTtsStore.getState();

    const savedIndex =
        startParagraphIndex == null &&
        state.lastStoppedDocumentKey === documentKey &&
        state.lastStoppedSegmentIndex > 0
            ? state.lastStoppedSegmentIndex
            : 0;

    const startIndex =
        startParagraphIndex == null
            ? savedIndex < allSegments.length
                ? savedIndex
                : 0
            : allSegments.findIndex((segment) => segment.paragraphIndex >= startParagraphIndex);

    if (startIndex < 0) {
        return;
    }

    startPlaybackAtIndex(
        allSegments,
        startIndex,
        settings,
        language,
        documentKey,
        {
            markCompletedNaturally: state.markCompletedNaturally,
            reset: state.reset,
            setDocumentKey: state.setDocumentKey,
            setPlaybackState: state.setPlaybackState,
            setSegments: state.setSegments,
        },
        getTtsStatusSnapshot,
    );
}

// ── Browser TTS ──

let browserTtsGapTimer: ReturnType<typeof setTimeout> | null = null;

function clearBrowserTtsTimer(): void {
    if (browserTtsGapTimer != null) {
        clearTimeout(browserTtsGapTimer);
        browserTtsGapTimer = null;
    }
}

function getTtsStatusSnapshot(): 'idle' | 'loading' | 'playing' | 'paused' | 'error' {
    return useTtsStore.getState().status;
}

function playBrowserSegment(
    segments: TtsSegment[],
    index: number,
    settings: TtsSettings,
    actions: BrowserPlaybackActions,
    getStatus: () => 'idle' | 'loading' | 'playing' | 'paused' | 'error',
): void {
    clearBrowserTtsTimer();

    if (index >= segments.length) {
        actions.markCompletedNaturally();
        actions.reset();
        return;
    }

    actions.setPlaybackState({
        status: 'playing',
        currentSegmentIndex: index,
        totalSegments: segments.length,
        provider: 'browser',
    });

    const cfg = settings.providers.browser;
    const gapMs = settings.segmentGapMs ?? SEGMENT_GAP_MS;

    browserTts.setOnSegmentEnd(() => {
        // Check if we were stopped while speaking
        if (getStatus() === 'idle') return;

        if (gapMs > 0) {
            browserTtsGapTimer = setTimeout(
                () => playBrowserSegment(segments, index + 1, settings, actions, getStatus),
                gapMs,
            );
        } else {
            playBrowserSegment(segments, index + 1, settings, actions, getStatus);
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
    documentKey: string,
    actions: PlaybackActions,
    getStatus: () => 'idle' | 'loading' | 'playing' | 'paused' | 'error',
): void {
    actions.setSegments(segments);
    actions.setDocumentKey(documentKey);
    // Set status eagerly so the mini-player subscriber pauses sermon audio
    actions.setPlaybackState({
        status: 'loading',
        currentSegmentIndex: startIndex,
        totalSegments: segments.length,
        provider: settings.activeProvider,
    });

    if (settings.activeProvider === 'browser') {
        playBrowserSegment(segments, startIndex, settings, actions, getStatus);
    } else {
        window.api.tts.startPlayback(segments, language, startIndex).catch(() => {
            message.error(
                i18next.t('La lecture audio a échoué. Vérifiez la configuration du fournisseur.'),
            );
            actions.reset();
        });
    }
}

// ── Hook (per-document playback controls) ──

export function useTts(
    paragraphs: { paragraphIndex: number; content: string }[],
    language: string,
    documentKey: string,
    options?: UseTtsOptions,
) {
    const settings = useTtsStore((s) => s.settings);
    const status = useTtsStore((s) => s.status);
    const currentDocumentKey = useTtsStore((s) => s.documentKey);
    const currentSegmentIndex = useTtsStore((s) => s.currentSegmentIndex);
    const totalSegments = useTtsStore((s) => s.totalSegments);
    const segments = useTtsStore((s) => s.segments);
    const setPlaybackState = useTtsStore((s) => s.setPlaybackState);
    const languageSupported = useTtsStore((s) => s.languageSupported);
    const incompatibleMessage = useTtsStore((s) => s.incompatibleMessage);
    const stopAndRemember = useTtsStore((s) => s.stopAndRemember);
    const reset = useTtsStore((s) => s.reset);
    const markCompletedNaturally = useTtsStore((s) => s.markCompletedNaturally);
    const activeProvider = settings?.activeProvider;

    // Stop TTS on language change (ignore empty transitions during tab switches)
    const prevLanguageRef = useRef(language);
    useEffect(() => {
        if (!language || prevLanguageRef.current === language) {
            return;
        }

        const hadLanguage = !!prevLanguageRef.current;
        prevLanguageRef.current = language;
        if (hadLanguage && status !== 'idle') {
            stopAllTtsPlayback();
            reset();
        }
    }, [language, reset, status]);

    const play = useCallback(async () => {
        await startTtsPlayback(paragraphs, language, documentKey, options);
    }, [documentKey, language, options, paragraphs]);

    const pause = useCallback(() => {
        if (activeProvider === 'browser') {
            browserTts.pause();
        } else {
            window.api.tts.pausePlayback();
            ttsAudioPlayer.pause();
        }
        setPlaybackState({
            status: 'paused',
            currentSegmentIndex,
            totalSegments,
            provider: activeProvider ?? DEFAULT_TTS_PROVIDER,
        });
    }, [activeProvider, currentSegmentIndex, setPlaybackState, totalSegments]);

    const resume = useCallback(() => {
        if (activeProvider === 'browser') {
            browserTts.resume();
        } else {
            window.api.tts.resumePlayback();
            ttsAudioPlayer.resume();
        }
        setPlaybackState({
            status: 'playing',
            currentSegmentIndex,
            totalSegments,
            provider: activeProvider ?? DEFAULT_TTS_PROVIDER,
        });
    }, [activeProvider, currentSegmentIndex, setPlaybackState, totalSegments]);

    const stop = useCallback(() => {
        clearBrowserTtsTimer();
        browserTts.cancel();
        stopAllTtsPlayback();
        stopAndRemember();
    }, [stopAndRemember]);

    const seekToSegment = useCallback(
        (i: number) => {
            if (activeProvider === 'browser') {
                browserTts.cancel();
                const segs = useTtsStore.getState().segments;
                if (segs.length && settings) {
                    playBrowserSegment(
                        segs,
                        i,
                        settings,
                        {
                            markCompletedNaturally,
                            reset,
                            setPlaybackState,
                        },
                        getTtsStatusSnapshot,
                    );
                }
            } else {
                window.api.tts.seekToSegment(i);
            }
        },
        [activeProvider, markCompletedNaturally, reset, setPlaybackState, settings],
    );

    const playFromParagraph = useCallback(
        async (paragraphIndex: number) => {
            await startTtsPlayback(paragraphs, language, documentKey, options, paragraphIndex);
        },
        [documentKey, language, options, paragraphs],
    );

    // Restart playback from current paragraph when content-shaping settings change
    const contentKey = `${settings?.announceSegmentNumbers}:${settings?.readIntroduction}:${settings?.highlightMode}`;
    const contentKeyRef = useRef(contentKey);
    useEffect(() => {
        if (contentKeyRef.current !== contentKey) {
            contentKeyRef.current = contentKey;
            if (
                currentDocumentKey === documentKey &&
                (status === 'playing' || status === 'paused')
            ) {
                const currentSeg = segments[currentSegmentIndex];
                const paragraphIdx = currentSeg?.paragraphIndex ?? 0;
                playFromParagraph(Math.max(1, paragraphIdx));
            }
        }
    }, [
        contentKey,
        currentDocumentKey,
        currentSegmentIndex,
        documentKey,
        playFromParagraph,
        segments,
        status,
    ]);

    const isThisDocument = currentDocumentKey === documentKey;
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
