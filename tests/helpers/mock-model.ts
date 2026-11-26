import {
    APICallError,
    type LanguageModelV4CallOptions,
    type LanguageModelV4Content,
    type LanguageModelV4FinishReason,
    type LanguageModelV4GenerateResult,
    type LanguageModelV4Prompt,
    type LanguageModelV4StreamPart,
    type LanguageModelV4StreamResult,
    type LanguageModelV4Usage,
} from '@ai-sdk/provider';
import { delay } from '@ai-sdk/provider-utils';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';

export type FinishReasonName = LanguageModelV4FinishReason['unified'];

export type ScriptPart =
    | { kind: 'text'; deltas: string[] }
    | { kind: 'reasoning'; deltas: string[] }
    | { kind: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
    | { kind: 'pause'; ms: number }
    | { kind: 'stream-error'; error: unknown }
    | { kind: 'break'; error: unknown };

export interface UsageInput {
    input?: number;
    output?: number;
    reasoning?: number;
    cacheRead?: number;
}

export interface StepOptions {
    finishReason?: FinishReasonName;
    usage?: UsageInput;
    firstChunkDelayMs?: number;
    chunkDelayMs?: number;
    /** The call fails before any chunk, like an HTTP error response. */
    reject?: unknown;
}

export interface ScriptStep extends StepOptions {
    parts: ScriptPart[];
}

const DEFAULT_USAGE: Required<UsageInput> = { input: 10, output: 5, reasoning: 0, cacheRead: 0 };

let toolCallCounter = 0;

function splitIntoDeltas(text: string, wordsPerDelta: number): string[] {
    const words = text.match(/\S+\s*|\s+/g) ?? [];
    const deltas: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerDelta) {
        deltas.push(words.slice(i, i + wordsPerDelta).join(''));
    }
    return deltas;
}

export function say(text: string | string[], options?: { wordsPerDelta?: number }): ScriptPart {
    const deltas = Array.isArray(text) ? text : splitIntoDeltas(text, options?.wordsPerDelta ?? 1);
    return { kind: 'text', deltas };
}

export function think(text: string | string[], options?: { wordsPerDelta?: number }): ScriptPart {
    const deltas = Array.isArray(text) ? text : splitIntoDeltas(text, options?.wordsPerDelta ?? 1);
    return { kind: 'reasoning', deltas };
}

export function callTool(toolName: string, input: unknown, toolCallId?: string): ScriptPart {
    return {
        kind: 'tool-call',
        toolName,
        input,
        toolCallId: toolCallId ?? `call-${++toolCallCounter}`,
    };
}

export function pause(ms: number): ScriptPart {
    return { kind: 'pause', ms };
}

/** An `error` part inside a stream that otherwise keeps going, as providers send in SSE. */
export function streamError(error: unknown): ScriptPart {
    return { kind: 'stream-error', error };
}

/** The stream itself fails at this point, like a dropped connection. */
export function breakStream(error: unknown = new Error('socket hang up')): ScriptPart {
    return { kind: 'break', error };
}

export function step(parts: ScriptPart[], options: StepOptions = {}): ScriptStep {
    return { parts, ...options };
}

export function apiError(
    statusCode: number,
    message = `HTTP ${statusCode}`,
    options?: { isRetryable?: boolean },
): APICallError {
    return new APICallError({
        message,
        url: 'http://mock.invalid/v1/chat/completions',
        requestBodyValues: {},
        statusCode,
        responseBody: JSON.stringify({ error: { message } }),
        isRetryable: options?.isRetryable ?? (statusCode === 429 || statusCode >= 500),
    });
}

export function toUsage(input: UsageInput = {}): LanguageModelV4Usage {
    const usage = { ...DEFAULT_USAGE, ...input };
    return {
        inputTokens: {
            total: usage.input,
            noCache: usage.input - usage.cacheRead,
            cacheRead: usage.cacheRead,
            cacheWrite: undefined,
        },
        outputTokens: {
            total: usage.output,
            text: Math.max(0, usage.output - usage.reasoning),
            reasoning: usage.reasoning,
        },
    };
}

