import { app } from 'electron';
import { join } from 'node:path';
import { readFileSync, existsSync, createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import log from 'electron-log';
import { getDatabaseDir } from '@main/lib/app-paths';

export interface BibleVersion {
    langCode: string;
    abbreviation: string;
    name: string;
    fileName: string;
    type: 'local' | 'remote';
}

const GITHUB_RELEASE_BASE = 'https://github.com/paradoxe35/wmb-table/releases/download/v1.0.0';
const REMOTE_INDEX_URL = `${GITHUB_RELEASE_BASE}/bible-index.json`;

let bibleIndex: BibleVersion[] | null = null;
let activeBibleDb: Database.Database | null = null;
let activeVersion: BibleVersion | null = null;

function getResourceDir(): string {
    if (app.isPackaged) {
        return join(process.resourcesPath, 'database');
    }
    return join(__dirname, '../../resources/database');
}

function getBibleDataDir(): string {
    return join(getDatabaseDir(), 'bibles');
}

function getCachedRemoteIndexPath(): string {
    return join(getBibleDataDir(), 'bible-index.remote.json');
}

/**
 * Load the local (bundled) bible-index.json.
 */
function loadLocalIndex(): BibleVersion[] {
    const indexPath = join(getResourceDir(), 'bible-index.json');
    if (!existsSync(indexPath)) {
        log.warn('bible-index.json not found at', indexPath);
        return [];
    }
    return JSON.parse(readFileSync(indexPath, 'utf-8')) as BibleVersion[];
}

/**
 * Load the cached remote index from ~/.wmb-table (if available).
 */
function loadCachedRemoteIndex(): BibleVersion[] {
    const cachePath = getCachedRemoteIndexPath();
    if (!existsSync(cachePath)) return [];
    try {
        return JSON.parse(readFileSync(cachePath, 'utf-8')) as BibleVersion[];
    } catch {
        log.warn('Failed to parse cached remote bible-index.json');
        return [];
    }
}

/**
 * Merge local and remote indexes.
 * Local entries are authoritative — remote entries only add new versions (by abbreviation).
 */
function mergeIndexes(local: BibleVersion[], remote: BibleVersion[]): BibleVersion[] {
    const seen = new Set(local.map((v) => v.abbreviation));
    const merged = [...local];
    for (const rv of remote) {
        if (!seen.has(rv.abbreviation)) {
            // Remote entries are always type: 'remote'
            merged.push({ ...rv, type: 'remote' });
            seen.add(rv.abbreviation);
        }
    }
    return merged;
}

export function loadBibleIndex(): BibleVersion[] {
    if (bibleIndex) return bibleIndex;

    const local = loadLocalIndex();
    const cached = loadCachedRemoteIndex();
    bibleIndex = mergeIndexes(local, cached);
    return bibleIndex;
}

/**
 * Fetch the remote bible-index.json from GitHub release, cache it, and merge into the index.
 * Returns the updated merged index. Non-blocking — call and forget on startup if desired.
 */
export async function refreshRemoteIndex(): Promise<BibleVersion[]> {
    try {
        log.info(`Fetching remote bible index: ${REMOTE_INDEX_URL}`);
        const response = await fetch(REMOTE_INDEX_URL);
        if (!response.ok) {
            log.warn(`Failed to fetch remote bible index: ${response.status}`);
            return loadBibleIndex();
        }

        const remoteVersions = (await response.json()) as BibleVersion[];

        // Cache to disk
        const cacheDir = getBibleDataDir();
        mkdirSync(cacheDir, { recursive: true });
        writeFileSync(getCachedRemoteIndexPath(), JSON.stringify(remoteVersions, null, 2));
        log.info(`Cached remote bible index (${remoteVersions.length} versions)`);

        // Re-merge
        const local = loadLocalIndex();
        bibleIndex = mergeIndexes(local, remoteVersions);
        return bibleIndex;
    } catch (err) {
        log.warn('Failed to refresh remote bible index:', err);
        return loadBibleIndex();
    }
}

export function getAllBibleVersions(): BibleVersion[] {
    return loadBibleIndex();
}

export function getBibleVersionsForLanguage(langCode: string): BibleVersion[] {
    return loadBibleIndex().filter((v) => v.langCode === langCode);
}

export function getDefaultBibleVersion(langCode: string): BibleVersion | null {
    const versions = getBibleVersionsForLanguage(langCode);
    return versions.length > 0 ? versions[0] : null;
}

/**
 * Resolve the file path for a Bible version.
 * Local: bundled in resources/database/
 * Remote: downloaded to ~/.wmb-table/databases/bibles/
 */
function resolveBiblePath(version: BibleVersion): string {
    if (version.type === 'local') {
        return join(getResourceDir(), version.fileName);
    }
    return join(getBibleDataDir(), version.fileName);
}

export function isBibleAvailable(version: BibleVersion): boolean {
    return existsSync(resolveBiblePath(version));
}

function openBibleDb(version: BibleVersion): Database.Database {
    const dbPath = resolveBiblePath(version);
    if (!existsSync(dbPath)) {
        throw new Error(`Bible database file not found: ${dbPath}`);
    }
    const db = new Database(dbPath, { readonly: true });
    db.pragma('mmap_size = 268435456');
    db.pragma('cache_size = -10000');
    return db;
}

export function switchBibleForLanguage(langCode: string): void {
    // Close current Bible DB if open
    if (activeBibleDb) {
        activeBibleDb.close();
        activeBibleDb = null;
        activeVersion = null;
    }

    // Try requested language, then 'en' fallback, then first available
    let version = getDefaultBibleVersion(langCode);
    if (!version || !isBibleAvailable(version)) {
        if (langCode !== 'en') {
            version = getDefaultBibleVersion('en');
        }
    }
    // Last resort: first available version that has a file
    if (!version || !isBibleAvailable(version)) {
        version = loadBibleIndex().find((v) => isBibleAvailable(v)) ?? null;
    }

    if (!version) {
        log.warn(`No Bible version available for language '${langCode}' or any fallback`);
        return;
    }

    try {
        activeBibleDb = openBibleDb(version);
        activeVersion = version;
        log.info(`Switched Bible to ${version.name} (${version.fileName})`);
    } catch (err) {
        log.error('Failed to open Bible database:', err);
    }
}

/**
 * Switch to a specific Bible version by abbreviation.
 */
export function switchBibleVersion(abbreviation: string): void {
    const version = loadBibleIndex().find((v) => v.abbreviation === abbreviation);
    if (!version) {
        log.warn(`Bible version '${abbreviation}' not found in index`);
        return;
    }
    if (!isBibleAvailable(version)) {
        log.warn(`Bible version '${abbreviation}' file not available`);
        return;
    }

    if (activeBibleDb) {
        activeBibleDb.close();
        activeBibleDb = null;
        activeVersion = null;
    }

    try {
        activeBibleDb = openBibleDb(version);
        activeVersion = version;
        log.info(`Switched Bible to ${version.name} (${version.fileName})`);
    } catch (err) {
        log.error('Failed to open Bible database:', err);
    }
}

/**
 * Download a remote Bible version from GitHub release.
 */
export async function downloadBibleVersion(
    abbreviation: string,
    onProgress?: (percentage: number) => void,
): Promise<void> {
    const version = loadBibleIndex().find((v) => v.abbreviation === abbreviation);
    if (!version) throw new Error(`Bible version '${abbreviation}' not found in index`);
    if (version.type !== 'remote')
        throw new Error(`Bible version '${abbreviation}' is local, not remote`);

    const targetDir = getBibleDataDir();
    mkdirSync(targetDir, { recursive: true });
    const targetPath = join(targetDir, version.fileName);

    const url = `${GITHUB_RELEASE_BASE}/${version.fileName}`;
    log.info(`Downloading Bible: ${url}`);

    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Failed to download Bible: ${response.status} ${response.statusText}`);

    const totalBytes = Number(response.headers.get('content-length') || 0);
    let downloadedBytes = 0;

    const fileStream = createWriteStream(targetPath);
    const body = response.body;
    if (!body) throw new Error('No response body');

    const reader = body.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fileStream.write(value);
            downloadedBytes += value.length;
            if (totalBytes > 0 && onProgress) {
                onProgress(Math.round((downloadedBytes / totalBytes) * 100));
            }
        }
    } finally {
        fileStream.end();
    }

    await new Promise<void>((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
    });

    log.info(
        `Bible downloaded: ${version.fileName} (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`,
    );
}

export function getActiveBibleDb(): Database.Database | null {
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
