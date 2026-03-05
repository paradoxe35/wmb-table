import { app } from 'electron';
import { join } from 'node:path';
import { createWriteStream, existsSync, statSync, readdirSync } from 'node:fs';
import { mkdir, rm, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import log from 'electron-log';
import * as tantivyService from './tantivy.service';
import * as sermonMetadataService from './sermon-metadata.service';
import * as sermonMetadataRepo from '../database/repositories/sermon-metadata.repository';

const execFileAsync = promisify(execFile);

const MANIFEST_URL =
    'https://github.com/paradoxe35/wmb-table/releases/download/v1.0.0/manifest.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ManifestLanguage {
    code: string;
    language: string;
    sermons_available: number;
    sermons_with_audio: number;
    filename: string;
    filesize: number;
    checksum: string;
}

export interface ManifestBible {
    code: string;
    language: string;
    filename: string;
    filesize: number;
    checksum: string;
}

export interface Manifest {
    version: number;
    languages: ManifestLanguage[];
    bible: ManifestBible[];
}

export interface InstalledLanguage {
    code: string;
    language: string;
    sermonsCount: number;
    sizeOnDisk: number;
}

export interface DownloadableLanguage {
    code: string;
    language: string;
    sermonsAvailable: number;
    sermonsWithAudio: number;
    filesize: number;
    installed: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getIndexesDir(): string {
    return join(app.getPath('userData'), 'indexes');
}

function getDirectorySize(dirPath: string): number {
    let total = 0;
    try {
        const entries = readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dirPath, entry.name);
            if (entry.isFile()) {
                total += statSync(fullPath).size;
            } else if (entry.isDirectory()) {
                total += getDirectorySize(fullPath);
            }
        }
    } catch {
        // directory may not exist
    }
    return total;
}

async function verifyChecksum(filePath: string, expected: string): Promise<boolean> {
    const data = await readFile(filePath);
    const actual = createHash('sha256').update(data).digest('hex');
    return actual === expected;
}

async function extractZip(zipPath: string, destDir: string): Promise<void> {
    if (process.platform === 'win32') {
        await execFileAsync('powershell', [
            '-NoProfile',
            '-Command',
            `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`,
        ]);
    } else {
        await execFileAsync('unzip', ['-o', zipPath, '-d', destDir]);
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchManifest(): Promise<Manifest> {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as Manifest;
}

export async function downloadLanguagePack(
    langCode: string,
    onProgress: (pct: number) => void,
): Promise<void> {
    const manifest = await fetchManifest();
    const langInfo = manifest.languages.find((l) => l.code === langCode);
    if (!langInfo) {
        throw new Error(`Language "${langCode}" not found in manifest`);
    }

    const indexesDir = getIndexesDir();
    await mkdir(indexesDir, { recursive: true });

    const tmpDir = join(indexesDir, `.tmp-${langCode}`);
    const finalDir = join(indexesDir, langCode);
    const zipPath = join(indexesDir, `.tmp-${langCode}.zip`);

    // Clean up any previous temp artifacts
    if (existsSync(tmpDir)) await rm(tmpDir, { recursive: true });
    if (existsSync(zipPath)) await rm(zipPath);

    // Download ZIP with progress
    const downloadUrl = `https://github.com/paradoxe35/wmb-table/releases/download/v1.0.0/${langInfo.filename}`;
    const response = await fetch(downloadUrl);
    if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const fileStream = createWriteStream(zipPath);
    let downloaded = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fileStream.write(value);
            downloaded += value.length;
            if (contentLength > 0) {
                onProgress(Math.round((downloaded / contentLength) * 100));
            }
        }
    } finally {
        fileStream.end();
        await new Promise<void>((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });
    }

    // Verify checksum
    const checksumOk = await verifyChecksum(zipPath, langInfo.checksum);
    if (!checksumOk) {
        await rm(zipPath);
        throw new Error(`Checksum verification failed for "${langCode}"`);
    }

    // Extract
    await mkdir(tmpDir, { recursive: true });
    await extractZip(zipPath, tmpDir);
    await rm(zipPath);

    // Replace existing index directory
    if (existsSync(finalDir)) await rm(finalDir, { recursive: true });
    await rename(tmpDir, finalDir);

    // Open index and build metadata
    tantivyService.openIndex(langCode);
    sermonMetadataService.buildMetadataFromIndex(langCode);

    log.info(`[language-pack] Installed language pack "${langCode}"`);
}

export async function deleteLanguagePack(langCode: string): Promise<void> {
    // Close all indexes and re-open the remaining ones
    tantivyService.closeAllIndexes();

    const indexDir = join(getIndexesDir(), langCode);
    if (existsSync(indexDir)) {
        await rm(indexDir, { recursive: true });
    }

    sermonMetadataRepo.deleteByLanguage(langCode);

    // Re-initialize remaining indexes
    tantivyService.initializeTantivy();

    log.info(`[language-pack] Deleted language pack "${langCode}"`);
}

export function getInstalledLanguages(): InstalledLanguage[] {
    const codes = tantivyService.getInstalledLanguages();
    const indexesDir = getIndexesDir();

    return codes.map((code) => {
        const sermons = sermonMetadataRepo.getSermonList(code);
        const dirPath = join(indexesDir, code);
        return {
            code,
            language: code,
            sermonsCount: sermons.length,
            sizeOnDisk: getDirectorySize(dirPath),
        };
    });
}

export async function getDownloadableLanguages(): Promise<DownloadableLanguage[]> {
    const manifest = await fetchManifest();
    const installed = new Set(tantivyService.getInstalledLanguages());

    return manifest.languages.map((lang) => ({
        code: lang.code,
        language: lang.language,
        sermonsAvailable: lang.sermons_available,
        sermonsWithAudio: lang.sermons_with_audio,
        filesize: lang.filesize,
        installed: installed.has(lang.code),
    }));
}