const RAW_FINISH_REASONS: Partial<Record<FinishReasonName, string>> = {
    stop: 'stop',
    length: 'length',
    'tool-calls': 'tool_calls',
    'content-filter': 'content_filter',
};

function resolveFinishReason(scriptStep: ScriptStep): LanguageModelV4FinishReason {
    const hasToolCall = scriptStep.parts.some((part) => part.kind === 'tool-call');
    const unified = scriptStep.finishReason ?? (hasToolCall ? 'tool-calls' : 'stop');
    return { unified, raw: RAW_FINISH_REASONS[unified] };
}

type InternalChunk =
    | LanguageModelV4StreamPart
    | { type: 'internal-pause'; ms: number }
    | { type: 'internal-break'; error: unknown };

function partToChunks(part: ScriptPart, id: string): InternalChunk[] {
    switch (part.kind) {
        case 'text':
            return [
                { type: 'text-start', id },
                ...part.deltas.map((delta): InternalChunk => ({ type: 'text-delta', id, delta })),
                { type: 'text-end', id },
            ];
        case 'reasoning':
            return [
                { type: 'reasoning-start', id },
                ...part.deltas.map((delta): InternalChunk => ({
                    type: 'reasoning-delta',
                    id,
                    delta,
                })),
                { type: 'reasoning-end', id },
            ];
        case 'tool-call': {
            const { toolCallId, toolName } = part;
            const input = JSON.stringify(part.input);
            return [
                { type: 'tool-input-start', id: toolCallId, toolName },
                { type: 'tool-input-delta', id: toolCallId, delta: input },
                { type: 'tool-input-end', id: toolCallId },
                { type: 'tool-call', toolCallId, toolName, input },
            ];
        }
        case 'pause':
            return [{ type: 'internal-pause', ms: part.ms }];
        case 'stream-error':
            return [{ type: 'error', error: part.error }];
        case 'break':
            return [{ type: 'internal-break', error: part.error }];
    }
}

function toStreamChunks(scriptStep: ScriptStep, stepIndex: number): InternalChunk[] {
    return [
        { type: 'stream-start', warnings: [] },
        ...scriptStep.parts.flatMap((part, partIndex) =>
            partToChunks(part, `${stepIndex}-${partIndex}`),
        ),
        {
            type: 'finish',
            finishReason: resolveFinishReason(scriptStep),
            usage: toUsage(scriptStep.usage),
        },
    ];
}

function abortReason(signal: AbortSignal): unknown {
    return signal.reason ?? new DOMException('This operation was aborted', 'AbortError');
}

function buildScriptedStream(
    scriptStep: ScriptStep,
    stepIndex: number,
    abortSignal: AbortSignal | undefined,
): ReadableStream<LanguageModelV4StreamPart> {
    const abortableDelay = (ms: number | null) => delay(ms, { abortSignal });
    const source = simulateReadableStream<InternalChunk>({
        chunks: toStreamChunks(scriptStep, stepIndex),
        initialDelayInMs: scriptStep.firstChunkDelayMs ?? null,
        chunkDelayInMs: scriptStep.chunkDelayMs ?? null,
        _internal: { delay: abortableDelay },
    });

    return source.pipeThrough(
        new TransformStream<InternalChunk, LanguageModelV4StreamPart>({
            async transform(chunk, controller) {
                if (abortSignal?.aborted) {
                    controller.error(abortReason(abortSignal));
                    return;
                }
                if (chunk.type === 'internal-pause') {
                    await abortableDelay(chunk.ms);
                    return;
                }
                if (chunk.type === 'internal-break') {
                    controller.error(chunk.error);
                    return;
                }
                controller.enqueue(chunk);
            },
        }),
    );
}

