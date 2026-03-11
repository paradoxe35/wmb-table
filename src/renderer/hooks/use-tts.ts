import { useCallback, useEffect, useRef } from 'react';
import { message } from 'antd';
import { useTtsStore } from '@renderer/stores/tts.store';
import { browserTts } from '@renderer/services/browser-tts';
import { ttsAudioPlayer } from '@renderer/services/tts-audio-player';
import type { TtsHighlightMode, TtsSegment, TtsSettings } from '@shared/tts.types';

// ── Text segmentation ──

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
            if (!text) continue;
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
    // Sentence mode: delegate to main process (native sentencex)
    return window.api.tts.segmentParagraphs(paragraphs, language);
}

// ── Browser TTS playback ──

function playBrowserSegment(segments: TtsSegment[], index: number, settings: TtsSettings): void {
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
    const gapMs = settings.segmentGapMs ?? 700;
    browserTts.setOnSegmentEnd(() => {
        if (gapMs > 0) {
            setTimeout(() => playBrowserSegment(segments, index + 1, settings), gapMs);
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

// ── Shared start logic ──

function startPlaybackAtIndex(
    segments: TtsSegment[],
    startIndex: number,
    settings: TtsSettings,
    language: string,
    documentId: string,
): void {
    useTtsStore.getState().setSegments(segments);
    useTtsStore.getState().setDocumentId(documentId);

    if (settings.activeProvider === 'browser') {
        playBrowserSegment(segments, startIndex, settings);
    } else {
        window.api.tts.startPlayback(segments, language, startIndex).catch(() => {
            message.error('La lecture audio a échoué. Vérifiez la configuration du fournisseur.');
            useTtsStore.getState().reset();
        });
    }
}

// ── Hook ──

export function useTts(
    paragraphs: { paragraphIndex: number; content: string }[],
    language: string,
    documentId: string,
) {
    const settings = useTtsStore((s) => s.settings);
    const status = useTtsStore((s) => s.status);
    const currentDocId = useTtsStore((s) => s.documentId);
    const setPlaybackState = useTtsStore((s) => s.setPlaybackState);
    const settingsLoaded = useRef(false);

    // Load settings on mount
    useEffect(() => {
        if (!settingsLoaded.current) {
            settingsLoaded.current = true;
            window.api.tts.getSettings().then((s) => useTtsStore.getState().setSettings(s));
        }
    }, []);

    // Check language support
    useEffect(() => {
        if (!settings) return;
        if (settings.activeProvider === 'browser') {
            const check = () => {
                const supported = browserTts.supportsLanguage(language);
                useTtsStore.getState().setLanguageSupported(supported);
            };
            check();
            window.speechSynthesis.addEventListener('voiceschanged', check);
            return () => window.speechSynthesis.removeEventListener('voiceschanged', check);
        } else {
            window.api.tts.checkLanguageSupport(language).then((support) => {
                const active = settings.activeProvider;
                useTtsStore.getState().setLanguageSupported(support[active] ?? false);
            });
        }
    }, [language, settings?.activeProvider]);

    // Re-check language support after a model download completes
    useEffect(() => {
        return window.api.on.ttsModelDownloadProgress((p) => {
            if (p.status !== 'complete' || !settings || settings.activeProvider === 'browser')
                return;
            window.api.tts.checkLanguageSupport(language).then((support) => {
                const active = useTtsStore.getState().settings?.activeProvider;
                if (active && active !== 'browser') {
                    useTtsStore.getState().setLanguageSupported(support[active] ?? false);
                }
            });
        });
    }, [language, settings?.activeProvider]);

    // Listen to push events for playback state (main-process providers)
    useEffect(() => {
        return window.api.on.ttsPlaybackState((state) => {
            if (state.status === 'idle') {
                // Natural playback end — clear resume position
                useTtsStore.getState().reset();
            } else {
                setPlaybackState(state);
            }
            if (state.status === 'error') {
                message.error(
                    'La lecture audio a échoué. Vérifiez la configuration du fournisseur.',
                );
            }
        });
    }, [setPlaybackState]);

    // Listen to segment audio and play it (main-process providers)
    useEffect(() => {
        return window.api.on.ttsSegmentAudio((data) => {
            const rate = settings?.rate ?? 1;
            ttsAudioPlayer.play(data.audioBase64, data.mimeType, rate);
        });
    }, [settings]);

    // Signal segment completion from audio player to main process
    // Gap is handled in the main process (overlaps with synthesis time)
    useEffect(() => {
        let pending = false;
        ttsAudioPlayer.setOnEnded(() => {
            if (pending) return;
            pending = true;
            window.api.tts.segmentComplete().finally(() => {
                pending = false;
            });
        });
    }, []);

    const play = useCallback(async () => {
        if (!settings || !paragraphs.length) return;
        const segments = await segmentText(paragraphs, settings.highlightMode, language);
        if (!segments.length) return;

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
        if (settings?.activeProvider === 'browser') {
            browserTts.pause();
            setPlaybackState({
                status: 'paused',
                currentSegmentIndex: useTtsStore.getState().currentSegmentIndex,
                totalSegments: useTtsStore.getState().totalSegments,
                provider: 'browser',
            });
        } else {
            window.api.tts.pausePlayback();
            ttsAudioPlayer.pause();
        }
    }, [settings?.activeProvider, setPlaybackState]);

    const resume = useCallback(() => {
        if (settings?.activeProvider === 'browser') {
            browserTts.resume();
            setPlaybackState({
                status: 'playing',
                currentSegmentIndex: useTtsStore.getState().currentSegmentIndex,
                totalSegments: useTtsStore.getState().totalSegments,
                provider: 'browser',
            });
        } else {
            window.api.tts.resumePlayback();
            ttsAudioPlayer.resume();
        }
    }, [settings?.activeProvider, setPlaybackState]);

    const stop = useCallback(() => {
        if (settings?.activeProvider === 'browser') {
            browserTts.cancel();
        } else {
            ttsAudioPlayer.stop();
            window.api.tts.stopPlayback();
        }
        useTtsStore.getState().stopAndRemember();
    }, [settings?.activeProvider]);

    const seekToSegment = useCallback(
        (i: number) => {
            if (settings?.activeProvider === 'browser') {
                browserTts.cancel();
                const segs = useTtsStore.getState().segments;
                if (segs.length) playBrowserSegment(segs, i, settings);
            } else {
                window.api.tts.seekToSegment(i);
            }
        },
        [settings],
    );

    const playFromParagraph = useCallback(
        async (paragraphIndex: number) => {
            if (!settings || !paragraphs.length) return;
            const segments = await segmentText(paragraphs, settings.highlightMode, language);
            if (!segments.length) return;

            // Find first segment at or after the target paragraph
            const startIndex = segments.findIndex((s) => s.paragraphIndex >= paragraphIndex);
            if (startIndex < 0) return;

            startPlaybackAtIndex(segments, startIndex, settings, language, documentId);
        },
        [paragraphs, language, documentId, settings],
    );

    const isThisDocument = currentDocId === documentId;
    const isPlaying = isThisDocument && (status === 'playing' || status === 'loading');
    const isPaused = isThisDocument && status === 'paused';
    const languageSupported = useTtsStore((s) => s.languageSupported);

    return {
        canSpeak: languageSupported,
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
