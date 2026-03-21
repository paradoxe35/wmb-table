import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { app } from 'electron';

const APP_DIR = join(homedir(), '.wmb-table');

export function getAppDataDir(): string {
    mkdirSync(APP_DIR, { recursive: true });
    return APP_DIR;
}

export function getDatabaseDir(): string {
    const dir = join(APP_DIR, 'databases');
    mkdirSync(dir, { recursive: true });
    return dir;
}

export function getIndexesDir(): string {
    const dir = join(APP_DIR, 'indexes');
    mkdirSync(dir, { recursive: true });
    return dir;
}

export function getTtsCacheDir(): string {
    const dir = join(APP_DIR, 'tts-cache');
    mkdirSync(dir, { recursive: true });
    return dir;
}

export function getTtsModelsDir(): string {
    const dir = join(APP_DIR, 'tts-models');
    mkdirSync(dir, { recursive: true });
    return dir;
}

export function getAudioCacheDir(): string {
    const dir = join(APP_DIR, 'audio-cache');
    mkdirSync(dir, { recursive: true });
    return dir;
}

export function getAiModelsDir(): string {
    const dir = join(APP_DIR, 'ai-models');
    mkdirSync(dir, { recursive: true });
    return dir;
}

// ── Bundled resources ──

export function getTtsResourceDir(): string {
    if (app.isPackaged) {
        return join(process.resourcesPath, 'tts');
    }
    return join(__dirname, '../../resources/tts');
}
