import { describe, expect, it, vi } from 'vitest';

vi.mock('@main/database/repositories/ai.repository', () => ({
    getRecentMessages: vi.fn().mockReturnValue([]),
}));

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('lodash', () => ({
    default: { omit: vi.fn(), pick: vi.fn() },
}));

const { calculateRemoteTokenBudget } = await import('@main/services/ai/context-memory');

describe('calculateRemoteTokenBudget', () => {
    it('returns default 32k when context window is undefined', () => {
        expect(calculateRemoteTokenBudget(undefined)).toBe(32_000);
    });

    it('returns default 32k when context window is 0', () => {
        expect(calculateRemoteTokenBudget(0)).toBe(32_000);
    });

    it('calculates budget for 128k model', () => {
        const budget = calculateRemoteTokenBudget(128_000);
        // 128000 - 2000 (system) - 4000 (tools) - 4096 (output) - 512 (safety) = 117392
        expect(budget).toBe(117_392);
    });

    it('calculates budget for 200k model', () => {
        const budget = calculateRemoteTokenBudget(200_000);
        expect(budget).toBe(189_392);
    });

    it('caps at MAX_HISTORY_BUDGET for 1M+ models', () => {
        const budget = calculateRemoteTokenBudget(1_000_000);
        expect(budget).toBe(200_000);
    });

    it('floors at MIN_HISTORY_BUDGET for very small models', () => {
        const budget = calculateRemoteTokenBudget(8_000);
        expect(budget).toBe(4_000);
    });

    it('handles edge case where overhead exceeds context window', () => {
        const budget = calculateRemoteTokenBudget(5_000);
        expect(budget).toBe(4_000);
    });
});
