import { describe, expect, it } from 'vitest';
import { APICallError } from '@ai-sdk/provider';
import { generateText, stepCountIs, streamText, tool } from 'ai';
import { z } from 'zod';
import {
    apiError,
    breakStream,
    callTool,
    createScriptedModel,
    pause,
    promptTexts,
    promptToolResults,
    say,
    step,
    streamError,
    think,
} from './mock-model';

const searchSermons = tool({
    description: 'Search sermons',
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => ({ results: [{ sermonId: `id-for-${query}` }] }),
});

async function collect(stream: AsyncIterable<{ type: string }>) {
    const parts: { type: string }[] = [];
    for await (const part of stream) parts.push(part);
    return parts;
}

describe('createScriptedModel with streamText', () => {
    it('streams text deltas split by words', async () => {
        const { model } = createScriptedModel([step([say('Hello there world')])]);
        const result = streamText({ model, prompt: 'hi' });

        const deltas: string[] = [];
        for await (const part of result.fullStream) {
            if (part.type === 'text-delta') deltas.push(part.text);
        }

        expect(deltas).toEqual(['Hello ', 'there ', 'world']);
        expect(await result.text).toBe('Hello there world');
        expect(await result.finishReason).toBe('stop');
    });

    it('streams reasoning deltas before the text', async () => {
        const { model } = createScriptedModel([step([think('Let me think'), say('Answer')])]);
        const result = streamText({ model, prompt: 'hi' });

        const types = (await collect(result.fullStream)).map((part) => part.type);

        expect(types.indexOf('reasoning-delta')).toBeLessThan(types.indexOf('text-delta'));
        expect(await result.reasoningText).toBe('Let me think');
        expect(await result.text).toBe('Answer');
    });

    it('runs a multi-step tool loop and records what the model received each step', async () => {
        const scripted = createScriptedModel([
            step([think('I should search'), callTool('searchSermons', { query: 'faith' })]),
            step([say('Found it.')], { usage: { input: 120, output: 7 } }),
        ]);

        const result = streamText({
            model: scripted.model,
            system: 'You are a test assistant.',
            prompt: 'Find faith',
            tools: { searchSermons },
            stopWhen: stepCountIs(5),
            maxOutputTokens: 4096,
            providerOptions: { openai: { reasoningEffort: 'low' } },
        });

        expect(await result.text).toBe('Found it.');
        const steps = await result.steps;
        expect(steps).toHaveLength(2);
        expect(steps[0].finishReason).toBe('tool-calls');
        expect(steps[0].toolCalls[0]).toMatchObject({
            toolName: 'searchSermons',
            input: { query: 'faith' },
        });
        expect(steps[0].toolResults[0].output).toEqual({
            results: [{ sermonId: 'id-for-faith' }],
        });
        expect((await result.totalUsage).inputTokens).toBe(130);

        expect(scripted.calls).toHaveLength(2);
        expect(scripted.remainingSteps()).toBe(0);
        const [first, second] = scripted.calls;
        expect(first.toolNames).toEqual(['searchSermons']);
        expect(first.maxOutputTokens).toBe(4096);
        expect(first.providerOptions).toEqual({ openai: { reasoningEffort: 'low' } });
        expect(promptTexts(first.prompt, 'system')).toEqual(['You are a test assistant.']);
        expect(promptTexts(first.prompt, 'user')).toEqual(['Find faith']);
        expect(promptToolResults(first.prompt)).toEqual([]);
        expect(promptToolResults(second.prompt)[0]).toMatchObject({
            toolName: 'searchSermons',
            output: { type: 'json', value: { results: [{ sermonId: 'id-for-faith' }] } },
        });
    });

    it.each(['stop', 'length', 'content-filter', 'other'] as const)(
        'reports the scripted finish reason %s',
        async (finishReason) => {
            const { model } = createScriptedModel([step([say('partial')], { finishReason })]);
            const result = streamText({ model, prompt: 'hi' });

            expect(await result.finishReason).toBe(finishReason);
        },
    );

    it('reports a scripted error finish reason', async () => {
        const { model } = createScriptedModel([step([say('partial')], { finishReason: 'error' })]);
        const result = streamText({ model, prompt: 'hi' });

        expect(await result.finishReason).toBe('error');
    });

    it('stops the tool loop at the step limit when the model keeps calling tools', async () => {
        const scripted = createScriptedModel(
            Array.from({ length: 3 }, (_, i) =>
                step([callTool('searchSermons', { query: `q${i}` })]),
            ),
        );
        const result = streamText({
            model: scripted.model,
            prompt: 'loop',
            tools: { searchSermons },
            stopWhen: stepCountIs(3),
        });

        expect(await result.finishReason).toBe('tool-calls');
        expect(await result.text).toBe('');
        expect(scripted.calls).toHaveLength(3);
    });

    it('reports scripted usage numbers', async () => {
        const { model } = createScriptedModel([
            step([say('x')], {
                usage: { input: 1000, output: 300, reasoning: 200, cacheRead: 400 },
            }),
        ]);
        const result = streamText({ model, prompt: 'hi' });

        const usage = await result.totalUsage;
        expect(usage).toMatchObject({ inputTokens: 1000, outputTokens: 300 });
        expect(usage.outputTokenDetails.reasoningTokens).toBe(200);
        expect(usage.inputTokenDetails.cacheReadTokens).toBe(400);
    });

    it('surfaces an error part inside the stream', async () => {
        const { model } = createScriptedModel([
            step([say('before'), streamError(new Error('provider overloaded'))]),
        ]);
        const errors: unknown[] = [];
        const result = streamText({
            model,
            prompt: 'hi',
            onError: ({ error }) => errors.push(error),
        });

        const parts = await collect(result.fullStream);

        expect(parts.some((part) => part.type === 'error')).toBe(true);
        expect((errors[0] as Error).message).toBe('provider overloaded');
    });

    it('fails mid-stream when the stream breaks after some text', async () => {
        const { model } = createScriptedModel([
            step([say('half an answer'), breakStream(new Error('socket hang up'))]),
        ]);
        const result = streamText({ model, prompt: 'hi', maxRetries: 0 });

        const deltas: string[] = [];
        const consume = async () => {
            for await (const part of result.fullStream) {
                if (part.type === 'text-delta') deltas.push(part.text);
            }
        };

        await expect(consume()).rejects.toThrow('socket hang up');
        expect(deltas.join('')).toBe('half an answer');
    });

    it('rejects the call before streaming, like an HTTP error', async () => {
        const { model, calls } = createScriptedModel([
            step([], { reject: apiError(401, 'Invalid API key') }),
        ]);
        const errors: unknown[] = [];
        const result = streamText({
            model,
            prompt: 'hi',
            maxRetries: 0,
            onError: ({ error }) => errors.push(error),
        });

        await collect(result.fullStream);

        expect(APICallError.isInstance(errors[0])).toBe(true);
        expect((errors[0] as APICallError).statusCode).toBe(401);
        expect(calls).toHaveLength(1);
    });

    it('retries a retryable HTTP error and then succeeds', async () => {
        const { model, calls } = createScriptedModel([
            step([], { reject: apiError(500, 'Internal error') }),
            step([say('recovered')]),
        ]);
        const result = streamText({ model, prompt: 'hi', maxRetries: 1 });

        expect(await result.text).toBe('recovered');
        expect(calls).toHaveLength(2);
    });

    it('waits before the first chunk and between chunks', async () => {
        const { model } = createScriptedModel([
            step([say('a b c')], { firstChunkDelayMs: 60, chunkDelayMs: 10 }),
        ]);
        const startedAt = Date.now();
        const result = streamText({ model, prompt: 'hi' });

        let firstDeltaAt = 0;
        for await (const part of result.fullStream) {
            if (part.type === 'text-delta' && !firstDeltaAt) firstDeltaAt = Date.now();
        }

        expect(firstDeltaAt - startedAt).toBeGreaterThanOrEqual(55);
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(90);
    });

    it('pauses at a scripted point inside the stream', async () => {
        const { model } = createScriptedModel([step([say('one'), pause(80), say('two')])]);
        const result = streamText({ model, prompt: 'hi' });

        const timestamps: Record<string, number> = {};
        for await (const part of result.fullStream) {
            if (part.type === 'text-delta') timestamps[part.text] = Date.now();
        }

        expect(timestamps.two - timestamps.one).toBeGreaterThanOrEqual(75);
    });

    it('stops streaming as soon as the abort signal fires', async () => {
        const { model } = createScriptedModel([
            step([say('one two three four five six')], { chunkDelayMs: 40 }),
        ]);
        const controller = new AbortController();
        const result = streamText({ model, prompt: 'hi', abortSignal: controller.signal });

        const deltas: string[] = [];
        const types: string[] = [];
        for await (const part of result.fullStream) {
            types.push(part.type);
            if (part.type === 'text-delta') {
                deltas.push(part.text);
                if (deltas.length === 2) controller.abort();
            }
        }

        expect(deltas).toEqual(['one ', 'two ']);
        expect(types).toContain('abort');
    });

    it('aborts during a long time to first token', async () => {
        const { model } = createScriptedModel([step([say('late')], { firstChunkDelayMs: 10_000 })]);
        const controller = new AbortController();
        const startedAt = Date.now();
        const result = streamText({ model, prompt: 'hi', abortSignal: controller.signal });
        setTimeout(() => controller.abort(), 30);

        const types = (await collect(result.fullStream)).map((part) => part.type);

        expect(types).toContain('abort');
        expect(Date.now() - startedAt).toBeLessThan(2000);
    });

    it('fails loudly when the script runs out of steps', async () => {
        const { model } = createScriptedModel([step([callTool('searchSermons', { query: 'x' })])]);
        const errors: unknown[] = [];
        const result = streamText({
            model,
            prompt: 'hi',
            tools: { searchSermons },
            stopWhen: stepCountIs(5),
            maxRetries: 0,
            onError: ({ error }) => errors.push(error),
        });

        await collect(result.fullStream);

        expect((errors[0] as Error).message).toMatch(/no step 2/);
    });
});

