import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { APICallError } from '@ai-sdk/provider';
import { generateText, stepCountIs, streamText, tool } from 'ai';
import { z } from 'zod';
import { readScenarioContext } from './openai-wire';
import { MOCK_MODEL_ID, type ChatRequest } from './scenario';
import { startMockLlmServer, type MockLlmServer } from './server';

let server: MockLlmServer;
let logDir: string;

beforeAll(async () => {
    logDir = mkdtempSync(join(tmpdir(), 'mock-llm-'));
    server = await startMockLlmServer({ logFile: join(logDir, 'requests.jsonl') });
});

afterAll(async () => {
    await server.close();
    rmSync(logDir, { recursive: true, force: true });
});

const model = () =>
    createOpenAICompatible({ name: 'mock', apiKey: 'test', baseURL: server.baseUrl })(
        MOCK_MODEL_ID,
    );

const sermonTools = {
    searchSermons: tool({
        inputSchema: z.object({ query: z.string(), limit: z.number().optional() }),
        execute: async ({ query }) => ({
            results: [{ sermonId: `${query}-0317M`, translationId: 7, title: `Sermon ${query}` }],
        }),
    }),
    getSermonContent: tool({
        inputSchema: z.object({ sermonId: z.string() }).passthrough(),
        execute: async () => ({ paragraphs: [{ text: 'Believing wonderful promises today' }] }),
    }),
    searchContent: tool({
        inputSchema: z.object({ query: z.string() }).passthrough(),
        execute: async () => ({ hits: [] }),
    }),
};

function lastRequest() {
    return server.requests[server.requests.length - 1];
}

