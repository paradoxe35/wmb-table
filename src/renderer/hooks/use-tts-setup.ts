import { useEffect, useRef } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/stores';
import { useTtsStore } from '@renderer/stores/tts.store';
import { browserTts } from '@renderer/services/browser-tts';
import { ttsAudioPlayer } from '@renderer/services/tts-audio-player';
import {
    DEFAULT_TTS_PROVIDER,
    SEGMENT_GAP_MS,
    type TtsIncompatibilityReason,
} from '@shared/tts.types';

function getIncompatibilityMessage(
    reason: TtsIncompatibilityReason | undefined,
    t: (k: string) => string,
): string {
    switch (reason) {
        case 'not_configured':
            return t(
                "Ce fournisseur n'est pas configuré. Ajoutez une clé API dans les paramètres de Lecture audio.",
            );
        case 'model_not_downloaded':
            return t(
                "Le modèle vocal n'est pas téléchargé. Téléchargez-le dans les paramètres de Lecture audio.",
            );
        case 'no_model_for_language':
            return t(
                'Le modèle sélectionné ne prend pas en charge cette langue. Changez de modèle dans les paramètres de Lecture audio.',
            );
        case 'unsupported_language':
            return t('Ce fournisseur ne prend pas en charge cette langue.');
        default:
            return t('Ce fournisseur ne peut pas lire cette langue.');
    }
}

/**
 * Top-level TTS hook: settings, auto-switch, language checks, and IPC listeners.
 * Called once in App — not per document view.
 */
