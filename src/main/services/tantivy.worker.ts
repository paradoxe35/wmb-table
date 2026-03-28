import { parentPort } from 'node:worker_threads';
import {
    closeAllIndexes,
    getInstalledLanguages,
    initializeIndexes,
    openIndexEntry,
} from './tantivy-worker/shared';
import {
    getMatchingParagraphs,
    getSearchSnippet,
    getSermonParagraphs,
    searchSermons,
} from './tantivy-worker/search-reads';
import { findSimilarSermons } from './tantivy-worker/similarity';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkerRequest {
    id: number;
    method: string;
    args: unknown[];
}

interface WorkerResponse {
    id: number;
    result?: unknown;
    error?: string;
}

// ---------------------------------------------------------------------------
// Methods exposed to main process
// ---------------------------------------------------------------------------

function initialize(indexesDir: string, langTitles: Record<string, string>): void {
    initializeIndexes(indexesDir, langTitles);
}

function openIndex(indexesDir: string, langCode: string, langEnglishTitle: string | null): void {
    openIndexEntry(indexesDir, langCode, langEnglishTitle);
}

// ---------------------------------------------------------------------------
// Method dispatch
// ---------------------------------------------------------------------------

const methods: Record<string, (...args: never[]) => unknown> = {
    initialize,
    openIndex,
    closeAllIndexes,
    getInstalledLanguages,
    getSermonParagraphs,
    searchSermons,
    getSearchSnippet,
    getMatchingParagraphs,
    findSimilarSermons,
};

parentPort?.on('message', (msg: WorkerRequest) => {
    const { id, method, args } = msg;
    try {
        const fn = methods[method];
        if (!fn) throw new Error(`Unknown worker method: ${method}`);
        const result = fn(...(args as never[]));
        const response: WorkerResponse = { id, result };
        parentPort!.postMessage(response);
    } catch (err) {
        const response: WorkerResponse = {
            id,
            error: err instanceof Error ? err.message : String(err),
        };
        parentPort!.postMessage(response);
    }
});
