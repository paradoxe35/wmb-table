import { app } from 'electron';
import { join } from 'node:path';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import Database from 'better-sqlite3';
import log from 'electron-log';
import { getDatabaseDir } from '@main/lib/app-paths';
import { githubDownload, resolveGitHubDownloadRequest } from '@main/lib/github';
import { downloadResumableFile, replaceFileAtomically } from '@main/lib/resumable-download';
import { SimpleCache } from '@main/lib/simple-cache';
import { normalizeBibleAbbreviation } from '@shared/types';

const BIBLE_INDEX_FILE = 'bible-index.json';
const READONLY_SQLITE_MMAP_SIZE = 64 * 1024 * 1024;
const READONLY_SQLITE_CACHE_SIZE = -4000;

// Cache the remote index fetch for 24 hours to avoid unnecessary network requests
const remoteIndexCache = new SimpleCache<BibleVersion[]>('bible-remote-index', 24 * 60 * 60 * 1000);

export interface BibleVersion {
    langCode: string;
    abbreviation: string;
    name: string;
    fileName: string;
    type: 'local' | 'remote';
}

let bibleIndex: BibleVersion[] | null = null;
let activeBibleDb: Database.Database | null = null;
let activeVersion: BibleVersion | null = null;

function normalizeBibleVersion(version: BibleVersion): BibleVersion {
    return {
        ...version,
        abbreviation: normalizeBibleAbbreviation(version.abbreviation),
    };
}

function getResourceDir(): string {
    if (app.isPackaged) {
        return join(process.resourcesPath, 'database');
    }
    return join(__dirname, '../../resources/database');
}

function getBibleDataDir(): string {
    return join(getDatabaseDir(), 'bibles');
}

/**
 * Load the local (bundled) bible-index.json.
 */
function loadLocalIndex(): BibleVersion[] {
    const indexPath = join(getResourceDir(), BIBLE_INDEX_FILE);
    if (!existsSync(indexPath)) {
        log.warn('bible-index.json not found at', indexPath);
        return [];
    }
    return (JSON.parse(readFileSync(indexPath, 'utf-8')) as BibleVersion[]).map(
        normalizeBibleVersion,
    );
}

/**
 * Merge local and remote indexes.
 * Local entries are authoritative — remote entries only add new versions (by abbreviation).
 */
function mergeIndexes(local: BibleVersion[], remote: BibleVersion[]): BibleVersion[] {
    const seen = new Set(local.map((version) => version.abbreviation));
    const merged = [...local];
    for (const remoteVersion of remote.map(normalizeBibleVersion)) {
        if (!seen.has(remoteVersion.abbreviation)) {
            merged.push({ ...remoteVersion, type: 'remote' });
            seen.add(remoteVersion.abbreviation);
        }
    }
    return merged;
}

function getVersionsForLanguageFromIndex(index: BibleVersion[], langCode: string): BibleVersion[] {
    return index.filter((version) => version.langCode === langCode).map(normalizeBibleVersion);
}

function dedupeBibleVersions(versions: BibleVersion[]): BibleVersion[] {
    const seen = new Set<string>();
    const deduped: BibleVersion[] = [];

    for (const version of versions) {
        const normalized = normalizeBibleVersion(version);
        if (seen.has(normalized.abbreviation)) {
            continue;
        }
        seen.add(normalized.abbreviation);
        deduped.push(normalized);
    }

    return deduped;
}

function mergeLocalAndRemoteIndex(remoteVersions: BibleVersion[] = []): BibleVersion[] {
    return mergeIndexes(loadLocalIndex(), remoteVersions);
}

function getCachedRemoteVersions(options: { allowStale?: boolean } = {}): BibleVersion[] {
    const { allowStale = false } = options;
    const cached =
        remoteIndexCache.get() ?? (allowStale ? remoteIndexCache.getStale() : null) ?? [];

    return cached.map(normalizeBibleVersion);
}

function updateBibleIndex(remoteVersions: BibleVersion[] = []): BibleVersion[] {
    bibleIndex = mergeLocalAndRemoteIndex(remoteVersions);
    return bibleIndex;
}

