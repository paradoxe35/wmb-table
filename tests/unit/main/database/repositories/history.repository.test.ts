import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as historyRepo from '@main/database/repositories/history.repository';

describe('history.repository', () => {
    beforeEach(() => {
        createTestDb();
    });

    const LANG = 'en';

    it('getHistory returns empty initially', () => {
        expect(historyRepo.getHistory(LANG)).toEqual([]);
    });

    it('addHistoryEntry creates history and item', () => {
        historyRepo.addHistoryEntry(
            '2024-01-01',
            1704067200000,
            '10:00',
            'Doc Title',
            LANG,
            '53-0403',
        );
        const all = historyRepo.getHistory(LANG);
        expect(all).toHaveLength(1);
        expect(all[0].date).toBe('2024-01-01');

        const items = historyRepo.getHistoryItems(all[0].id);
        expect(items).toHaveLength(1);
        expect(items[0].documentTitle).toBe('Doc Title');
    });

    it('addHistoryEntry reuses existing history for same milliseconds', () => {
        historyRepo.addHistoryEntry('2024-01-01', 1704067200000, '10:00', 'Doc 1', LANG, '53-0403');
        historyRepo.addHistoryEntry('2024-01-01', 1704067200000, '10:05', 'Doc 2', LANG, '53-0404');

        const all = historyRepo.getHistory(LANG);
        expect(all).toHaveLength(1);

        const items = historyRepo.getHistoryItems(all[0].id);
        expect(items).toHaveLength(2);
    });

    it('enforces 30-entry cap', () => {
        for (let i = 0; i < 32; i++) {
            historyRepo.addHistoryEntry(`date-${i}`, i, '10:00', `Doc ${i}`, LANG, `sermon-${i}`);
        }
        const all = historyRepo.getHistory(LANG);
        expect(all.length).toBeLessThanOrEqual(30);
    });
});
