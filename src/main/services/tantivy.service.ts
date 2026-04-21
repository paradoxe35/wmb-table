import { Worker } from 'node:worker_threads';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import log from 'electron-log';
import type { SermonParagraph, MatchingParagraphSnippet, SimilarParagraph } from '@shared/types';
import * as refRepo from '@main/database/repositories/reference.repository';
import { getIndexesDir } from '@main/lib/app-paths';
import workerPath from './tantivy.worker?modulePath';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { SermonParagraph } from '@shared/types';

export interface GroupedSearchHit {
    translationId: number;
    tantivySermonDate: number;
    score: number;
    bestDocAddress: { segmentOrd: number; doc: number };
    bestParagraphIndex: number;
    hitCount: number;
}

export interface SearchSermonResult {
    hits: GroupedSearchHit[];
    total: number;
    totalIsExact: boolean;
}

/** Raw result from the worker before sermon ID/title resolution. */
export interface FindSimilarRawResult {
    hits: Array<{
        translationId: number;
        tantivySermonDate: number;
        score: number;
        paragraphs: SimilarParagraph[];
    }>;
    total: number;
}

// ---------------------------------------------------------------------------
// Worker management
// ---------------------------------------------------------------------------

let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
const inFlightByLanguage = new Map<string, number>();
const MAX_LOADED_INDEXES = 1;
let indexMutationQueue: Promise<void> = Promise.resolve();

// Installed languages are discovered from disk. Loaded languages track worker residency.
let installedLanguagesCache: string[] = [];
let loadedLanguagesCache: string[] = [];

function getWorker(): Worker {
    if (!worker) throw new Error('Tantivy worker not initialized');
    return worker;
}

function enqueueIndexMutation<T>(operation: () => Promise<T>): Promise<T> {
    const next = indexMutationQueue.then(operation, operation);
    indexMutationQueue = next.then(
        () => undefined,
        () => undefined,
    );
    return next;
}

