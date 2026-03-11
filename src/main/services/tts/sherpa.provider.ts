import { Worker } from 'node:worker_threads';
import { existsSync, readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
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
} from '@shared/tts.types';
import { normalizeLangCode, getLangLabelFr } from './sherpa-catalog';
import { getAllCatalogModels, findCatalogModelByModelName } from './sherpa-catalog-data';
import { getTtsModelsDir } from '@main/lib/app-paths';
import workerPath from './sherpa.worker?modulePath';

// ---------------------------------------------------------------------------
// Worker RPC
// ---------------------------------------------------------------------------

let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let progressCallback: ((pct: number) => void) | null = null;

function getWorker(): Worker {
    if (!worker) {
        worker = new Worker(workerPath);
        worker.on('message', (msg: { id: number; result?: unknown; error?: string }) => {
            if (msg.id === -1 && msg.result && typeof msg.result === 'object') {
                const r = msg.result as { type?: string; percentage?: number };
                if (r.type === 'progress' && progressCallback) {
                    progressCallback(r.percentage ?? 0);
                }
                return;
            }
            const p = pending.get(msg.id);
            if (!p) return;
            pending.delete(msg.id);
            if (msg.error) p.reject(new Error(msg.error));
            else p.resolve(msg.result);
        });
        worker.on('error', (err) => log.error('[sherpa-worker] Worker error:', err));
    }
    return worker;
}

function call<T>(method: string, ...args: unknown[]): Promise<T> {
    const id = ++requestId;
    return new Promise<T>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
        getWorker().postMessage({ id, method, args });
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSherpaModelsDir(): string {
    const dir = join(getTtsModelsDir(), 'sherpa');
    mkdirSync(dir, { recursive: true });
    return dir;
}

function findOnnxFile(dir: string): string | null {
    if (!existsSync(dir)) return null;
    try {
        const file = readdirSync(dir).find((f) => extname(f) === '.onnx' && !f.endsWith('.json'));
        return file ? join(dir, file) : null;
    } catch {
        return null;
    }
}

function isModelInstalled(modelName: string): boolean {
    const dir = join(getSherpaModelsDir(), modelName);
    return findOnnxFile(dir) !== null && existsSync(join(dir, 'tokens.txt'));
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
            .filter((e) => e.isDirectory() && isModelInstalled(e.name))
            .map((e) => e.name);
    } catch {
        return [];
    }
}

/** Resolve language code for an installed model directory name */
function getLangCodeForModel(modelName: string): string {
    // MMS models: mms-{langCode}
    if (modelName.startsWith('mms-')) {
        return normalizeLangCode(modelName.slice(4));
    }
    // Catalog models: look up in catalog
    const entry = findCatalogModelByModelName(modelName);
    if (entry) return entry.langCode;
    // Fallback: try to extract from dir name pattern like vits-piper-{lang}_{region}-...
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

    supportsLanguage(langCode: string): boolean {
        const code = normalizeLangCode(langCode);
        const installed = getInstalledModelNames();
        return installed.some((name) => getLangCodeForModel(name) === code);
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

        const audioBase64 = await call<string>('synthesize', request.text, sid, speed);
        return { audioBase64, mimeType: 'audio/wav' };
    }

    async downloadModel(onProgress: (pct: number) => void, modelName?: string): Promise<void> {
        if (!modelName) throw new Error('Model name required for Sherpa download');

        progressCallback = onProgress;
        try {
            onProgress(0);

            if (modelName.startsWith('mms-')) {
                // MMS model: download individual files
                const langCode = modelName.slice(4);
                await call<void>('downloadMmsModel', langCode, getSherpaModelsDir());
            } else {
                // Catalog model: download tar.bz2
                const entry = findCatalogModelByModelName(modelName);
                if (!entry) throw new Error(`Unknown model: ${modelName}`);
                await call<void>('downloadModel', entry.url, entry.modelName, getSherpaModelsDir());
            }

            onProgress(100);
        } finally {
            progressCallback = null;
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
            call('dispose').catch(() => {});
        }
    }

    setConfig(settings: TtsProviderSettings): void {
        if (settings.voiceId) {
            const parts = settings.voiceId.split(':');
            this.speakerId = parseInt(parts[1] ?? '0', 10) || 0;
        }
        if (settings.model) this.activeModel = settings.model;
    }

    async previewVoice(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
        return this.synthesize(request);
    }

    dispose(): void {
        call('dispose').catch(() => {});
        if (worker) {
            worker.terminate().catch(() => {});
            worker = null;
            pending.clear();
        }
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

        // Fallback: any installed model matching the language (including MMS)
        return installed.find((name) => getLangCodeForModel(name) === code);
    }

    private async initializeModel(modelName: string): Promise<void> {
        const modelDir = join(getSherpaModelsDir(), modelName);
        if (!isModelInstalled(modelName)) {
            throw new Error(`Modèle Sherpa-ONNX non trouvé: ${modelName}`);
        }
        const ok = await call<boolean>('initialize', modelDir);
        if (!ok) throw new Error(`Échec d'initialisation du modèle: ${modelName}`);
        this.activeModel = modelName;
        this.initialized = true;
    }
}