async function buildScriptedGenerateResult(
    scriptStep: ScriptStep,
    abortSignal: AbortSignal | undefined,
): Promise<LanguageModelV4GenerateResult> {
    await delay(scriptStep.firstChunkDelayMs ?? null, { abortSignal });
    const content: LanguageModelV4Content[] = [];
    for (const part of scriptStep.parts) {
        switch (part.kind) {
            case 'text':
                content.push({ type: 'text', text: part.deltas.join('') });
                break;
            case 'reasoning':
                content.push({ type: 'reasoning', text: part.deltas.join('') });
                break;
            case 'tool-call':
                content.push({
                    type: 'tool-call',
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    input: JSON.stringify(part.input),
                });
                break;
            case 'pause':
                await delay(part.ms, { abortSignal });
                break;
            case 'stream-error':
            case 'break':
                throw part.error;
        }
    }
    return {
        content,
        finishReason: resolveFinishReason(scriptStep),
        usage: toUsage(scriptStep.usage),
        warnings: [],
    };
}

export interface RecordedCall {
    index: number;
    method: 'stream' | 'generate';
    prompt: LanguageModelV4Prompt;
    toolNames: string[];
    toolChoice: LanguageModelV4CallOptions['toolChoice'];
    maxOutputTokens: number | undefined;
    reasoning: LanguageModelV4CallOptions['reasoning'];
    providerOptions: LanguageModelV4CallOptions['providerOptions'];
    abortSignal: AbortSignal | undefined;
    options: LanguageModelV4CallOptions;
}

export interface ScriptedModel {
    model: MockLanguageModelV4;
    calls: RecordedCall[];
    remainingSteps(): number;
}

function recordCall(
    index: number,
    method: RecordedCall['method'],
    options: LanguageModelV4CallOptions,
): RecordedCall {
    return {
        index,
        method,
        prompt: options.prompt,
        toolNames: (options.tools ?? []).map((tool) => tool.name),
        toolChoice: options.toolChoice,
        maxOutputTokens: options.maxOutputTokens,
        reasoning: options.reasoning,
        providerOptions: options.providerOptions,
        abortSignal: options.abortSignal,
        options,
    };
}

export function createScriptedModel(
    steps: ScriptStep[],
    options?: { provider?: string; modelId?: string },
): ScriptedModel {
    const calls: RecordedCall[] = [];

    const nextStep = (method: RecordedCall['method'], callOptions: LanguageModelV4CallOptions) => {
        const index = calls.length;
        calls.push(recordCall(index, method, callOptions));
        const scriptStep = steps[index];
        if (!scriptStep) {
            throw new Error(`Scripted model has no step ${index + 1} (script has ${steps.length})`);
        }
        if (scriptStep.reject !== undefined) {
            throw scriptStep.reject;
        }
        return { scriptStep, index };
    };

    const model = new MockLanguageModelV4({
        provider: options?.provider ?? 'mock-provider',
        modelId: options?.modelId ?? 'mock-model',
        doStream: async (callOptions): Promise<LanguageModelV4StreamResult> => {
            const { scriptStep, index } = nextStep('stream', callOptions);
            return { stream: buildScriptedStream(scriptStep, index, callOptions.abortSignal) };
        },
        doGenerate: async (callOptions) => {
            const { scriptStep } = nextStep('generate', callOptions);
            return buildScriptedGenerateResult(scriptStep, callOptions.abortSignal);
        },
    });

    return { model, calls, remainingSteps: () => Math.max(0, steps.length - calls.length) };
}

export function promptTexts(
    prompt: LanguageModelV4Prompt,
    role: 'system' | 'user' | 'assistant',
): string[] {
    return prompt
        .filter((message) => message.role === role)
        .map((message) =>
            typeof message.content === 'string'
                ? message.content
                : message.content
                      .map((part) =>
                          'text' in part && typeof part.text === 'string' ? part.text : '',
                      )
                      .join(''),
        );
}

export function promptToolResults(prompt: LanguageModelV4Prompt) {
    return prompt.flatMap((message) =>
        message.role === 'tool'
            ? message.content.flatMap((part) => (part.type === 'tool-result' ? [part] : []))
            : [],
    );
}
