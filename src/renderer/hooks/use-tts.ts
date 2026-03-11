import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useTtsStore } from '@renderer/stores/tts.store';
import { browserTts } from '@renderer/services/browser-tts';
import { ttsAudioPlayer } from '@renderer/services/tts-audio-player';
import {
    type TtsHighlightMode,
    type TtsSegment,
    type TtsSettings,
    type TtsIncompatibilityReason,
} from '@shared/tts.types';

// ── Language compatibility ──

function getIncompatibilityMessage(
    reason: TtsIncompatibilityReason | undefined,
    t: (k: string) => string,
): string {
    switch (reason) {
        case 'not_configured':
            return t(
                "Ce fournisseur n'est pas configuré. Ajoutez une clé API dans les paramètres TTS.",
            );
        case 'model_not_downloaded':
            return t(
                "Le modèle vocal n'est pas téléchargé. Téléchargez-le dans les paramètres TTS.",
            );
        case 'no_voice_for_language':
            return t(
                'La voix sélectionnée ne prend pas en charge cette langue. Changez de voix dans les paramètres TTS.',
            );
        case 'unsupported_language':
            return t('Ce fournisseur ne prend pas en charge cette langue.');
        default:
            return t('Ce fournisseur ne peut pas lire cette langue.');
    }
}

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
    const { t } = useTranslation();
    const settings = useTtsStore((s) => s.settings);
    const status = useTtsStore((s) => s.status);
    const currentDocId = useTtsStore((s) => s.documentId);
    const setPlaybackState = useTtsStore((s) => s.setPlaybackState);
    const languageSupported = useTtsStore((s) => s.languageSupported);
    const settingsLoaded = useRef(false);

    const [incompatibleMessage, setIncompatibleMessage] = useState<string | undefined>(undefined);

    // Used to re-trigger the language support check (e.g. after a model download)
    const [recheckCounter, setRecheckCounter] = useState(0);

    // Load settings on mount
    useEffect(() => {
        if (!settingsLoaded.current) {
            settingsLoaded.current = true;
            window.api.tts.getSettings().then((s) => useTtsStore.getState().setSettings(s));
        }
    }, []);

    // Track active provider config to re-run check when voice/model changes
    const activeProviderCfg = settings?.providers[settings.activeProvider ?? 'browser'];

    // Language support check + auto-switch for the active provider
    useEffect(() => {
        if (!settings) return;

        let cancelled = false;

        const check = async () => {
            const activeProvider = settings.activeProvider;

            if (activeProvider === 'browser') {
                const supported = browserTts.supportsLanguage(language);
                if (cancelled) return;
                useTtsStore.getState().setLanguageSupported(supported);
                setIncompatibleMessage(
                    supported
                        ? undefined
                        : t('Le navigateur ne dispose pas de voix pour cette langue.'),
                );
                return;
            }

            // Ask the active provider to resolve a compatible voice/model for this language.
            // The service is provider-agnostic: any provider can implement resolveVoiceForLanguage.
            // If it returns fresh settings, update the store immediately — no need to wait for recheck.
            if (settings.autoSwitchVoice) {
                const resolved = await window.api.tts.resolveVoiceForLanguage(language);
                if (cancelled) return;
                if (resolved) {
                    useTtsStore.getState().setSettings(resolved);
                }
            }

            try {
                const results = await window.api.tts.checkLanguageSupport(language);
                if (cancelled) return;
                const result = results[activeProvider];
                useTtsStore.getState().setLanguageSupported(result.supported);
                setIncompatibleMessage(
                    result.supported ? undefined : getIncompatibilityMessage(result.reason, t),
                );
            } catch {
                if (cancelled) return;
                useTtsStore.getState().setLanguageSupported(false);
                setIncompatibleMessage(
                    t('Impossible de vérifier la compatibilité du fournisseur.'),
                );
            }
        };

        check();

        // Browser voices may load asynchronously; re-check when they become available
        const isBrowser = settings.activeProvider === 'browser';
        if (isBrowser) {
            window.speechSynthesis.addEventListener('voiceschanged', check);
        }
        return () => {
            cancelled = true;
            if (isBrowser) {
                window.speechSynthesis.removeEventListener('voiceschanged', check);
            }
        };
        // Include active provider config so the check reruns when voice/model changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        language,
        settings?.activeProvider,
        settings?.autoSwitchVoice,
        activeProviderCfg?.voiceId,
        activeProviderCfg?.model,
        t,
        recheckCounter,
    ]);

    // Re-check language support after a model download completes
    useEffect(() => {
        return window.api.on.ttsModelDownloadProgress((p) => {
            if (p.status === 'complete') {
                setRecheckCounter((c) => c + 1);
            }
        });
    }, []);

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

    const activeProvider = settings?.activeProvider;

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
        if (activeProvider === 'browser') {
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
    }, [activeProvider, setPlaybackState]);

    const resume = useCallback(() => {
        if (activeProvider === 'browser') {
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
    }, [activeProvider, setPlaybackState]);

    const stop = useCallback(() => {
        if (activeProvider === 'browser') {
            browserTts.cancel();
        } else {
            ttsAudioPlayer.stop();
            window.api.tts.stopPlayback();
        }
        useTtsStore.getState().stopAndRemember();
    }, [activeProvider]);

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
