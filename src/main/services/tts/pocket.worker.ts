import { parentPort } from 'node:worker_threads';
import { PocketEngine, type PocketOptions, type VoiceSource } from './pocket/engine';
import { bundleDir, installBundle } from './pocket/installer';
import { encodeWav } from './wav';

interface WorkerRequest {
    id: number;
    method: string;
    args: unknown[];
}

let engine: PocketEngine | null = null;
let loadedDir = '';

function sendProgress(percentage: number): void {
    parentPort?.postMessage({
        id: -1,
        result: { type: 'progress', percentage, phase: 'downloading' },
    });
}

const methods = {
    async initialize(modelsDir: string, bundle: string): Promise<boolean> {
        const dir = bundleDir(modelsDir, bundle);
        if (engine && loadedDir === dir) return true;

        engine?.dispose();
        engine = await PocketEngine.load(dir);
        loadedDir = dir;
        return true;
    },

    async synthesize(text: string, voice: VoiceSource, options: PocketOptions): Promise<string> {
        if (!engine) throw new Error("Le moteur Pocket TTS n'est pas initialisé.");
        const audio = await engine.synthesize(text, voice, options);
        return encodeWav(audio.samples, audio.sampleRate).toString('base64');
    },

    async downloadBundle(modelsDir: string, bundle: string): Promise<void> {
        await installBundle(modelsDir, bundle, sendProgress);
    },

    dispose(): void {
        engine?.dispose();
        engine = null;
        loadedDir = '';
    },
};

parentPort?.on('message', async ({ id, method, args }: WorkerRequest) => {
    try {
        const fn = methods[method as keyof typeof methods];
        if (!fn) throw new Error(`Méthode Pocket inconnue: ${method}`);
        const result = await (fn as (...a: unknown[]) => unknown)(...args);
        parentPort!.postMessage({ id, result });
    } catch (error) {
        parentPort!.postMessage({
            id,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
