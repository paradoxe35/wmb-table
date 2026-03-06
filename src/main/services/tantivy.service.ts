import { Worker } from 'node:worker_threads';
import log from 'electron-log';
import type { SermonParagraph } from '@shared/types';
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
    hitCount: number;
}

export interface SearchSermonResult {
    hits: GroupedSearchHit[];
    total: number;
}

// ---------------------------------------------------------------------------
// Worker management
// ---------------------------------------------------------------------------

let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

// Installed languages cache (kept in sync via lifecycle calls)
let installedLanguagesCache: string[] = [];

function getWorker(): Worker {
    if (!worker) throw new Error('Tantivy worker not initialized');
    return worker;
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

export async function initializeTantivy(): Promise<void> {
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
    await call('initialize', indexesDir, langTitles);
    installedLanguagesCache = await call<string[]>('getInstalledLanguages');
    log.info(`[tantivy] Worker initialized, ${installedLanguagesCache.length} indexes loaded`);
}

export async function openIndex(langCode: string): Promise<void> {
    const lang = refRepo.getLanguageByCode(langCode);
    await call('openIndex', getIndexesDir(), langCode, lang?.title ?? null);
    installedLanguagesCache = await call<string[]>('getInstalledLanguages');
}

export async function closeAllIndexes(): Promise<void> {
    await call('closeAllIndexes');
    installedLanguagesCache = [];
}

export function getInstalledLanguages(): string[] {
    return installedLanguagesCache;
}

export async function getSermonParagraphs(
    langCode: string,
    translationId: number,
    sermonId?: number,
): Promise<SermonParagraph[]> {
    return call<SermonParagraph[]>('getSermonParagraphs', langCode, translationId, sermonId);
}

export async function searchSermons(
    langCode: string,
    queryText: string,
    limit: number,
    offset: number,
): Promise<SearchSermonResult> {
    return call<SearchSermonResult>('searchSermons', langCode, queryText, limit, offset);
}

export async function getSearchSnippet(
    langCode: string,
    queryText: string,
    docAddress: { segmentOrd: number; doc: number },
): Promise<string> {
    return call<string>('getSearchSnippet', langCode, queryText, docAddress);
}

export async function getSermonParagraphCount(
    langCode: string,
    translationId: number,
    sermonId?: number,
): Promise<number> {
    return call<number>('getSermonParagraphCount', langCode, translationId, sermonId);
}

export async function terminateWorker(): Promise<void> {
    if (worker) {
        await worker.terminate();
        worker = null;
        pending.clear();
        installedLanguagesCache = [];
    }
}
