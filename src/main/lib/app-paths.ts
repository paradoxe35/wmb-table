import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

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
