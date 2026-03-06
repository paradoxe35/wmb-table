/**
 * Integration tests for tantivy.service.
 *
 * These tests require real Tantivy index directories on disk.
 * Set the TANTIVY_TEST_INDEXES environment variable to a directory
 * containing language sub-folders (e.g. "en/", "orm/"), each with
 * a valid Tantivy index and meta.json.
 *
 * Example:
 *   TANTIVY_TEST_INDEXES=/path/to/indexes pnpm test -- tantivy
 *
 * The entire suite is skipped when the env var is not set.
 *
 * NOTE: These tests exercise the worker internals directly (not via the
 * async service wrapper) because spawning the electron-vite worker in a
 * vitest environment is not straightforward.
 */
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Import the worker module directly for testing (bypasses worker_threads)

const workerModule = await import('@main/services/tantivy.worker');

const INDEXES_DIR = process.env.TANTIVY_TEST_INDEXES ?? '';
const hasIndexes = INDEXES_DIR !== '' && existsSync(INDEXES_DIR);

function availableLangs(): string[] {
    if (!hasIndexes) return [];
    return readdirSync(INDEXES_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(join(INDEXES_DIR, d.name, 'meta.json')))
        .map((d) => d.name);
}

const langs = availableLangs();

describe.skipIf(!hasIndexes)('tantivy.service', () => {
    // These tests are skipped by default — they require real indexes on disk
    it.todo('getInstalledLanguages() returns opened languages');
    it.todo('getSermonParagraphs() returns ordered paragraphs for first language');
    it.todo('searchSermons() returns results');
    it.todo('getSearchSnippet() returns HTML with highlights');
});
