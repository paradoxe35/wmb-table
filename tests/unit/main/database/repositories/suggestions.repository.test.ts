import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test-helpers';
import * as suggestionsRepo from '@main/database/repositories/suggestions.repository';

describe('suggestions.repository', () => {
  beforeEach(() => {
    createTestDb();
  });

  it('getSuggestions returns empty initially', () => {
    expect(suggestionsRepo.getSuggestions()).toEqual([]);
  });

  it('addSuggestion creates suggestion', () => {
    const s = suggestionsRepo.addSuggestion('test query', 5);
    expect(s.searchText).toBe('test query');
    expect(s.found).toBe(5);
  });

  it('addSuggestion upserts on conflict', () => {
    suggestionsRepo.addSuggestion('test', 5);
    suggestionsRepo.addSuggestion('test', 10);
    const all = suggestionsRepo.getSuggestions();
    expect(all).toHaveLength(1);
    expect(all[0].found).toBe(10);
  });

  it('enforces 20-entry cap', () => {
    for (let i = 0; i < 25; i++) {
      suggestionsRepo.addSuggestion(`query-${i}`, i);
    }
    const all = suggestionsRepo.getSuggestions();
    expect(all.length).toBeLessThanOrEqual(20);
  });
});
