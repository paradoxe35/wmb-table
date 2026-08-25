import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import log from 'electron-log';
import pLimitModule from 'p-limit';
import { getMainWindow } from '@main/lib/window';
import { sendToRenderer } from '@main/ipc/register';
import { PushChannels } from '@shared/ipc.types';
import { getTtsDemoText } from '@shared/tts-demo-texts';
import type { TtsProvider } from './provider';
import { TtsCache } from './tts-cache';
import { disposeSilenceTrimming } from './silence';
import type { CacheHit } from './tts-cache';
import { OpenAiProvider } from './openai.provider';
import { SherpaProvider } from './sherpa.provider';
import { ElevenLabsProvider } from './elevenlabs.provider';
import { EdgeProvider } from './edge.provider';
import { CartesiaProvider } from './cartesia.provider';
import { getTtsCacheDir, getTtsResourceDir } from '@main/lib/app-paths';
import * as ttsRepo from '@main/database/repositories/tts.repository';
import {
    type TtsProviderType,
    type TtsProviderInfo,
    type TtsSettings,
    type TtsSegment,
    type TtsSynthesizeResult,
    type TtsPlaybackStatus,
    type TtsCacheKey,
    type TtsModelInfo,
    type TtsVoice,
    type TtsVoiceCloneRequest,
    type TtsVoiceCloneResult,
    type TtsReferenceVoiceAudio,
    type TtsCompatibilityResult,
    TTS_REFERENCE_VOICES,
} from '@shared/tts.types';
import { resolveDefaultExport } from '@main/lib/module-interop';
import { retryNetworkCall } from '@main/lib/network-retry';

const pLimit = resolveDefaultExport(pLimitModule);

/** A prepared playback segment is always a disk cache reference. */
type PreparedSegment = CacheHit;

/** Bump when audio processing changes, to supersede cached segments. */
const AUDIO_PIPELINE_VERSION = 'sherpa-language-v2';

function getReferenceVoiceMimeType(fileName: string): string {
    switch (extname(fileName).toLowerCase()) {
        case '.mp3':
            return 'audio/mpeg';
        case '.wav':
            return 'audio/wav';
        case '.m4a':
            return 'audio/mp4';
        case '.aac':
            return 'audio/aac';
        case '.ogg':
            return 'audio/ogg';
        default:
            return 'application/octet-stream';
    }
}

export class TtsService {
    private providers = new Map<TtsProviderType, TtsProvider>();
    private cache: TtsCache;
    private settings: TtsSettings;
    private segments: TtsSegment[] = [];
    private currentIndex = 0;
    private currentLanguage = '';
    private status: TtsPlaybackStatus = 'idle';
    private lastError?: string;
    private playbackGeneration = 0;
    private completedNaturally = false;
    private readonly modelDownloadLimit = pLimit(1);
    private readonly activeModelDownloads = new Map<string, Promise<void>>();

    /** Frozen copy of settings at playback start — immune to mid-session provider switches. */
    private playbackSettings: TtsSettings | null = null;

    /**
     * How many segments ahead to synthesize and queue in the renderer.
     * All start concurrently — the renderer receives each as soon as it's ready.
     */
    private static readonly LOOKAHEAD = 4;

    /**
     * Tracks which segment indices have already been submitted for synthesis
     * in the current playback session. Prevents duplicate synthesis when
     * ensureWindow is called repeatedly as segments are consumed.
     */
    private prepared = new Set<number>();

    private static readonly PREFETCH_RETRY_BUDGET_MS = 120_000;
    private static readonly PREFETCH_RETRY_MIN_MS = 1_000;
    private static readonly PREFETCH_RETRY_MAX_MS = 15_000;

    constructor() {
        this.settings = ttsRepo.ensureSettings();
        this.cache = new TtsCache(this.settings.cacheMaxSizeMb);
        this.initProviders();
    }

    private initProviders(): void {
        const sherpa = new SherpaProvider();
        const elevenlabs = new ElevenLabsProvider();
        const openai = new OpenAiProvider();
        const edge = new EdgeProvider();
        const cartesia = new CartesiaProvider();

        this.providers.set('sherpa', sherpa);
        this.providers.set('elevenlabs', elevenlabs);
        this.providers.set('openai', openai);
        this.providers.set('edge', edge);
        this.providers.set('cartesia', cartesia);

        for (const [type, provider] of this.providers) {
            const cfg = this.settings.providers[type];
            if (cfg) provider.setConfig(cfg);
        }
    }

