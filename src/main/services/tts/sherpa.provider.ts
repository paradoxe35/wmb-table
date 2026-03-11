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
import { normalizeLangCode, getLangLabelFr } from './sherpa-catalog';
import { getAllCatalogModels, findCatalogModelByModelName } from './sherpa-catalog-data';
import { getTtsModelsDir } from '@main/lib/app-paths';
import { WorkerRpc } from './worker-rpc';
import workerPath from './sherpa.worker?modulePath';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findOnnxFile(dir: string): string | null {
    if (!existsSync(dir)) return null;
    try {
        const file = readdirSync(dir).find((f) => extname(f) === '.onnx' && !f.endsWith('.json'));
        return file ? join(dir, file) : null;
    } catch {
        return null;
    }
}

function isModelInstalled(modelDir: string): boolean {
    return findOnnxFile(modelDir) !== null && existsSync(join(modelDir, 'tokens.txt'));
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

function getLangCodeForModel(modelName: string): string {
    if (modelName.startsWith('mms-')) return normalizeLangCode(modelName.slice(4));
    const entry = findCatalogModelByModelName(modelName);
    if (entry) return entry.langCode;
    const parts = modelName.split('-');
    if (parts.length >= 3) {
        const langPart = parts[2].split('_')[0];
        if (langPart.length === 2 || langPart.length === 3) return normalizeLangCode(langPart);
    }
    return 'en';
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
    private readonly rpc = new WorkerRpc(workerPath, 'sherpa');

    async getInfo(): Promise<TtsProviderInfo> {
        const installed = getInstalledModelNames();
        const installedSet = new Set(installed);
        const voices: TtsVoice[] = [];

        for (const name of installed) {
            const langCode = getLangCodeForModel(name);
            const entry = findCatalogModelByModelName(name);
            const { numSpeakers, speakerIdMap } = readModelMeta(name);

            if (numSpeakers <= 1) {
                voices.push({
                    id: `${name}:0`,
                    name: entry?.name ?? name.replace(/[-_]/g, ' '),
                    languageCodes: [langCode],
                });
            } else {
                const speakerNames = Object.keys(speakerIdMap);
                for (let i = 0; i < numSpeakers; i++) {
                    const speakerName = speakerNames.find((k) => speakerIdMap[k] === i);
                    voices.push({
                        id: `${name}:${i}`,
                        name: speakerName ?? `Speaker ${i + 1}`,
                        languageCodes: [langCode],
                    });
                }
            }
        }

        const supportedLangs = [...new Set(installed.map(getLangCodeForModel))];

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
        const code = normalizeLangCode(langCode);
        const installed = getInstalledModelNames();

        if (installed.length === 0) {
            return { supported: false, reason: 'model_not_downloaded' };
        }

        // If a specific voice is configured, validate that model's language
        if (cfg?.voiceId) {
            const modelName = cfg.voiceId.split(':')[0];
            if (modelName && installed.includes(modelName)) {
                return normalizeLangCode(getLangCodeForModel(modelName)) === code
                    ? { supported: true }
                    : { supported: false, reason: 'no_voice_for_language' };
            }
        }

        // No voice configured: check if any installed model supports the language
        return installed.some((name) => normalizeLangCode(getLangCodeForModel(name)) === code)
            ? { supported: true }
            : { supported: false, reason: 'no_voice_for_language' };
    }

    async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        await this.ensureInitialized(request.model, request.language);
        const speed = request.rate ?? this.speed;
        let sid = this.speakerId;

        if (request.voiceId?.includes(':')) {
            const [modelName, speakerStr] = request.voiceId.split(':');
            sid = parseInt(speakerStr, 10) || 0;
            if (modelName !== this.activeModel) {
                await this.initializeModel(modelName);
            }
        }

        const audioBase64 = await this.rpc.call<string>('synthesize', request.text, sid, speed);
        return { audioBase64, mimeType: 'audio/wav' };
    }

    async downloadModel(onProgress: (pct: number) => void, modelName?: string): Promise<void> {
        if (!modelName) throw new Error('Model name required for Sherpa download');

        this.rpc.onProgress = onProgress;
        try {
            onProgress(0);

            if (modelName.startsWith('mms-')) {
                const langCode = modelName.slice(4);
                await this.rpc.call<void>('downloadMmsModel', langCode, getSherpaModelsDir());
            } else {
                const entry = findCatalogModelByModelName(modelName);
                if (!entry) throw new Error(`Unknown model: ${modelName}`);
                await this.rpc.call<void>(
                    'downloadModel',
                    entry.url,
                    entry.modelName,
                    getSherpaModelsDir(),
                );
            }

            onProgress(100);
        } finally {
            this.rpc.onProgress = null;
        }
    }

    async isModelReady(): Promise<boolean> {
        return getInstalledModelNames().length > 0;
    }

    getAvailableModels(): TtsModelInfo[] {
        const installedSet = new Set(getInstalledModelNames());

        return getAllCatalogModels().map((entry) => ({
            langCode: entry.langCode,
            langLabel: getLangLabelFr(entry.langCode) || entry.langName,
            langName: entry.langName,
            modelName: entry.modelName,
            voiceName: entry.name,
            installed: installedSet.has(entry.modelName),
            engine: entry.engine,
            quality: entry.quality,
            filesizeMb: entry.filesizeMb,
            numSpeakers: entry.numSpeakers,
        }));
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
        if (settings.model) this.activeModel = settings.model;
    }

    resolveVoiceForLanguage(langCode: string, cfg?: TtsProviderSettings): string | null {
        const code = normalizeLangCode(langCode);
        const installed = getInstalledModelNames();

        // If the configured voiceId already points to an installed model for this language, no change needed
        if (cfg?.voiceId) {
            const modelName = cfg.voiceId.split(':')[0];
            if (modelName && installed.includes(modelName)) {
                if (normalizeLangCode(getLangCodeForModel(modelName)) === code) {
                    return null;
                }
            }
        }

        // Find the first installed model whose language matches
        const compatibleModel = installed.find(
            (name) => normalizeLangCode(getLangCodeForModel(name)) === code,
        );
        return compatibleModel ? `${compatibleModel}:0` : null;
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
        const target = modelName || this.findModelForLanguage(language) || this.activeModel;
        if (this.initialized && (!target || target === this.activeModel)) return;

        if (target) {
            await this.initializeModel(target);
        } else {
            const installed = getInstalledModelNames();
            if (installed.length === 0) throw new Error('Aucun modèle Sherpa-ONNX installé');
            await this.initializeModel(installed[0]);
        }
    }

    private findModelForLanguage(language?: string): string | undefined {
        if (!language) return undefined;
        const code = normalizeLangCode(language);
        const installed = getInstalledModelNames();

        // Prefer non-MMS model (typically higher quality)
        const nonMms = getAllCatalogModels().find(
            (m) =>
                m.engine !== 'mms' &&
                normalizeLangCode(m.langCode) === code &&
                installed.includes(m.modelName),
        );
        if (nonMms) return nonMms.modelName;

        return installed.find((name) => getLangCodeForModel(name) === code);
    }

    private async initializeModel(modelName: string): Promise<void> {
        const modelDir = join(getSherpaModelsDir(), modelName);
        if (!isModelInstalled(modelDir)) {
            throw new Error(`Modèle Sherpa-ONNX non trouvé: ${modelName}`);
        }
        const ok = await this.rpc.call<boolean>('initialize', modelDir);
        if (!ok) throw new Error(`Échec d'initialisation du modèle: ${modelName}`);
        this.activeModel = modelName;
        this.initialized = true;
    }
}
