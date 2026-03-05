import { resolve } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    _openIndexFromPathForTesting,
    _clearCacheForTesting,
    getInstalledLanguages,
    getUniqueSermonDates,
    getSermonParagraphs,
    searchSermons,
    getSearchSnippet,
} from '@main/services/tantivy.service';

const EN_INDEX_PATH = resolve(__dirname, '../../../../tmp');
const ORM_INDEX_PATH = resolve(__dirname, '../../../../tmp/orm');

beforeAll(() => {
    _openIndexFromPathForTesting('orm', ORM_INDEX_PATH);
    _openIndexFromPathForTesting('en', EN_INDEX_PATH);
});

afterAll(() => {
    _clearCacheForTesting();
});

describe('tantivy.service — Oromo index', () => {
    it('getInstalledLanguages() includes orm', () => {
        const langs = getInstalledLanguages();
        expect(langs).toContain('orm');
    });

    it('getUniqueSermonDates() returns distinct entries', () => {
        const entries = getUniqueSermonDates('orm');
        expect(entries.length).toBeGreaterThan(0);

        const ids = entries.map((e) => e.translationId);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);

        for (const entry of entries) {
            expect(entry.translationId).toBeGreaterThan(0);
            expect(entry.sermonDate).toBeTruthy();
        }
    });

    it('getSermonParagraphs() returns ordered paragraphs', () => {
        const entries = getUniqueSermonDates('orm');
        const tid = entries[0].translationId;
        const paragraphs = getSermonParagraphs('orm', tid);

        expect(paragraphs.length).toBeGreaterThan(0);

        for (const p of paragraphs) {
            expect(p.translationId).toBe(tid);
            expect(p.content).toBeTruthy();
        }

        // Verify ordered by lineIndex
        for (let i = 1; i < paragraphs.length; i++) {
            expect(paragraphs[i].lineIndex).toBeGreaterThanOrEqual(paragraphs[i - 1].lineIndex);
        }
    });

    it('searchSermons() returns grouped results', () => {
        const result = searchSermons('orm', 'waaqayyo', 10, 0);
        expect(result.hits.length).toBeGreaterThan(0);
        expect(result.total).toBeGreaterThan(0);

        const ids = result.hits.map((h) => h.translationId);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);

        for (const hit of result.hits) {
            expect(hit.score).toBeGreaterThan(0);
            expect(hit.hitCount).toBeGreaterThan(0);
            expect(hit.bestDocAddress).toBeDefined();
        }
    });

    it('getSearchSnippet() returns HTML with highlights', () => {
        const result = searchSermons('orm', 'waaqayyo', 1, 0);
        expect(result.hits.length).toBeGreaterThan(0);

        const snippet = getSearchSnippet('orm', 'waaqayyo', result.hits[0].bestDocAddress);
        expect(snippet).toContain('<b>');
    });
});

describe('tantivy.service — English index', () => {
    it('getInstalledLanguages() includes en', () => {
        expect(getInstalledLanguages()).toContain('en');
    });

    it('getSermonParagraphs() includes stemmedContent', () => {
        const entries = getUniqueSermonDates('en');
        const tid = entries[0].translationId;
        const paragraphs = getSermonParagraphs('en', tid);

        expect(paragraphs.length).toBeGreaterThan(0);

        const withStemmed = paragraphs.filter((p) => p.stemmedContent);
        expect(withStemmed.length).toBeGreaterThan(0);
    });

    it('searchSermons() matches stemmed terms', () => {
        const result = searchSermons('en', 'believe', 5, 0);
        expect(result.hits.length).toBeGreaterThan(0);
        expect(result.total).toBeGreaterThan(0);

        for (const hit of result.hits) {
            expect(hit.score).toBeGreaterThan(0);
        }
    });
});
