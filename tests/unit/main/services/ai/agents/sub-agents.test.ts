import { beforeEach, describe, expect, it, vi } from 'vitest';
import { estimateTokenCount } from 'tokenx';
import { z } from 'zod';
import { MockLanguageModelV4 } from 'ai/test';
import {
    apiError,
    callTool,
    createScriptedModel,
    pause,
    promptTexts,
    say,
    step,
    type RecordedCall,
    type ScriptStep,
} from '../../../../../helpers/mock-model';

const sendToRendererMock = vi.fn();
const logWarnMock = vi.fn();
const toolBehaviour = new Map<string, (input: unknown) => unknown>();

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: logWarnMock, error: vi.fn() },
}));

vi.mock('@main/ipc/register', () => ({ sendToRenderer: sendToRendererMock }));

function fakeTool(name: string) {
    return {
        description: `Fake ${name}.`,
        inputSchema: z.object({ query: z.string().optional() }).passthrough(),
        execute: async (input: unknown) => {
            const behaviour = toolBehaviour.get(name);
            return behaviour ? behaviour(input) : { results: [{ title: `${name} hit` }] };
        },
    };
}

const fakeTools = (names: string[]) =>
    Object.fromEntries(names.map((name) => [name, fakeTool(name)]));

vi.mock('@main/services/ai/tools/sermon.tools', () => ({
    buildSermonTools: () => fakeTools(['searchSermons', 'searchContent', 'getSermonContent']),
}));
vi.mock('@main/services/ai/tools/bible.tools', () => ({
    buildBibleTools: () => fakeTools(['getBiblePassage', 'getBibleVersions', 'searchBible']),
}));
vi.mock('@main/services/ai/tools/document.tools', () => ({
    buildDocumentTools: () =>
        fakeTools(['searchCustomDocuments', 'getCustomDocuments', 'getCustomDocumentContent']),
}));

const { buildAgentTools } = await import('@main/services/ai/agents');
const { resolveChatTimeouts } = await import('@main/services/ai/model-timeouts');
const { PushChannels } = await import('@shared/ipc.types');

type AgentContextInput = Parameters<typeof buildAgentTools>[0];

const REPORT = 'Rapport : le Saint-Esprit révèle l’amour de Dieu [Sermon](wmb://sermon/fr/1/12).';
const LARGE_TEXT = "Qui t'a appris que tu es nu ? Le Saint-Esprit révèle l'amour de Dieu. ".repeat(
    400,
);

const searchSteps = (count: number): ScriptStep[] =>
    Array.from({ length: count }, (_, index) =>
        step([callTool('searchContent', { query: `q${index}` })]),
    );
const report = (text = REPORT, finishReason?: 'length'): ScriptStep =>
    step([say(text)], finishReason ? { finishReason } : {});
const isToolChoiceNone = (call: RecordedCall) => call.toolChoice?.type === 'none';
const systemText = (call: RecordedCall) => promptTexts(call.prompt, 'system').join('\n');

function agentContext(
    model: AgentContextInput['model'],
    overrides: Partial<AgentContextInput> = {},
): AgentContextInput {
    return {
        model,
        contentLanguage: 'fr',
        uiLanguage: 'fr',
        activeBibleVersion: 'lsg',
        contextWindow: 128_000,
        maxOutputTokens: 32_000,
        timeouts: resolveChatTimeouts(false),
        dispatch: {
            browserWindow: {} as never,
            conversationId: 'conv-1',
            generationId: 'gen-1',
            assistantMessageId: 'assistant-1',
        },
        ...overrides,
    };
}

function research(script: ScriptStep[], overrides: Partial<AgentContextInput> = {}) {
    const scripted = createScriptedModel(script);
    const tools = buildAgentTools(agentContext(scripted.model, overrides));
    return {
        scripted,
        run: () => tools.researchTopic.execute({ topic: 'Qui t’a dit que tu étais nu ?' }),
    };
}

function readSermon(script: ScriptStep[], overrides: Partial<AgentContextInput> = {}) {
    const scripted = createScriptedModel(script);
    const tools = buildAgentTools(agentContext(scripted.model, overrides));
    return {
        scripted,
        run: () =>
            tools.readSermon.execute({ sermonId: '63-0318', question: 'Que dit-il des Sceaux ?' }),
    };
}

