import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import log from 'electron-log';
import pLimit from 'p-limit';
import { getMainWindow } from '@main/lib/window';
import { sendToRenderer } from '@main/ipc/register';
import { PushChannels } from '@shared/ipc.types';
import { getTtsDemoText } from '@shared/tts-demo-texts';
import type { TtsProvider } from './provider';
import { TtsCache } from './tts-cache';
import type { CacheHit } from './tts-cache';
import { OpenAiProvider } from './openai.provider';
import { SherpaProvider } from './sherpa.provider';
import { ElevenLabsProvider } from './elevenlabs.provider';
import { EdgeProvider } from './edge.provider';
import { CartesiaProvider } from './cartesia.provider';
import { getTtsResourceDir } from '@main/lib/app-paths';
import * as ttsRepo from '@main/database/repositories/tts.repository';
import {
    type TtsProviderType,
    type TtsProviderInfo,
    type TtsSettings,
    type TtsSegment,
    type TtsSynthesizeRequest,
    type TtsSynthesizeResult,
    type TtsPlaybackStatus,
    type TtsCacheKey,
    type TtsModelInfo,
    type TtsVoice,
    type TtsVoiceCloneRequest,
    type TtsVoiceCloneResult,
    type TtsCompatibilityResult,
    TTS_REFERENCE_VOICES,
} from '@shared/tts.types';

/**
 * A prepared segment is either a disk cache reference (no RAM used)
 * or an already-synthesized result waiting to be sent.
 */
type PreparedSegment = CacheHit | TtsSynthesizeResult;

function isCacheHit(p: PreparedSegment): p is CacheHit {
    return 'path' in p && !('audioBase64' in p);
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

    async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        const providerType = request.provider ?? this.settings.activeProvider;
        if (providerType === 'browser') {
            throw new Error('Browser TTS synthesis is handled in the renderer process');
        }
        const provider = this.providers.get(providerType);
        if (!provider) throw new Error(`Unknown TTS provider: ${providerType}`);

        const cfg = this.settings.providers[providerType];
        const cacheKey = this.buildCacheKey(
            providerType,
            request.text,
            request.language,
            request.voiceId ?? cfg?.voiceId ?? '',
            request.model ?? cfg?.model ?? '',
            request.rate ?? this.settings.rate,
        );
        const hit = await this.cache.lookup(cacheKey);
        if (hit) return await this.cache.read(hit);

        const result = await provider.synthesize(request);
        await this.cache.set(cacheKey, result);
        return result;
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
            throw new Error(`Provider ${providerType} does not support model download`);
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
            throw new Error(`Provider ${providerType} does not support model deletion`);
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
            throw new Error(`Provider ${providerType} does not support voice cloning`);
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

    async previewVoice(language: string): Promise<TtsSynthesizeResult> {
        await this.reloadSettings();
        const providerType = this.settings.activeProvider;
        if (providerType === 'browser') {
            throw new Error('Browser TTS preview is handled in the renderer process');
        }
        const provider = this.providers.get(providerType);
        if (!provider) throw new Error(`Unknown TTS provider: ${providerType}`);

        const cfg = this.settings.providers[providerType];
        const text = getTtsDemoText(language);
        return provider.previewVoice({
            text,
            language,
            voiceId: cfg?.voiceId,
            model: cfg?.model,
            rate: 1,
        });
    }

    async deleteClonedVoice(providerType: TtsProviderType, voiceId: string): Promise<void> {
        const provider = this.providers.get(providerType);
        if (!provider?.deleteClonedVoice) {
            throw new Error(`Provider ${providerType} does not support voice cloning`);
        }
        return provider.deleteClonedVoice(voiceId);
    }

    getReferenceVoiceAudio(referenceId: string): string {
        const ref = TTS_REFERENCE_VOICES.find((v) => v.id === referenceId);
        if (!ref) {
            throw new Error(`Unknown reference voice: ${referenceId}`);
        }
        const filePath = join(getTtsResourceDir(), ref.fileName);
        return readFileSync(filePath).toString('base64');
    }

    async dispose(): Promise<void> {
        await this.cache.flush();
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

    /** Synthesize and queue a segment to the renderer. Retries once on failure. */
    private async prepareAndQueue(index: number, generation: number): Promise<void> {
        for (let attempt = 0; attempt < 2; attempt++) {
            if (generation !== this.playbackGeneration) return;
            try {
                const segment = this.segments[index];
                if (!segment) return;

                const prepared = await this.prepareSegment(segment);
                if (generation !== this.playbackGeneration) return;

                const result = isCacheHit(prepared) ? await this.cache.read(prepared) : prepared;
                if (generation !== this.playbackGeneration) return;

                const win = getMainWindow();
                if (win) {
                    sendToRenderer(win, PushChannels.ttsSegmentAudio, {
                        segmentIndex: index,
                        audioBase64: result.audioBase64,
                        mimeType: result.mimeType,
                        queued: true,
                    });
                }
                return; // success
            } catch (err) {
                if (attempt === 0) {
                    log.warn(`TTS prefetch ${index} failed, retrying:`, err);
                } else {
                    log.error(`TTS prefetch ${index} failed after retry:`, err);
                }
            }
        }
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
            const prepared = await this.prepareSegment(this.segments[index]);
            if (generation !== this.playbackGeneration) return;

            await this.playPreparedSegment(index, prepared, generation);
        } catch (err) {
            if (generation !== this.playbackGeneration) return;
            log.error('TTS playSegment error:', err);
            this.status = 'error';
            this.lastError = err instanceof Error ? err.message : 'Erreur inconnue';
            this.pushState();
        }
    }

    private async playPreparedSegment(
        index: number,
        prepared: PreparedSegment,
        generation: number,
    ): Promise<void> {
        this.currentIndex = index;

        const result = isCacheHit(prepared) ? await this.cache.read(prepared) : prepared;
        if (generation !== this.playbackGeneration) return;

        const win = getMainWindow();
        if (win) {
            sendToRenderer(win, PushChannels.ttsSegmentAudio, {
                segmentIndex: index,
                audioBase64: result.audioBase64,
                mimeType: result.mimeType,
                // No `queued` flag — renderer plays this immediately.
            });
        }

        this.status = 'playing';
        this.pushState();
    }

    /**
     * Synthesize a segment: returns a disk CacheHit (zero RAM) if cached,
     * or a fresh TtsSynthesizeResult after network/local synthesis.
     */
    private async prepareSegment(segment: TtsSegment): Promise<PreparedSegment> {
        const s = this.playbackSettings ?? this.settings;
        const providerType = s.activeProvider;
        const provider = this.providers.get(providerType);
        if (!provider) throw new Error(`Provider not found: ${providerType}`);

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
        this.cache.set(cacheKey, result).catch(() => {});
        return result;
    }

    private buildCacheKey(
        provider: TtsProviderType,
        text: string,
        language: string,
        voiceId: string,
        model: string,
        rate: number,
    ): TtsCacheKey {
        const hash = createHash('sha256').update(text).digest('hex').substring(0, 16);
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
