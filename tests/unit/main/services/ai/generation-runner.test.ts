import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tool, type ToolSet } from 'ai';
import { estimateTokenCount } from 'tokenx';
import { z } from 'zod';
import {
    apiError,
    callTool,
    createScriptedModel,
    pause,
    promptTexts,
    say,
    step,
    think,
    type RecordedCall,
    type ScriptStep,
} from '../../../../helpers/mock-model';

const dispatchReasoningDeltaMock = vi.fn();
const dispatchToolCallStartMock = vi.fn();
const dispatchToolCallCompleteMock = vi.fn();

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@main/services/ai/runners/stream-dispatcher', () => ({
    dispatchReasoningDelta: dispatchReasoningDeltaMock,
    dispatchToolCallStart: dispatchToolCallStartMock,
    dispatchToolCallComplete: dispatchToolCallCompleteMock,
}));

const { GenerationRunnerImpl } = await import('@main/services/ai/runners/generation-runner');
const { planRunBudget, measurePromptTokens, measureToolTokens } =
    await import('@main/services/ai/token-budget');
const { resolveChatTimeouts } = await import('@main/services/ai/model-timeouts');

const SYSTEM_PROMPT = 'You are the sermon assistant. Answer from tool results only.';
const SERMON_TEXT = "Qui t'a appris que tu es nu ? Le Saint-Esprit révèle l'amour de Dieu. ".repeat(
    120,
);

function sermonTools(overrides: Partial<Record<string, () => unknown>> = {}): ToolSet {
    const result = (name: string, fallback: () => unknown) => async () =>
        (overrides[name] ?? fallback)();
    return {
        searchSermons: tool({
            description: 'Search sermons.',
            inputSchema: z.object({ query: z.string() }),
            execute: result('searchSermons', () => ({
                results: Array.from({ length: 5 }, (_, index) => ({
                    sermonId: `63-03${index}`,
                    title: `Sermon ${index}`,
                    snippet: SERMON_TEXT,
                })),
            })),
        }),
        editNote: tool({
            description: 'Edit a note.',
            inputSchema: z.object({ noteId: z.string() }),
            execute: result('editNote', () => ({ noteId: 'n1', replacements: 1 })),
        }),
    };
}

interface RunOptions {
    contextWindow?: number;
    maxOutputTokens?: number;
    tools?: ToolSet;
    history?: { role: 'user' | 'assistant'; content: string }[];
    abortSignal?: AbortSignal;
    reasoningControl?: boolean;
    maxSteps?: number;
    timeouts?: Partial<ReturnType<typeof resolveChatTimeouts>>;
}

async function runScript(script: ScriptStep[], options: RunOptions = {}) {
    const scripted = createScriptedModel(script);
    const tools = options.tools ?? sermonTools();
    const fixedPromptTokens = measurePromptTokens(SYSTEM_PROMPT) + measureToolTokens(tools);
    const budget = planRunBudget(
        { contextWindow: options.contextWindow, maxOutputTokens: options.maxOutputTokens },
        fixedPromptTokens,
    );
    const deltas: string[] = [];
    const outcome = await new GenerationRunnerImpl().run({
        browserWindow: {} as never,
        conversationId: 'conv-1',
        generationId: 'gen-1',
        assistantMessageId: 'assistant-1',
        model: scripted.model,
        systemPrompt: SYSTEM_PROMPT,
        history: options.history ?? [{ role: 'user', content: 'Qui t’a dit que tu étais nu ?' }],
        tools,
        abortSignal: options.abortSignal ?? new AbortController().signal,
        isCurrentRun: () => true,
        dispatchTextDelta: (delta) => deltas.push(delta),
        budget,
        fixedPromptTokens,
        reasoningControl: options.reasoningControl ?? true,
        timeouts: { ...resolveChatTimeouts(false), ...options.timeouts },
        maxSteps: options.maxSteps,
    });
    return {
        outcome,
        calls: scripted.calls,
        text: deltas.join(''),
        toolTokens: measureToolTokens(tools),
    };
}

function requestTokens(call: RecordedCall, toolTokens: number): number {
    return estimateTokenCount(JSON.stringify(call.prompt)) + toolTokens;
}

const searchSteps = (count: number) =>
    Array.from({ length: count }, (_, index) =>
        step([think(`Search ${index}`), callTool('searchSermons', { query: `q${index}` })]),
    );