    async reloadSettings(): Promise<void> {
        this.settings = ttsRepo.ensureSettings();
        await this.cache.setMaxSize(this.settings.cacheMaxSizeMb);
        for (const [type, provider] of this.providers) {
            const cfg = this.settings.providers[type];
            if (cfg) provider.setConfig(cfg);
        }
    }

    async getProviderInfos(): Promise<TtsProviderInfo[]> {
        const browserInfo: TtsProviderInfo = {
            type: 'browser',
            locality: 'local',
            displayName: 'Navigateur (SpeechSynthesis)',
            supportedLanguages: [],
            supportsVoiceCloning: false,
            supportsStreaming: false,
            voices: [],
            defaultModel: null,
            availableModels: [],
            requiresApiKey: false,
            requiresModelDownload: false,
        };

        const providerInfos = await Promise.all(
            [...this.providers.values()].map((p) => p.getInfo()),
        );
        return [browserInfo, ...providerInfos];
    }

    async startPlayback(segments: TtsSegment[], language: string, startIndex = 0): Promise<void> {
        await this.reloadSettings();
        await this.resolvePlaybackConfigForLanguage(language);

        this.playbackGeneration++;
        this.segments = segments;
        this.currentIndex = startIndex;
        this.currentLanguage = language;
        this.status = 'playing';
        this.completedNaturally = false;
        this.prepared.clear();
        this.playbackSettings = { ...this.settings };
        this.pushState();

        // Non-queued audio must be sent before queued audio (renderer calls
        // clearPreloaded() on non-queued arrival), so await before prefetching.
        await this.playSegment(startIndex, this.playbackGeneration);
        this.ensureWindow(startIndex + 1, this.playbackGeneration);
    }

    private async resolvePlaybackConfigForLanguage(language: string): Promise<void> {
        if (!this.settings.autoSwitchVoice) {
            return;
        }

        const providerType = this.settings.activeProvider;
        const activeProvider = this.providers.get(providerType);
        if (!activeProvider?.resolveConfigForLanguage) {
            return;
        }

        const cfg = this.settings.providers[providerType];
        const resolved = await activeProvider.resolveConfigForLanguage(language, cfg);
        if (!resolved) {
            return;
        }

        ttsRepo.updateSettings({
            providers: {
                ...this.settings.providers,
                [providerType]: { ...cfg, ...resolved },
            },
        });
        await this.reloadSettings();
    }

    pause(): void {
        this.status = 'paused';
        this.pushState();
    }

    resume(): void {
        if (this.status === 'paused') {
            this.status = 'playing';
            this.pushState();
        }
    }

    stop(completedNaturally = false): void {
        this.playbackGeneration++;
        this.status = 'idle';
        this.completedNaturally = completedNaturally;
        this.segments = [];
        this.currentIndex = 0;
        this.prepared.clear();
        this.playbackSettings = null;
        this.pushState();
    }

    async seekToSegment(index: number): Promise<void> {
        if (index < 0 || index >= this.segments.length) return;
        this.playbackGeneration++;
        this.prepared.clear();
        this.currentIndex = index;
        this.status = 'playing';
        this.pushState();

        try {
            await this.playSegment(index, this.playbackGeneration);
        } catch (err) {
            log.error('TTS seekToSegment playback error:', err);
            return;
        }
        this.ensureWindow(index + 1, this.playbackGeneration);
    }

    async onSegmentComplete(): Promise<void> {
        if (this.status !== 'playing') return;

        const nextIndex = this.currentIndex + 1;
        if (nextIndex >= this.segments.length) {
            this.stop(true);
            return;
        }

        this.currentIndex = nextIndex;
        this.status = 'playing';
        this.pushState();

        this.ensureWindow(nextIndex + 1, this.playbackGeneration);
    }

