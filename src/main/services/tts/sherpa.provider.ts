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
import { SHERPA_MODEL_CATALOG, findModelByName } from '@shared/sherpa-models';
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

function readModelMeta(modelName: string): {
    numSpeakers: number;
    speakerIdMap: Record<string, number>;
} {
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
        const voices: TtsVoice[] = [];
        for (const name of installed) {
            const entry = findModelByName(name);
            const langCodes = entry ? [entry.langCode] : ['en'];
            const { numSpeakers, speakerIdMap } = readModelMeta(name);

            if (numSpeakers <= 1) {
                voices.push({
                    id: `${name}:0`,
                    name: entry?.voiceName ?? name.replace(/[-_]/g, ' '),
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

        const supportedLangs = SHERPA_MODEL_CATALOG.filter((m) =>
            installed.includes(m.modelName),
        ).map((m) => m.langCode);

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
            modelDownloaded: installed.length > 0,
        };
    }

    supportsLanguage(langCode: string): boolean {
        const code = langCode.split('-')[0].toLowerCase();
        const installed = getInstalledModelNames();
        return installed.some((name) => {
            const entry = findModelByName(name);
            return entry?.langCode === code;
        });
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
        const entry = findModelByName(modelName);
        if (!entry) throw new Error(`Unknown model: ${modelName}`);

        progressCallback = onProgress;
        try {
            onProgress(0);
            await call<void>('downloadModel', entry.url, entry.modelName, getSherpaModelsDir());
            onProgress(100);
        } finally {
            progressCallback = null;
        }
    }

    async isModelReady(): Promise<boolean> {
        return getInstalledModelNames().length > 0;
    }

    getAvailableModels(): TtsModelInfo[] {
        const installed = getInstalledModelNames();
        return SHERPA_MODEL_CATALOG.map((entry) => ({
            langCode: entry.langCode,
            langLabel: entry.langLabel,
            modelName: entry.modelName,
            voiceName: entry.voiceName,
            installed: installed.includes(entry.modelName),
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
        const code = language.split('-')[0].toLowerCase();
        const installed = getInstalledModelNames();
        const entry = SHERPA_MODEL_CATALOG.find(
            (m) => m.langCode === code && installed.includes(m.modelName),
        );
        return entry?.modelName;
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
