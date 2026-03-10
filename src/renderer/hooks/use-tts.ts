import { useCallback, useEffect, useRef } from 'react';
import { message } from 'antd';
import { useTtsStore } from '@renderer/stores/tts.store';
import { browserTts } from '@renderer/services/browser-tts';
import { ttsAudioPlayer } from '@renderer/services/tts-audio-player';
import type { TtsSegment, TtsSettings } from '@shared/tts.types';

// ── Text segmentation ──

function segmentText(
    paragraphs: { paragraphIndex: number; content: string }[],
    mode: 'word' | 'sentence' | 'paragraph',
): TtsSegment[] {
    let index = 0;
    const segments: TtsSegment[] = [];
    for (const p of paragraphs) {
        if (!p.content.trim()) continue;

        if (mode === 'paragraph') {
            segments.push({
                index: index++,
                text: p.content,
                paragraphIndex: p.paragraphIndex,
                startOffset: 0,
                endOffset: p.content.length,
            });
        } else if (mode === 'sentence') {
            const sentenceRegex = /[^.!?]+[.!?]*(\s+|$)/g;
            let match: RegExpExecArray | null;
            while ((match = sentenceRegex.exec(p.content)) !== null) {
                const text = match[0].trim();
                if (text) {
                    segments.push({
                        index: index++,
                        text,
                        paragraphIndex: p.paragraphIndex,
                        startOffset: match.index,
                        endOffset: match.index + match[0].length,
                    });
                }
            }
        } else {
            const wordRegex = /\S+/g;
            let match: RegExpExecArray | null;
            while ((match = wordRegex.exec(p.content)) !== null) {
                segments.push({
                    index: index++,
                    text: match[0],
                    paragraphIndex: p.paragraphIndex,
                    startOffset: match.index,
                    endOffset: match.index + match[0].length,
                });
            }
        }
    }
    return segments;
}

// ── Browser TTS playback ──

function playBrowserSegment(
    segments: TtsSegment[],
    index: number,
    settings: TtsSettings,
    onComplete: () => void,
): void {
    if (index >= segments.length) {
        useTtsStore.getState().setPlaybackState({
            status: 'idle',
            currentSegmentIndex: 0,
            totalSegments: 0,
            provider: 'browser',
        });
        return;
    }

    useTtsStore.getState().setPlaybackState({
        status: 'playing',
        currentSegmentIndex: index,
        totalSegments: segments.length,
        provider: 'browser',
    });

    const cfg = settings.providers.browser;
    browserTts.setOnSegmentEnd(() => {
        playBrowserSegment(segments, index + 1, settings, onComplete);
    });
    browserTts.speak(segments[index].text, cfg?.voiceId, {
        rate: settings.rate,
        pitch: cfg?.pitch,
        volume: cfg?.volume,
    });
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
            // Browser voices load asynchronously
            const check = () => {
                const supported = browserTts.supportsLanguage(language);
                useTtsStore.getState().setLanguageSupported(supported);
            };
            check();
            // Voices may load late
            window.speechSynthesis.addEventListener('voiceschanged', check);
            return () => window.speechSynthesis.removeEventListener('voiceschanged', check);
        } else {
            window.api.tts.checkLanguageSupport(language).then((support) => {
                const active = settings.activeProvider;
                useTtsStore.getState().setLanguageSupported(support[active] ?? false);
            });
        }
    }, [language, settings?.activeProvider]);

    // Listen to push events for playback state (main-process providers)
    useEffect(() => {
        return window.api.on.ttsPlaybackState((state) => {
            setPlaybackState(state);
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

    const play = useCallback(() => {
        if (!settings || !paragraphs.length) return;
        const segments = segmentText(paragraphs, settings.highlightMode);
        if (!segments.length) return;
        useTtsStore.getState().setSegments(segments);
        useTtsStore.getState().setDocumentId(documentId);

        if (settings.activeProvider === 'browser') {
            playBrowserSegment(segments, 0, settings, () => {});
        } else {
            window.api.tts.startPlayback(segments, language).catch(() => {
                message.error(
                    'La lecture audio a échoué. Vérifiez la configuration du fournisseur.',
                );
                useTtsStore.getState().reset();
            });
        }
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
        useTtsStore.getState().reset();
    }, [settings?.activeProvider]);

    const seekToSegment = useCallback(
        (i: number) => {
            if (settings?.activeProvider === 'browser') {
                const segs = useTtsStore.getState().segments;
                if (segs.length) playBrowserSegment(segs, i, settings, () => {});
            } else {
                window.api.tts.seekToSegment(i);
            }
        },
        [settings],
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
    };
}