describe('mock LLM server with the real OpenAI-compatible provider', () => {
    it('lists the mock model with its limits', async () => {
        const body = await (await fetch(`${server.baseUrl}/models`)).json();

        expect(body.data[0]).toMatchObject({ id: MOCK_MODEL_ID, context_length: 128_000 });
    });

    it('plays the normal scenario: reasoning, a tool call, then a streamed answer', async () => {
        const result = streamText({
            model: model(),
            prompt: 'What did he preach? #scenario:normal',
            tools: sermonTools,
            stopWhen: stepCountIs(5),
            maxOutputTokens: 1234,
        });

        const text = await result.text;
        const steps = await result.steps;
        expect(steps[0].reasoningText).toContain('search the 1963 sermons');
        expect(steps[0].toolCalls[0]).toMatchObject({
            toolName: 'searchSermons',
            input: { query: '1963', limit: 3 },
        });
        expect(text).toContain('**Sermon 1963** (1963-0317M)');
        expect(text).toContain('MOCK-NORMAL-DONE');
        expect(await result.finishReason).toBe('stop');
        expect((await result.totalUsage).outputTokens).toBeGreaterThan(0);
        expect(lastRequest()).toMatchObject({
            scenario: 'normal',
            stepIndex: 1,
            maxTokens: 1234,
            toolResultCount: 1,
            outcome: 'completed',
        });
    });

    it('runs the long research scenario for more than 30 tool steps', async () => {
        const result = streamText({
            model: model(),
            prompt: 'Research everything #scenario:long-research',
            tools: sermonTools,
            stopWhen: stepCountIs(50),
        });

        const steps = await result.steps;
        expect(steps.length).toBe(33);
        expect(steps.flatMap((s) => s.toolCalls.map((c) => c.toolName))).toContain(
            'getSermonContent',
        );
        expect(steps[31].toolCalls[0]).toMatchObject({
            toolName: 'searchContent',
            input: { query: 'wonderful' },
        });
        expect(await result.text).toContain('MOCK-LONG-RESEARCH-DONE');
    });

    it('reports finish reason length', async () => {
        const result = streamText({ model: model(), prompt: 'x #scenario:length' });

        expect(await result.text).toContain('MOCK-LENGTH-TEXT');
        expect(await result.finishReason).toBe('length');
    });

    it.each([
        ['401', 'Incorrect API key'],
        ['404', 'does not exist'],
    ])('answers HTTP %s with an OpenAI error body', async (status, message) => {
        const errors: unknown[] = [];
        const result = streamText({
            model: model(),
            prompt: `x #scenario:${status}`,
            maxRetries: 0,
            onError: ({ error }) => errors.push(error),
        });
        await result.consumeStream();

        expect(APICallError.isInstance(errors[0])).toBe(true);
        expect((errors[0] as APICallError).statusCode).toBe(Number(status));
        expect((errors[0] as APICallError).message).toContain(message);
    });

    it('drops the connection mid-stream', async () => {
        const result = streamText({ model: model(), prompt: 'x #scenario:drop' });
        let streamed = '';
        const consume = async () => {
            for await (const delta of result.textStream) streamed += delta;
        };

        await expect(consume()).rejects.toThrow('Failed to process successful response');
        expect(streamed).toContain('MOCK-DROP-TEXT');
        expect(lastRequest().outcome).toBe('dropped');
    });

    it('waits for the configured first-token delay', async () => {
        const startedAt = Date.now();
        const result = await generateText({
            model: model(),
            prompt: 'x #scenario:slow-first-token #delay=150',
        });

        expect(result.text).toContain('MOCK-SLOW-DONE');
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(140);
    });

    it('serves non-streaming tool loops, as the research sub-agent uses', async () => {
        const result = await generateText({
            model: model(),
            prompt: 'Topic to investigate: 1963 #scenario:research-worker',
            tools: sermonTools,
            stopWhen: stepCountIs(10),
        });

        expect(result.steps.map((s) => s.toolCalls[0]?.toolName)).toEqual([
            'searchSermons',
            'getSermonContent',
            undefined,
        ]);
        expect(result.text).toContain('Research report');
        expect(lastRequest()).toMatchObject({ scenario: 'research-worker', stream: false });
    });

    it('notices when the client aborts', async () => {
        const controller = new AbortController();
        const result = streamText({
            model: model(),
            prompt: 'x #scenario:slow-first-token #delay=5000',
            abortSignal: controller.signal,
        });
        setTimeout(() => controller.abort(), 100);
        await result.consumeStream();
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(lastRequest().outcome).toBe('client-closed');
    });

    it('answers title prompts without a tag', async () => {
        const result = await generateText({
            model: model(),
            prompt: 'Generate a short conversation title (max 8 words)\nuser: hi #scenario:normal',
        });

        expect(result.text).toBe('Mock conversation title');
    });

    it('writes every request to the log file', () => {
        const lines = readFileSync(join(logDir, 'requests.jsonl'), 'utf8').trim().split('\n');

        expect(lines.length).toBe(server.requests.length);
        expect(JSON.parse(lines[0])).toHaveProperty('scenario');
    });
});

describe('readScenarioContext', () => {
    const request = (messages: ChatRequest['messages']): ChatRequest => ({
        model: MOCK_MODEL_ID,
        messages,
    });

    it('reads the tag, params and the step from the tagged user message on', () => {
        const ctx = readScenarioContext(
            request([
                { role: 'system', content: 'sys' },
                { role: 'user', content: 'earlier question' },
                { role: 'assistant', content: 'earlier answer' },
                { role: 'user', content: 'new one #scenario:slow-first-token #delay=50' },
                {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                        { id: 'c1', function: { name: 'searchSermons', arguments: '{}' } },
                    ],
                },
                { role: 'tool', tool_call_id: 'c1', content: '{"results":[]}' },
            ]),
        );

        expect(ctx).toMatchObject({
            tag: 'slow-first-token',
            params: { delay: '50' },
            stepIndex: 1,
            toolResults: [{ toolName: 'searchSermons', content: '{"results":[]}' }],
        });
    });

    it('counts steps from the last user message when there is no tag', () => {
        const ctx = readScenarioContext(
            request([
                { role: 'user', content: [{ type: 'text', text: 'plain' }] },
                { role: 'assistant', content: 'a' },
            ]),
        );

        expect(ctx).toMatchObject({ tag: null, stepIndex: 1, userText: 'plain' });
    });
});