export function useTtsSetup(): void {
    const { t } = useTranslation();
    const activeLanguage = useAppStore((s) => s.activeLanguage);
    const settings = useTtsStore((s) => s.settings);
    const settingsLoaded = useRef(false);
    const recheckTrigger = useTtsStore((s) => s.recheckTrigger);

    // Load settings once
    useEffect(() => {
        if (!settingsLoaded.current) {
            settingsLoaded.current = true;
            window.api.tts.getSettings().then((s) => {
                useTtsStore.getState().setSettings(s);
            });
        }
    }, []);

    const activeProviderCfg = settings?.providers[settings.activeProvider ?? DEFAULT_TTS_PROVIDER];

    // Auto-switch voice on language change (provider switches handled in tts-tab)
    const prevLangRef = useRef<string | null>(null);
    useEffect(() => {
        if (!activeLanguage || !settings?.autoSwitchVoice) {
            return;
        }
        if (settings.activeProvider === 'browser') {
            return;
        }
        if (prevLangRef.current === activeLanguage) {
            return;
        }
        prevLangRef.current = activeLanguage;

        let cancelled = false;
        window.api.tts.resolveConfigForLanguage(activeLanguage).then((resolved) => {
            if (cancelled || !resolved) {
                return;
            }
            useTtsStore.getState().setSettings(resolved);
        });
        return () => {
            cancelled = true;
        };
    }, [activeLanguage, settings?.activeProvider, settings?.autoSwitchVoice]);

    // Language compatibility check
    useEffect(() => {
        if (!settings || !activeLanguage) {
            return;
        }

        let cancelled = false;
        const activeProvider = settings.activeProvider;

        const check = async () => {
            if (activeProvider === 'browser') {
                const supported = browserTts.supportsLanguage(activeLanguage);
                if (cancelled) {
                    return;
                }
                const store = useTtsStore.getState();
                store.setLanguageSupported(supported);
                store.setIncompatibleMessage(
                    supported
                        ? undefined
                        : t('Le navigateur ne dispose pas de voix pour cette langue.'),
                );
                return;
            }

            try {
                const results = await window.api.tts.checkLanguageSupport(activeLanguage);
                if (cancelled) {
                    return;
                }
                const result = results[activeProvider];
                const store = useTtsStore.getState();
                store.setLanguageSupported(result.supported);
                store.setIncompatibleMessage(
                    result.supported ? undefined : getIncompatibilityMessage(result.reason, t),
                );
            } catch {
                if (cancelled) {
                    return;
                }
                const store = useTtsStore.getState();
                store.setLanguageSupported(false);
                store.setIncompatibleMessage(
                    t('Impossible de vérifier la compatibilité du fournisseur.'),
                );
            }
        };

        check();

        // Browser voices may load asynchronously
        if (activeProvider === 'browser') {
            window.speechSynthesis.addEventListener('voiceschanged', check);
            return () => {
                cancelled = true;
                window.speechSynthesis.removeEventListener('voiceschanged', check);
            };
        }
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        activeLanguage,
        settings?.activeProvider,
        activeProviderCfg?.voiceId,
        activeProviderCfg?.model,
        activeProviderCfg?.apiKey,
        t,
        recheckTrigger,
    ]);

    // Re-check after model download
    useEffect(() => {
        return window.api.on.ttsModelDownloadProgress((p) => {
            if (p.status === 'complete') {
                useTtsStore.getState().triggerRecheck();
            }
        });
    }, []);

    // Playback state from main process
    useEffect(() => {
        return window.api.on.ttsPlaybackState((state) => {
            if (state.status === 'idle') {
                useTtsStore.getState().reset();
            } else {
                useTtsStore.getState().setPlaybackState(state);
            }
            if (state.status === 'error') {
                message.error(
                    t('La lecture audio a échoué. Vérifiez la configuration du fournisseur.'),
                );
            }
        });
    }, [t]);

    // Segment audio playback + segment completion (merged so they share gap-timer state)
    useEffect(() => {
        let pending = false;
        let gapTimeout: ReturnType<typeof setTimeout> | null = null;
        let pausedDuringGap = false;

        const clearGap = () => {
            if (gapTimeout) {
                clearTimeout(gapTimeout);
                gapTimeout = null;
            }
        };

        const playPreloadedAndNotify = () => {
            const current = useTtsStore.getState();
            if (current.status === 'idle' || current.status === 'paused') return;
            const rate = current.settings?.rate ?? 1;
            ttsAudioPlayer.playPreloaded(rate);
            if (!pending) {
                pending = true;
                window.api.tts.segmentComplete(true).finally(() => {
                    pending = false;
                });
            }
        };

        // Listen for stop/pause/resume to manage the gap timer
        const unsubStore = useTtsStore.subscribe((state) => {
            if (state.status === 'idle' || state.status === 'paused') {
                if (gapTimeout) {
                    clearGap();
                    pausedDuringGap = true;
                }
            }
            // Resume after pausing during the gap — play the preloaded buffer now
            if (state.status === 'playing' && pausedDuringGap) {
                pausedDuringGap = false;
                if (ttsAudioPlayer.hasPreloaded()) {
                    playPreloadedAndNotify();
                }
            }
        });

        // Receive audio from main — either play immediately or preload for later
        const unsubAudio = window.api.on.ttsSegmentAudio((data) => {
            const state = useTtsStore.getState();
            if (state.status === 'idle') return;

            if (data.queued) {
                ttsAudioPlayer.preload(data.audioBase64, data.mimeType, data.segmentIndex);
            } else {
                // A new non-queued segment means a fresh playback (start or seek).
                // Cancel any pending gap timer from the previous segment transition.
                clearGap();
                pausedDuringGap = false;
                ttsAudioPlayer.clearPreloaded();
                const rate = state.settings?.rate ?? 1;
                ttsAudioPlayer.play(data.audioBase64, data.mimeType, rate);
            }
        });

        // When a segment finishes playing, transition to the next one
        ttsAudioPlayer.setOnEnded(() => {
            const state = useTtsStore.getState();
            if (state.status === 'idle') return;

            const gapMs = state.settings?.segmentGapMs ?? SEGMENT_GAP_MS;

            if (ttsAudioPlayer.hasPreloaded()) {
                const onGapElapsed = () => {
                    gapTimeout = null;
                    playPreloadedAndNotify();
                };
                if (gapMs > 0) {
                    gapTimeout = setTimeout(onGapElapsed, gapMs);
                } else {
                    playPreloadedAndNotify();
                }
            } else {
                // No preloaded buffer — fall back to the original round-trip
                if (pending) return;
                pending = true;
                window.api.tts.segmentComplete().finally(() => {
                    pending = false;
                });
            }
        });

        return () => {
            unsubStore();
            unsubAudio();
            clearGap();
        };
    }, []);
}
