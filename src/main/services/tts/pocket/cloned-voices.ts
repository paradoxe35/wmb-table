import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodeWav, encodeWav } from '../wav';

const FOLDER = 'cloned';
const EXTENSION = '.wav';
const NAME_PATTERN = /^[a-zA-Z0-9_-]{1,32}$/;

export interface ClonedAudio {
    samples: Float32Array;
    sampleRate: number;
}

function folder(modelsDir: string): string {
    return join(modelsDir, FOLDER);
}

function fileOf(modelsDir: string, name: string): string {
    return join(folder(modelsDir), `${name}${EXTENSION}`);
}

export function assertValidName(name: string): void {
    if (!NAME_PATTERN.test(name)) {
        throw new Error('Le nom de la voix doit contenir 1 à 32 lettres, chiffres, - ou _.');
    }
}

export async function listClonedVoices(modelsDir: string): Promise<string[]> {
    try {
        const entries = await readdir(folder(modelsDir));
        return entries
            .filter((entry) => entry.endsWith(EXTENSION))
            .map((entry) => entry.slice(0, -EXTENSION.length));
    } catch {
        return [];
    }
}

/**
 * Recordings are normalised to WAV on the way in, so playback never has to know what the
 * reader uploaded.
 */
export async function saveClonedVoice(
    modelsDir: string,
    name: string,
    audio: ClonedAudio,
): Promise<void> {
    assertValidName(name);
    await mkdir(folder(modelsDir), { recursive: true });
    await writeFile(fileOf(modelsDir, name), encodeWav(audio.samples, audio.sampleRate));
}

export async function readClonedVoice(modelsDir: string, name: string): Promise<ClonedAudio> {
    const path = fileOf(modelsDir, name);
    if (!existsSync(path)) throw new Error(`Voix clonée introuvable: ${name}`);

    const decoded = decodeWav(await readFile(path));
    if (!decoded) throw new Error(`Voix clonée illisible: ${name}`);
    return { samples: decoded.samples, sampleRate: decoded.sampleRate };
}

export async function deleteClonedVoice(modelsDir: string, name: string): Promise<void> {
    await rm(fileOf(modelsDir, name), { force: true });
}