describe('createScriptedModel with generateText', () => {
    it('runs the same script through doGenerate with tools', async () => {
        const scripted = createScriptedModel([
            step([think('search first'), callTool('searchSermons', { query: 'grace' })]),
            step([say('Grace is covered.')], { finishReason: 'length' }),
        ]);

        const result = await generateText({
            model: scripted.model,
            prompt: 'grace?',
            tools: { searchSermons },
            stopWhen: stepCountIs(4),
            maxOutputTokens: 256,
        });

        expect(result.text).toBe('Grace is covered.');
        expect(result.finishReason).toBe('length');
        expect(result.steps[0].reasoningText).toBe('search first');
        expect(scripted.calls.map((call) => call.method)).toEqual(['generate', 'generate']);
        expect(scripted.calls[1].maxOutputTokens).toBe(256);
        expect(promptToolResults(scripted.calls[1].prompt)).toHaveLength(1);
    });

    it('throws a scripted HTTP error', async () => {
        const { model } = createScriptedModel([
            step([], { reject: apiError(404, 'model not found') }),
        ]);

        await expect(generateText({ model, prompt: 'hi', maxRetries: 0 })).rejects.toMatchObject({
            statusCode: 404,
        });
    });

    it('throws a scripted mid-response failure', async () => {
        const { model } = createScriptedModel([
            step([say('x'), breakStream(new Error('dropped'))]),
        ]);

        await expect(generateText({ model, prompt: 'hi', maxRetries: 0 })).rejects.toThrow(
            'dropped',
        );
    });

    it('can be aborted while waiting for the response', async () => {
        const { model } = createScriptedModel([step([say('late')], { firstChunkDelayMs: 10_000 })]);
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 20);

        await expect(
            generateText({ model, prompt: 'hi', abortSignal: controller.signal }),
        ).rejects.toMatchObject({ name: 'AbortError' });
    });
});
