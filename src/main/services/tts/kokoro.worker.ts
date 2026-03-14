import { parentPort } from 'node:worker_threads';
import { readFile, unlink } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pcmToWav } from './utils.worker';

interface WorkerRequest {
    id: number;
    method: string;
    args: unknown[];
}

interface WorkerResponse {
    id: number;
    result?: unknown;
    error?: string;
}

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let kokoroInstance: any = null;
let modelReady = false;
let cachedVoices: string[] = [];
let modelsDir = ''; // set once via downloadModel / synthesize

// ---------------------------------------------------------------------------
// Worker methods
// ---------------------------------------------------------------------------

function sendProgress(percentage: number): void {
    parentPort!.postMessage({ id: -1, result: { type: 'progress', percentage } });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeProgressCallback(): (progress: any) => void {
    // @huggingface/transformers progress events: { status, file, progress, loaded, total }
    const fileProgress = new Map<string, number>();
    return (event) => {
        if (!event || typeof event !== 'object') return;
        if (event.status === 'progress' && event.file) {
            fileProgress.set(event.file, event.progress ?? 0);
            const values = [...fileProgress.values()];
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            sendProgress(Math.round(5 + avg * 0.9));
        } else if (event.status === 'done' && event.file) {
            fileProgress.set(event.file, 100);
        }
    };
}

async function loadModel(withProgress: boolean): Promise<void> {
    const { KokoroTTS, env } = await import('@pngwasi/kokoro-js');

    if (modelsDir) {
        env.cacheDir = modelsDir;
    }

    if (withProgress) sendProgress(2);

    kokoroInstance = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: 'q8',
        device: 'cpu',
        progress_callback: withProgress ? makeProgressCallback() : undefined,
    });
    modelReady = true;
    cachedVoices = kokoroInstance.list_voices?.() ?? [];

    if (withProgress) sendProgress(100);
}

async function ensureModel(): Promise<void> {
    if (kokoroInstance) return;
    await loadModel(false);
}

function initialize(dir: string): void {
    modelsDir = dir;
}

async function downloadModel(): Promise<void> {
    await loadModel(true);
}

async function synthesize(text: string, voice: string): Promise<string> {
    await ensureModel();

    const audio = await kokoroInstance.generate(text, { voice });

    let wavBuffer: Buffer;
    if (typeof audio.toBlob === 'function') {
        const blob = await audio.toBlob();
        wavBuffer = Buffer.from(await blob.arrayBuffer());
    } else if (audio.data) {
        wavBuffer = pcmToWav(audio.data, audio.sampling_rate ?? 24000);
    } else {
        const tmpPath = join(tmpdir(), `kokoro-${Date.now()}.wav`);
        await audio.save(tmpPath);
        wavBuffer = await readFile(tmpPath);
        await unlink(tmpPath);
    }

    return wavBuffer.toString('base64');
}

function isModelReady(): boolean {
    if (modelReady && kokoroInstance != null) return true;
    if (!modelsDir) return false;
    try {
        return existsSync(modelsDir) && readdirSync(modelsDir).length > 0;
    } catch {
        return false;
    }
}

function listVoices(): string[] {
    return cachedVoices;
}

function dispose(): void {
    kokoroInstance = null;
    modelReady = false;
    cachedVoices = [];
}

// ---------------------------------------------------------------------------
// Message dispatch
// ---------------------------------------------------------------------------

const methods: Record<string, (...args: never[]) => unknown> = {
    initialize,
    downloadModel,
    synthesize,
    isModelReady,
    listVoices,
    dispose,
};

parentPort?.on('message', async (msg: WorkerRequest) => {
    const { id, method, args } = msg;
    try {
        const fn = methods[method];
        if (!fn) throw new Error(`Unknown TTS worker method: ${method}`);
        const result = await fn(...(args as never[]));
        const response: WorkerResponse = { id, result };
        parentPort!.postMessage(response);
    } catch (err) {
        const response: WorkerResponse = {
            id,
            error: err instanceof Error ? err.message : String(err),
        };
        parentPort!.postMessage(response);
    }
});
