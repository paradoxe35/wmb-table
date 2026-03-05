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
 */
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    _openIndexFromPathForTesting,
    _clearCacheForTesting,
    getInstalledLanguages,
    getSermonParagraphs,
    searchSermons,
    getSearchSnippet,
} from '@main/services/tantivy.service';

const INDEXES_DIR = process.env.TANTIVY_TEST_INDEXES ?? '';
const hasIndexes = INDEXES_DIR !== '' && existsSync(INDEXES_DIR);

function availableLangs(): string[] {
    if (!hasIndexes) return [];
    return readdirSync(INDEXES_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(join(INDEXES_DIR, d.name, 'meta.json')))
        .map((d) => d.name);
}

const langs = availableLangs();

beforeAll(() => {
    for (const lang of langs) {
        _openIndexFromPathForTesting(lang, join(INDEXES_DIR, lang));
    }
});

afterAll(() => {
    _clearCacheForTesting();
});

describe.skipIf(!hasIndexes)('tantivy.service', () => {
    it('getInstalledLanguages() returns opened languages', () => {
        const installed = getInstalledLanguages();
        for (const lang of langs) {
            expect(installed).toContain(lang);
        }
    });

    it('getSermonParagraphs() returns ordered paragraphs for first language', () => {
        const lang = langs[0];
        // translationId 0 = default (English), 1+ for others
        const translationId = lang === 'en' ? 0 : 1;
        const paragraphs = getSermonParagraphs(lang, translationId);

        expect(paragraphs.length).toBeGreaterThan(0);

        for (const p of paragraphs) {
            expect(p.translationId).toBe(translationId);
            expect(p.content).toBeTruthy();
        }

        // Verify ordered by lineIndex
        for (let i = 1; i < paragraphs.length; i++) {
            expect(paragraphs[i].lineIndex).toBeGreaterThanOrEqual(paragraphs[i - 1].lineIndex);
        }
    });

    it('searchSermons() returns results', () => {
        const lang = langs[0];
        // Use a very common term to ensure hits
        const term = lang === 'en' ? 'the' : 'a';
        const result = searchSermons(lang, term, 5, 0);

        expect(result.hits.length).toBeGreaterThan(0);
        expect(result.total).toBeGreaterThan(0);

        for (const hit of result.hits) {
            expect(hit.score).toBeGreaterThan(0);
        }
    });

    it('getSearchSnippet() returns HTML with highlights', () => {
        const lang = langs[0];
        const term = lang === 'en' ? 'the' : 'a';
        const result = searchSermons(lang, term, 1, 0);
        expect(result.hits.length).toBeGreaterThan(0);

        const snippet = getSearchSnippet(lang, term, result.hits[0].bestDocAddress);
        expect(snippet).toContain('<b>');
    });
});
