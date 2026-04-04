import { existsSync, readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import log from 'electron-log';
import type { TtsProvider } from './provider';
import type {
    TtsProviderType,
    TtsProviderInfo,
    TtsProviderSettings,
    TtsSynthesizeRequest,
    TtsSynthesizeResult,
    TtsModelInfo,
    TtsVoice,
    TtsCompatibilityResult,
} from '@shared/tts.types';
import { getLanguageLabelFr, normalizeLanguageCode } from '@shared/tts.types';
import { entrySupportsLang, normalizeLangCodes } from './sherpa-catalog';
import { getAllCatalogModels, findCatalogModelByModelName } from './sherpa-catalog-data';
import { getTtsModelsDir } from '@main/lib/app-paths';
import { WorkerRpc } from './worker-rpc';
import type { TtsProviderDownloadProgress } from './provider';
import workerPath from './sherpa.worker?modulePath';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findOnnxFiles(dir: string): string[] {
    if (!existsSync(dir)) return [];
    try {
        return readdirSync(dir)
            .filter((fileName) => extname(fileName) === '.onnx' && !fileName.endsWith('.json'))
            .map((fileName) => join(dir, fileName));
    } catch {
        return [];
    }
}

function findVocoderFile(dir: string): string | null {
    if (!existsSync(dir)) return null;
    try {
        const fileName = readdirSync(dir).find(
            (fileName) => extname(fileName) === '.onnx' && /vocos|vocoder|hifigan/i.test(fileName),
        );
        return fileName ? join(dir, fileName) : null;
    } catch {
        return null;
    }
}

function findAcousticModelFile(dir: string): string | null {
    if (!existsSync(dir)) return null;
    try {
        const fileName = readdirSync(dir).find(
            (fileName) =>
                extname(fileName) === '.onnx' &&
                !/vocos|vocoder|hifigan/i.test(fileName) &&
                !fileName.endsWith('.json'),
        );
        return fileName ? join(dir, fileName) : null;
    } catch {
        return null;
    }
}

function isModelInstalled(modelDir: string): boolean {
    if (!existsSync(join(modelDir, 'tokens.txt'))) {
        return false;
    }

    const onnxFiles = findOnnxFiles(modelDir);
    if (onnxFiles.length === 0) {
        return false;
    }

    if (existsSync(join(modelDir, 'voices.bin'))) {
        return findAcousticModelFile(modelDir) !== null;
    }

    if (findVocoderFile(modelDir)) {
        return findAcousticModelFile(modelDir) !== null;
    }

    return true;
}

function getSherpaModelsDir(): string {
    const dir = join(getTtsModelsDir(), 'sherpa');
    mkdirSync(dir, { recursive: true });
    return dir;
}

interface ModelMeta {
    numSpeakers: number;
    speakerIdMap: Record<string, number>;
}

function readModelMeta(modelName: string): ModelMeta {
    const dir = join(getSherpaModelsDir(), modelName);
    try {
        const metaFile = readdirSync(dir).find((f) => f.endsWith('.onnx.json'));
        if (!metaFile) return { numSpeakers: 1, speakerIdMap: {} };
        const meta = JSON.parse(readFileSync(join(dir, metaFile), 'utf-8'));
        return {
            numSpeakers: meta.num_speakers ?? 1,
            speakerIdMap: meta.speaker_id_map ?? {},
        };
    } catch {
        return { numSpeakers: 1, speakerIdMap: {} };
    }
}

function getInstalledModelNames(): string[] {
    const modelsDir = getSherpaModelsDir();
    if (!existsSync(modelsDir)) return [];
    try {
        return readdirSync(modelsDir, { withFileTypes: true })
            .filter((e) => e.isDirectory() && isModelInstalled(join(modelsDir, e.name)))
            .map((e) => e.name);
    } catch {
        return [];
    }
}

function getLangCodesForModel(modelName: string): string[] {
    if (modelName.startsWith('mms-')) return [normalizeLanguageCode(modelName.slice(4))];
    const entry = findCatalogModelByModelName(modelName);
    if (entry) {
        return normalizeLangCodes(entry.langCode);
    }
    const parts = modelName.split('-');
    if (parts.length >= 3) {
        const langPart = parts[2].split('_')[0];
        if (langPart.length === 2 || langPart.length === 3) {
            return [normalizeLanguageCode(langPart)];
        }
    }
    return ['en'];
}

function getModelLangLabel(langCode: string | string[], langName?: string): string {
    if (Array.isArray(langCode) && langCode.length > 1) {
        return 'Multilingue';
    }

    const primaryLang = Array.isArray(langCode) ? langCode[0] : langCode;
    return getLanguageLabelFr(primaryLang) || langName || primaryLang;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class SherpaProvider implements TtsProvider {
    readonly type: TtsProviderType = 'sherpa';
    private speakerId = 0;
    private speed = 1.0;
    private activeModel = '';
    private initialized = false;
    private initPromise: Promise<void> | null = null;
    private readonly rpc = new WorkerRpc(workerPath, 'sherpa');

    async getInfo(): Promise<TtsProviderInfo> {
        const installed = getInstalledModelNames();
        const installedSet = new Set(installed);
        const voices: TtsVoice[] = [];

        for (const name of installed) {
            const langCodes = getLangCodesForModel(name);
            const entry = findCatalogModelByModelName(name);
            const { numSpeakers, speakerIdMap } = readModelMeta(name);

            if (numSpeakers <= 1) {
                voices.push({
                    id: `${name}:0`,
                    name: entry?.name ?? name.replace(/[-_]/g, ' '),
                    languageCodes: langCodes,
                });
            } else {
                const speakerNames = Object.keys(speakerIdMap);
                for (let i = 0; i < numSpeakers; i++) {
                    const speakerName = speakerNames.find((k) => speakerIdMap[k] === i);
                    voices.push({
                        id: `${name}:${i}`,
                        name: speakerName ?? `Speaker ${i + 1}`,
                        languageCodes: langCodes,
                    });
                }
            }
        }

        const supportedLangs = [...new Set(installed.flatMap(getLangCodesForModel))];

        return {
            type: 'sherpa',
            locality: 'local',
            displayName: 'Sherpa-ONNX TTS',
            supportedLanguages: supportedLangs,
            supportsVoiceCloning: false,
            supportsStreaming: false,
            voices,
            defaultModel: installed[0] ?? null,
            availableModels: installed,
            requiresApiKey: false,
            requiresModelDownload: true,
            modelDownloaded: installedSet.size > 0,
        };
    }

    async checkCompatibility(
        langCode: string,
        cfg?: TtsProviderSettings,
    ): Promise<TtsCompatibilityResult> {
        const code = normalizeLanguageCode(langCode);
        const installed = getInstalledModelNames();

        if (installed.length === 0) {
            return { supported: false, reason: 'model_not_downloaded' };
        }

        // If a specific voice is configured, validate that model's language
        if (cfg?.voiceId) {
            const modelName = cfg.voiceId.split(':')[0];
            if (modelName && installed.includes(modelName)) {
                return getLangCodesForModel(modelName).includes(code)
                    ? { supported: true }
                    : { supported: false, reason: 'no_model_for_language' };
            }
        }

        // No voice configured: check if any installed model supports the language
        return installed.some((name) => getLangCodesForModel(name).includes(code))
            ? { supported: true }
            : { supported: false, reason: 'no_model_for_language' };
    }

    async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        // Extract model name from voiceId (format: "modelName:speakerId")
        let modelName = request.model;
        let sid = this.speakerId;
        if (request.voiceId?.includes(':')) {
            const [voiceModel, speakerStr] = request.voiceId.split(':');
            modelName = voiceModel || modelName;
            sid = parseInt(speakerStr, 10) || 0;
        }

        await this.ensureInitialized(modelName, request.language);
        const speed = request.rate ?? this.speed;
        const audioBase64 = await this.rpc.call<string>('synthesize', request.text, sid, speed);
        return { audioBase64, mimeType: 'audio/wav' };
    }

    async downloadModel(
        onProgress: (progress: TtsProviderDownloadProgress) => void,
        modelName?: string,
    ): Promise<void> {
        if (!modelName) {
            throw new Error('Le nom du modèle est requis pour le téléchargement Sherpa.');
        }

        this.rpc.onProgressEvent = (event) => {
            onProgress({
                percentage: event.percentage,
                phase: event.phase as TtsProviderDownloadProgress['phase'],
            });
        };

        try {
            onProgress({ percentage: 0, phase: 'downloading' });

            if (modelName.startsWith('mms-')) {
                const langCode = modelName.slice(4);
                await this.rpc.call<void>('downloadMmsModel', langCode, getSherpaModelsDir());
            } else {
                const entry = findCatalogModelByModelName(modelName);
                if (!entry) {
                    throw new Error('Modèle Sherpa inconnu.');
                }

                await this.rpc.call<void>(
                    'downloadModel',
                    entry.url,
                    entry.modelName,
                    getSherpaModelsDir(),
                );
            }

            // Worker already sends 100% progress via RPC — no need to call again
        } finally {
            this.rpc.onProgressEvent = null;
        }
    }

    async isModelReady(): Promise<boolean> {
        return getInstalledModelNames().length > 0;
    }

    getAvailableModels(): TtsModelInfo[] {
        const installedSet = new Set(getInstalledModelNames());

        return getAllCatalogModels().map((entry) => {
            return {
                langCode: entry.langCode,
                langLabel: getModelLangLabel(entry.langCode, entry.langName),
                langName: entry.langName,
                modelName: entry.modelName,
                voiceName: entry.name,
                installed: installedSet.has(entry.modelName),
                engine: entry.engine,
                quality: entry.quality,
                filesizeMb: entry.filesizeMb,
                numSpeakers: entry.numSpeakers,
            };
        });
    }

    async deleteModel(modelName: string): Promise<void> {
        const dir = join(getSherpaModelsDir(), modelName);
        if (existsSync(dir)) {
            await rm(dir, { recursive: true, force: true });
        }
        if (this.activeModel === modelName) {
            this.initialized = false;
            this.activeModel = '';
            this.rpc.call('dispose').catch(() => {});
        }
    }

    setConfig(settings: TtsProviderSettings): void {
        if (settings.voiceId) {
            const parts = settings.voiceId.split(':');
            this.speakerId = parseInt(parts[1] ?? '0', 10) || 0;
        }
        if (settings.model && settings.model !== this.activeModel) {
            this.activeModel = settings.model;
            this.initialized = false;
        }
    }

    resolveConfigForLanguage(
        langCode: string,
        cfg?: TtsProviderSettings,
    ): Partial<TtsProviderSettings> | null {
        const code = normalizeLanguageCode(langCode);
        const installed = getInstalledModelNames();

        // If the configured voiceId already points to an installed model for this language, no change needed
        if (cfg?.voiceId) {
            const modelName = cfg.voiceId.split(':')[0];
            if (modelName && installed.includes(modelName)) {
                if (getLangCodesForModel(modelName).includes(code)) {
                    return null;
                }
            }
        }

        // Find the first installed model whose language matches
        const compatibleModel = installed.find((name) => getLangCodesForModel(name).includes(code));

        if (!compatibleModel) {
            // No installed model for this language — clear voice so UI reflects incompatibility
            return { voiceId: '', model: '' };
        }

        return { voiceId: `${compatibleModel}:0`, model: compatibleModel };
    }

    async previewVoice(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        return this.synthesize(request);
    }

    dispose(): void {
        this.rpc.call('dispose').catch(() => {});
        this.rpc.dispose();
        this.initialized = false;
        log.info('Sherpa-ONNX TTS provider disposed');
    }

    private async ensureInitialized(modelName?: string, language?: string): Promise<void> {
        // If already initializing, wait for it to finish
        if (this.initPromise) {
            await this.initPromise;
        }

        const target = modelName || this.findModelForLanguage(language) || this.activeModel;
        if (this.initialized && (!target || target === this.activeModel)) return;

        const model = target || getInstalledModelNames()[0];
        if (!model) throw new Error('Aucun modèle Sherpa-ONNX installé');

        // Serialize: only one initialization at a time
        this.initPromise = this.initializeModel(model, language).finally(() => {
            this.initPromise = null;
        });
        await this.initPromise;
    }

    private findModelForLanguage(language?: string): string | undefined {
        if (!language) return undefined;
        const code = normalizeLanguageCode(language);
        const installed = getInstalledModelNames();

        // Prefer non-MMS model (typically higher quality)
        const nonMms = getAllCatalogModels().find(
            (m) =>
                m.engine !== 'mms' && entrySupportsLang(m, code) && installed.includes(m.modelName),
        );
        if (nonMms) return nonMms.modelName;

        return installed.find((name) => getLangCodesForModel(name).includes(code));
    }

    private async initializeModel(modelName: string, language?: string): Promise<void> {
        const modelDir = join(getSherpaModelsDir(), modelName);
        if (!isModelInstalled(modelDir)) {
            throw new Error(`Modèle Sherpa-ONNX non trouvé: ${modelName}`);
        }
        const ok = await this.rpc.call<boolean>('initialize', modelDir, language);
        if (!ok) throw new Error(`Échec d'initialisation du modèle: ${modelName}`);
        this.activeModel = modelName;
        this.initialized = true;
    }
}
