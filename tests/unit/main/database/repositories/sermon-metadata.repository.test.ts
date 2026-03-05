import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as repo from '@main/database/repositories/sermon-metadata.repository';

describe('sermon-metadata.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('getSermonList returns empty initially', () => {
        expect(repo.getSermonList('en')).toEqual([]);
    });

    it('upsertMetadata inserts entries and getSermonList retrieves them', () => {
        repo.upsertMetadata([
            {
                translationId: 1,
                languageCode: 'en',
                sermonDate: '650101',
                title: '65-0101',
                paragraphCount: 42,
            },
            {
                translationId: 2,
                languageCode: 'en',
                sermonDate: '650102',
                title: '65-0102',
                paragraphCount: 30,
            },
        ]);

        const list = repo.getSermonList('en');
        expect(list).toHaveLength(2);
        // Ordered by sermon_date desc
        expect(list[0].sermonDate).toBe('650102');
        expect(list[1].sermonDate).toBe('650101');
    });

    it('upsert updates existing row (same translationId + languageCode)', () => {
        repo.upsertMetadata([
            {
                translationId: 1,
                languageCode: 'en',
                sermonDate: '650101',
                title: 'Original',
                paragraphCount: 10,
            },
        ]);

        repo.upsertMetadata([
            {
                translationId: 1,
                languageCode: 'en',
                sermonDate: '650101',
                title: 'Updated',
                paragraphCount: 20,
            },
        ]);

        const list = repo.getSermonList('en');
        expect(list).toHaveLength(1);
        expect(list[0].title).toBe('Updated');
        expect(list[0].paragraphCount).toBe(20);
    });

    it('getSermonMeta returns specific sermon', () => {
        repo.upsertMetadata([
            {
                translationId: 5,
                languageCode: 'fr',
                sermonDate: '630101',
                title: 'Test',
                paragraphCount: 15,
            },
        ]);

        const meta = repo.getSermonMeta(5, 'fr');
        expect(meta).not.toBeNull();
        expect(meta!.translationId).toBe(5);
        expect(meta!.languageCode).toBe('fr');
    });

    it('getSermonMeta returns null for non-existent', () => {
        expect(repo.getSermonMeta(999, 'xx')).toBeNull();
    });

    it('getSermonsByYear groups sermons by year', () => {
        repo.upsertMetadata([
            {
                translationId: 1,
                languageCode: 'en',
                sermonDate: '650101',
                title: 'A',
                paragraphCount: 1,
            },
            {
                translationId: 2,
                languageCode: 'en',
                sermonDate: '650201',
                title: 'B',
                paragraphCount: 2,
            },
            {
                translationId: 3,
                languageCode: 'en',
                sermonDate: '640301',
                title: 'C',
                paragraphCount: 3,
            },
        ]);

        const byYear = repo.getSermonsByYear('en');
        expect(Object.keys(byYear).sort()).toEqual(['64', '65']);
        expect(byYear['65']).toHaveLength(2);
        expect(byYear['64']).toHaveLength(1);
    });

    it('getAvailableTranslations returns translations for a sermon', () => {
        repo.upsertMetadata([
            {
                translationId: 10,
                languageCode: 'en',
                sermonDate: '650101',
                title: 'EN Title',
                paragraphCount: 5,
            },
            {
                translationId: 10,
                languageCode: 'fr',
                sermonDate: '650101',
                title: 'FR Title',
                paragraphCount: 5,
            },
        ]);

        const translations = repo.getAvailableTranslations(10);
        expect(translations).toHaveLength(2);
        const codes = translations.map((t) => t.languageCode).sort();
        expect(codes).toEqual(['en', 'fr']);
    });

    it('deleteByLanguage removes all sermons for a language', () => {
        repo.upsertMetadata([
            {
                translationId: 1,
                languageCode: 'en',
                sermonDate: '650101',
                title: 'A',
                paragraphCount: 1,
            },
            {
                translationId: 2,
                languageCode: 'fr',
                sermonDate: '650101',
                title: 'B',
                paragraphCount: 2,
            },
        ]);

        repo.deleteByLanguage('en');
        expect(repo.getSermonList('en')).toHaveLength(0);
        expect(repo.getSermonList('fr')).toHaveLength(1);
    });

    it('getLanguagesWithMetadata returns distinct language codes', () => {
        repo.upsertMetadata([
            {
                translationId: 1,
                languageCode: 'en',
                sermonDate: '650101',
                title: 'A',
                paragraphCount: 1,
            },
            {
                translationId: 2,
                languageCode: 'en',
                sermonDate: '650102',
                title: 'B',
                paragraphCount: 2,
            },
            {
                translationId: 3,
                languageCode: 'fr',
                sermonDate: '650101',
                title: 'C',
                paragraphCount: 3,
            },
        ]);

        const langs = repo.getLanguagesWithMetadata().sort();
        expect(langs).toEqual(['en', 'fr']);
    });

    it('getSermonList with year filter', () => {
        repo.upsertMetadata([
            {
                translationId: 1,
                languageCode: 'en',
                sermonDate: '650101',
                title: 'A',
                paragraphCount: 1,
            },
            {
                translationId: 2,
                languageCode: 'en',
                sermonDate: '640201',
                title: 'B',
                paragraphCount: 2,
            },
        ]);

        const filtered = repo.getSermonList('en', { year: '65' });
        expect(filtered).toHaveLength(1);
        expect(filtered[0].sermonDate).toBe('650101');
    });
});
