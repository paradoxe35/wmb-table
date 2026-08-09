import { beforeEach, describe, expect, it, vi } from 'vitest';

const streamTextMock = vi.fn();
const dispatchTextDeltaMock = vi.fn();
const dispatchReasoningDeltaMock = vi.fn();
const dispatchToolCallStartMock = vi.fn();
const dispatchToolCallCompleteMock = vi.fn();

vi.mock('ai', () => ({
    streamText: streamTextMock,
    stepCountIs: vi.fn((steps: number) => steps),
}));

vi.mock('@main/lib/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@main/services/ai/runners/stream-dispatcher', () => ({
    dispatchTextDelta: dispatchTextDeltaMock,
    dispatchReasoningDelta: dispatchReasoningDeltaMock,
    dispatchToolCallStart: dispatchToolCallStartMock,
    dispatchToolCallComplete: dispatchToolCallCompleteMock,
}));

const { GenerationRunnerImpl } = await import('@main/services/ai/runners/generation-runner');

function runWith(parts: unknown[], dispatchTextDelta = vi.fn()) {
    streamTextMock.mockReturnValue({
        fullStream: (async function* () {
            for (const part of parts) yield part;
        })(),
    });

    return new GenerationRunnerImpl().run({
        browserWindow: {} as never,
        conversationId: 'conv-1',
        generationId: 'gen-1',
        assistantMessageId: 'assistant-1',
        model: {} as never,
        systemPrompt: 'system',
        history: [],
        tools: {},
        abortSignal: new AbortController().signal,
        isCurrentRun: vi.fn(() => true),
        dispatchTextDelta,
        contextWindow: 16_000,
        toolTokens: 5_000,
        systemPromptTokens: 2_000,
    });
}

describe('GenerationRunnerImpl', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('appends a truncation notice when the stream finishes because of length', async () => {
        const dispatchTextDelta = vi.fn();

        await runWith([{ type: 'finish-step', finishReason: 'length' }], dispatchTextDelta);

        expect(dispatchTextDelta).toHaveBeenCalledWith(
            expect.stringContaining('Response truncated due to length limit'),
        );
    });

    it('completes the tool call when a tool fails so the UI and note views recover', async () => {
        await runWith([
            {
                type: 'tool-error',
                toolCallId: 'call-1',
                toolName: 'editNote',
                error: new Error('anchor not found'),
            },
        ]);

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
});