async function fetchRemoteIndexFromRelease(): Promise<BibleVersion[]> {
    log.info(`Fetching remote bible index: ${BIBLE_INDEX_FILE}`);
    const response = await githubDownload(BIBLE_INDEX_FILE);
    if (!response.ok) {
        throw new Error(`Failed to fetch remote bible index: ${response.status}`);
    }

    return ((await response.json()) as BibleVersion[]).map(normalizeBibleVersion);
}

export function loadBibleIndex(): BibleVersion[] {
    if (bibleIndex) return bibleIndex;

    return updateBibleIndex(getCachedRemoteVersions({ allowStale: true }));
}

/**
 * Fetch the remote bible-index.json from GitHub release, cache it, and merge into the index.
 * Returns the updated merged index. Non-blocking — call and forget on startup if desired.
 */
export async function refreshRemoteIndex(
    options: { force?: boolean } = {},
): Promise<BibleVersion[]> {
    const { force = false } = options;
    try {
        if (force) {
            remoteIndexCache.remove();
        }

        const remoteVersions = await remoteIndexCache.getOrFetch(fetchRemoteIndexFromRelease);
        log.info(`Cached remote bible index (${remoteVersions.length} versions)`);
        return updateBibleIndex(remoteVersions);
    } catch (err) {
        log.warn('Failed to refresh remote bible index:', err);
        return loadBibleIndex();
    }
}

export function getAllBibleVersions(): BibleVersion[] {
    return loadBibleIndex();
}

export function getBibleVersionsForLanguage(langCode: string): BibleVersion[] {
    return loadBibleIndex()
        .filter((version) => version.langCode === langCode)
        .map(normalizeBibleVersion);
}

export function resolveBibleVersionsForDisplay(
    index: BibleVersion[],
    langCode: string,
    isAvailable: (version: BibleVersion) => boolean,
): BibleVersion[] {
    const requestedVersions = getVersionsForLanguageFromIndex(index, langCode);
    if (requestedVersions.some(isAvailable)) {
        return requestedVersions;
    }

    const fallbackAvailableVersion =
        (langCode !== 'en'
            ? getVersionsForLanguageFromIndex(index, 'en').find(isAvailable)
            : undefined) ?? index.find(isAvailable);

    if (fallbackAvailableVersion) {
        const fallbackAvailableVersions = getVersionsForLanguageFromIndex(
            index,
            fallbackAvailableVersion.langCode,
        ).filter(isAvailable);
        if (requestedVersions.length > 0 && fallbackAvailableVersion.langCode !== langCode) {
            return dedupeBibleVersions([...fallbackAvailableVersions, ...requestedVersions]);
        }
        return fallbackAvailableVersions;
    }

    if (requestedVersions.length > 0) {
        return requestedVersions;
    }

    if (langCode !== 'en') {
        const englishVersions = getVersionsForLanguageFromIndex(index, 'en');
        if (englishVersions.length > 0) {
            return englishVersions;
        }
    }

    const [firstVersion] = index;
    return firstVersion ? getVersionsForLanguageFromIndex(index, firstVersion.langCode) : [];
}

export function getBibleVersionsForResolvedLanguage(langCode: string): BibleVersion[] {
    return resolveBibleVersionsForDisplay(loadBibleIndex(), langCode, isBibleAvailable);
}

export function getDefaultBibleVersion(langCode: string): BibleVersion | null {
    const versions = getBibleVersionsForLanguage(langCode).filter(isBibleAvailable);
    return versions.length > 0 ? versions[0] : null;
}

export function hasAvailableBibleVersionForLanguage(langCode: string): boolean {
    return getBibleVersionsForLanguage(langCode).some(isBibleAvailable);
}

export function getAvailableBibleVersionsForLanguage(langCode: string): BibleVersion[] {
    return getBibleVersionsForLanguage(langCode).filter(isBibleAvailable);
}

