import { parentPort } from 'node:worker_threads';
import { createReadStream, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { rename, rm, stat, unlink } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { basename, join, extname } from 'node:path';
import { extract as tarExtract } from 'tar';
import unbzip2 from 'unbzip2-stream';
import { encodeWav } from './wav';
import type { TtsModelDownloadProgress } from '@shared/tts.types';
import { downloadResumableFile } from '@main/lib/resumable-download';

interface WorkerRequest {
    id: number;
    method: string;
    args: unknown[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsInstance: any = null;
let currentModelDir = '';
let currentKokoroConfigKey = '';

function sendProgress(
    percentage: number,
    phase: TtsModelDownloadProgress['phase'] = 'downloading',
): void {
    parentPort!.postMessage({ id: -1, result: { type: 'progress', percentage, phase } });
}

// ---------------------------------------------------------------------------
// WASM module loading
// Uses sherpa-onnx (WASM) instead of sherpa-onnx-node (native addon)
// to avoid Electron's external buffer restriction (electron/issues/35801).
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sherpaModule: any = null;

function loadSherpa(): void {
    if (!sherpaModule) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sherpa = require('sherpa-onnx');
        sherpaModule = sherpa;
    }
}

// ---------------------------------------------------------------------------
// Worker methods
// ---------------------------------------------------------------------------

function findOnnxFiles(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((f) => extname(f) === '.onnx' && !f.endsWith('.json'))
        .map((f) => join(dir, f));
}

function findVocoderFile(dir: string): string | null {
    if (!existsSync(dir)) return null;
    const file = readdirSync(dir).find(
        (f) => extname(f) === '.onnx' && /vocos|vocoder|hifigan/i.test(f),
    );
    return file ? join(dir, file) : null;
}

function findAcousticModelFile(dir: string): string | null {
    if (!existsSync(dir)) return null;
    const file = readdirSync(dir).find(
        (f) => extname(f) === '.onnx' && !/vocos|vocoder|hifigan/i.test(f) && !f.endsWith('.json'),
    );
    return file ? join(dir, file) : null;
}

function findKokoroLexiconFiles(dir: string): string[] {
    if (!existsSync(dir)) {
        return [];
    }

    return readdirSync(dir)
        .filter((fileName) => /^lexicon.*\.txt$/i.test(fileName))
        .sort((a, b) => a.localeCompare(b))
        .map((fileName) => join(dir, fileName));
}

function buildKokoroLexiconArg(dir: string): string {
    const lexicons = findKokoroLexiconFiles(dir);
    return lexicons.join(',');
}

/**
 * Supertonic splits the voice across four models and carries no `tokens.txt`, so it is the
 * one engine that cannot be recognised by the files every other engine shares.
 */
function findSupertonicConfig(modelDir: string): Record<string, string> | null {
    const files = {
        durationPredictor: 'duration_predictor',
        textEncoder: 'text_encoder',
        vectorEstimator: 'vector_estimator',
        vocoder: 'vocoder',
    };

    if (!existsSync(join(modelDir, 'tts.json'))) return null;

    const onnxFiles = findOnnxFiles(modelDir);
    const config: Record<string, string> = {
        ttsJson: join(modelDir, 'tts.json'),
        unicodeIndexer: join(modelDir, 'unicode_indexer.bin'),
        voiceStyle: join(modelDir, 'voice.bin'),
    };

    for (const [key, prefix] of Object.entries(files)) {
        const file = onnxFiles.find((path) => basename(path).startsWith(prefix));
        if (!file) return null;
        config[key] = file;
    }

    return existsSync(config.unicodeIndexer) && existsSync(config.voiceStyle) ? config : null;
}

function hasValidModelAssets(modelDir: string): boolean {
    if (findSupertonicConfig(modelDir)) {
        return true;
    }

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

function resolveExtractedModelDir(rootDir: string, modelName: string): string | null {
    const directMatch = join(rootDir, modelName);
    if (hasValidModelAssets(directMatch)) {
        return directMatch;
    }

    if (hasValidModelAssets(rootDir)) {
        return rootDir;
    }

    const children = readdirSync(rootDir, { withFileTypes: true }).filter((entry) =>
        entry.isDirectory(),
    );
    if (children.length === 1) {
        const nestedDir = join(rootDir, children[0].name);
        return hasValidModelAssets(nestedDir) ? nestedDir : null;
    }

    return null;
}

function getModelArchiveTempPath(modelsDir: string, modelName: string): string {
    return join(modelsDir, `${modelName}.download.tar.bz2`);
}

function getModelPartialDir(modelsDir: string, modelName: string): string {
    return join(modelsDir, `${modelName}.partial`);
}

function createProgressTransform(
    totalBytes: number,
    pctStart: number,
    pctEnd: number,
    phase: NonNullable<TtsModelDownloadProgress['phase']>,
): Transform {
    let processedBytes = 0;

    return new Transform({
        transform(chunk, _encoding, callback) {
            processedBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
            const pct =
                totalBytes > 0
                    ? pctStart + (processedBytes / totalBytes) * (pctEnd - pctStart)
                    : pctEnd;
            sendProgress(Math.min(pctEnd, Math.round(pct)), phase);
            callback(null, chunk);
        },
    });
}

function initialize(modelDir: string, language?: string, engine?: string): boolean {
    const kokoroLexiconArg = buildKokoroLexiconArg(modelDir);
    // Only Kokoro takes its language at load time; supertonic reads one per generation.
    const kokoroLang = engine === 'kokoro' ? (language ?? '') : '';
    const kokoroConfigKey = `${modelDir}|${kokoroLexiconArg}|${kokoroLang}`;
    // Skip if already initialized with this model
    if (ttsInstance && currentKokoroConfigKey === kokoroConfigKey) {
        return true;
    }

    loadSherpa();

    // Dispose previous model only when switching to a different one
    if (ttsInstance?.free) {
        ttsInstance.free();
        ttsInstance = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const offlineTtsModelConfig: any = {
        numThreads: 1,
        debug: 0,
        provider: 'cpu',
    };

    const supertonic = findSupertonicConfig(modelDir);
    if (supertonic) {
        offlineTtsModelConfig.offlineTtsSupertonicModelConfig = supertonic;
        return createTts(offlineTtsModelConfig, modelDir, kokoroConfigKey);
    }

    const tokens = join(modelDir, 'tokens.txt');
    if (!existsSync(tokens)) return false;

    const hasLexicon = existsSync(join(modelDir, 'lexicon.txt'));
    const hasDataDir = existsSync(join(modelDir, 'espeak-ng-data'));
    const hasVoicesBin = existsSync(join(modelDir, 'voices.bin'));
    const vocoder = findVocoderFile(modelDir);
    const onnxFiles = findOnnxFiles(modelDir);

    if (hasVoicesBin && engine === 'kitten') {
        // Kitten ships a `voices.bin` like Kokoro but reads its speaker styles differently;
        // loaded as Kokoro it aborts the process with `style_dim should be 3-d`.
        const modelOnnx = onnxFiles[0];
        if (!modelOnnx) return false;

        offlineTtsModelConfig.offlineTtsKittenModelConfig = {
            model: modelOnnx,
            voices: join(modelDir, 'voices.bin'),
            tokens,
            dataDir: hasDataDir ? join(modelDir, 'espeak-ng-data') : '',
            lengthScale: 1.0,
        };
    } else if (hasVoicesBin) {
        // Kokoro engine
        const modelOnnx = onnxFiles.find((f) => !/vocos|vocoder|hifigan/i.test(f));
        if (!modelOnnx) {
            return false;
        }

        offlineTtsModelConfig.offlineTtsKokoroModelConfig = {
            model: modelOnnx,
            voices: join(modelDir, 'voices.bin'),
            tokens,
            dataDir: hasDataDir ? join(modelDir, 'espeak-ng-data') : '',
            lengthScale: 1.0,
            lexicon: kokoroLexiconArg,
            lang: kokoroLang,
        };
    } else if (vocoder) {
        // Matcha engine (acousticModel + vocoder)
        const acousticModel = findAcousticModelFile(modelDir);
        if (!acousticModel) return false;
        offlineTtsModelConfig.offlineTtsMatchaModelConfig = {
            acousticModel,
            vocoder,
            tokens,
            lexicon: hasLexicon ? join(modelDir, 'lexicon.txt') : '',
            dataDir: hasDataDir ? join(modelDir, 'espeak-ng-data') : '',
            noiseScale: 0.667,
            lengthScale: 1.0,
        };
    } else {
        // VITS engine (piper, coqui, mimic3, icefall, mms, etc.)
        const modelOnnx = onnxFiles[0];
        if (!modelOnnx) return false;
        offlineTtsModelConfig.offlineTtsVitsModelConfig = {
            model: modelOnnx,
            tokens,
            lexicon: hasLexicon ? join(modelDir, 'lexicon.txt') : '',
            dataDir: hasDataDir ? join(modelDir, 'espeak-ng-data') : '',
            noiseScale: 0.667,
            noiseScaleW: 0.8,
            lengthScale: 1.0,
        };
    }

    return createTts(offlineTtsModelConfig, modelDir, kokoroConfigKey);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTts(offlineTtsModelConfig: any, modelDir: string, configKey: string): boolean {
    ttsInstance = sherpaModule.createOfflineTts({
        offlineTtsModelConfig,
        maxNumSentences: 2,
        ruleFsts: '',
        ruleFars: '',
    });
    currentModelDir = modelDir;
    currentKokoroConfigKey = configKey;
    return true;
}

function getNumSpeakers(): number {
    return ttsInstance?.numSpeakers ?? 1;
}

function synthesize(text: string, speakerId: number, speed: number, lang?: string): string {
    if (!ttsInstance) throw new Error('Sherpa-ONNX TTS not initialized');
    const audio = ttsInstance.generate({
        text,
        sid: speakerId,
        speed,
        ...(lang ? { extra: { lang } } : {}),
    });
    const wavBuffer = encodeWav(audio.samples, audio.sampleRate);
    return wavBuffer.toString('base64');
}

function isReady(): boolean {
    return ttsInstance !== null;
}

function getModelDir(): string {
    return currentModelDir;
}

function dispose(): void {
    if (ttsInstance?.free) ttsInstance.free();
    ttsInstance = null;
    currentModelDir = '';
    currentKokoroConfigKey = '';
}

/** sherpa throws a raw pointer when it refuses a model, which reaches the reader as
 * `Error: 15029440`. Nothing is recoverable from the number, so say what happened instead. */
function serializeWorkerError(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }

    if (typeof err === 'string') {
        return err;
    }

    return 'Cette voix ne peut pas être lue sur cet ordinateur.';
}

// ---------------------------------------------------------------------------
// Shared download helper
// ---------------------------------------------------------------------------

async function downloadFile(
    url: string,
    destPath: string,
    pctStart: number,
    pctEnd: number,
    phase: NonNullable<TtsModelDownloadProgress['phase']> = 'downloading',
): Promise<void> {
    await downloadResumableFile({
        url,
        destinationPath: destPath,
        reuseExistingFile: true,
        onProgress: (progress) => {
            if (!progress.totalBytes) {
                return;
            }
            const pct = pctStart + (progress.percentage / 100) * (pctEnd - pctStart);
            sendProgress(Math.round(pct), phase);
        },
    });
}

// ---------------------------------------------------------------------------
// Model download: fetch .tar.bz2, extract to modelsDir/<modelName>/
// ---------------------------------------------------------------------------

async function downloadModel(url: string, modelName: string, modelsDir: string): Promise<void> {
    const tmpFile = getModelArchiveTempPath(modelsDir, modelName);
    const tmpExtractDir = getModelPartialDir(modelsDir, modelName);
    const finalModelDir = join(modelsDir, modelName);
    mkdirSync(modelsDir, { recursive: true });
    sendProgress(2, 'downloading');

    try {
        await downloadFile(url, tmpFile, 5, 78, 'downloading');

        await rm(tmpExtractDir, { recursive: true, force: true }).catch(() => {});
        mkdirSync(tmpExtractDir, { recursive: true });
        const archiveSize = (await stat(tmpFile)).size;
        sendProgress(80, 'extracting');
        await pipeline(
            createReadStream(tmpFile),
            createProgressTransform(archiveSize, 80, 94, 'extracting'),
            unbzip2(),
            tarExtract({ cwd: tmpExtractDir }),
        );

        const extractedModelDir = resolveExtractedModelDir(tmpExtractDir, modelName);
        if (!extractedModelDir) {
            await unlink(tmpFile).catch(() => {});
            await rm(tmpExtractDir, { recursive: true, force: true }).catch(() => {});
            throw new Error(`Extracted Sherpa model is incomplete: ${modelName}`);
        }

        sendProgress(96, 'finalizing');
        await rm(finalModelDir, { recursive: true, force: true }).catch(() => {});

        if (extractedModelDir === tmpExtractDir) {
            await rename(tmpExtractDir, finalModelDir);
        } else {
            await rename(extractedModelDir, finalModelDir);
            await rm(tmpExtractDir, { recursive: true, force: true }).catch(() => {});
        }

        await unlink(tmpFile).catch(() => {});
        sendProgress(100, 'finalizing');
    } catch (err) {
        await rm(tmpExtractDir, { recursive: true, force: true }).catch(() => {});
        throw err;
    }
}

// ---------------------------------------------------------------------------
// MMS model download: individual model.onnx + tokens.txt
// ---------------------------------------------------------------------------

async function downloadMmsModel(langCode: string, modelsDir: string): Promise<void> {
    const baseUrl = 'https://huggingface.co/willwade/mms-tts-multilingual-models-onnx/resolve/main';
    const modelName = `mms-${langCode}`;
    const modelDir = join(modelsDir, modelName);
    const tmpModelDir = getModelPartialDir(modelsDir, modelName);
    mkdirSync(tmpModelDir, { recursive: true });
    sendProgress(2, 'downloading');

    try {
        await downloadFile(
            `${baseUrl}/${langCode}/model.onnx`,
            join(tmpModelDir, 'model.onnx'),
            2,
            86,
            'downloading',
        );
        await downloadFile(
            `${baseUrl}/${langCode}/tokens.txt`,
            join(tmpModelDir, 'tokens.txt'),
            86,
            94,
            'downloading',
        );

        if (!hasValidModelAssets(tmpModelDir)) {
            await rm(tmpModelDir, { recursive: true, force: true }).catch(() => {});
            throw new Error(`Downloaded Sherpa model is incomplete: ${modelName}`);
        }

        sendProgress(96, 'finalizing');
        await rm(modelDir, { recursive: true, force: true }).catch(() => {});
        await rename(tmpModelDir, modelDir);
        sendProgress(100, 'finalizing');
    } catch (err) {
        throw err;
    }
}

// ---------------------------------------------------------------------------
// Message dispatch
// ---------------------------------------------------------------------------

const methods: Record<string, (...args: never[]) => unknown> = {
    initialize,
    synthesize,
    isReady,
    getNumSpeakers,
    getModelDir,
    dispose,
    downloadModel,
    downloadMmsModel,
};

parentPort?.on('message', async (msg: WorkerRequest) => {
    const { id, method, args } = msg;
    try {
        const fn = methods[method];
        if (!fn) throw new Error(`Unknown Sherpa worker method: ${method}`);
        const result = await fn(...(args as never[]));
        parentPort!.postMessage({ id, result });
    } catch (err) {
        parentPort!.postMessage({
            id,
            error: serializeWorkerError(err),
        });
    }
});
