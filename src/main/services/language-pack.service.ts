import { join, dirname } from 'node:path';
import { createWriteStream, existsSync, statSync, readdirSync } from 'node:fs';
import { mkdir, rm, rename } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import * as yauzl from 'yauzl';
import log from 'electron-log';
import type { DownloadableLanguage, InstalledLanguage, LanguageInstallAction } from '@shared/types';
import * as tantivyService from './tantivy.service';
import * as refRepo from '../database/repositories/reference.repository';
import * as languageSourcesRepo from '../database/repositories/language-sources.repository';
import { getIndexesDir } from '@main/lib/app-paths';
import {
    getGitHubReleaseAssetUrl,
    githubHead,
    resolveGitHubDownloadRequest,
} from '@main/lib/github';
import { downloadResumableFile } from '@main/lib/resumable-download';
import type {
    InstalledLanguageSourceType,
    StoredInstalledLanguageSource,
    StoredLanguageHeaders,
} from '@main/database/repositories/language-sources.repository';

export type { InstalledLanguage, DownloadableLanguage } from '@shared/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 60 * 1000;

type LanguageDownloadSource = {
    archivePath: string;
    sourceType: InstalledLanguageSourceType;
    sourceUrl: string;
    headers: StoredLanguageHeaders;
};

type RemoteLanguageSource = {
    sourceType: InstalledLanguageSourceType;
    sourceUrl: string;
    fileName: string;
    headers: StoredLanguageHeaders;
};

export interface GetInstalledLanguagesOptions {
    checkForUpdates?: boolean;
    force?: boolean;
    includeStats?: boolean;
}