    async resolveConfigForLanguage(language: string): Promise<TtsSettings | null> {
        await this.reloadSettings();
        const activeProvider = this.settings.activeProvider;
        const provider = this.providers.get(activeProvider);
        if (!provider?.resolveConfigForLanguage) return null;

        const cfg = this.settings.providers[activeProvider];
        const resolved = await provider.resolveConfigForLanguage(language, cfg);
        if (!resolved) {
            return null;
        }

        ttsRepo.updateSettings({
            providers: {
                ...this.settings.providers,
                [activeProvider]: { ...cfg, ...resolved },
            },
        });
        await this.reloadSettings();
        return this.settings;
    }

    async checkLanguageSupport(
        langCode: string,
    ): Promise<Record<TtsProviderType, TtsCompatibilityResult>> {
        await this.reloadSettings();
        const result = {} as Record<TtsProviderType, TtsCompatibilityResult>;
        for (const [type, provider] of this.providers) {
            const cfg = this.settings.providers[type];
            try {
                result[type] = await provider.checkCompatibility(langCode, cfg);
            } catch (err) {
                log.warn(`TTS compatibility check failed for provider ${type}:`, err);
                result[type] = { supported: false };
            }
        }
        return result;
    }

    async downloadModel(providerType: TtsProviderType, modelName?: string): Promise<void> {
        const provider = this.providers.get(providerType);
        if (!provider?.downloadModel) {
            throw new Error('Ce fournisseur ne prend pas en charge le téléchargement de modèles.');
        }
        const downloadKey = `${providerType}:${modelName ?? ''}`;
        const existing = this.activeModelDownloads.get(downloadKey);
        if (existing) {
            await existing;
            return;
        }

        const job = this.modelDownloadLimit(async () => {
            try {
                await provider.downloadModel?.((progress) => {
                    this.pushModelDownloadProgress(providerType, modelName, {
                        percentage: progress.percentage,
                        status: 'downloading',
                        phase: progress.phase,
                    });
                }, modelName);

                this.pushModelDownloadProgress(providerType, modelName, {
                    percentage: 100,
                    status: 'complete',
                    phase: 'finalizing',
                });
            } catch (err) {
                this.pushModelDownloadProgress(providerType, modelName, {
                    percentage: 0,
                    status: 'error',
                    error: err instanceof Error ? err.message : String(err),
                });
                throw err;
            } finally {
                this.activeModelDownloads.delete(downloadKey);
            }
        });

        this.activeModelDownloads.set(downloadKey, job);
        await job;
    }

    private pushModelDownloadProgress(
        providerType: TtsProviderType,
        modelName: string | undefined,
        progress: {
            percentage: number;
            status: 'downloading' | 'complete' | 'error';
            phase?: 'downloading' | 'extracting' | 'finalizing';
            error?: string;
        },
    ): void {
        const win = getMainWindow();
        if (!win) {
            return;
        }

        sendToRenderer(win, PushChannels.ttsModelDownloadProgress, {
            provider: providerType,
            modelName,
            percentage: progress.percentage,
            status: progress.status,
            phase: progress.phase,
            error: progress.error,
        });
    }

    getProviderModels(providerType: TtsProviderType): TtsModelInfo[] {
        const provider = this.providers.get(providerType);
        return provider?.getAvailableModels?.() ?? [];
    }

    async deleteProviderModel(providerType: TtsProviderType, modelName: string): Promise<void> {
        const provider = this.providers.get(providerType);
        if (!provider?.deleteModel) {
            throw new Error('Ce fournisseur ne prend pas en charge la suppression de modèles.');
        }
        await provider.deleteModel(modelName);
    }

    async clearCache(): Promise<void> {
        await this.cache.clear();
    }

    getCacheSize(): number {
        return this.cache.getSize();
    }

    async cloneVoice(
        providerType: TtsProviderType,
        request: TtsVoiceCloneRequest,
    ): Promise<TtsVoiceCloneResult> {
        const provider = this.providers.get(providerType);
        if (!provider?.cloneVoice) {
            throw new Error('Ce fournisseur ne prend pas en charge le clonage de voix.');
        }
        return provider.cloneVoice(request);
    }

    async listClonedVoices(providerType: TtsProviderType): Promise<TtsVoice[]> {
        const provider = this.providers.get(providerType);
        if (!provider?.listClonedVoices) {
            return [];
        }
        return provider.listClonedVoices();
    }