export function getBibleVersionToAutoActivateAfterDownload(
    langCode: string | null,
    abbreviation: string,
): BibleVersion | null {
    if (!langCode) {
        return null;
    }

    const downloadedVersion = findBibleVersion(abbreviation);
    if (
        !downloadedVersion ||
        downloadedVersion.langCode !== langCode ||
        !isBibleAvailable(downloadedVersion)
    ) {
        return null;
    }

    const availableVersions = getAvailableBibleVersionsForLanguage(langCode);
    if (availableVersions.length !== 1) {
        return null;
    }

    return availableVersions[0].abbreviation === downloadedVersion.abbreviation
        ? downloadedVersion
        : null;
}

/**
 * Resolve the file path for a Bible version.
 * Local: bundled in resources/database/
 * Remote: downloaded to ~/.wmb-table/databases/bibles/
 */
export function resolveBiblePath(version: BibleVersion): string {
    if (version.type === 'local') {
        return join(getResourceDir(), version.fileName);
    }
    return join(getBibleDataDir(), version.fileName);
}

export function isBibleAvailable(version: BibleVersion): boolean {
    return existsSync(resolveBiblePath(version));
}

function getBibleDownloadTempPath(version: BibleVersion): string {
    return `${resolveBiblePath(version)}.download`;
}

function validateBibleDatabase(dbPath: string): void {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
        const quickCheck = db.prepare('PRAGMA quick_check(1)').pluck().get() as string | undefined;
        if (quickCheck !== 'ok') {
            throw new Error(
                `Bible database integrity check failed: ${quickCheck ?? 'unknown error'}`,
            );
        }
    } finally {
        db.close();
    }
}

function openBibleDb(version: BibleVersion): Database.Database {
    const dbPath = resolveBiblePath(version);
    if (!existsSync(dbPath)) {
        throw new Error(`Bible database file not found: ${dbPath}`);
    }
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    db.pragma(`mmap_size = ${READONLY_SQLITE_MMAP_SIZE}`);
    db.pragma(`cache_size = ${READONLY_SQLITE_CACHE_SIZE}`);
    return db;
}

function ensureActiveBibleDb(): Database.Database | null {
    if (activeBibleDb || !activeVersion) {
        return activeBibleDb;
    }

    try {
        activeBibleDb = openBibleDb(activeVersion);
        return activeBibleDb;
    } catch (err) {
        log.error('Failed to lazily open active Bible database:', err);
        return null;
    }
}

function replaceActiveBible(version: BibleVersion): BibleVersion | null {
    try {
        const validatedDb = openBibleDb(version);
        const previousDb = activeBibleDb;
        validatedDb.close();

        activeBibleDb = null;
        activeVersion = version;
        previousDb?.close();

        log.info(`Selected Bible ${version.name} (${version.fileName})`);
        return version;
    } catch (err) {
        log.error('Failed to switch Bible database:', err);
        return null;
    }
}

function resolveBibleVersionForLanguage(
    langCode: string,
    preferredAbbreviation?: string | null,
): BibleVersion | null {
    const preferred = normalizeBibleAbbreviation(preferredAbbreviation);

    const pickForLanguage = (candidateLang: string): BibleVersion | null => {
        const versions = getBibleVersionsForLanguage(candidateLang).filter(isBibleAvailable);
        if (versions.length === 0) {
            return null;
        }

        if (preferred) {
            const preferredVersion = versions.find(
                (version) => normalizeBibleAbbreviation(version.abbreviation) === preferred,
            );
            if (preferredVersion) {
                return preferredVersion;
            }
        }

        return versions[0];
    };

    return (
        pickForLanguage(langCode) ??
        (langCode !== 'en' ? pickForLanguage('en') : null) ??
        loadBibleIndex().find(isBibleAvailable) ??
        null
    );
}

export function getResolvedBibleVersionForLanguage(
    langCode: string,
    preferredAbbreviation?: string | null,
) {
    return resolveBibleVersionForLanguage(langCode, preferredAbbreviation);
}

export function switchBibleForLanguage(
    langCode: string,
    preferredAbbreviation?: string | null,
): BibleVersion | null {
    const version = resolveBibleVersionForLanguage(langCode, preferredAbbreviation);
    if (!version) {
        log.warn(`No Bible version available for language '${langCode}' or any fallback`);
        return null;
    }

    return replaceActiveBible(version);
}

