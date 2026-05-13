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
            expect(meta!.sermonId).toBe('53-0403');
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
            expect(meta!.sermonId).toBe(sample.sermon_id);
            expect(meta!.translationId).toBe(sample.translator_id);
            expect(meta!.languageCode).toBe('fr');
            expect(meta!.title).toBe(sample.title);
            expect(meta!.enTitle).toBe(sample.sermon_title);
            expect(meta!.translationName).toBe(sample.translator_name);
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

            // Each entry should have availableTranslations
            for (const entry of list) {
                expect(entry.availableTranslations).toBeDefined();
                expect(entry.availableTranslations.length).toBeGreaterThanOrEqual(1);
            }

            // Deduplicated count should match unique sermon count from repo
            const uniqueCount = refRepo.getUniqueSermonCountForLanguage('fr');
            expect(list.length).toBe(uniqueCount);
        });

        it(
            'uses hasAudio instead of materialized audioLink in the boot payload',
            {
                timeout: 30000,
            },
            () => {
                const list = refDataService.getSermonListDeduplicated('en');
                const withAudio = list.filter((entry) => entry.hasAudio);
                expect(withAudio.length).toBeGreaterThan(100);

                for (const entry of withAudio.slice(0, 10)) {
                    expect(refRepo.getAudioForSermonByIds(entry.sermonId, 'en')).toMatch(
                        /^https:\/\//,
                    );
                }
            },
        );
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

        it('English sermons include audioLink when audio exists', { timeout: 30000 }, () => {
            const list = refDataService.getSermonListForLanguage('en');
            const withAudio = list.filter((m) => m.audioLink !== null);
            // English should have many sermons with audio
            expect(withAudio.length).toBeGreaterThan(100);
            // audioLink should be a valid URL
            for (const meta of withAudio.slice(0, 5)) {
                expect(meta.audioLink).toMatch(/^https:\/\//);
            }
        });

        it('audioLink matches individual lookup', { timeout: 30000 }, () => {
            const list = refDataService.getSermonListForLanguage('en');
            const withAudio = list.filter((m) => m.audioLink !== null).slice(0, 10);
            for (const meta of withAudio) {
                const individual = refRepo.getAudioForSermonByIds(meta.sermonId, 'en');
                expect(meta.audioLink).toBe(individual);
            }
        });

        it('French sermons include audioLink when audio exists', { timeout: 30000 }, () => {
            const list = refDataService.getSermonListForLanguage('fr');
            const withAudio = list.filter((m) => m.audioLink !== null);
            expect(withAudio.length).toBeGreaterThan(0);
            for (const meta of withAudio.slice(0, 5)) {
                expect(meta.audioLink).toMatch(/^https:\/\//);
            }
        });

        it('French audio links are selected by translation source', { timeout: 30000 }, () => {
            const list = refDataService.getSermonListForLanguage('fr');
            const shp = list.find((m) => m.sermonId === '47-0412' && m.translationName === 'SHP');
            const vgr = list.find((m) => m.sermonId === '47-0412' && m.translationName === 'VGR');

            expect(shp?.audioLink).toContain('47-0412.mp3');
            expect(shp?.audioLink).not.toContain('VGR.m4a');
            expect(vgr?.audioLink).toContain('VGR.m4a');
        });
    });

    describe('getTranslationsForSermonInLanguage', () => {
        it('returns translations for a known French sermon', { timeout: 30000 }, () => {
            const translations = refRepo.getTranslationsForLanguage('fr');
            const sample = translations[0];
            const sermonTranslations = refDataService.getTranslationsForSermonInLanguage(
                sample.sermon_id,
                'fr',
            );
            expect(sermonTranslations.length).toBeGreaterThanOrEqual(1);
            expect(sermonTranslations[0].sermonId).toBe(sample.sermon_id);
        });

        it('returns sorted by translationId', { timeout: 30000 }, () => {
            const translations = refRepo.getTranslationsForLanguage('fr');
            const sample = translations[0];
            const sermonTranslations = refDataService.getTranslationsForSermonInLanguage(
                sample.sermon_id,
                'fr',
            );
            for (let i = 1; i < sermonTranslations.length; i++) {
                expect(sermonTranslations[i].translationId).toBeGreaterThanOrEqual(
                    sermonTranslations[i - 1].translationId,
                );
            }
        });

        it('all returned entries share the same sermonId', { timeout: 30000 }, () => {
            const translations = refRepo.getTranslationsForLanguage('fr');
            const sample = translations[0];
            const sermonTranslations = refDataService.getTranslationsForSermonInLanguage(
                sample.sermon_id,
                'fr',
            );
            for (const t of sermonTranslations) {
                expect(t.sermonId).toBe(sample.sermon_id);
                expect(t.languageCode).toBe('fr');
            }
        });

        it('includes audioLink, title, and translationName', { timeout: 30000 }, () => {
            const translations = refRepo.getTranslationsForLanguage('fr');
            const sample = translations[0];
            const sermonTranslations = refDataService.getTranslationsForSermonInLanguage(
                sample.sermon_id,
                'fr',
            );
            const t = sermonTranslations[0];
            expect(t.title).toBeTruthy();
            expect(t.translationName).toBeTruthy();
            expect(typeof t.dateMs).toBe('number');
            // audioLink can be null if no audio exists
            if (t.audioLink !== null) {
                expect(t.audioLink).toMatch(/^https:\/\//);
            }
        });

        it(
            'returns translation-specific audio links for same-language translations',
            {
                timeout: 30000,
            },
            () => {
                const sermonTranslations = refDataService.getTranslationsForSermonInLanguage(
                    '47-0412',
                    'fr',
                );
                const shp = sermonTranslations.find((m) => m.translationName === 'SHP');
                const vgr = sermonTranslations.find((m) => m.translationName === 'VGR');

                expect(shp?.audioLink).toContain('47-0412.mp3');
                expect(shp?.audioLink).not.toContain('VGR.m4a');
                expect(vgr?.audioLink).toContain('VGR.m4a');
            },
        );

        it('matches getSermonListForLanguage filtered result', { timeout: 30000 }, () => {
            const translations = refRepo.getTranslationsForLanguage('fr');
            const sample = translations[0];
            // Get from targeted function
            const sermonTranslations = refDataService.getTranslationsForSermonInLanguage(
                sample.sermon_id,
                'fr',
            );
            // Get from full list and filter (old approach)
            const fullList = refDataService.getSermonListForLanguage('fr');
            const fromFullList = fullList
                .filter((m) => m.sermonId === sample.sermon_id)
                .sort((a, b) => a.translationId - b.translationId);
            // Should be identical
            expect(sermonTranslations).toEqual(fromFullList);
        });

        it('returns empty for non-existent sermon', { timeout: 30000 }, () => {
            const sermonTranslations = refDataService.getTranslationsForSermonInLanguage(
                'XX-XXXX',
                'fr',
            );
            expect(sermonTranslations).toEqual([]);
        });

        it('returns single entry for English sermon', { timeout: 30000 }, () => {
            const sermonTranslations = refDataService.getTranslationsForSermonInLanguage(
                '53-0403',
                'en',
            );
            expect(sermonTranslations).toHaveLength(1);
            expect(sermonTranslations[0].translationId).toBe(0);
            expect(sermonTranslations[0].sermonId).toBe('53-0403');
        });
    });

    describe('getSermonsByYear', () => {
        it('groups sermons by year prefix', { timeout: 30000 }, () => {
            const byYear = refDataService.getSermonsByYear('en');
            const years = Object.keys(byYear);
            expect(years.length).toBeGreaterThan(10);
            // Each sermon in a year group should have matching prefix
            for (const [year, sermons] of Object.entries(byYear)) {
                for (const s of sermons) {
                    expect(s.sermonId.split('-')[0]).toBe(year);
                }
            }
        });
    });
});
