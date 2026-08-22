import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { TtsProvider, TtsProviderDownloadProgress } from './provider';
import type {
    TtsCompatibilityResult,
    TtsVoiceCloneRequest,
    TtsVoiceCloneResult,
    TtsModelInfo,
    TtsProviderInfo,
    TtsProviderSettings,
    TtsProviderType,
    TtsSynthesizeRequest,
    TtsSynthesizeResult,
    TtsVoice,
} from '@shared/tts.types';
import { TTS_REFERENCE_VOICES, voiceLanguageCode } from '@shared/tts.types';
import {
    clonedIdOf,
    clonedVoiceName,
    pocketVoiceBundle,
    pocketVoiceId,
    pocketVoiceName,
    referenceIdOf,
    referenceVoiceName,
} from '@shared/pocket-voice-id';
import { getTtsModelsDir, getTtsResourceDir } from '@main/lib/app-paths';
import { WorkerRpc } from './worker-rpc';
import workerPath from './pocket.worker?modulePath';
import { trimWavSilence } from './silence';
import {
    POCKET_MODELS,
    POCKET_VOICES,
    VOICE_SIZE_MB,
    findModelByBundle,
    findModelForLanguage,
} from './pocket/catalog';
import { ensureVoice, isBundleInstalled } from './pocket/installer';
import {
    assertValidName,
    deleteClonedVoice,
    listClonedVoices,
    readClonedVoice,
    saveClonedVoice,
    type ClonedAudio,
} from './pocket/cloned-voices';
import { decodeWav } from './wav';
import type { VoiceSource } from './pocket/engine';

function modelsDir(): string {
    const dir = join(getTtsModelsDir(), 'pocket');
    mkdirSync(dir, { recursive: true });
    return dir;
}

function installedBundles(): string[] {
    const dir = modelsDir();
    if (!existsSync(dir)) return [];
    try {
        return readdirSync(dir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && isBundleInstalled(dir, entry.name))
            .map((entry) => entry.name);
    } catch {
        return [];
    }
}

