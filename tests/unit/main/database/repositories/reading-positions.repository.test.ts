import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../test-helpers';
import * as readingPositionsRepo from '@main/database/repositories/reading-positions.repository';

describe('reading-positions.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    it('returns null when no position exists', () => {
        expect(readingPositionsRepo.getReadingPosition('sermon:en:1:abc')).toBeNull();
    });

    it('saves and reloads a reading position', () => {
        readingPositionsRepo.saveReadingPosition('sermon:en:1:abc', 320, 0);

        expect(readingPositionsRepo.getReadingPosition('sermon:en:1:abc')).toEqual({
            documentKey: 'sermon:en:1:abc',
            scrollY: 320,
            scrollX: 0,
        });
    });

    it('updates an existing reading position', () => {
        readingPositionsRepo.saveReadingPosition('custom:doc-1', 120, 0);
        readingPositionsRepo.saveReadingPosition('custom:doc-1', 880, 0);

        expect(readingPositionsRepo.getReadingPosition('custom:doc-1')).toEqual({
            documentKey: 'custom:doc-1',
            scrollY: 880,
            scrollX: 0,
        });
    });
});
