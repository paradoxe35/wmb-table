import { createHash } from 'node:crypto';
import log from 'electron-log';
import { getMainWindow } from '@main/lib/window';
import { sendToRenderer } from '@main/ipc/register';
import { PushChannels } from '@shared/ipc.types';
import type { TtsProvider } from './provider';
import { TtsCache } from './tts-cache';
import type { CacheHit } from './tts-cache';
import { OpenAiProvider } from './openai.provider';
import { KokoroProvider } from './kokoro.provider';
import { QwenProvider } from './qwen.provider';
import * as ttsRepo from '@main/database/repositories/tts.repository';
import type {
    TtsProviderType,
    TtsProviderInfo,
    TtsSettings,
    TtsSegment,
    TtsSynthesizeRequest,
    TtsSynthesizeResult,
    TtsPlaybackStatus,
    TtsCacheKey,
    TtsVoice,
    TtsVoiceCloneRequest,
    TtsVoiceCloneResult,
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
    private prefetchQueue = new Map<number, Promise<PreparedSegment>>();

    constructor() {
        this.settings = ttsRepo.ensureSettings();
        this.cache = new TtsCache(this.settings.cacheMaxSizeMb);
        this.initProviders();
    }

    private initProviders(): void {
        const kokoro = new KokoroProvider();
        const qwen = new QwenProvider();
        const openai = new OpenAiProvider();

        this.providers.set('kokoro', kokoro);
        this.providers.set('qwen', qwen);
        this.providers.set('openai', openai);

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

    async startPlayback(segments: TtsSegment[], language: string): Promise<void> {
        this.playbackGeneration++;
        this.segments = segments;
        this.currentIndex = 0;
        this.currentLanguage = language;
        this.status = 'playing';
        this.prefetchQueue.clear();
        this.pushState();
        await this.playSegment(0, this.playbackGeneration);
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

    stop(): void {
        this.playbackGeneration++;
        this.status = 'idle';
        this.segments = [];
        this.currentIndex = 0;
        this.prefetchQueue.clear();
        this.pushState();
    }

    seekToSegment(index: number): void {
        if (index < 0 || index >= this.segments.length) return;
        this.playbackGeneration++;
        this.currentIndex = index;
        this.status = 'playing';
        this.prefetchQueue.clear();
        this.pushState();
        this.playSegment(index, this.playbackGeneration).catch((err) => {
            log.error('TTS seekToSegment playback error:', err);
        });
    }

    async onSegmentComplete(): Promise<void> {
        if (this.status === 'playing') {
            const nextIndex = this.currentIndex + 1;
            if (nextIndex >= this.segments.length) {
                this.stop();
                return;
            }
            await this.playSegment(nextIndex, this.playbackGeneration);
        }
    }

    checkLanguageSupport(langCode: string): Record<TtsProviderType, boolean> {
        const result: Record<TtsProviderType, boolean> = {
            browser: true,
            kokoro: false,
            qwen: false,
            openai: false,
        };
        for (const [type, provider] of this.providers) {
            result[type] = provider.supportsLanguage(langCode);
        }
        return result;
    }

    async downloadModel(providerType: TtsProviderType): Promise<void> {
        const provider = this.providers.get(providerType);
        if (!provider?.downloadModel) {
            throw new Error(`Provider ${providerType} does not support model download`);
        }
        const win = getMainWindow();
        await provider.downloadModel((percentage) => {
            if (win) {
                sendToRenderer(win, PushChannels.ttsModelDownloadProgress, {
                    provider: providerType,
                    percentage,
                    status: percentage >= 100 ? 'complete' : 'downloading',
                });
            }
        });
    }

    async getModelStatus(
        providerType: TtsProviderType,
    ): Promise<{ downloaded: boolean; sizeBytes: number }> {
        const provider = this.providers.get(providerType);
        return {
            downloaded: (await provider?.isModelReady?.()) ?? false,
            sizeBytes: 0,
        };
    }

    async clearCache(): Promise<void> {
        await this.cache.clear();
    }

    getCacheSize(): number {
        return this.cache.getSize();
    }

    async cloneVoice(request: TtsVoiceCloneRequest): Promise<TtsVoiceCloneResult> {
        const qwen = this.providers.get('qwen') as QwenProvider | undefined;
        if (!qwen) throw new Error('Qwen provider not available');
        return qwen.cloneVoice(request);
    }

    async listClonedVoices(): Promise<TtsVoice[]> {
        const qwen = this.providers.get('qwen') as QwenProvider | undefined;
        if (!qwen) return [];
        return qwen.listClonedVoices();
    }

    async deleteClonedVoice(voiceId: string): Promise<void> {
        const qwen = this.providers.get('qwen') as QwenProvider | undefined;
        if (!qwen) throw new Error('Qwen provider not available');
        return qwen.deleteClonedVoice(voiceId);
    }

    async dispose(): Promise<void> {
        await this.cache.flush();
        for (const provider of this.providers.values()) {
            provider.dispose();
        }
    }

    // ── Private ──

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

            // Abort if playback was stopped or restarted while awaiting synthesis
            if (generation !== this.playbackGeneration) return;

            // Resolve to TtsSynthesizeResult — read from disk only now
            const result = isCacheHit(prepared) ? await this.cache.read(prepared) : prepared;

            const win = getMainWindow();
            if (win) {
                sendToRenderer(win, PushChannels.ttsSegmentAudio, {
                    segmentIndex: index,
                    audioBase64: result.audioBase64,
                    mimeType: result.mimeType,
                    duration: result.duration,
                });
            }
            // result (and its audioBase64) goes out of scope here → eligible for GC

            this.status = 'playing';
            this.pushState();

            // Prefetch stores disk references, not audio buffers
            this.prefetch(index + 1);
            this.prefetch(index + 2);
        } catch (err) {
            if (generation !== this.playbackGeneration) return;
            log.error('TTS playSegment error:', err);
            this.status = 'error';
            this.lastError = err instanceof Error ? err.message : 'Erreur inconnue';
            this.pushState();
        }
    }

    /**
     * Prepare a segment for playback: returns a CacheHit (disk reference, zero RAM)
     * or a TtsSynthesizeResult (just synthesized, will be cached to disk).
     */
    private async prepareSegment(segment: TtsSegment): Promise<PreparedSegment> {
        // Check prefetch queue first
        const prefetched = this.prefetchQueue.get(segment.index);
        if (prefetched) {
            this.prefetchQueue.delete(segment.index);
            try {
                return await prefetched;
            } catch {
                // fall through to try again
            }
        }

        const providerOrder = [this.settings.activeProvider, ...this.settings.fallbackOrder];
        const tried = new Set<TtsProviderType>();

        for (const providerType of providerOrder) {
            if (tried.has(providerType) || providerType === 'browser') continue;
            tried.add(providerType);

            const provider = this.providers.get(providerType);
            if (!provider || !provider.supportsLanguage(this.currentLanguage)) continue;

            const cfg = this.settings.providers[providerType];
            if (!cfg?.enabled && providerType !== this.settings.activeProvider) continue;

            const cacheKey = this.buildCacheKey(
                providerType,
                segment.text,
                this.currentLanguage,
                cfg?.voiceId ?? '',
                cfg?.model ?? '',
                this.settings.rate,
            );

            // Check disk cache — returns a file reference, no audio loaded into RAM
            const hit = await this.cache.lookup(cacheKey);
            if (hit) return hit;

            try {
                const result = await provider.synthesize({
                    text: segment.text,
                    language: this.currentLanguage,
                    voiceId: cfg?.voiceId,
                    model: cfg?.model,
                    rate: this.settings.rate,
                });
                // Write to disk cache immediately, so future lookups return disk refs
                await this.cache.set(cacheKey, result);
                // Return a disk reference instead of keeping result in memory
                const freshHit = await this.cache.lookup(cacheKey);
                if (freshHit) return freshHit;
                return result;
            } catch (err) {
                log.error(`TTS provider ${providerType} failed:`, err);
                continue;
            }
        }
        throw new Error('All TTS providers failed');
    }

    private prefetch(index: number): void {
        if (index >= this.segments.length || this.prefetchQueue.has(index)) return;
        this.prefetchQueue.set(
            index,
            this.prepareSegment(this.segments[index]).catch((err) => {
                log.warn(`TTS prefetch ${index} failed:`, err);
                throw err;
            }),
        );
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
            model: model || 'default',
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
            provider: this.settings.activeProvider,
            error: this.status === 'error' ? this.lastError : undefined,
        });
    }
}
