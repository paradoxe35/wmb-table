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
            calculateRemoteTokenBudget({
                modelLimits: { contextWindow: undefined },
                prompt: {
                    toolTokens: 5_000,
                    systemPromptTokens: 2_000,
                },
            }),
        ).toBe(32_000);
    });

    it('returns default 32k when context window is 0', () => {
        expect(
            calculateRemoteTokenBudget({
                modelLimits: { contextWindow: 0 },
                prompt: {
                    toolTokens: 5_000,
                    systemPromptTokens: 2_000,
                },
            }),
        ).toBe(32_000);
    });

    it('calculates budget for 128k model', () => {
        const budget = calculateRemoteTokenBudget({
            modelLimits: { contextWindow: 128_000 },
            prompt: {
                toolTokens: 5_000,
                systemPromptTokens: 2_000,
            },
        });
        expect(budget).toBe(112_296);
    });

    it('calculates budget for 200k model', () => {
        const budget = calculateRemoteTokenBudget({
            modelLimits: { contextWindow: 200_000 },
            prompt: {
                toolTokens: 5_000,
                systemPromptTokens: 2_000,
            },
        });
        expect(budget).toBe(184_296);
    });

    it('caps at MAX_HISTORY_BUDGET for 1M+ models', () => {
        const budget = calculateRemoteTokenBudget({
            modelLimits: { contextWindow: 1_000_000 },
            prompt: {
                toolTokens: 5_000,
                systemPromptTokens: 2_000,
            },
        });
        expect(budget).toBe(200_000);
    });

    it('never budgets more history than a small context window can hold', () => {
        const contextWindow = 8_000;
        const prompt = { toolTokens: 5_000, systemPromptTokens: 2_000 };
        const budget = calculateRemoteTokenBudget({ modelLimits: { contextWindow }, prompt });
        const outputTokens = resolveRemoteOutputTokens({ modelLimits: { contextWindow }, prompt });

        expect(budget + outputTokens + prompt.toolTokens + prompt.systemPromptTokens).toBeLessThan(
            contextWindow,
        );
    });

    it('returns no history budget when overhead already exceeds the context window', () => {
        const budget = calculateRemoteTokenBudget({
            modelLimits: { contextWindow: 5_000 },
            prompt: {
                toolTokens: 5_000,
                systemPromptTokens: 2_000,
            },
        });
        expect(budget).toBe(0);
    });

    it('never lets history plus output exceed the room left by the prompt', () => {
        const prompt = { toolTokens: 5_000, systemPromptTokens: 2_000 };
        const overhead = prompt.toolTokens + prompt.systemPromptTokens;

        for (const contextWindow of [
            5_000, 8_000, 16_000, 32_000, 64_000, 128_000, 200_000, 1_000_000,
        ]) {
            const modelLimits = { contextWindow };
            const reserved =
                calculateRemoteTokenBudget({ modelLimits, prompt }) +
                resolveRemoteOutputTokens({ modelLimits, prompt });

            expect(reserved).toBeLessThanOrEqual(Math.max(1, contextWindow - overhead));
        }
    });

    it('keeps output tokens inside the context window on small models', () => {
        const contextWindow = 8_000;
        const outputTokens = resolveRemoteOutputTokens({
            modelLimits: { contextWindow },
            prompt: { toolTokens: 5_000, systemPromptTokens: 2_000 },
        });

        expect(outputTokens).toBeGreaterThan(0);
        expect(outputTokens).toBeLessThanOrEqual(contextWindow - 7_512);
    });

    it('uses explicit prompt and tool tokens when reserving output space', () => {
        const maxOutputTokens = resolveRemoteOutputTokens({
            modelLimits: { contextWindow: 16_000 },
            prompt: {
                toolTokens: 5_000,
                systemPromptTokens: 2_000,
            },
        });

        expect(maxOutputTokens).toBe(4_488);
    });

    it('caps output tokens to the provider model output limit', () => {
        const maxOutputTokens = resolveRemoteOutputTokens({
            modelLimits: { contextWindow: 128_000, maxOutputTokens: 4_096 },
            prompt: {
                toolTokens: 5_000,
                systemPromptTokens: 2_000,
            },
        });

        expect(maxOutputTokens).toBe(4_096);
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
