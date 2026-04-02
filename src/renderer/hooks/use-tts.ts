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
    hasSpeakableContent,
} from '@shared/tts.types';

// ── Per-document TTS options ──

interface UseTtsOptions {
    introText?: string;
    getSegmentLabel?: (paragraphIndex: number) => string;
}

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

// ── Browser TTS ──

let browserTtsGapTimer: ReturnType<typeof setTimeout> | null = null;

function clearBrowserTtsTimer(): void {
    if (browserTtsGapTimer != null) {
        clearTimeout(browserTtsGapTimer);
        browserTtsGapTimer = null;
    }
}

function playBrowserSegment(
    segments: TtsSegment[],
    index: number,
    settings: TtsSettings,
    actions: Pick<
        ReturnType<typeof useTtsStore.getState>,
        'markCompletedNaturally' | 'reset' | 'setPlaybackState'
    >,
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
        if (useTtsStore.getState().status === 'idle') return;

        if (gapMs > 0) {
            browserTtsGapTimer = setTimeout(
                () => playBrowserSegment(segments, index + 1, settings, actions),
                gapMs,
            );
        } else {
            playBrowserSegment(segments, index + 1, settings, actions);
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
    actions: Pick<
        ReturnType<typeof useTtsStore.getState>,
        'markCompletedNaturally' | 'reset' | 'setDocumentId' | 'setPlaybackState' | 'setSegments'
    >,
): void {
    actions.setSegments(segments);
    actions.setDocumentId(documentId);
    // Set status eagerly so the mini-player subscriber pauses sermon audio
    actions.setPlaybackState({
        status: 'loading',
        currentSegmentIndex: startIndex,
        totalSegments: segments.length,
        provider: settings.activeProvider,
    });

    if (settings.activeProvider === 'browser') {
        playBrowserSegment(segments, startIndex, settings, actions);
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
    documentId: string,
    options?: UseTtsOptions,
) {
    const settings = useTtsStore((s) => s.settings);
    const status = useTtsStore((s) => s.status);
    const currentDocId = useTtsStore((s) => s.documentId);
    const setPlaybackState = useTtsStore((s) => s.setPlaybackState);
    const languageSupported = useTtsStore((s) => s.languageSupported);
    const incompatibleMessage = useTtsStore((s) => s.incompatibleMessage);
    const setSegments = useTtsStore((s) => s.setSegments);
    const setDocumentId = useTtsStore((s) => s.setDocumentId);
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

        // Always build allSegments with intro at index 0 (when enabled).
        // The startIndex will skip the intro naturally on resume — no need
        // to conditionally omit it, which avoids an index offset bug.
        const allSegments: TtsSegment[] = [];
        if (options?.introText && settings.readIntroduction) {
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

        // Resume at saved position (skips intro naturally), clamp if stale
        const store = useTtsStore.getState();
        const savedIndex =
            store.lastStoppedDocumentId === documentId && store.lastStoppedSegmentIndex > 0
                ? store.lastStoppedSegmentIndex
                : 0;
        const startIndex = savedIndex < allSegments.length ? savedIndex : 0;

        startPlaybackAtIndex(allSegments, startIndex, settings, language, documentId, {
            markCompletedNaturally,
            reset,
            setDocumentId,
            setPlaybackState,
            setSegments,
        });
    }, [
        documentId,
        language,
        markCompletedNaturally,
        options,
        paragraphs,
        reset,
        setDocumentId,
        setPlaybackState,
        setSegments,
        settings,
    ]);

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
        stopAndRemember();
    }, [stopAndRemember]);

    const seekToSegment = useCallback(
        (i: number) => {
            if (activeProvider === 'browser') {
                browserTts.cancel();
                const segs = useTtsStore.getState().segments;
                if (segs.length && settings) {
                    playBrowserSegment(segs, i, settings, {
                        markCompletedNaturally,
                        reset,
                        setPlaybackState,
                    });
                }
            } else {
                window.api.tts.seekToSegment(i);
            }
        },
        [activeProvider, markCompletedNaturally, reset, setPlaybackState, settings],
    );

    const playFromParagraph = useCallback(
        async (paragraphIndex: number) => {
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

            // Build same segment array as play() so indices are consistent
            // across stop/resume cycles (intro is included but skipped).
            const allSegments: TtsSegment[] = [];
            if (options?.introText && settings.readIntroduction) {
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

            const startIndex = allSegments.findIndex((s) => s.paragraphIndex >= paragraphIndex);
            if (startIndex < 0) {
                return;
            }

            startPlaybackAtIndex(allSegments, startIndex, settings, language, documentId, {
                markCompletedNaturally,
                reset,
                setDocumentId,
                setPlaybackState,
                setSegments,
            });
        },
        [
            documentId,
            language,
            markCompletedNaturally,
            options,
            paragraphs,
            reset,
            setDocumentId,
            setPlaybackState,
            setSegments,
            settings,
        ],
    );

    // Restart playback from current paragraph when content-shaping settings change
    const contentKey = `${settings?.announceSegmentNumbers}:${settings?.readIntroduction}:${settings?.highlightMode}`;
    const contentKeyRef = useRef(contentKey);
    useEffect(() => {
        if (contentKeyRef.current !== contentKey) {
            contentKeyRef.current = contentKey;
            const store = useTtsStore.getState();
            if (
                store.documentId === documentId &&
                (store.status === 'playing' || store.status === 'paused')
            ) {
                const currentSeg = store.segments[store.currentSegmentIndex];
                const paragraphIdx = currentSeg?.paragraphIndex ?? 0;
                playFromParagraph(Math.max(1, paragraphIdx));
            }
        }
    }, [contentKey, documentId, playFromParagraph]);

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