/**
 * Switch to a specific Bible version by abbreviation.
 */
export function switchBibleVersion(abbreviation: string): BibleVersion | null {
    const version = findBibleVersion(abbreviation);
    if (!version) {
        log.warn(`Bible version '${abbreviation}' not found in index`);
        return null;
    }
    if (!isBibleAvailable(version)) {
        log.warn(`Bible version '${abbreviation}' file not available`);
        return null;
    }

    return replaceActiveBible(version);
}

export function findBibleVersion(abbreviation: string): BibleVersion | null {
    const normalized = normalizeBibleAbbreviation(abbreviation);

    const bibleVersion = loadBibleIndex().find(
        (v) => normalizeBibleAbbreviation(v.abbreviation) === normalized,
    );

    return bibleVersion ?? null;
}

export function withBibleDb<T>(
    abbreviation: string | null | undefined,
    reader: (db: Database.Database) => T,
): T | null {
    const normalized = normalizeBibleAbbreviation(abbreviation);
    if (!normalized) {
        const db = ensureActiveBibleDb();
        return db ? reader(db) : null;
    }

    if (activeVersion && normalizeBibleAbbreviation(activeVersion.abbreviation) === normalized) {
        const db = ensureActiveBibleDb();
        return db ? reader(db) : null;
    }

    const version = findBibleVersion(normalized);
    if (!version || !isBibleAvailable(version)) {
        return null;
    }

    const db = openBibleDb(version);
    try {
        return reader(db);
    } finally {
        db.close();
    }
}

/**
 * Download a remote Bible version from GitHub release.
 */
export async function downloadBibleVersion(
    abbreviation: string,
    onProgress?: (percentage: number) => void,
): Promise<void> {
    const normalized = normalizeBibleAbbreviation(abbreviation);
    const version = loadBibleIndex().find((v) => v.abbreviation === normalized);
    if (!version) {
        throw new Error(`Bible version '${abbreviation}' not found in index`);
    }

    if (version.type !== 'remote') {
        throw new Error(`Bible version '${abbreviation}' is local, not remote`);
    }

    // Skip download if already available on disk
    if (isBibleAvailable(version)) {
        log.info(`Bible already downloaded: ${version.fileName}, skipping download`);
        onProgress?.(100);
        return;
    }

    const targetDir = getBibleDataDir();
    mkdirSync(targetDir, { recursive: true });
    const targetPath = join(targetDir, version.fileName);
    const tempPath = getBibleDownloadTempPath(version);

    log.info(`Downloading Bible: ${version.fileName}`);

    const request = await resolveGitHubDownloadRequest(version.fileName);
    const result = await downloadResumableFile({
        url: request.url,
        headers: request.headers,
        destinationPath: tempPath,
        reuseExistingFile: true,
        onProgress: (progress) => onProgress?.(progress.percentage),
        onWarning: (warning) => log.warn('Bible download warning:', warning),
    });

    try {
        validateBibleDatabase(tempPath);
    } catch (error) {
        await rm(tempPath, { force: true }).catch(() => {});
        throw error;
    }

    await replaceFileAtomically(tempPath, targetPath);

    log.info(
        `Bible downloaded: ${version.fileName} (${(result.downloadedBytes / 1024 / 1024).toFixed(1)} MB)`,
    );
}

export function getActiveBibleDb(): Database.Database | null {
    return ensureActiveBibleDb();
}

export function peekActiveBibleDb(): Database.Database | null {
    return activeBibleDb;
}

export function getActiveVersion(): BibleVersion | null {
    return activeVersion;
}

export function closeBibleDb(): void {
    if (activeBibleDb) {
        activeBibleDb.close();
        activeBibleDb = null;
        activeVersion = null;
    }
}

// For testing: allow injecting a database
export function _setBibleDbForTesting(db: Database.Database | null, version?: BibleVersion): void {
    activeBibleDb = db;
    activeVersion = version ?? null;
}
