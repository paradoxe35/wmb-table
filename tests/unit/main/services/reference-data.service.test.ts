import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { _setRefDbForTesting } from '@main/database/reference-db';
import * as refDataService from '@main/services/reference-data.service';
import * as refRepo from '@main/database/repositories/reference.repository';

const DATA_SQLITE_PATH = resolve(__dirname, '../../../../resources/database/data.sqlite');

let db: Database.Database;

beforeAll(() => {
    db = new Database(DATA_SQLITE_PATH, { readonly: true });
    _setRefDbForTesting(db);
});

afterAll(() => {
    db.close();
});

describe('reference-data.service', () => {
    describe('getSermonMeta', () => {
        it('returns meta for English sermon by date (direct lookup)', () => {
            const meta = refDataService.getSermonMeta(0, 'en', '53-0403');
            expect(meta).not.toBeNull();
            expect(meta!.sermonDate).toBe('53-0403');
            expect(meta!.translationId).toBe(0);
            expect(meta!.languageCode).toBe('en');
            expect(meta!.title).toBeTruthy();
        });

        it('returns null for English with no sermonDate', () => {
            const meta = refDataService.getSermonMeta(0, 'en');
            expect(meta).toBeNull();
        });

        it('returns null for non-existent English sermon', () => {
            const meta = refDataService.getSermonMeta(0, 'en', 'XX-XXXX');
            expect(meta).toBeNull();
        });

        it('returns meta for French sermon via direct SQL query', () => {
            // Use a known French translation directly
            const translations = refRepo.getTranslationsForLanguage('fr');
            expect(translations.length).toBeGreaterThan(0);
            const sample = translations[0];

            const meta = refDataService.getSermonMeta(sample.translator_id, 'fr', sample.sermon_id);
            expect(meta).not.toBeNull();
            expect(meta!.sermonDate).toBe(sample.sermon_id);
            expect(meta!.translationId).toBe(sample.translator_id);
            expect(meta!.languageCode).toBe('fr');
            expect(meta!.title).toBe(sample.title);
            expect(meta!.enTitle).toBe(sample.sermon_title);
            expect(meta!.traductionName).toBe(sample.translator_name);
            expect(typeof meta!.dateMs).toBe('number');
        });

        it('returns null for non-existent French translation', () => {
            const meta = refDataService.getSermonMeta(9999, 'fr', 'XX-XXXX');
            expect(meta).toBeNull();
        });

        it('returns null for non-existent language', () => {
            const meta = refDataService.getSermonMeta(0, 'zzzz', '53-0403');
            expect(meta).toBeNull();
        });

        it('returns null for translated language with no sermonDate', () => {
            const meta = refDataService.getSermonMeta(1, 'fr');
            expect(meta).toBeNull();
        });

        it('includes cityState and location when available', () => {
            // 53-0403 is Jeffersonville, IN
            const meta = refDataService.getSermonMeta(0, 'en', '53-0403');
            expect(meta).not.toBeNull();
            expect(meta!.cityState).toBe('Jeffersonville, IN');
        });
    });

    describe('getSermonListDeduplicated', () => {
        it('returns deduplicated list for French', { timeout: 30000 }, () => {
            const list = refDataService.getSermonListDeduplicated('fr');
            expect(list.length).toBeGreaterThan(0);

            // Each entry should have availableTraductions
            for (const entry of list) {
                expect(entry.availableTraductions).toBeDefined();
                expect(entry.availableTraductions.length).toBeGreaterThanOrEqual(1);
            }

            // Deduplicated count should match unique sermon count from repo
            const uniqueCount = refRepo.getUniqueSermonCountForLanguage('fr');
            expect(list.length).toBe(uniqueCount);
        });
    });

    describe('getSermonListForLanguage', () => {
        it('returns English sermons from sermon table directly', { timeout: 30000 }, () => {
            const list = refDataService.getSermonListForLanguage('en');
            expect(list.length).toBeGreaterThan(1000);
            // All English entries should have translationId=0
            for (const meta of list) {
                expect(meta.translationId).toBe(0);
                expect(meta.languageCode).toBe('en');
            }
        });

        it('returns French translations with translator info', { timeout: 30000 }, () => {
            const list = refDataService.getSermonListForLanguage('fr');
            expect(list.length).toBeGreaterThan(100);
            // French entries should have non-zero translationId
            const withTranslator = list.filter((m) => m.translationId > 0);
            expect(withTranslator.length).toBe(list.length);
        });
    });
});