function displayVoiceName(voice: string): string {
    const referenceId = referenceIdOf(voice);
    if (referenceId) {
        return TTS_REFERENCE_VOICES.find((entry) => entry.id === referenceId)?.name ?? referenceId;
    }
    return voice.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export class PocketProvider implements TtsProvider {
    readonly type: TtsProviderType = 'pocket';
    readonly trimSilence = trimWavSilence;
    private readonly rpc = new WorkerRpc(workerPath, 'pocket');
    private readonly referenceAudio = new Map<string, VoiceSource>();
    private voiceId = '';
    private loadedBundle = '';
    private loading: Promise<void> | null = null;

    async getInfo(): Promise<TtsProviderInfo> {
        const installed = installedBundles();
        const cloned = await listClonedVoices(modelsDir());
        const voices: TtsVoice[] = [];

        for (const bundle of installed) {
            const model = findModelByBundle(bundle);
            if (!model) continue;

            for (const voice of POCKET_VOICES) {
                voices.push({
                    id: pocketVoiceId(bundle, voice),
                    name: displayVoiceName(voice),
                    languageCodes: [model.langCode],
                });
            }
            for (const reference of TTS_REFERENCE_VOICES) {
                voices.push({
                    id: pocketVoiceId(bundle, referenceVoiceName(reference.id)),
                    name: reference.name,
                    languageCodes: [model.langCode],
                    isCloned: true,
                });
            }
            for (const name of cloned) {
                voices.push({
                    id: pocketVoiceId(bundle, clonedVoiceName(name)),
                    name,
                    languageCodes: [model.langCode],
                    isCloned: true,
                });
            }
        }

        return {
            type: 'pocket',
            locality: 'local',
            displayName: 'Pocket TTS (Kyutai)',
            supportedLanguages: installed
                .map((bundle) => findModelByBundle(bundle)?.langCode)
                .filter((code): code is string => Boolean(code)),
            supportsVoiceCloning: true,
            supportsStreaming: false,
            voices,
            defaultModel: installed[0] ?? null,
            availableModels: installed,
            requiresApiKey: false,
            requiresModelDownload: true,
            modelDownloaded: installed.length > 0,
        };
    }

    async checkCompatibility(
        langCode: string,
        cfg?: TtsProviderSettings,
    ): Promise<TtsCompatibilityResult> {
        const installed = installedBundles();
        if (installed.length === 0) return { supported: false, reason: 'model_not_downloaded' };

        const model = findModelForLanguage(voiceLanguageCode(langCode));
        if (!model) return { supported: false, reason: 'no_model_for_language' };
        if (!installed.includes(model.bundle)) {
            return { supported: false, reason: 'model_not_downloaded' };
        }
        if (cfg?.voiceId && pocketVoiceBundle(cfg.voiceId) !== model.bundle) {
            return { supported: false, reason: 'no_model_for_language' };
        }
        return { supported: true };
    }

    async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        const voiceId = request.voiceId || this.voiceId || this.defaultVoiceFor(request.language);
        if (!voiceId) throw new Error('Aucune voix Pocket TTS disponible.');

        const bundle = pocketVoiceBundle(voiceId);
        await this.ensureLoaded(bundle);

        const voice = await this.resolveVoice(bundle, pocketVoiceName(voiceId));
        const audioBase64 = await this.rpc.call<string>('synthesize', request.text, voice, {});
        return { audioBase64, mimeType: 'audio/wav' };
    }

    async previewVoice(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        return this.synthesize(request);
    }

    async downloadModel(
        onProgress: (progress: TtsProviderDownloadProgress) => void,
        modelName?: string,
    ): Promise<void> {
        const bundle = modelName ?? findModelForLanguage('fr')?.bundle;
        if (!bundle || !findModelByBundle(bundle)) {
            throw new Error('Modèle Pocket TTS inconnu.');
        }

        this.rpc.onProgressEvent = ({ percentage }) =>
            onProgress({ percentage, phase: 'downloading' });
        try {
            onProgress({ percentage: 0, phase: 'downloading' });
            await this.rpc.call<void>('downloadBundle', modelsDir(), bundle);
            onProgress({ percentage: 100, phase: 'finalizing' });
        } finally {
            this.rpc.onProgressEvent = null;
        }
    }

    async isModelReady(): Promise<boolean> {
        return installedBundles().length > 0;
    }

    getAvailableModels(): TtsModelInfo[] {
        const installed = new Set(installedBundles());
        return POCKET_MODELS.map((model) => ({
            langCode: [model.langCode],
            modelName: model.bundle,
            voiceName: model.displayName,
            installed: installed.has(model.bundle),
            engine: 'pocket',
            filesizeMb: model.filesizeMb,
        }));
    }

    async deleteModel(bundle: string): Promise<void> {
        if (this.loadedBundle === bundle) {
            await this.rpc.call('dispose').catch(() => {});
            this.loadedBundle = '';
        }
        await rm(join(modelsDir(), bundle), { recursive: true, force: true });
    }

    resolveConfigForLanguage(
        langCode: string,
        cfg?: TtsProviderSettings,
    ): Partial<TtsProviderSettings> | null {
        const model = findModelForLanguage(voiceLanguageCode(langCode));
        if (!model || !installedBundles().includes(model.bundle)) {
            return { voiceId: '', model: '' };
        }
        if (cfg?.voiceId && pocketVoiceBundle(cfg.voiceId) === model.bundle) return null;

        return {
            voiceId: pocketVoiceId(model.bundle, POCKET_VOICES[0]),
            model: model.bundle,
        };
    }

    setConfig(settings: TtsProviderSettings): void {
        if (settings.voiceId) this.voiceId = settings.voiceId;
    }

    dispose(): void {
        this.rpc.call('dispose').catch(() => {});
        this.rpc.dispose();
        this.loadedBundle = '';
    }

    /** Only an installed bundle can speak: naming another one just fails later at load. */
    private defaultVoiceFor(language?: string): string {
        const installed = installedBundles();
        const preferred = language
            ? findModelForLanguage(voiceLanguageCode(language))?.bundle
            : undefined;

        const bundle = preferred && installed.includes(preferred) ? preferred : installed[0];
        return bundle ? pocketVoiceId(bundle, POCKET_VOICES[0]) : '';
    }

    private async ensureLoaded(bundle: string): Promise<void> {
        if (this.loading) await this.loading;
        if (this.loadedBundle === bundle) return;

        if (!isBundleInstalled(modelsDir(), bundle)) {
            throw new Error(`Modèle Pocket TTS non installé: ${bundle}`);
        }

        this.loading = this.rpc
            .call<boolean>('initialize', modelsDir(), bundle)
            .then(() => {
                this.loadedBundle = bundle;
            })
            .finally(() => {
                this.loading = null;
            });
        await this.loading;
    }

    private async resolveVoice(bundle: string, voice: string): Promise<VoiceSource> {
        const referenceId = referenceIdOf(voice);
        const clonedName = clonedIdOf(voice);

        if (!referenceId && !clonedName) {
            return {
                kind: 'embedding',
                key: `${bundle}/${voice}`,
                file: await ensureVoice(modelsDir(), bundle, voice),
            };
        }

        const key = referenceId ? `ref/${referenceId}` : `clone/${clonedName}`;
        const cached = this.referenceAudio.get(key);
        if (cached) return cached;

        const audio = referenceId
            ? await this.readReferenceAudio(referenceId)
            : await readClonedVoice(modelsDir(), clonedName!);

        const source: VoiceSource = { kind: 'audio', key, ...audio };
        this.referenceAudio.set(key, source);
        return source;
    }

    async cloneVoice(request: TtsVoiceCloneRequest): Promise<TtsVoiceCloneResult> {
        assertValidName(request.name);
        const bundle = pocketVoiceBundle(this.voiceId) || installedBundles()[0];
        if (!bundle) throw new Error("Installez d'abord un modèle Pocket TTS.");

        await saveClonedVoice(
            modelsDir(),
            request.name,
            await decodeAudio(Buffer.from(request.audioBase64, 'base64')),
        );
        this.referenceAudio.delete(`clone/${request.name}`);

        return { voiceId: pocketVoiceId(bundle, clonedVoiceName(request.name)) };
    }

    async listClonedVoices(): Promise<TtsVoice[]> {
        const bundle = pocketVoiceBundle(this.voiceId) || installedBundles()[0];
        if (!bundle) return [];

        const model = findModelByBundle(bundle);
        return (await listClonedVoices(modelsDir())).map((name) => ({
            id: pocketVoiceId(bundle, clonedVoiceName(name)),
            name,
            languageCodes: model ? [model.langCode] : [],
            isCloned: true,
        }));
    }

    async deleteClonedVoice(voiceId: string): Promise<void> {
        const name = clonedIdOf(pocketVoiceName(voiceId));
        if (!name) return;
        await deleteClonedVoice(modelsDir(), name);
        this.referenceAudio.delete(`clone/${name}`);
    }

    private async readReferenceAudio(referenceId: string): Promise<ClonedAudio> {
        const reference = TTS_REFERENCE_VOICES.find((entry) => entry.id === referenceId);
        if (!reference) throw new Error(`Voix de référence inconnue: ${referenceId}`);

        return decodeAudio(await readFile(join(getTtsResourceDir(), reference.fileName)));
    }
}

/** Readers upload WAV or MP3; anything else has to be converted before it reaches here. */
async function decodeAudio(bytes: Buffer): Promise<ClonedAudio> {
    const wav = decodeWav(bytes);
    if (wav) return { samples: wav.samples, sampleRate: wav.sampleRate };

    const { MPEGDecoder } = await import('mpg123-decoder');
    const decoder = new MPEGDecoder();
    await decoder.ready;
    const { channelData, sampleRate, errors } = decoder.decode(new Uint8Array(bytes));
    decoder.free();

    if (errors.length > 0 || channelData.length === 0) {
        throw new Error('Enregistrement illisible: utilisez un fichier WAV ou MP3.');
    }
    return { samples: channelData[0], sampleRate };
}

export { VOICE_SIZE_MB };