    async previewVoice(language: string, voiceId?: string): Promise<TtsSynthesizeResult> {
        await this.reloadSettings();
        const providerType = this.settings.activeProvider;
        if (providerType === 'browser') {
            throw new Error(
                'La prévisualisation du navigateur est gérée dans le processus renderer.',
            );
        }
        const provider = this.providers.get(providerType);
        if (!provider) throw new Error('Fournisseur TTS inconnu.');

        const cfg = this.settings.providers[providerType];
        const text = getTtsDemoText(language);
        const preview = await provider.previewVoice({
            text,
            language,
            voiceId: voiceId ?? cfg?.voiceId,
            model: cfg?.model,
            rate: 1,
        });
        return provider.trimSilence(preview);
    }

    async deleteClonedVoice(providerType: TtsProviderType, voiceId: string): Promise<void> {
        const provider = this.providers.get(providerType);
        if (!provider?.deleteClonedVoice) {
            throw new Error('Ce fournisseur ne prend pas en charge le clonage de voix.');
        }
        return provider.deleteClonedVoice(voiceId);
    }

    getReferenceVoiceAudio(referenceId: string): TtsReferenceVoiceAudio {
        const ref = TTS_REFERENCE_VOICES.find((v) => v.id === referenceId);
        if (!ref) {
            throw new Error('Voix de référence introuvable.');
        }
        const filePath = join(getTtsResourceDir(), ref.fileName);
        return {
            audioBase64: readFileSync(filePath).toString('base64'),
            mimeType: getReferenceVoiceMimeType(ref.fileName),
        };
    }

    async dispose(): Promise<void> {
        await this.cache.flush();
        disposeSilenceTrimming();
        for (const provider of this.providers.values()) {
            provider.dispose();
        }
    }

    // ── Private ──

    /**
     * Ensure segments [fromIndex, fromIndex + LOOKAHEAD) are all being synthesized
     * concurrently. Each one, when ready, is immediately sent to the renderer as a
     * queued (pre-decoded) segment. Segments already submitted are skipped via the
     * `prepared` set, so calling this repeatedly is safe and cheap.
     */
    private ensureWindow(fromIndex: number, generation: number): void {
        const end = Math.min(fromIndex + TtsService.LOOKAHEAD, this.segments.length);
        for (let i = fromIndex; i < end; i++) {
            if (this.prepared.has(i)) continue;
            this.prepared.add(i); // claim slot before async work to prevent races
            this.prepareAndQueue(i, generation).catch(() => {});
        }
    }

    /**
     * Retries while the budget lasts, so a network outage resumes by itself once it ends.
     * Giving up un-claims the slot, letting a later window or the user try again.
     */
    private async prepareAndQueue(index: number, generation: number): Promise<void> {
        const segment = this.segments[index];
        if (!segment) return;

        try {
            const prepared = await retryNetworkCall(() => this.prepareSegment(segment), {
                label: `TTS prefetch ${index}`,
                retries: Number.POSITIVE_INFINITY,
                maxRetryTimeMs: TtsService.PREFETCH_RETRY_BUDGET_MS,
                minTimeoutMs: TtsService.PREFETCH_RETRY_MIN_MS,
                maxTimeoutMs: TtsService.PREFETCH_RETRY_MAX_MS,
                shouldContinue: () => generation === this.playbackGeneration,
            });
            if (generation !== this.playbackGeneration) return;

            const win = getMainWindow();
            if (win) {
                sendToRenderer(
                    win,
                    PushChannels.ttsSegmentAudio,
                    this.toSegmentAudioPayload(index, prepared, true),
                );
            }
        } catch (err) {
            if (generation !== this.playbackGeneration) return;
            this.prepared.delete(index);
            log.error(`TTS prefetch ${index} gave up:`, err);
            this.failPlayback(err);
        }
    }

    private failPlayback(error: unknown): void {
        this.status = 'error';
        this.lastError = error instanceof Error ? error.message : 'Erreur inconnue';
        this.pushState();
    }

