import { app } from 'electron';
import { join } from 'node:path';
import { createWriteStream, existsSync, statSync, readdirSync } from 'node:fs';
import { mkdir, rm, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import log from 'electron-log';
import type { InstalledLanguage, DownloadableLanguage } from '@shared/types';
import * as tantivyService from './tantivy.service';
import * as refRepo from '../database/repositories/reference.repository';

const execFileAsync = promisify(execFile);

export type { InstalledLanguage, DownloadableLanguage } from '@shared/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FALLBACK_DOWNLOAD_BASE = 'https://github.com/paradoxe35/wmb-table/releases/download/v1.0.0';

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

export async function downloadLanguagePack(
    langCode: string,
    onProgress: (pct: number) => void,
): Promise<void> {
    const lang = refRepo.getLanguageByCode(langCode);
    if (!lang) {
        throw new Error(`Language "${langCode}" not found in reference database`);
    }

    const indexesDir = getIndexesDir();
    await mkdir(indexesDir, { recursive: true });

    const tmpDir = join(indexesDir, `.tmp-${langCode}`);
    const finalDir = join(indexesDir, langCode);
    const zipPath = join(indexesDir, `.tmp-${langCode}.zip`);

    // Clean up any previous temp artifacts
    if (existsSync(tmpDir)) await rm(tmpDir, { recursive: true });
    if (existsSync(zipPath)) await rm(zipPath);

    // Primary: data.sqlite language.url, Fallback: GitHub releases
    const primaryUrl = lang.url;
    const fallbackUrl = `${FALLBACK_DOWNLOAD_BASE}/${lang.fileName}`;

    let response: Response | null = null;
    try {
        response = await fetch(primaryUrl);
        if (!response.ok) {
            log.warn(
                `[language-pack] Primary download failed (${response.status}), trying fallback`,
            );
            response = null;
        }
    } catch (err) {
        log.warn('[language-pack] Primary download error, trying fallback:', err);
    }

    if (!response) {
        response = await fetch(fallbackUrl);
        if (!response.ok) {
            throw new Error(
                `Download failed from both sources: ${response.status} ${response.statusText}`,
            );
        }
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

    // Extract
    await mkdir(tmpDir, { recursive: true });
    await extractZip(zipPath, tmpDir);
    await rm(zipPath);

    // Replace existing index directory
    if (existsSync(finalDir)) await rm(finalDir, { recursive: true });
    await rename(tmpDir, finalDir);

    // Open index (no metadata build needed — data.sqlite is the source of truth)
    await tantivyService.openIndex(langCode);

    log.info(`[language-pack] Installed language pack "${langCode}"`);
}

export async function deleteLanguagePack(langCode: string): Promise<void> {
    // Close all indexes and re-open the remaining ones
    await tantivyService.closeAllIndexes();

    const indexDir = join(getIndexesDir(), langCode);
    if (existsSync(indexDir)) {
        await rm(indexDir, { recursive: true });
    }

    // Re-initialize remaining indexes
    await tantivyService.initializeTantivy();

    log.info(`[language-pack] Deleted language pack "${langCode}"`);
}

export async function getInstalledLanguages(): Promise<InstalledLanguage[]> {
    const codes = tantivyService.getInstalledLanguages();
    const indexesDir = getIndexesDir();

    return codes.map((code) => {
        const lang = refRepo.getLanguageByCode(code);
        const dirPath = join(indexesDir, code);
        const translationCount = lang?.translationsSupport
            ? refRepo.getUniqueSermonCountForLanguage(code)
            : refRepo.getAllSermons().length;
        return {
            code,
            language: lang?.nativeTitle ?? code,
            enLanguage: lang?.title ?? code,
            sermonsCount: translationCount,
            sizeOnDisk: getDirectorySize(dirPath),
        };
    });
}

export async function getDownloadableLanguages(): Promise<DownloadableLanguage[]> {
    const allLanguages = refRepo.getAllLanguages();
    const installed = new Set(tantivyService.getInstalledLanguages());

    return allLanguages.map((lang) => {
        const sermonsAvailable = lang.translationsSupport
            ? refRepo.getUniqueSermonCountForLanguage(lang.code)
            : refRepo.getAllSermons().length;
        const audioCount = refRepo.getAudioCountForLanguage(lang.code);

        // Parse fileSize string like "31.17 MB" to bytes
        let filesize = 0;
        const match = lang.fileSize.match(/([\d.]+)\s*(\w+)/);
        if (match) {
            const num = parseFloat(match[1]);
            const unit = match[2].toUpperCase();
            if (unit === 'MB') filesize = Math.round(num * 1024 * 1024);
            else if (unit === 'KB') filesize = Math.round(num * 1024);
            else if (unit === 'GB') filesize = Math.round(num * 1024 * 1024 * 1024);
            else filesize = Math.round(num);
        }

        return {
            code: lang.code,
            language: lang.nativeTitle,
            enLanguage: lang.title,
            sermonsAvailable,
            sermonsWithAudio: audioCount,
            filesize,
            installed: installed.has(lang.code),
        };
    });
}