function getInstalledLanguageCodesOnDisk(): string[] {
    const indexesDir = getIndexesDir();
    if (!existsSync(indexesDir)) {
        return [];
    }

    try {
        return readdirSync(indexesDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .filter((langCode) => existsSync(join(indexesDir, langCode, 'meta.json')))
            .sort((left, right) => left.localeCompare(right));
    } catch (error) {
        log.warn('[tantivy] Failed to scan installed indexes:', error);
        return [];
    }
}

function call<T>(method: string, ...args: unknown[]): Promise<T> {
    const id = ++requestId;
    return new Promise<T>((resolve, reject) => {
        pending.set(id, {
            resolve: resolve as (v: unknown) => void,
            reject,
        });
        getWorker().postMessage({ id, method, args });
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a map of langCode → English title for all languages in the reference DB */
function getLangTitlesMap(): Record<string, string> {
    const all = refRepo.getAllLanguages();
    const map: Record<string, string> = {};
    for (const lang of all) {
        map[lang.code] = lang.title;
    }
    return map;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function syncLoadedLanguagesCache(): Promise<void> {
    loadedLanguagesCache = await call<string[]>('getInstalledLanguages');
}

function incrementInFlight(langCode: string): void {
    inFlightByLanguage.set(langCode, (inFlightByLanguage.get(langCode) ?? 0) + 1);
}

async function closeIndexNoLock(langCode: string): Promise<void> {
    if (!loadedLanguagesCache.includes(langCode)) {
        return;
    }

    await call('closeIndex', langCode);
    await syncLoadedLanguagesCache();
}

async function evictIdleIndexesNoLock(): Promise<void> {
    if (loadedLanguagesCache.length <= MAX_LOADED_INDEXES) {
        return;
    }

    for (const langCode of [...loadedLanguagesCache]) {
        if (loadedLanguagesCache.length <= MAX_LOADED_INDEXES) {
            break;
        }
        if ((inFlightByLanguage.get(langCode) ?? 0) > 0) {
            continue;
        }
        await closeIndexNoLock(langCode);
    }
}

async function ensureIndexLoadedNoLock(langCode: string): Promise<void> {
    if (loadedLanguagesCache.includes(langCode)) {
        return;
    }

    installedLanguagesCache = getInstalledLanguageCodesOnDisk();
    if (!installedLanguagesCache.includes(langCode)) {
        throw new Error(`No Tantivy index installed for language "${langCode}"`);
    }

    const lang = refRepo.getLanguageByCode(langCode);
    await call('openIndex', getIndexesDir(), langCode, lang?.title ?? null);
    await syncLoadedLanguagesCache();
}

async function ensureIndexLoaded(langCode: string): Promise<void> {
    await enqueueIndexMutation(async () => {
        await ensureIndexLoadedNoLock(langCode);
        await evictIdleIndexesNoLock();
    });
}

async function releaseIdleIndexes(): Promise<void> {
    await enqueueIndexMutation(async () => {
        await evictIdleIndexesNoLock();
    });
}

async function runWithLoadedIndex<T>(langCode: string, operation: () => Promise<T>): Promise<T> {
    incrementInFlight(langCode);
    try {
        await ensureIndexLoaded(langCode);
        return await operation();
    } finally {
        const nextCount = (inFlightByLanguage.get(langCode) ?? 1) - 1;
        if (nextCount > 0) {
            inFlightByLanguage.set(langCode, nextCount);
        } else {
            inFlightByLanguage.delete(langCode);
        }
        await releaseIdleIndexes();
    }
}

export async function initializeTantivy(preloadLangCode?: string | null): Promise<void> {
    if (worker) {
        await worker.terminate();
        worker = null;
        pending.clear();
        loadedLanguagesCache = [];
    }

    worker = new Worker(workerPath);
    worker.on('message', (msg: { id: number; result?: unknown; error?: string }) => {
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        if (msg.error) {
            p.reject(new Error(msg.error));
        } else {
            p.resolve(msg.result);
        }
    });
    worker.on('error', (err) => {
        log.error('[tantivy-worker] Worker error:', err);
    });

    const indexesDir = getIndexesDir();
    const langTitles = getLangTitlesMap();
    installedLanguagesCache = getInstalledLanguageCodesOnDisk();
    const preloadCodes =
        preloadLangCode && installedLanguagesCache.includes(preloadLangCode)
            ? [preloadLangCode]
            : [];

    await call('initialize', indexesDir, langTitles, preloadCodes);
    await syncLoadedLanguagesCache();
    log.info(
        `[tantivy] Worker initialized, ${loadedLanguagesCache.length} index(es) loaded out of ${installedLanguagesCache.length} installed`,
    );
}

export async function openIndex(langCode: string): Promise<void> {
    await enqueueIndexMutation(async () => {
        await ensureIndexLoadedNoLock(langCode);
        await evictIdleIndexesNoLock();
    });
}

export async function closeAllIndexes(): Promise<void> {
    await enqueueIndexMutation(async () => {
        await call('closeAllIndexes');
        loadedLanguagesCache = [];
        installedLanguagesCache = getInstalledLanguageCodesOnDisk();
    });
}

export function getInstalledLanguages(): string[] {
    return installedLanguagesCache;
}

export function getLoadedLanguages(): string[] {
    return loadedLanguagesCache;
}

export async function getSermonParagraphs(
    langCode: string,
    translationId: number,
    sermonId?: number,
): Promise<SermonParagraph[]> {
    return runWithLoadedIndex(langCode, () =>
        call<SermonParagraph[]>('getSermonParagraphs', langCode, translationId, sermonId),
    );
}

export async function searchSermons(
    langCode: string,
    queryText: string,
    limit: number,
    offset: number,
    mode: 'any' | 'all' | 'exact' = 'all',
): Promise<SearchSermonResult> {
    return runWithLoadedIndex(langCode, () =>
        call<SearchSermonResult>('searchSermons', langCode, queryText, limit, offset, mode),
    );
}

export async function getSearchSnippet(
    langCode: string,
    queryText: string,
    docAddress: { segmentOrd: number; doc: number },
): Promise<string> {
    return runWithLoadedIndex(langCode, () =>
        call<string>('getSearchSnippet', langCode, queryText, docAddress),
    );
}

export async function getMatchingParagraphs(
    langCode: string,
    queryText: string,
    translationId: number,
    sermonDate: number,
    mode: 'any' | 'all' | 'exact' = 'all',
): Promise<MatchingParagraphSnippet[]> {
    return runWithLoadedIndex(langCode, () =>
        call<MatchingParagraphSnippet[]>(
            'getMatchingParagraphs',
            langCode,
            queryText,
            translationId,
            sermonDate,
            mode,
        ),
    );
}

export async function findSimilarSermons(
    langCode: string,
    translationId: number,
    sermonDate: number,
    paragraphIndex: number,
    limit?: number,
): Promise<FindSimilarRawResult> {
    return runWithLoadedIndex(langCode, () =>
        call<FindSimilarRawResult>(
            'findSimilarSermons',
            langCode,
            translationId,
            sermonDate,
            paragraphIndex,
            limit,
        ),
    );
}

export async function terminateWorker(): Promise<void> {
    if (worker) {
        await worker.terminate();
        worker = null;
        pending.clear();
        installedLanguagesCache = [];
        loadedLanguagesCache = [];
    }
}
