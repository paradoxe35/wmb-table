import { parentPort } from 'node:worker_threads';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sherpaOnnx: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsInstance: any = null;
let currentModelDir = '';

function sendProgress(percentage: number): void {
    parentPort!.postMessage({ id: -1, result: { type: 'progress', percentage } });
}

// ---------------------------------------------------------------------------
// PCM → WAV
// ---------------------------------------------------------------------------

function pcmToWav(samples: Float32Array, sampleRate: number): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = samples.length * 2;
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

    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(sample < 0 ? sample * 0x8000 : sample * 0x7fff, headerSize + i * 2);
    }

    return buffer;
}

// ---------------------------------------------------------------------------
// Native library path setup (cross-platform)
// ---------------------------------------------------------------------------

function ensureLibraryPath(): void {
    const platform = os.platform() === 'win32' ? 'win' : os.platform();
    const arch = os.arch();
    const pkgName = `sherpa-onnx-${platform}-${arch}`;

    let libDir: string | null = null;
    try {
        const pkgPath = require.resolve(`${pkgName}/package.json`);
        libDir = join(pkgPath, '..');
    } catch {
        const candidates = [
            join(__dirname, '..', '..', 'node_modules', pkgName),
            join(__dirname, '..', '..', 'node_modules.asar.unpacked', pkgName),
        ];
        const pnpmIdx = __dirname.indexOf(`node_modules${sep}.pnpm`);
        if (pnpmIdx !== -1) {
            const base = __dirname.slice(0, pnpmIdx + 'node_modules'.length);
            candidates.push(join(base, '.pnpm', `${pkgName}@*`, 'node_modules', pkgName));
        }
        for (const c of candidates) {
            if (existsSync(c)) {
                libDir = c;
                break;
            }
        }
    }

    if (!libDir) return;

    if (os.platform() === 'darwin') {
        const cur = process.env.DYLD_LIBRARY_PATH ?? '';
        if (!cur.includes(libDir)) {
            process.env.DYLD_LIBRARY_PATH = libDir + (cur ? `:${cur}` : '');
        }
    } else if (os.platform() === 'linux') {
        const cur = process.env.LD_LIBRARY_PATH ?? '';
        if (!cur.includes(libDir)) {
            process.env.LD_LIBRARY_PATH = libDir + (cur ? `:${cur}` : '');
        }
    }
}

function loadSherpa(): void {
    if (!sherpaOnnx) {
        ensureLibraryPath();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        sherpaOnnx = require('sherpa-onnx-node');
    }
}

// ---------------------------------------------------------------------------
// Worker methods
// ---------------------------------------------------------------------------

function initialize(modelDir: string): boolean {
    loadSherpa();

    const modelOnnx = join(modelDir, 'model.onnx');
    const tokens = join(modelDir, 'tokens.txt');
    if (!existsSync(modelOnnx) || !existsSync(tokens)) return false;

    const hasLexicon = existsSync(join(modelDir, 'lexicon.txt'));
    const hasDataDir = existsSync(join(modelDir, 'espeak-ng-data'));
    const hasVoicesBin = existsSync(join(modelDir, 'voices.bin'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
        model: { debug: false, numThreads: 2, provider: 'cpu' },
        maxNumSentences: 2,
    };

    if (hasVoicesBin) {
        config.model.kokoro = {
            model: modelOnnx,
            voices: join(modelDir, 'voices.bin'),
            tokens,
            dataDir: hasDataDir ? join(modelDir, 'espeak-ng-data') : undefined,
        };
    } else {
        config.model.vits = {
            model: modelOnnx,
            tokens,
            lexicon: hasLexicon ? join(modelDir, 'lexicon.txt') : undefined,
            dataDir: hasDataDir ? join(modelDir, 'espeak-ng-data') : undefined,
        };
    }

    ttsInstance = new sherpaOnnx.OfflineTts(config);
    currentModelDir = modelDir;
    return true;
}

function synthesize(text: string, speakerId: number, speed: number): string {
    if (!ttsInstance) throw new Error('Sherpa-ONNX TTS not initialized');
    const audio = ttsInstance.generate({ text, sid: speakerId, speed });
    const wavBuffer = pcmToWav(new Float32Array(audio.samples), audio.sampleRate);
    return wavBuffer.toString('base64');
}

function isReady(): boolean {
    return ttsInstance !== null;
}

function getModelDir(): string {
    return currentModelDir;
}

function dispose(): void {
    ttsInstance = null;
    currentModelDir = '';
}

// ---------------------------------------------------------------------------
// Model download: fetch .tar.bz2, extract to modelsDir/<modelName>/
// ---------------------------------------------------------------------------

async function downloadModel(url: string, modelName: string, modelsDir: string): Promise<void> {
    const tmpFile = join(modelsDir, `${modelName}.tar.bz2`);
    mkdirSync(modelsDir, { recursive: true });
    sendProgress(2);

    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    const contentLength = Number(response.headers.get('content-length') || 0);
    const reader = response.body!.getReader();
    const fileStream = createWriteStream(tmpFile);
    let downloaded = 0;

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            fileStream.write(value);
            downloaded += value.byteLength;
            if (contentLength > 0) {
                sendProgress(Math.round(5 + (downloaded / contentLength) * 70));
            }
        }
        fileStream.end();
        await new Promise<void>((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });

        sendProgress(80);

        // Node.js zlib doesn't support bzip2 — use system tar
        // Windows 10+ ships with tar.exe that supports bzip2 via -j flag
        const tarCmd = os.platform() === 'win32' ? 'tar.exe' : 'tar';
        await new Promise<void>((resolve, reject) => {
            const p = spawn(tarCmd, ['xjf', tmpFile, '-C', modelsDir], { stdio: 'ignore' });
            p.on('close', (code) =>
                code === 0 ? resolve() : reject(new Error(`tar extraction failed (code ${code})`)),
            );
            p.on('error', reject);
        });

        sendProgress(95);
        await unlink(tmpFile).catch(() => {});
        sendProgress(100);
    } catch (err) {
        await unlink(tmpFile).catch(() => {});
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
    getModelDir,
    dispose,
    downloadModel,
};

parentPort?.on('message', async (msg: WorkerRequest) => {
    const { id, method, args } = msg;
    try {
        const fn = methods[method];
        if (!fn) throw new Error(`Unknown Sherpa worker method: ${method}`);
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
