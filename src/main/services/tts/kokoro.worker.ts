import { parentPort } from 'node:worker_threads';
import { access, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

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

// ---------------------------------------------------------------------------
// Helper: PCM Float32 → WAV Buffer
// ---------------------------------------------------------------------------

function pcmToWav(pcmData: Float32Array, sampleRate: number): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmData.length * 2;
    const headerSize = 44;
    const buffer = Buffer.alloc(headerSize + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < pcmData.length; i++) {
        const sample = Math.max(-1, Math.min(1, pcmData[i]));
        buffer.writeInt16LE(sample < 0 ? sample * 0x8000 : sample * 0x7fff, headerSize + i * 2);
    }

    return buffer;
}

// ---------------------------------------------------------------------------
// Worker methods
// ---------------------------------------------------------------------------

function sendProgress(percentage: number): void {
    parentPort!.postMessage({ id: -1, result: { type: 'progress', percentage } });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeProgressCallback(): (progress: any) => void {
    // @huggingface/transformers progress events: { status, file, progress, loaded, total }
    // Track files being downloaded and compute overall progress
    const fileProgress = new Map<string, number>();
    return (event) => {
        if (!event || typeof event !== 'object') return;
        if (event.status === 'progress' && event.file) {
            fileProgress.set(event.file, event.progress ?? 0);
            // Average progress across all tracked files, scale to 5–95 range
            const values = [...fileProgress.values()];
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            sendProgress(Math.round(5 + avg * 0.9));
        } else if (event.status === 'done') {
            // A file finished
            if (event.file) fileProgress.set(event.file, 100);
        }
    };
}

async function loadModel(withProgress: boolean): Promise<void> {
    const { KokoroTTS } = await import('@pngwasi/kokoro-js');

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

async function downloadModel(): Promise<void> {
    await loadModel(true);
}

async function synthesize(text: string, voice: string, modelsDir: string): Promise<string> {
    await ensureModel();

    const audio = await kokoroInstance.generate(text, { voice });

    let wavBuffer: Buffer;
    if (typeof audio.toBlob === 'function') {
        const blob = await audio.toBlob();
        wavBuffer = Buffer.from(await blob.arrayBuffer());
    } else if (audio.data) {
        wavBuffer = pcmToWav(audio.data, audio.sampling_rate ?? 24000);
    } else {
        const tmpPath = join(modelsDir, `tmp-${Date.now()}.wav`);
        await audio.save(tmpPath);
        wavBuffer = await readFile(tmpPath);
        await unlink(tmpPath);
    }

    return wavBuffer.toString('base64');
}

async function isModelReady(): Promise<boolean> {
    if (modelReady && kokoroInstance) return true;

    const cacheDir =
        process.env.HF_HOME ??
        process.env.HUGGINGFACE_HUB_CACHE ??
        join(homedir(), '.cache', 'huggingface', 'hub');
    const modelCacheDir = join(cacheDir, 'models--onnx-community--Kokoro-82M-v1.0-ONNX');
    try {
        await access(modelCacheDir);
        return true;
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
