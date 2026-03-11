import { parentPort } from 'node:worker_threads';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { join, extname } from 'node:path';
import { extract as tarExtract } from 'tar';
import unbzip2 from 'unbzip2-stream';
import { pcmToWav } from './utils.worker';

interface WorkerRequest {
    id: number;
    method: string;
    args: unknown[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsInstance: any = null;
let currentModelDir = '';

function sendProgress(percentage: number): void {
    parentPort!.postMessage({ id: -1, result: { type: 'progress', percentage } });
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

function initialize(modelDir: string): boolean {
    loadSherpa();

    const tokens = join(modelDir, 'tokens.txt');
    if (!existsSync(tokens)) return false;

    const hasLexicon = existsSync(join(modelDir, 'lexicon.txt'));
    const hasDataDir = existsSync(join(modelDir, 'espeak-ng-data'));
    const hasVoicesBin = existsSync(join(modelDir, 'voices.bin'));
    const vocoder = findVocoderFile(modelDir);
    const onnxFiles = findOnnxFiles(modelDir);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const offlineTtsModelConfig: any = {
        numThreads: 1,
        debug: 0,
        provider: 'cpu',
    };

    if (hasVoicesBin) {
        // Kokoro engine
        const modelOnnx = onnxFiles.find((f) => !/vocos|vocoder|hifigan/i.test(f));
        if (!modelOnnx) return false;
        offlineTtsModelConfig.offlineTtsKokoroModelConfig = {
            model: modelOnnx,
            voices: join(modelDir, 'voices.bin'),
            tokens,
            dataDir: hasDataDir ? join(modelDir, 'espeak-ng-data') : '',
            lengthScale: 1.0,
            lexicon: '',
            lang: '',
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

    const config = {
        offlineTtsModelConfig,
        maxNumSentences: 2,
        ruleFsts: '',
        ruleFars: '',
    };

    ttsInstance = sherpaModule.createOfflineTts(config);
    currentModelDir = modelDir;
    return true;
}

function getNumSpeakers(): number {
    return ttsInstance?.numSpeakers ?? 1;
}

function synthesize(text: string, speakerId: number, speed: number): string {
    if (!ttsInstance) throw new Error('Sherpa-ONNX TTS not initialized');
    const audio = ttsInstance.generate({ text, sid: speakerId, speed });
    const wavBuffer = pcmToWav(audio.samples, audio.sampleRate);
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
}

// ---------------------------------------------------------------------------
// Shared download helper
// ---------------------------------------------------------------------------

async function downloadFile(
    url: string,
    destPath: string,
    pctStart: number,
    pctEnd: number,
): Promise<void> {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);

    const contentLength = Number(response.headers.get('content-length') || 0);
    const reader = response.body!.getReader();
    const fileStream = createWriteStream(destPath);
    let downloaded = 0;

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            fileStream.write(value);
            downloaded += value.byteLength;
            if (contentLength > 0) {
                const pct = pctStart + (downloaded / contentLength) * (pctEnd - pctStart);
                sendProgress(Math.round(pct));
            }
        }
        fileStream.end();
        await new Promise<void>((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });
    } catch (err) {
        fileStream.destroy();
        await unlink(destPath).catch(() => {});
        throw err;
    }
}

// ---------------------------------------------------------------------------
// Model download: fetch .tar.bz2, extract to modelsDir/<modelName>/
// ---------------------------------------------------------------------------

async function downloadModel(url: string, modelName: string, modelsDir: string): Promise<void> {
    const tmpFile = join(modelsDir, `${modelName}.tar.bz2`);
    mkdirSync(modelsDir, { recursive: true });
    sendProgress(2);

    try {
        await downloadFile(url, tmpFile, 5, 75);
        sendProgress(80);
        await pipeline(createReadStream(tmpFile), unbzip2(), tarExtract({ cwd: modelsDir }));
        sendProgress(95);
        await unlink(tmpFile).catch(() => {});
        sendProgress(100);
    } catch (err) {
        await unlink(tmpFile).catch(() => {});
        throw err;
    }
}

// ---------------------------------------------------------------------------
// MMS model download: individual model.onnx + tokens.txt
// ---------------------------------------------------------------------------

async function downloadMmsModel(langCode: string, modelsDir: string): Promise<void> {
    const baseUrl = 'https://huggingface.co/willwade/mms-tts-multilingual-models-onnx/resolve/main';
    const modelDir = join(modelsDir, `mms-${langCode}`);
    mkdirSync(modelDir, { recursive: true });
    sendProgress(2);

    try {
        await downloadFile(
            `${baseUrl}/${langCode}/model.onnx`,
            join(modelDir, 'model.onnx'),
            2,
            90,
        );
        await downloadFile(
            `${baseUrl}/${langCode}/tokens.txt`,
            join(modelDir, 'tokens.txt'),
            90,
            98,
        );
        sendProgress(100);
    } catch (err) {
        const { rm } = await import('node:fs/promises');
        await rm(modelDir, { recursive: true, force: true }).catch(() => {});
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
            error: err instanceof Error ? err.message : String(err),
        });
    }
});
