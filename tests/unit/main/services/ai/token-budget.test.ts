import { describe, expect, it, vi } from 'vitest';
import { tool } from 'ai';
import { z } from 'zod';

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const {
    FINAL_ANSWER_MAX_OUTPUT_TOKENS,
    canFitToolRound,
    measurePromptTokens,
    measureToolTokens,
    planRunBudget,
    resolveStepOutputTokens,
} = await import('@main/services/ai/token-budget');

const FIXED_PROMPT_TOKENS = 7_000;

describe('planRunBudget', () => {
    it.each([
        // label, contextWindow, maxOutputTokens, answerTokens, promptLimit, historyBudget
        ['128k window, 16k output', 128_000, 16_384, 16_384, 109_056, 61_233],
        ['128k window, 128k output', 128_000, 128_000, 32_000, 93_440, 51_864],
        ['1M window, 131k output', 1_000_000, 131_072, 32_768, 947_232, 200_000],
        ['unknown limits', undefined, undefined, 8_192, 54_528, 28_516],
        ['window 0 counts as unknown', 0, undefined, 8_192, 54_528, 28_516],
        ['32k window, 4k output', 32_000, 4_096, 4_096, 27_264, 12_158],
        ['8k window, unknown output', 8_000, undefined, 2_000, 5_744, 0],
        ['4k window, 128k output', 4_000, 128_000, 1_024, 2_720, 0],
    ])('%s', (_label, contextWindow, maxOutputTokens, answerTokens, promptLimit, historyBudget) => {
        const budget = planRunBudget({ contextWindow, maxOutputTokens }, FIXED_PROMPT_TOKENS);

        expect(budget.answerTokens).toBe(answerTokens);
        expect(budget.promptLimit).toBe(promptLimit);
        expect(budget.historyBudget).toBe(historyBudget);
    });

    it.each([4_000, 8_000, 32_000, 128_000, 200_000, 1_000_000])(
        'keeps the largest prompt plus the answer inside a %i-token window',
        (contextWindow) => {
            for (const maxOutputTokens of [undefined, 4_096, 16_384, 128_000]) {
                const budget = planRunBudget(
                    { contextWindow, maxOutputTokens },
                    FIXED_PROMPT_TOKENS,
                );
                expect(budget.promptLimit + budget.answerTokens).toBeLessThan(contextWindow);
                expect(budget.historyBudget + FIXED_PROMPT_TOKENS).toBeLessThanOrEqual(
                    Math.max(FIXED_PROMPT_TOKENS, budget.promptLimit),
                );
            }
        },
    );

    it('never reserves more than the model can write, nor more than 32k', () => {
        expect(
            planRunBudget({ contextWindow: 2_000_000, maxOutputTokens: 2_048 }, 0).answerTokens,
        ).toBe(2_048);
        expect(
            planRunBudget({ contextWindow: 2_000_000, maxOutputTokens: 500_000 }, 0).answerTokens,
        ).toBe(FINAL_ANSWER_MAX_OUTPUT_TOKENS);
    });

    it('leaves room in the prompt for the tool rounds of the run, not only for history', () => {
        const budget = planRunBudget({ contextWindow: 128_000, maxOutputTokens: 16_384 }, 7_000);

        expect(budget.promptLimit - FIXED_PROMPT_TOKENS - budget.historyBudget).toBeGreaterThan(
            30_000,
        );
    });
});

describe('resolveStepOutputTokens', () => {
    const wide = planRunBudget({ contextWindow: 128_000, maxOutputTokens: 128_000 }, 7_000);
    const known16k = planRunBudget({ contextWindow: 128_000, maxOutputTokens: 16_384 }, 7_000);
    const tiny = planRunBudget({ contextWindow: 4_000, maxOutputTokens: undefined }, 7_000);

    it.each([
        ['a search step gets a modest cap', wide, 20_000, 'research', 16_384],
        ['the answer step gets the full answer budget', wide, 20_000, 'answer', 32_000],
        [
            'a search step never exceeds what the model can write',
            known16k,
            20_000,
            'research',
            16_384,
        ],
        ['the answer step uses the model maximum below 32k', known16k, 20_000, 'answer', 16_384],
        ['an oversized prompt shrinks the cap to the room left', wide, 100_000, 'answer', 25_440],
        ['a full window still asks for a minimal answer', tiny, 9_000, 'answer', 256],
    ] as const)('%s', (_label, budget, promptTokens, phase, expected) => {
        expect(resolveStepOutputTokens(budget, promptTokens, phase)).toBe(expected);
    });
});

describe('canFitToolRound', () => {
    const budget = planRunBudget({ contextWindow: 128_000, maxOutputTokens: 16_384 }, 7_000);

    it('allows another tool round while the prompt has room', () => {
        expect(canFitToolRound(budget, 60_000)).toBe(true);
    });

    it('refuses another tool round once it would eat into the answer reserve', () => {
        expect(canFitToolRound(budget, budget.promptLimit - 1_000)).toBe(false);
    });
});

describe('measuring prompts', () => {
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