function slowReportModel(delayMs: number) {
    return new MockLanguageModelV4({
        doGenerate: async () => {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return {
                content: [{ type: 'text', text: REPORT }],
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: undefined },
                    outputTokens: { total: 5, text: 5, reasoning: 0 },
                },
                warnings: [],
            };
        },
    });
}

function toolCompleteEvents() {
    return sendToRendererMock.mock.calls
        .filter(([, channel]) => channel === PushChannels.aiToolCallComplete)
        .map(([, , event]) => event);
}

describe('sub-agents', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        toolBehaviour.clear();
    });

    describe('step limit', () => {
        it('forces a report step when the reader runs out of steps mid research', async () => {
            const { scripted, run } = readSermon([...searchSteps(19), report()]);

            const result = await run();

            expect(scripted.calls).toHaveLength(20);
            const last = scripted.calls[19];
            expect(isToolChoiceNone(last)).toBe(true);
            expect(systemText(last)).toContain('Write your report now');
            expect(result).toMatchObject({ status: 'incomplete', reason: 'step-limit' });
            expect((result as { response: string }).response).toContain(REPORT);
        });

        it('forces a report step for the research agent at its step limit', async () => {
            const { scripted, run } = research([...searchSteps(49), report()]);

            const result = await run();

            expect(scripted.calls).toHaveLength(50);
            expect(isToolChoiceNone(scripted.calls[49])).toBe(true);
            expect(result).toMatchObject({ status: 'incomplete', reason: 'step-limit', steps: 50 });
            expect((result as { response: string }).response).toContain(REPORT);
        });

        it('asks once more without tools when the model still calls a tool on the report step', async () => {
            const { scripted, run } = readSermon([
                ...searchSteps(19),
                step([callTool('searchContent', { query: 'encore' })]),
                report(),
            ]);

            const result = await run();

            expect(scripted.calls).toHaveLength(21);
            expect(scripted.calls[20].toolNames).toEqual([]);
            expect(result).toMatchObject({ status: 'incomplete', reason: 'step-limit' });
            expect((result as { response: string }).response).toContain(REPORT);
        });
    });

    describe('report finished normally', () => {
        it('returns the last step report as completed with run stats', async () => {
            const { run } = research([...searchSteps(2), report()]);

            const result = await run();

            expect(result).toMatchObject({ status: 'completed', response: REPORT, steps: 3 });
            expect((result as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0);
            expect(result).not.toHaveProperty('reason');
        });

        it('does not keep "let me search more" text from earlier steps in the report', async () => {
            const { run } = research([
                step([say('Je vais chercher encore.'), callTool('searchContent', { query: 'nu' })]),
                report(),
            ]);

            const result = await run();

            expect((result as { response: string }).response).toBe(REPORT);
        });

        it('caps output from the model budget instead of a fixed 4,096', async () => {
            const { scripted, run } = research([callStep(), report()]);

            await run();

            expect(scripted.calls[1].maxOutputTokens).toBeGreaterThan(4_096);
            expect(logWarnMock).not.toHaveBeenCalledWith(
                'Research agent output truncated',
                expect.anything(),
            );
        });

        function callStep() {
            return step([callTool('searchContent', { query: 'amour' })]);
        }
    });

    describe('report cut by the output limit', () => {
        it('continues a cut report and joins both parts', async () => {
            const { scripted, run } = research([
                ...searchSteps(1),
                report('Première partie du rapport, ', 'length'),
                report('seconde partie.'),
            ]);

            const result = await run();

            expect(scripted.calls).toHaveLength(3);
            expect(promptTexts(scripted.calls[2].prompt, 'user').join('\n')).toContain('cut off');
            expect(result).toMatchObject({
                status: 'completed',
                response: 'Première partie du rapport, seconde partie.',
            });
        });

        it('marks the report incomplete when the continuation is cut too', async () => {
            const { run } = research([
                ...searchSteps(1),
                report('Première partie, ', 'length'),
                report('seconde partie', 'length'),
            ]);

            const result = await run();

            expect(result).toMatchObject({ status: 'incomplete', reason: 'report-cut' });
            expect((result as { response: string }).response).toContain(
                'Première partie, seconde partie',
            );
        });

        it('asks for the report when the cut step wrote nothing', async () => {
            const { scripted, run } = research([
                ...searchSteps(1),
                step([], { finishReason: 'length' }),
                report(),
            ]);

            const result = await run();

            expect(scripted.calls).toHaveLength(3);
            expect(result).toMatchObject({ status: 'completed', response: REPORT });
        });
    });

    describe('tool events', () => {
        it('sends isError for a failing tool inside the sub-agent', async () => {
            toolBehaviour.set('searchContent', () => {
                throw new Error('Index de recherche indisponible');
            });
            const { run } = research([
                step([callTool('searchContent', { query: 'nu' }, 'inner-1')]),
                report(),
            ]);

            await run();

            expect(toolCompleteEvents()).toEqual([
                expect.objectContaining({
                    toolName: 'researchTopic:searchContent',
                    toolCallId: 'inner-1',
                    isError: true,
                    payload: { error: 'Index de recherche indisponible' },
                }),
            ]);
        });

        it('sends isError for an { error } result and false for a good one', async () => {
            toolBehaviour.set('searchBible', () => ({ error: 'Bible non installée' }));
            const { run } = research([
                step([
                    callTool('searchBible', { query: 'nu' }, 'inner-bible'),
                    callTool('searchContent', { query: 'nu' }, 'inner-content'),
                ]),
                report(),
            ]);

            await run();

            const events = toolCompleteEvents();
            expect(events.find((event) => event.toolCallId === 'inner-bible')).toMatchObject({
                isError: true,
            });
            expect(events.find((event) => event.toolCallId === 'inner-content')).toMatchObject({
                isError: false,
            });
        });
    });

    describe('stop and time limits', () => {
        it('stops at once when the parent run is aborted mid-step', async () => {
            const controller = new AbortController();
            const { scripted, run } = research(
                [step([pause(5_000), callTool('searchContent', { query: 'nu' })]), report()],
                { abortSignal: controller.signal },
            );

            const startedAt = Date.now();
            setTimeout(() => controller.abort(), 30);

            await expect(run()).rejects.toThrow();
            expect(Date.now() - startedAt).toBeLessThan(1_000);
            expect(scripted.calls).toHaveLength(1);
        });

        it('does not start when the parent run is already stopped', async () => {
            const controller = new AbortController();
            controller.abort();
            const { scripted, run } = research([report()], { abortSignal: controller.signal });

            await expect(run()).rejects.toThrow();
            expect(scripted.calls).toHaveLength(0);
        });

        it('sends no progress events once the parent run is stopped', async () => {
            const controller = new AbortController();
            toolBehaviour.set('searchContent', () => {
                controller.abort();
                return { results: [] };
            });
            const { run } = research(
                [step([callTool('searchContent', { query: 'nu' })]), report()],
                { abortSignal: controller.signal },
            );

            await expect(run()).rejects.toThrow();
            expect(toolCompleteEvents()).toEqual([]);
        });

        it('fails with a clear reason when the model does not answer in time', async () => {
            const { run } = research([step([pause(5_000), say(REPORT)])], {
                timeouts: { ...resolveChatTimeouts(false), agentToolMs: 300 },
            });

            const result = await run();

            expect(result).toMatchObject({ status: 'failed', reason: 'timeout' });
            expect((result as { response: string }).response).toMatch(/in time/i);
        });

        it('writes the report early when its time is nearly used up', async () => {
            toolBehaviour.set('searchContent', async () => {
                await new Promise((resolve) => setTimeout(resolve, 900));
                return { results: [] };
            });
            const { scripted, run } = research([...searchSteps(1), report()], {
                timeouts: { ...resolveChatTimeouts(false), agentToolMs: 1_000 },
            });

            const result = await run();

            expect(isToolChoiceNone(scripted.calls[1])).toBe(true);
            expect(result).toMatchObject({ status: 'incomplete', reason: 'time-limit' });
            expect((result as { response: string }).response).toContain(REPORT);
        });

        it('fails, without throwing, when the provider rejects the call', async () => {
            const { run } = research([
                step([], { reject: new Error('Provider returned error 502') }),
            ]);

            const result = await run();

            expect(result).toMatchObject({ status: 'failed', reason: 'error' });
            expect((result as { error: string }).error).toContain('502');
        });
    });

    describe('context budget', () => {
        it('keeps every sub-agent prompt inside the window when tool results are large', async () => {
            toolBehaviour.set('getSermonContent', () => ({
                paragraphs: [{ paragraphNumber: 1, content: LARGE_TEXT }],
            }));
            const script = [
                ...Array.from({ length: 12 }, (_, index) =>
                    step([callTool('getSermonContent', { query: `p${index}` })]),
                ),
                report(),
            ];
            const { scripted, run } = readSermon(script, {
                contextWindow: 32_000,
                maxOutputTokens: 8_192,
            });

            const result = await run();

            for (const call of scripted.calls) {
                const promptTokens = estimateTokenCount(JSON.stringify(call.prompt));
                expect(promptTokens + (call.maxOutputTokens ?? 0)).toBeLessThan(32_000);
            }
            expect(result).toMatchObject({ status: 'completed', response: REPORT });
        });
    });

    describe('reasoning the provider refuses', () => {
        const refused = () =>
            step([], { reject: apiError(400, 'This model does not support thinking') });

        it('retries once without reasoning', async () => {
            const { scripted, run } = research([refused(), report()], { reasoningControl: true });

            const result = await run();

            expect(result).toMatchObject({ status: 'completed', response: REPORT });
            expect(scripted.calls.map((call) => call.reasoning)).toEqual(['low', undefined]);
        });

        it('starts the next sub-agent of the run without reasoning', async () => {
            const scripted = createScriptedModel([refused(), report(), report()]);
            const tools = buildAgentTools(agentContext(scripted.model, { reasoningControl: true }));

            await tools.researchTopic.execute({ topic: 'la foi' });
            await tools.researchTopic.execute({ topic: "l'amour" });

            expect(scripted.calls.map((call) => call.reasoning)).toEqual([
                'low',
                undefined,
                undefined,
            ]);
        });

        it('does not retry a 400 about something else', async () => {
            const { scripted, run } = research(
                [step([], { reject: apiError(400, 'Invalid tool schema') }), report()],
                { reasoningControl: true },
            );

            const result = await run();

            expect(result).toMatchObject({ status: 'failed', reason: 'error' });
            expect(scripted.calls).toHaveLength(1);
        });
    });

    describe('parallel runs', () => {
        it('runs at most two sub-agents at the same time and queues the third', async () => {
            let active = 0;
            let peak = 0;
            const model = new MockLanguageModelV4({
                doGenerate: async () => {
                    active++;
                    peak = Math.max(peak, active);
                    await new Promise((resolve) => setTimeout(resolve, 60));
                    active--;
                    return {
                        content: [{ type: 'text', text: REPORT }],
                        finishReason: { unified: 'stop', raw: 'stop' },
                        usage: {
                            inputTokens: {
                                total: 10,
                                noCache: 10,
                                cacheRead: 0,
                                cacheWrite: undefined,
                            },
                            outputTokens: { total: 5, text: 5, reasoning: 0 },
                        },
                        warnings: [],
                    };
                },
            });
            const tools = buildAgentTools(agentContext(model));

            const results = await Promise.all([
                tools.researchTopic.execute({ topic: 'la foi' }),
                tools.researchTopic.execute({ topic: "l'amour" }),
                tools.readSermon.execute({ sermonId: '63-0318' }),
            ]);

            expect(peak).toBe(2);
            expect(results.map((result) => (result as { status: string }).status)).toEqual([
                'completed',
                'completed',
                'completed',
            ]);
        });

        it('counts the time of a queued sub-agent from when it gets a slot', async () => {
            const model = slowReportModel(150);
            const tools = buildAgentTools(agentContext(model));

            const results = await Promise.all([
                tools.researchTopic.execute({ topic: 'la foi' }),
                tools.researchTopic.execute({ topic: "l'amour" }),
                tools.readSermon.execute({ sermonId: '63-0318' }),
            ]);

            expect((results[2] as { durationMs: number }).durationMs).toBeLessThan(250);
        });

        it('refuses a seventh sub-agent call in one run with a clear error', async () => {
            const model = slowReportModel(0);
            const tools = buildAgentTools(agentContext(model));

            const results = [];
            for (let call = 0; call < 7; call++) {
                results.push(await tools.researchTopic.execute({ topic: `sujet ${call}` }));
            }

            expect(model.doGenerateCalls).toHaveLength(6);
            expect(results[5]).toMatchObject({ status: 'completed' });
            expect(results[6]).toMatchObject({ status: 'failed', reason: 'call-limit' });
            expect((results[6] as { response: string }).response).toMatch(/6 .*answer/i);
        });
    });
});
