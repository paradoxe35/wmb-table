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
        historyRepo.addHistoryEntry('2024-01-01', 1704067200000, '10:00', LANG, {
            documentTitle: 'Doc Title',
            documentIdentity: { documentType: 'sermon', sermonId: '53-0403', translationId: 0 },
        });
        const all = historyRepo.getHistory(LANG);
        expect(all).toHaveLength(1);
        expect(all[0].date).toBe('2024-01-01');

        const items = historyRepo.getHistoryItems(all[0].id);
        expect(items).toHaveLength(1);
        expect(items[0].documentTitle).toBe('Doc Title');
    });

    it('addHistoryEntry reuses existing history for same milliseconds', () => {
        historyRepo.addHistoryEntry('2024-01-01', 1704067200000, '10:00', LANG, {
            documentTitle: 'Doc 1',
            documentIdentity: { documentType: 'sermon', sermonId: '53-0403', translationId: 0 },
        });
        historyRepo.addHistoryEntry('2024-01-01', 1704067200000, '10:05', LANG, {
            documentTitle: 'Doc 2',
            documentIdentity: { documentType: 'sermon', sermonId: '53-0404', translationId: 0 },
        });

        const all = historyRepo.getHistory(LANG);
        expect(all).toHaveLength(1);

        const items = historyRepo.getHistoryItems(all[0].id);
        expect(items).toHaveLength(2);
    });

    it('enforces 30-entry cap', () => {
        for (let i = 0; i < 32; i++) {
            historyRepo.addHistoryEntry(`date-${i}`, i, '10:00', LANG, {
                documentTitle: `Doc ${i}`,
                documentIdentity: {
                    documentType: 'sermon',
                    sermonId: `sermon-${i}`,
                    translationId: 0,
                },
            });
        }
        const all = historyRepo.getHistory(LANG);
        expect(all.length).toBeLessThanOrEqual(30);
    });

    it('keeps most recent entries when enforcing cap', () => {
        for (let i = 0; i < 32; i++) {
            historyRepo.addHistoryEntry(`date-${i}`, i, '10:00', LANG, {
                documentTitle: `Doc ${i}`,
                documentIdentity: {
                    documentType: 'sermon',
                    sermonId: `sermon-${i}`,
                    translationId: 0,
                },
            });
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
        historyRepo.addHistoryEntry('2024-01-01', 1000, '10:00', LANG, {
            documentTitle: 'Doc 0',
            documentIdentity: { documentType: 'sermon', sermonId: 'sermon-0', translationId: 0 },
        });
        // Add 51 more items to the same date (different sermonIds so they don't dedup)
        for (let i = 1; i <= 51; i++) {
            historyRepo.addHistoryEntry('2024-01-01', 1000, '10:00', LANG, {
                documentTitle: `Doc ${i}`,
                documentIdentity: {
                    documentType: 'sermon',
                    sermonId: `sermon-${i}`,
                    translationId: 0,
                },
            });
        }
        const all = historyRepo.getHistory(LANG);
        expect(all).toHaveLength(1);
        const items = historyRepo.getHistoryItems(all[0].id);
        expect(items.length).toBeLessThanOrEqual(50);
    });

    it('skips duplicate consecutive entries', () => {
        historyRepo.addHistoryEntry('2024-01-01', 1000, '10:00', LANG, {
            documentTitle: 'Doc',
            documentIdentity: { documentType: 'sermon', sermonId: 'sermon-1', translationId: 0 },
        });
        historyRepo.addHistoryEntry('2024-01-01', 1000, '10:05', LANG, {
            documentTitle: 'Doc',
            documentIdentity: { documentType: 'sermon', sermonId: 'sermon-1', translationId: 0 },
        });
        const all = historyRepo.getHistory(LANG);
        const items = historyRepo.getHistoryItems(all[0].id);
        expect(items).toHaveLength(1);
    });

    it('dedupes by document identity even when the display title changes', () => {
        const documentIdentity = {
            documentType: 'bible' as const,
            bibleBook: 'gen',
            bibleChapter: '1',
            bibleVersionAbbreviation: 'KJV',
        };

        historyRepo.addHistoryEntry('2024-01-01', 1000, '10:00', LANG, {
            documentTitle: 'Genesis 1',
            documentIdentity,
        });
        historyRepo.addHistoryEntry('2024-01-01', 1000, '10:05', LANG, {
            documentTitle: 'Genesis 1 (KJV)',
            documentIdentity,
        });

        const all = historyRepo.getHistory(LANG);
        const items = historyRepo.getHistoryItems(all[0].id);
        expect(items).toHaveLength(1);
    });

    it('separates history by language', () => {
        historyRepo.addHistoryEntry('2024-01-01', 1000, '10:00', 'en', {
            documentTitle: 'Doc EN',
            documentIdentity: { documentType: 'sermon', sermonId: 'sermon-1', translationId: 0 },
        });
        historyRepo.addHistoryEntry('2024-01-01', 2000, '10:00', 'fr', {
            documentTitle: 'Doc FR',
            documentIdentity: { documentType: 'sermon', sermonId: 'sermon-2', translationId: 0 },
        });
        expect(historyRepo.getHistory('en')).toHaveLength(1);
        expect(historyRepo.getHistory('fr')).toHaveLength(1);
    });
});