const answer = (text = 'Voici la réponse complète, avec les références trouvées.') =>
    step([think('I can answer now.'), say(text)]);
const isToolChoiceNone = (call: RecordedCall) => call.toolChoice?.type === 'none';

describe('GenerationRunnerImpl', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('long research', () => {
        it('keeps every prompt inside a small window and still writes the answer', async () => {
            const { outcome, calls, text, toolTokens } = await runScript(
                [...searchSteps(30), answer()],
                { contextWindow: 32_000, maxOutputTokens: 8_192, maxSteps: 31 },
            );

            expect(calls).toHaveLength(31);
            for (const call of calls) {
                expect(requestTokens(call, toolTokens) + (call.maxOutputTokens ?? 0)).toBeLessThan(
                    32_000,
                );
            }
            expect(JSON.stringify(calls[30].prompt)).toContain('[Condensed earlier result]');
            expect(JSON.stringify(calls[30].prompt)).toContain('Sermon 0');
            const last = calls[calls.length - 1];
            expect(isToolChoiceNone(last)).toBe(true);
            expect(last.reasoning).toBe('medium');
            expect(calls.slice(0, 30).every((call) => call.reasoning === 'low')).toBe(true);
            expect(promptTexts(last.prompt, 'system').join('')).toContain('research phase is over');
            expect(text).toContain('Voici la réponse complète');
            expect(outcome).toMatchObject({
                stepLimitReached: true,
                truncated: false,
                finishReason: 'stop',
                steps: 31,
            });
        });

        it('keeps the newest tool result whole while condensing older ones', async () => {
            const { calls } = await runScript([...searchSteps(12), answer()], {
                contextWindow: 32_000,
                maxOutputTokens: 8_192,
            });
            const lastPrompt = JSON.stringify(calls[12].prompt);

            expect(lastPrompt).toContain('[Condensed earlier result]');
            expect(lastPrompt).toContain(SERMON_TEXT.slice(0, 400));
        });

        it('trusts the provider token count when it is higher than the estimate', async () => {
            const heavySearch = (index: number) =>
                step([callTool('searchSermons', { query: `q${index}` })], {
                    usage: { input: 20_000 },
                });
            const estimated = await runScript([...searchSteps(2), answer()], {
                contextWindow: 64_000,
                maxOutputTokens: 8_192,
            });
            const reported = await runScript([heavySearch(0), heavySearch(1), answer()], {
                contextWindow: 64_000,
                maxOutputTokens: 8_192,
            });

            expect(JSON.stringify(estimated.calls[2].prompt)).not.toContain('[Condensed');
            expect(JSON.stringify(reported.calls[2].prompt)).toContain('[Condensed');
        });

        it('answers without tools when the history leaves no room for a tool round', async () => {
            const { calls, text, outcome } = await runScript([answer()], {
                contextWindow: 32_000,
                maxOutputTokens: 4_096,
                history: [{ role: 'user', content: SERMON_TEXT.repeat(12) }],
            });

            expect(isToolChoiceNone(calls[0])).toBe(true);
            expect(text).toContain('Voici la réponse');
            expect(outcome.stepLimitReached).toBe(false);
        });

        it('sends no pruning and the full 32k answer budget on a 1M window', async () => {
            const { calls } = await runScript([...searchSteps(3), answer()], {
                contextWindow: 1_000_000,
                maxOutputTokens: 131_072,
                maxSteps: 4,
            });

            expect(JSON.stringify(calls.map((call) => call.prompt))).not.toContain('[Condensed');
            expect(calls[0].maxOutputTokens).toBe(16_384);
            expect(calls[3].maxOutputTokens).toBe(32_768);
        });

        it.each([4_000, 8_000])(
            'still answers inside a tiny %i-token window',
            async (contextWindow) => {
                const { calls, text, toolTokens } = await runScript([...searchSteps(6), answer()], {
                    contextWindow,
                });

                for (const call of calls) {
                    expect(
                        requestTokens(call, toolTokens) + (call.maxOutputTokens ?? 0),
                    ).toBeLessThan(contextWindow);
                }
                expect(text).toContain('Voici la réponse');
            },
        );
    });

    describe('output budget', () => {
        it.each([
            ['unknown limits', undefined, undefined, 8_192, 8_192],
            ['a 4k-output model', 128_000, 4_096, 4_096, 4_096],
            ['a 128k-output model', 128_000, 128_000, 16_384, 32_000],
        ])(
            'caps search and answer steps for %s',
            async (_label, contextWindow, maxOutputTokens, searchCap, answerCap) => {
                const { calls } = await runScript([...searchSteps(1), answer()], {
                    contextWindow,
                    maxOutputTokens,
                    maxSteps: 2,
                });

                expect(calls[0].maxOutputTokens).toBe(searchCap);
                expect(calls[1].maxOutputTokens).toBe(answerCap);
            },
        );

        it('sends no reasoning setting when the provider must not get one', async () => {
            const { calls } = await runScript([...searchSteps(1), answer()], {
                reasoningControl: false,
                maxSteps: 2,
            });

            expect(calls.every((call) => call.reasoning === undefined)).toBe(true);
        });
    });

    describe('reasoning the provider refuses', () => {
        const refused = (
            message = 'registry.ollama.ai/library/llama3.2 does not support thinking',
        ) => step([], { reject: apiError(400, message) });

        it('retries without reasoning for the rest of the run', async () => {
            const { calls, text } = await runScript([refused(), ...searchSteps(1), answer('Fin.')]);

            expect(calls.map((call) => call.reasoning)).toEqual(['low', undefined, undefined]);
            expect(text).toBe('Fin.');
        });

        it('recognises an unsupported reasoning_effort parameter', async () => {
            const { calls } = await runScript([
                refused('Unrecognized request argument supplied: reasoning_effort'),
                answer(),
            ]);

            expect(calls.map((call) => call.reasoning)).toEqual(['low', undefined]);
        });

        it('fails on a 400 about something else', async () => {
            await expect(
                runScript([refused('Invalid tool schema for searchSermons'), answer()]),
            ).rejects.toThrow(/Invalid tool schema/);
        });

        it('retries only once', async () => {
            await expect(runScript([refused(), refused(), answer()])).rejects.toThrow(/thinking/);
        });
    });

    describe('cut answers', () => {
        it('continues a cut answer where it stopped', async () => {
            const { calls, text, outcome } = await runScript([
                step([say('Adam se cacha parce qu’il')], { finishReason: 'length' }),
                step([say(' avait peur. Fin de la réponse.')]),
            ]);

            expect(text).toBe('Adam se cacha parce qu’il avait peur. Fin de la réponse.');
            expect(promptTexts(calls[1].prompt, 'user').pop()).toContain('Continue exactly');
            expect(promptTexts(calls[1].prompt, 'assistant').join('')).toContain('Adam se cacha');
            expect(isToolChoiceNone(calls[1])).toBe(true);
            expect(calls[1].reasoning).toBe('medium');
            expect(outcome).toMatchObject({ truncated: false, continuations: 1 });
        });

        it('reports a truncated answer after two cut continuations, without notice text', async () => {
            const cut = (words: string) => step([say(words)], { finishReason: 'length' });
            const { calls, text, outcome } = await runScript([
                cut('Première partie,'),
                cut(' deuxième partie,'),
                cut(' troisième partie'),
            ]);

            expect(calls).toHaveLength(3);
            expect(text).toBe('Première partie, deuxième partie, troisième partie');
            expect(text).not.toMatch(/truncated/i);
            expect(outcome).toMatchObject({
                truncated: true,
                finishReason: 'length',
                continuations: 2,
            });
        });

        it('writes the answer when reasoning used the whole small cap', async () => {
            const { calls, text, outcome } = await runScript(
                [
                    step([think('Long hidden thinking. '.repeat(300))], {
                        finishReason: 'length',
                    }),
                    answer('La réponse arrive après la réflexion.'),
                ],
                { contextWindow: 128_000, maxOutputTokens: 4_096 },
            );

            expect(calls).toHaveLength(2);
            expect(promptTexts(calls[1].prompt, 'user').pop()).toContain('final answer');
            expect(calls[1].reasoning).toBe('medium');
            expect(text).toBe('La réponse arrive après la réflexion.');
            expect(outcome.truncated).toBe(false);
        });

        it('asks for the answer when the model stops after its tools without writing', async () => {
            const { calls, text } = await runScript([
                ...searchSteps(1),
                step([think('Done.')]),
                answer(),
            ]);

            expect(calls).toHaveLength(3);
            expect(isToolChoiceNone(calls[2])).toBe(true);
            expect(text).toContain('Voici la réponse');
        });
    });

    describe('step limit', () => {
        it('makes the last allowed step write the answer and reports the limit', async () => {
            const { calls, text, outcome } = await runScript([...searchSteps(2), answer()], {
                maxSteps: 3,
            });

            expect(calls.slice(0, 2).every((call) => !isToolChoiceNone(call))).toBe(true);
            expect(isToolChoiceNone(calls[2])).toBe(true);
            expect(text).toContain('Voici la réponse');
            expect(outcome).toMatchObject({ stepLimitReached: true, stoppedBy: 'model' });
        });

        it('retries without tools when the model calls one after tools were closed', async () => {
            const { calls, text } = await runScript(
                [...searchSteps(1), step([callTool('searchSermons', { query: 'x' })]), answer()],
                { maxSteps: 2 },
            );

            expect(calls).toHaveLength(3);
            expect(calls[2].toolNames).toEqual([]);
            expect(JSON.stringify(calls[2].prompt)).not.toContain('"query":"x"');
            expect(text).toContain('Voici la réponse');
        });
    });

    describe('tool errors', () => {
        it('marks a tool that returns { error } as failed', async () => {
            await runScript([step([callTool('editNote', { noteId: 'n1' }, 'call-1')]), answer()], {
                tools: sermonTools({ editNote: () => ({ error: 'anchor not found' }) }),
            });

            expect(dispatchToolCallCompleteMock).toHaveBeenCalledWith(
                expect.anything(),
                'conv-1',
                'gen-1',
                'assistant-1',
                {
                    toolCallId: 'call-1',
                    name: 'editNote',
                    output: { error: 'anchor not found' },
                    isError: true,
                },
                expect.any(Function),
            );
        });

        it('marks a thrown tool error as failed', async () => {
            await runScript([step([callTool('editNote', { noteId: 'n1' }, 'call-2')]), answer()], {
                tools: sermonTools({
                    editNote: () => {
                        throw new Error('database locked');
                    },
                }),
            });

            expect(dispatchToolCallCompleteMock.mock.calls[0][4]).toEqual({
                toolCallId: 'call-2',
                name: 'editNote',
                output: { error: 'database locked' },
                isError: true,
            });
        });

        it('marks a successful tool as not failed', async () => {
            await runScript([step([callTool('editNote', { noteId: 'n1' }, 'call-3')]), answer()]);

            expect(dispatchToolCallCompleteMock.mock.calls[0][4]).toMatchObject({ isError: false });
        });
    });

    describe('timeouts and stop', () => {
        it.each([
            ['between chunks', { chunkMs: 100 }, [say('Début'), pause(1_000), say('fin')], 'chunk'],
            [
                'before the first chunk',
                { firstChunkMs: 100 },
                [pause(1_000), say('fin')],
                'first-chunk',
            ],
            [
                'for the whole run',
                { totalMs: 150 },
                [say('Début'), pause(1_000), say('fin')],
                'total',
            ],
        ] as const)('fails with a clear timeout %s', async (_label, timeouts, parts, kind) => {
            await expect(runScript([step([...parts])], { timeouts })).rejects.toMatchObject({
                name: 'AiTimeoutError',
                kind,
                message: expect.stringContaining("n'a pas répondu à temps"),
            });
        });

        it('fails with a clear timeout when a step takes too long', async () => {
            await expect(
                runScript([step([say('Début'), pause(1_000), say('fin')])], {
                    timeouts: { stepMs: 150 },
                }),
            ).rejects.toMatchObject({ name: 'AiTimeoutError', kind: 'step' });
        });

        it('stops quietly mid-step when the user aborts, with no follow-up call', async () => {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 80);
            const { calls, text } = await runScript(
                [step([say('Début'), pause(1_000), say('fin')])],
                {
                    abortSignal: controller.signal,
                },
            );

            expect(calls).toHaveLength(1);
            expect(text).toBe('Début');
        });
    });

    describe('text joining', () => {
        it('separates text emitted across steps instead of running it together', async () => {
            const { text } = await runScript([
                step([say('Je lance la recherche.'), callTool('searchSermons', { query: 'q' })]),
                step([say('Le rapport indique...')]),
            ]);

            expect(text).toBe('Je lance la recherche.\n\nLe rapport indique...');
        });

        it('does not open the reply with a separator', async () => {
            const { text } = await runScript([step([say('Voici la reponse.')])]);

            expect(text).toBe('Voici la reponse.');
        });
    });
});
