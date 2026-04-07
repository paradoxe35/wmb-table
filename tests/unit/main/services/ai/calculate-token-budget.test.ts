import { describe, expect, it, vi } from 'vitest';
import { tool } from 'ai';
import { z } from 'zod';

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const {
    calculateRemoteTokenBudget,
    measurePromptTokens,
    measureToolTokens,
    resolveRemoteOutputTokens,
} = await import('@main/services/ai/token-budget');

describe('calculateRemoteTokenBudget', () => {
    it('returns default 32k when context window is undefined', () => {
        expect(
            calculateRemoteTokenBudget(undefined, {
                toolTokens: 5_000,
                systemPromptTokens: 2_000,
            }),
        ).toBe(32_000);
    });

    it('returns default 32k when context window is 0', () => {
        expect(
            calculateRemoteTokenBudget(0, {
                toolTokens: 5_000,
                systemPromptTokens: 2_000,
            }),
        ).toBe(32_000);
    });

    it('calculates budget for 128k model', () => {
        const budget = calculateRemoteTokenBudget(128_000, {
            toolTokens: 5_000,
            systemPromptTokens: 2_000,
        });
        expect(budget).toBe(114_344);
    });

    it('calculates budget for 200k model', () => {
        const budget = calculateRemoteTokenBudget(200_000, {
            toolTokens: 5_000,
            systemPromptTokens: 2_000,
        });
        expect(budget).toBe(186_344);
    });

    it('caps at MAX_HISTORY_BUDGET for 1M+ models', () => {
        const budget = calculateRemoteTokenBudget(1_000_000, {
            toolTokens: 5_000,
            systemPromptTokens: 2_000,
        });
        expect(budget).toBe(200_000);
    });

    it('floors at MIN_HISTORY_BUDGET for very small models', () => {
        const budget = calculateRemoteTokenBudget(8_000, {
            toolTokens: 5_000,
            systemPromptTokens: 2_000,
        });
        expect(budget).toBe(4_000);
    });

    it('handles edge case where overhead exceeds context window', () => {
        const budget = calculateRemoteTokenBudget(5_000, {
            toolTokens: 5_000,
            systemPromptTokens: 2_000,
        });
        expect(budget).toBe(4_000);
    });

    it('uses explicit prompt and tool tokens when reserving output space', () => {
        const maxOutputTokens = resolveRemoteOutputTokens(16_000, {
            toolTokens: 5_000,
            systemPromptTokens: 2_000,
        });

        expect(maxOutputTokens).toBe(4_488);
    });

    it('measures prompt tokens from the actual prompt text', () => {
        expect(measurePromptTokens('short prompt')).toBeGreaterThan(0);
    });

    it('measures actual AI SDK tool schemas from inputSchema', () => {
        const smallTools = {
            lookup: tool({
                description: 'Lookup a topic.',
                inputSchema: z.object({
                    topic: z.string(),
                }),
                execute: () => 'ok',
            }),
        };
        const largeTools = {
            lookup: tool({
                description: 'Lookup a topic.',
                inputSchema: z.object({
                    topic: z.string().describe('Topic to search for across the corpus.'),
                    languageCode: z.string().describe('Language code for the content search.'),
                    filters: z.object({
                        exact: z.boolean(),
                        includeNotes: z.boolean(),
                        includeDocuments: z.boolean(),
                    }),
                }),
                execute: () => 'ok',
            }),
        };

        expect(measureToolTokens(largeTools)).toBeGreaterThan(measureToolTokens(smallTools));
    });
});
