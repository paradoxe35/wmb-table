import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { _setRefDbForTesting } from '@main/database/reference-db';
import * as refRepo from '@main/database/repositories/reference.repository';

const DATA_SQLITE_PATH = resolve(__dirname, '../../../../../resources/database/data.sqlite');

let db: Database.Database;

beforeAll(() => {
    db = new Database(DATA_SQLITE_PATH, { readonly: true });
    _setRefDbForTesting(db);
});

afterAll(() => {
    db.close();
});

describe('reference.repository', () => {
    it('getAllLanguages returns languages', () => {
        const languages = refRepo.getAllLanguages();
        expect(languages.length).toBeGreaterThan(0);
        const en = languages.find((l) => l.code === 'en');
        expect(en).toBeDefined();
        expect(en!.translationsSupport).toBe(false);
    });

    it('getLanguageByCode returns correct language', () => {
        const fr = refRepo.getLanguageByCode('fr');
        expect(fr).not.toBeNull();
        expect(fr!.code).toBe('fr');
        expect(fr!.translationsSupport).toBe(true);
    });

    it('getLanguageByCode returns null for non-existent', () => {
        expect(refRepo.getLanguageByCode('zzzz')).toBeNull();
    });

    it('getAllSermons returns sermons with locations and cityState', () => {
        const sermons = refRepo.getAllSermons();
        expect(sermons.length).toBeGreaterThan(1000);
        const withLocation = sermons.filter((s) => s.location !== null);
        expect(withLocation.length).toBeGreaterThan(0);
        const withCityState = sermons.filter((s) => s.cityState !== null);
        expect(withCityState.length).toBeGreaterThan(0);
        // cityState should be formatted as "City, ST" or just "City"
        const sample = withCityState.find((s) => s.cityState!.includes(','));
        expect(sample).toBeDefined();
        expect(sample!.cityState).toMatch(/^.+, .+$/);
    });

    it('getSermonById finds a known sermon with cityState', () => {
        const sermon = refRepo.getSermonById('53-0403');
        expect(sermon).not.toBeNull();
        expect(sermon!.id).toBe('53-0403');
        // 53-0403 is at Jeffersonville, IN
        expect(sermon!.cityState).toBe('Jeffersonville, IN');
    });

    it('getTranslatorsForLanguage returns translators for French', () => {
        const translators = refRepo.getTranslatorsForLanguage('fr');
        expect(translators.length).toBeGreaterThan(1);
        const names = translators.map((t) => t.name);
        expect(names).toContain('SHP');
        expect(names).toContain('VGR');
    });

    it('getTranslationsForLanguage returns translations with city/state data', () => {
        const translations = refRepo.getTranslationsForLanguage('fr');
        expect(translations.length).toBeGreaterThan(100);
        const withCity = translations.filter((t) => t.city_name !== null);
        expect(withCity.length).toBeGreaterThan(0);
        // Verify a Jeffersonville sermon exists in French translations
        const jeff = withCity.find((t) => t.city_name === 'Jeffersonville');
        expect(jeff).toBeDefined();
        expect(jeff!.state_abbr).toBe('IN');
    });

    it('getTranslationsForSermon returns cross-language translations', () => {
        const translations = refRepo.getTranslationsForSermon('53-0403');
        expect(translations.length).toBeGreaterThan(0);
    });

    it('sermonIdToTantivyDate converts correctly', () => {
        expect(refRepo.sermonIdToTantivyDate('53-0403')).toBe(530403);
        expect(refRepo.sermonIdToTantivyDate('65-1128M')).toBe(651128);
        expect(refRepo.sermonIdToTantivyDate('65-0101')).toBe(650101);
    });

    it('tantivyDateToSermonIds reverse looks up', () => {
        // sermon_date in Tantivy index = sermon.date_ms (epoch milliseconds)
        const ids = refRepo.tantivyDateToSermonIds(-528508800000);
        expect(ids).toContain('53-0403');
    });

    it('getAudioForSermonByIds returns audio URL or null', () => {
        const url = refRepo.getAudioForSermonByIds('53-0403', 'en');
        // May or may not have audio — just check it doesn't throw
        if (url) {
            expect(url).toContain('https://');
        }
    });

    it('getTranslationCountForLanguage returns count', () => {
        const count = refRepo.getTranslationCountForLanguage('fr');
        expect(count).toBeGreaterThan(100);
    });

    it('getAudioCountForLanguage returns count', () => {
        const count = refRepo.getAudioCountForLanguage('en');
        expect(count).toBeGreaterThanOrEqual(0);
    });

    it('getTranslationByIds returns a single translation row', () => {
        // Use a known French translation directly
        const translations = refRepo.getTranslationsForLanguage('fr');
        expect(translations.length).toBeGreaterThan(0);
        const sample = translations[0];

        const row = refRepo.getTranslationByIds(sample.translator_id, sample.sermon_id, 'fr');
        expect(row).not.toBeNull();
        expect(row!.sermon_id).toBe(sample.sermon_id);
        expect(row!.translator_id).toBe(sample.translator_id);
        expect(row!.title).toBeTruthy();
        expect(row!.sermon_title).toBeTruthy();
        expect(typeof row!.sermon_date_ms).toBe('number');
    });

    it('getTranslationByIds returns null for non-existent', () => {
        const row = refRepo.getTranslationByIds(9999, 'XX-XXXX', 'fr');
        expect(row).toBeNull();
    });

    it('getUniqueSermonCountForLanguage returns deduplicated count', () => {
        const uniqueCount = refRepo.getUniqueSermonCountForLanguage('fr');
        const totalCount = refRepo.getTranslationCountForLanguage('fr');
        // Unique count should be <= total count (fewer due to multiple translators per sermon)
        expect(uniqueCount).toBeGreaterThan(0);
        expect(uniqueCount).toBeLessThanOrEqual(totalCount);
    });

    it('getUniqueSermonCountForLanguage returns 0 for non-existent language', () => {
        const count = refRepo.getUniqueSermonCountForLanguage('zzzz');
        expect(count).toBe(0);
    });
});
