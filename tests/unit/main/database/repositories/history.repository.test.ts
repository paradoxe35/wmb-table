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

    it('keeps most recent entries when enforcing cap', () => {
        for (let i = 0; i < 32; i++) {
            historyRepo.addHistoryEntry(`date-${i}`, i, '10:00', `Doc ${i}`, LANG, `sermon-${i}`);
        }
        const all = historyRepo.getHistory(LANG);
        // Most recent (highest milliseconds) should survive
        const msValues = all.map((h) => h.milliseconds);
        expect(msValues).toContain(31);
        expect(msValues).toContain(30);
        // Oldest should be deleted
        expect(msValues).not.toContain(0);
        expect(msValues).not.toContain(1);
    });

    it('enforces 50-item cap per history entry', () => {
        // Create a single history entry
        historyRepo.addHistoryEntry('2024-01-01', 1000, '10:00', 'Doc 0', LANG, 'sermon-0');
        // Add 51 more items to the same date (different sermonIds so they don't dedup)
        for (let i = 1; i <= 51; i++) {
            historyRepo.addHistoryEntry(
                '2024-01-01',
                1000,
                '10:00',
                `Doc ${i}`,
                LANG,
                `sermon-${i}`,
            );
        }
        const all = historyRepo.getHistory(LANG);
        expect(all).toHaveLength(1);
        const items = historyRepo.getHistoryItems(all[0].id);
        expect(items.length).toBeLessThanOrEqual(50);
    });

    it('skips duplicate consecutive entries', () => {
        historyRepo.addHistoryEntry('2024-01-01', 1000, '10:00', 'Doc', LANG, 'sermon-1');
        historyRepo.addHistoryEntry('2024-01-01', 1000, '10:05', 'Doc', LANG, 'sermon-1');
        const all = historyRepo.getHistory(LANG);
        const items = historyRepo.getHistoryItems(all[0].id);
        expect(items).toHaveLength(1);
    });

    it('separates history by language', () => {
        historyRepo.addHistoryEntry('2024-01-01', 1000, '10:00', 'Doc EN', 'en', 'sermon-1');
        historyRepo.addHistoryEntry('2024-01-01', 2000, '10:00', 'Doc FR', 'fr', 'sermon-2');
        expect(historyRepo.getHistory('en')).toHaveLength(1);
        expect(historyRepo.getHistory('fr')).toHaveLength(1);
    });
});