export interface LanguageInstallResult {
    action: LanguageInstallAction;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function normalizeHeaderValue(value: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function parseContentLength(value: string | null): number | null {
    const normalized = normalizeHeaderValue(value);
    if (!normalized) {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function getResponseHeaders(response: Response): StoredLanguageHeaders {
    return {
        etag: normalizeHeaderValue(response.headers.get('etag')),
        lastModified: normalizeHeaderValue(response.headers.get('last-modified')),
        contentLength: parseContentLength(response.headers.get('content-length')),
        versionId: normalizeHeaderValue(response.headers.get('x-amz-version-id')),
    };
}

function createEmptyStoredHeaders(): StoredLanguageHeaders {
    return {
        etag: null,
        lastModified: null,
        contentLength: null,
        versionId: null,
    };
}

function getArchiveTempPath(
    indexesDir: string,
    langCode: string,
    sourceType: InstalledLanguageSourceType,
): string {
    return join(indexesDir, `.tmp-${langCode}.${sourceType}.zip.download`);
}

async function getPrimarySourceHeaders(url: string): Promise<StoredLanguageHeaders> {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok ? getResponseHeaders(response) : createEmptyStoredHeaders();
    } catch {
        return createEmptyStoredHeaders();
    }
}

async function getGitHubSourceHeaders(fileName: string): Promise<StoredLanguageHeaders> {
    try {
        const response = await githubHead(fileName);
        return response.ok ? getResponseHeaders(response) : createEmptyStoredHeaders();
    } catch {
        return createEmptyStoredHeaders();
    }
}

function shouldCheckForUpdates(
    source: StoredInstalledLanguageSource | null,
    force = false,
): boolean {
    if (force || !source?.lastCheckedAt) {
        return true;
    }

    return Date.now() - source.lastCheckedAt.getTime() >= UPDATE_CHECK_INTERVAL_MS;
}

function hasLanguageUpdate(
    stored: StoredInstalledLanguageSource,
    remote: StoredLanguageHeaders,
): boolean {
    const keys = ['versionId', 'etag', 'lastModified', 'contentLength'] as const;
    for (const key of keys) {
        const storedValue = stored[key];
        const remoteValue = remote[key];
        if (storedValue != null && remoteValue != null && storedValue !== remoteValue) {
            return true;
        }
    }

    return false;
}

function extractZip(zipPath: string, destDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        yauzl.open(zipPath, { lazyEntries: true }, (err, zipFile) => {
            if (err || !zipFile) {
                return reject(err ?? new Error('Failed to open zip'));
            }

            zipFile.on('error', reject);
            zipFile.on('end', () => {
                zipFile.close();
                resolve();
            });

            zipFile.readEntry();
            zipFile.on('entry', (entry: yauzl.Entry) => {
                const outPath = join(destDir, entry.fileName);

                if (/\/$/.test(entry.fileName)) {
                    mkdir(outPath, { recursive: true })
                        .then(() => zipFile.readEntry())
                        .catch(reject);
                    return;
                }

                mkdir(dirname(outPath), { recursive: true })
                    .then(() => {
                        zipFile.openReadStream(entry, (streamErr, readStream) => {
                            if (streamErr || !readStream) {
                                return reject(
                                    streamErr ?? new Error('Failed to open entry stream'),
                                );
                            }
                            const writeStream = createWriteStream(outPath);
                            pipeline(readStream, writeStream)
                                .then(() => zipFile.readEntry())
                                .catch(reject);
                        });
                    })
                    .catch(reject);
            });
        });
    });
}

async function tryResolveRemoteLanguageSource(
    langCode: string,
    sourceType: InstalledLanguageSourceType,
    fileName: string,
    fallbackSourceUrl?: string,
): Promise<RemoteLanguageSource | null> {
    if (sourceType === 'github') {
        const response = await githubHead(fileName);
        if (!response.ok) {
            return null;
        }

        return {
            sourceType,
            sourceUrl: getGitHubReleaseAssetUrl(fileName),
            fileName,
            headers: getResponseHeaders(response),
        };
    }

    const primaryUrls = [refRepo.getLanguageByCode(langCode)?.url, fallbackSourceUrl].filter(
        (value, index, values): value is string => !!value && values.indexOf(value) === index,
    );

    for (const primaryUrl of primaryUrls) {
        const response = await fetch(primaryUrl, { method: 'HEAD' });
        if (!response.ok) {
            continue;
        }

        return {
            sourceType,
            sourceUrl: primaryUrl,
            fileName,
            headers: getResponseHeaders(response),
        };
    }

    return null;
}

async function resolveRemoteLanguageSource(
    langCode: string,
    stored: StoredInstalledLanguageSource | null,
): Promise<RemoteLanguageSource | null> {
    const lang = refRepo.getLanguageByCode(langCode);
    const fileName = stored?.fileName ?? lang?.fileName;
    if (!fileName) {
        return null;
    }

    if (stored) {
        return tryResolveRemoteLanguageSource(
            langCode,
            stored.sourceType,
            fileName,
            stored.sourceUrl,
        );
    }

    return (
        (await tryResolveRemoteLanguageSource(langCode, 'primary', fileName, lang?.url)) ??
        (await tryResolveRemoteLanguageSource(langCode, 'github', fileName))
    );
}

async function refreshInstalledLanguageUpdate(
    langCode: string,
    options: Pick<GetInstalledLanguagesOptions, 'force'> = {},
): Promise<boolean> {
    const stored = languageSourcesRepo.getInstalledLanguageSource(langCode);
    if (!shouldCheckForUpdates(stored, options.force)) {
        return stored?.updateAvailable ?? false;
    }

    const checkedAt = new Date().toISOString();

    try {
        const remote = await resolveRemoteLanguageSource(langCode, stored);
        if (!remote) {
            if (stored) {
                languageSourcesRepo.setInstalledLanguageUpdateStatus(langCode, {
                    updateAvailable: stored.updateAvailable,
                    lastCheckedAt: checkedAt,
                });
            }
            return stored?.updateAvailable ?? false;
        }

        if (!stored) {
            languageSourcesRepo.upsertInstalledLanguageSource({
                langCode,
                sourceType: remote.sourceType,
                sourceUrl: remote.sourceUrl,
                fileName: remote.fileName,
                ...remote.headers,
                updateAvailable: false,
                lastCheckedAt: checkedAt,
            });
            return false;
        }

        const updateAvailable = hasLanguageUpdate(stored, remote.headers);
        languageSourcesRepo.setInstalledLanguageUpdateStatus(langCode, {
            updateAvailable,
            lastCheckedAt: checkedAt,
        });
        return updateAvailable;
    } catch (error) {
        log.warn(`[language-pack] Update check failed for "${langCode}"`, error);
        return stored?.updateAvailable ?? false;
    }
}

async function downloadLanguageArchive(
    indexesDir: string,
    langCode: string,
    onProgress: (pct: number) => void,
): Promise<LanguageDownloadSource> {
    const lang = refRepo.getLanguageByCode(langCode);
    if (!lang) {
        throw new Error(`Language "${langCode}" not found in reference database`);
    }

    const primaryArchivePath = getArchiveTempPath(indexesDir, langCode, 'primary');
    try {
        await downloadResumableFile({
            url: lang.url,
            destinationPath: primaryArchivePath,
            reuseExistingFile: true,
            onProgress: (progress) => onProgress(progress.percentage),
            onWarning: (warning) => log.warn('[language-pack] Primary download warning', warning),
        });

        return {
            archivePath: primaryArchivePath,
            sourceType: 'primary',
            sourceUrl: lang.url,
            headers: await getPrimarySourceHeaders(lang.url),
        };
    } catch (error) {
        log.warn('[language-pack] Primary download error, trying fallback:', error);
    }

    const githubArchivePath = getArchiveTempPath(indexesDir, langCode, 'github');
    const request = await resolveGitHubDownloadRequest(lang.fileName);
    await downloadResumableFile({
        url: request.url,
        headers: request.headers,
        destinationPath: githubArchivePath,
        reuseExistingFile: true,
        onProgress: (progress) => onProgress(progress.percentage),
        onWarning: (warning) => log.warn('[language-pack] GitHub download warning', warning),
    });

    return {
        archivePath: githubArchivePath,
        sourceType: 'github',
        sourceUrl: getGitHubReleaseAssetUrl(lang.fileName),
        headers: await getGitHubSourceHeaders(lang.fileName),
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function downloadLanguagePack(
    langCode: string,
    onProgress: (pct: number) => void,
): Promise<LanguageInstallResult> {
    const lang = refRepo.getLanguageByCode(langCode);
    if (!lang) {
        throw new Error(`Language "${langCode}" not found in reference database`);
    }

    const indexesDir = getIndexesDir();
    await mkdir(indexesDir, { recursive: true });

    const tmpDir = join(indexesDir, `.tmp-${langCode}`);
    const finalDir = join(indexesDir, langCode);
    const wasInstalled =
        existsSync(finalDir) || !!languageSourcesRepo.getInstalledLanguageSource(langCode);
    if (existsSync(tmpDir)) {
        await rm(tmpDir, { recursive: true });
    }

    try {
        const archive = await downloadLanguageArchive(indexesDir, langCode, onProgress);

        await mkdir(tmpDir, { recursive: true });
        await extractZip(archive.archivePath, tmpDir);

        if (existsSync(finalDir)) {
            await rm(finalDir, { recursive: true });
        }

        await rename(tmpDir, finalDir);
        await tantivyService.openIndex(langCode);

        languageSourcesRepo.upsertInstalledLanguageSource({
            langCode,
            sourceType: archive.sourceType,
            sourceUrl: archive.sourceUrl,
            fileName: lang.fileName,
            ...archive.headers,
            updateAvailable: false,
        });

        await rm(archive.archivePath, { force: true });
        await rm(getArchiveTempPath(indexesDir, langCode, 'primary'), { force: true });
        await rm(getArchiveTempPath(indexesDir, langCode, 'github'), { force: true });

        log.info(`[language-pack] Installed language pack "${langCode}"`);

        return {
            action: wasInstalled ? 'updated' : 'installed',
        };
    } catch (error) {
        if (existsSync(tmpDir)) {
            await rm(tmpDir, { recursive: true, force: true });
        }
        throw error;
    }
}

export async function deleteLanguagePack(langCode: string): Promise<void> {
    await tantivyService.closeAllIndexes();

    const indexDir = join(getIndexesDir(), langCode);
    if (existsSync(indexDir)) {
        await rm(indexDir, { recursive: true });
    }

    await tantivyService.initializeTantivy();
    languageSourcesRepo.deleteInstalledLanguageSource(langCode);

    log.info(`[language-pack] Deleted language pack "${langCode}"`);
}

export async function refreshInstalledLanguageUpdates(
    options: Pick<GetInstalledLanguagesOptions, 'force'> = {},
): Promise<void> {
    const codes = tantivyService.getInstalledLanguages();
    await Promise.all(codes.map((langCode) => refreshInstalledLanguageUpdate(langCode, options)));
}

export async function getInstalledLanguages(
    options: GetInstalledLanguagesOptions = {},
): Promise<InstalledLanguage[]> {
    if (options.checkForUpdates) {
        await refreshInstalledLanguageUpdates({ force: options.force });
    }

    const codes = tantivyService.getInstalledLanguages();
    const indexesDir = getIndexesDir();
    const includeStats = options.includeStats !== false;
    const allSermonsCount = includeStats ? refRepo.getAllSermons().length : 0;

    return codes.map((code) => {
        const lang = refRepo.getLanguageByCode(code);
        const source = languageSourcesRepo.getInstalledLanguageSource(code);
        const dirPath = join(indexesDir, code);
        return {
            code,
            language: lang?.nativeTitle ?? code,
            enLanguage: lang?.title ?? code,
            sermonsCount: includeStats
                ? lang?.translationsSupport
                    ? refRepo.getUniqueSermonCountForLanguage(code)
                    : allSermonsCount
                : 0,
            sizeOnDisk: includeStats ? getDirectorySize(dirPath) : 0,
            updateAvailable: source?.updateAvailable ?? false,
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
