import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as historyRepo from '@main/database/repositories/history.repository';

describe('history.repository', () => {
  beforeEach(() => {
    createTestDb();
  });

  it('getHistory returns empty initially', () => {
    expect(historyRepo.getHistory()).toEqual([]);
  });

  it('addHistoryEntry creates history and item', () => {
    historyRepo.addHistoryEntry('2024-01-01', 1704067200000, '10:00', 'Doc Title');
    const all = historyRepo.getHistory();
    expect(all).toHaveLength(1);
    expect(all[0].date).toBe('2024-01-01');

    const items = historyRepo.getHistoryItems(all[0].id);
    expect(items).toHaveLength(1);
    expect(items[0].documentTitle).toBe('Doc Title');
  });

  it('addHistoryEntry reuses existing history for same milliseconds', () => {
    historyRepo.addHistoryEntry('2024-01-01', 1704067200000, '10:00', 'Doc 1');
    historyRepo.addHistoryEntry('2024-01-01', 1704067200000, '10:05', 'Doc 2');

    const all = historyRepo.getHistory();
    expect(all).toHaveLength(1);

    const items = historyRepo.getHistoryItems(all[0].id);
    expect(items).toHaveLength(2);
  });

  it('enforces 30-entry cap', () => {
    for (let i = 0; i < 32; i++) {
      historyRepo.addHistoryEntry(`date-${i}`, i, '10:00', `Doc ${i}`);
    }
    const all = historyRepo.getHistory();
    expect(all.length).toBeLessThanOrEqual(30);
  });
});
