import { resolve } from 'node:path';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
    _openIndexFromPathForTesting,
    _clearCacheForTesting,
    getUniqueSermonDates,
} from '@main/services/tantivy.service';
import { createTestDb } from '../database/test-helpers';
import * as sermonMetadataService from '@main/services/sermon-metadata.service';
import * as sermonMetadataRepo from '@main/database/repositories/sermon-metadata.repository';

const EN_INDEX_PATH = resolve(__dirname, '../../../../tmp');
const ORM_INDEX_PATH = resolve(__dirname, '../../../../tmp/orm');

beforeAll(() => {
    _openIndexFromPathForTesting('orm', ORM_INDEX_PATH);
    _openIndexFromPathForTesting('en', EN_INDEX_PATH);
});

afterAll(() => {
    _clearCacheForTesting();
});

describe('sermon-metadata.service', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('buildMetadataFromIndex(orm) creates metadata rows matching unique sermon dates', () => {
        sermonMetadataService.buildMetadataFromIndex('orm');

        const entries = getUniqueSermonDates('orm');
        const sermons = sermonMetadataRepo.getSermonList('orm');

        expect(sermons.length).toBe(entries.length);

        for (const sermon of sermons) {
            expect(sermon.languageCode).toBe('orm');
            expect(sermon.paragraphCount).toBeGreaterThan(0);
            expect(sermon.translationId).toBeGreaterThan(0);
            expect(sermon.sermonDate).toBeTruthy();
        }
    });

    it('buildMetadataFromIndex(en) creates metadata with paragraph counts', () => {
        sermonMetadataService.buildMetadataFromIndex('en');

        const entries = getUniqueSermonDates('en');
        const sermons = sermonMetadataRepo.getSermonList('en');

        expect(sermons.length).toBe(entries.length);

        for (const sermon of sermons) {
            expect(sermon.languageCode).toBe('en');
            expect(sermon.paragraphCount).toBeGreaterThan(0);
        }
    });

    it('buildMetadataFromIndex is idempotent (second call updates, not duplicates)', () => {
        sermonMetadataService.buildMetadataFromIndex('orm');
        const firstCount = sermonMetadataRepo.getSermonList('orm').length;

        sermonMetadataService.buildMetadataFromIndex('orm');
        const secondCount = sermonMetadataRepo.getSermonList('orm').length;

        expect(secondCount).toBe(firstCount);
    });
});