    private async playSegment(index: number, generation: number): Promise<void> {
        if (index >= this.segments.length) {
            this.stop();
            return;
        }
        this.currentIndex = index;
        this.status = 'loading';
        this.pushState();

        try {
            const prepared = await this.prepareSegmentForPlayback(index, generation);
            if (generation !== this.playbackGeneration) return;

            await this.playPreparedSegment(index, prepared);
        } catch (err) {
            if (generation !== this.playbackGeneration) return;
            log.error('TTS playSegment error:', err);
            this.status = 'error';
            this.lastError = err instanceof Error ? err.message : 'Erreur inconnue';
            this.pushState();
        }
    }

    private async prepareSegmentForPlayback(
        index: number,
        generation: number,
    ): Promise<PreparedSegment> {
        let lastError: unknown;

        for (let attempt = 0; attempt < 2; attempt++) {
            if (generation !== this.playbackGeneration) {
                throw new Error('Lecture TTS interrompue.');
            }

            try {
                const segment = this.segments[index];
                if (!segment) {
                    throw new Error('Segment TTS introuvable.');
                }

                return await this.prepareSegment(segment);
            } catch (error) {
                lastError = error;
                if (attempt === 0) {
                    log.warn(`TTS segment ${index} failed, retrying:`, error);
                }
            }
        }

        throw lastError;
    }

    private async playPreparedSegment(index: number, prepared: PreparedSegment): Promise<void> {
        this.currentIndex = index;

        const win = getMainWindow();
        if (win) {
            sendToRenderer(
                win,
                PushChannels.ttsSegmentAudio,
                this.toSegmentAudioPayload(index, prepared),
            );
        }

        this.status = 'playing';
        this.pushState();
    }

    /**
     * Synthesize a segment and materialize it into the disk cache so playback
     * can use file-backed audio instead of base64 IPC payloads.
     */
    private async prepareSegment(segment: TtsSegment): Promise<PreparedSegment> {
        const s = this.playbackSettings ?? this.settings;
        const providerType = s.activeProvider;
        const provider = this.providers.get(providerType);
        if (!provider) throw new Error('Fournisseur TTS introuvable.');

        const cfg = s.providers[providerType];
        // Synthesize at 1.0x — speed is applied in the renderer via playbackRate
        // so the user gets instant live feedback when adjusting the slider.
        const cacheKey = this.buildCacheKey(
            providerType,
            segment.text,
            this.currentLanguage,
            cfg?.voiceId ?? '',
            cfg?.model ?? '',
            1,
        );

        const hit = await this.cache.lookup(cacheKey);
        if (hit) return hit;

        const result = await provider.synthesize({
            text: segment.text,
            language: this.currentLanguage,
            voiceId: cfg?.voiceId,
            model: cfg?.model,
            rate: 1,
        });
        return this.cache.set(cacheKey, await provider.trimSilence(result));
    }

    private toSegmentAudioPayload(index: number, hit: CacheHit, queued = false) {
        const relativePath = relative(getTtsCacheDir(), hit.path)
            .split(sep)
            .map((part) => encodeURIComponent(part))
            .join('/');

        return {
            segmentIndex: index,
            audioUrl: `tts-cache://file/${relativePath}`,
            mimeType: hit.mimeType,
            ...(queued ? { queued: true } : {}),
        };
    }

    private buildCacheKey(
        provider: TtsProviderType,
        text: string,
        language: string,
        voiceId: string,
        model: string,
        rate: number,
    ): TtsCacheKey {
        const hash = createHash('sha256')
            .update(`${AUDIO_PIPELINE_VERSION}:${text}`)
            .digest('hex')
            .substring(0, 16);
        return {
            provider,
            model,
            voiceId: voiceId || 'default',
            language,
            rate,
            textHash: hash,
        };
    }

    private pushState(): void {
        const win = getMainWindow();
        if (!win) return;
        sendToRenderer(win, PushChannels.ttsPlaybackState, {
            status: this.status,
            currentSegmentIndex: this.currentIndex,
            totalSegments: this.segments.length,
            provider: (this.playbackSettings ?? this.settings).activeProvider,
            error: this.status === 'error' ? this.lastError : undefined,
            completedNaturally: this.status === 'idle' ? this.completedNaturally : undefined,
        });
    }
}
