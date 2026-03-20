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
    const contentLanguage = useAppStore((s) => s.contentLanguage);
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
        if (!contentLanguage || !settings?.autoSwitchVoice) {
            return;
        }
        if (settings.activeProvider === 'browser') {
            return;
        }
        if (prevLangRef.current === contentLanguage) {
            return;
        }
        prevLangRef.current = contentLanguage;

        let cancelled = false;
        window.api.tts.resolveConfigForLanguage(contentLanguage).then((resolved) => {
            if (cancelled || !resolved) {
                return;
            }
            useTtsStore.getState().setSettings(resolved);
        });
        return () => {
            cancelled = true;
        };
    }, [contentLanguage, settings?.activeProvider, settings?.autoSwitchVoice]);

    // Language compatibility check
    useEffect(() => {
        if (!settings || !contentLanguage) {
            return;
        }

        let cancelled = false;
        const activeProvider = settings.activeProvider;

        const check = async () => {
            if (activeProvider === 'browser') {
                const supported = browserTts.supportsLanguage(contentLanguage);
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
                const results = await window.api.tts.checkLanguageSupport(contentLanguage);
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
        contentLanguage,
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
                if (state.completedNaturally) {
                    // Natural end: signal consumers AND clear resume position
                    // so the next play starts from the beginning with intro.
                    useTtsStore.setState({
                        completedNaturally: true,
                        lastStoppedDocumentId: null,
                        lastStoppedSegmentIndex: 0,
                    });
                }
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

    // Segment audio playback + segment completion
    useEffect(() => {
        let pending = false;
        let gapTimeout: ReturnType<typeof setTimeout> | null = null;
        let pausedDuringGap = false;

        // The segment index we are waiting for when synthesis is still in flight.
        // -1 = not waiting. Set in onEnded; cleared when that segment's audio
        // arrives and playback is scheduled.
        let waitingForSegmentIndex = -1;

        // When onEnded fired — used to honour the gap even when audio arrives late.
        let endedAt = 0;

        // Locally tracked index of the segment that is currently (or was last) playing.
        // We do NOT use state.currentSegmentIndex from the store here because that value
        // is updated by an IPC round-trip (notifySegmentComplete → main → pushState →
        // renderer). If onEnded fires before the push arrives the store is stale, causing
        // `expected` to point to the segment that was just played instead of the next one,
        // which produces a deadlock where we wait forever for audio that already played.
        let lastPlayedSegmentIndex = -1;

        const clearGap = () => {
            if (gapTimeout) {
                clearTimeout(gapTimeout);
                gapTimeout = null;
            }
        };

        const notifySegmentComplete = () => {
            if (pending) return;
            pending = true;
            window.api.tts.segmentComplete().finally(() => {
                pending = false;
            });
        };

        /**
         * Play the front of the preloaded queue and notify the main process.
         * This is the single place that calls notifySegmentComplete — called only
         * after audio has actually started playing, so main state stays in sync.
         */
        const playPreloadedAndNotify = () => {
            gapTimeout = null;
            const current = useTtsStore.getState();
            if (current.status === 'idle' || current.status === 'paused') return;
            const rate = current.settings?.rate ?? 1;
            const played = ttsAudioPlayer.playPreloaded(rate);
            if (played < 0) return; // queue was empty — stop/seek raced the gap timer
            lastPlayedSegmentIndex = played;
            notifySegmentComplete();
        };

        /**
         * Schedule playback of the next preloaded segment respecting the gap.
         * `alreadyWaited` is how many ms have already elapsed since onEnded —
         * used so the total silence is always segmentGapMs, not gapMs + synthesis time.
         */
        const schedulePlay = (alreadyWaited = 0) => {
            const gapMs = useTtsStore.getState().settings?.segmentGapMs ?? SEGMENT_GAP_MS;
            const remaining = Math.max(0, gapMs - alreadyWaited);
            if (remaining > 0) {
                gapTimeout = setTimeout(playPreloadedAndNotify, remaining);
            } else {
                playPreloadedAndNotify();
            }
        };

        // Manage gap timer and waiting state on stop / pause / resume
        const unsubStore = useTtsStore.subscribe((state) => {
            if (state.status === 'idle') {
                // Hard stop: reset everything
                clearGap();
                waitingForSegmentIndex = -1;
                pausedDuringGap = false;
                lastPlayedSegmentIndex = -1;
            } else if (state.status === 'paused') {
                if (gapTimeout) {
                    clearGap();
                    pausedDuringGap = true;
                }
                // Paused while waiting for late audio — treat like a gap pause so
                // the resume path re-checks (or re-enters waiting mode).
                if (waitingForSegmentIndex >= 0) {
                    pausedDuringGap = true;
                    // Keep waitingForSegmentIndex so resume knows which segment to check.
                }
            } else if (state.status === 'playing' && pausedDuringGap) {
                pausedDuringGap = false;
                if (waitingForSegmentIndex >= 0) {
                    // Resuming from a waiting-for-audio pause
                    if (ttsAudioPlayer.hasPreloadedAtIndex(waitingForSegmentIndex)) {
                        // Audio arrived while paused — play now
                        waitingForSegmentIndex = -1;
                        schedulePlay();
                    }
                    // else: audio still hasn't arrived; ttsSegmentAudio.then() will
                    // trigger schedulePlay when it does (waitingForSegmentIndex stays set)
                } else if (ttsAudioPlayer.hasPreloaded()) {
                    // Resuming from a normal gap-timer pause
                    schedulePlay();
                }
            }
        });

        // Receive audio from main — play immediately (non-queued) or preload (queued)
        const unsubAudio = window.api.on.ttsSegmentAudio((data) => {
            const state = useTtsStore.getState();
            if (state.status === 'idle') return;

            if (data.queued) {
                ttsAudioPlayer
                    .preload(data.audioBase64, data.mimeType, data.segmentIndex)
                    .then(() => {
                        // Only act if we're waiting and the correct segment just arrived.
                        if (waitingForSegmentIndex < 0) return;
                        if (!ttsAudioPlayer.hasPreloadedAtIndex(waitingForSegmentIndex)) return;
                        // Don't auto-play while paused — resume handler will do it.
                        if (useTtsStore.getState().status === 'paused') return;

                        const elapsed = Date.now() - endedAt;
                        waitingForSegmentIndex = -1;
                        schedulePlay(elapsed);
                    });
            } else {
                // Non-queued = fresh playback (start or seek). Reset all state.
                clearGap();
                waitingForSegmentIndex = -1;
                pausedDuringGap = false;
                lastPlayedSegmentIndex = data.segmentIndex;
                ttsAudioPlayer.clearPreloaded();
                const rate = state.settings?.rate ?? 1;
                ttsAudioPlayer.play(data.audioBase64, data.mimeType, rate);
            }
        });

        // When a segment finishes, transition to the next one
        ttsAudioPlayer.setOnEnded(() => {
            const state = useTtsStore.getState();
            if (state.status === 'idle') return;

            clearGap();
            endedAt = Date.now();

            const expected = lastPlayedSegmentIndex + 1;

            if (ttsAudioPlayer.hasPreloadedAtIndex(expected)) {
                // Happy path: next segment is already pre-decoded → play after gap.
                // notifySegmentComplete is called inside playPreloadedAndNotify.
                schedulePlay();
            } else {
                // Synthesis still in flight. Save the expected index and wait.
                // Do NOT call notifySegmentComplete here — that would advance the
                // main process state before playback starts, causing a double-advance
                // when playPreloadedAndNotify calls it again, which would skip a segment.
                waitingForSegmentIndex = expected;
            }
        });

        return () => {
            unsubStore();
            unsubAudio();
            clearGap();
        };
    }, []);
}
