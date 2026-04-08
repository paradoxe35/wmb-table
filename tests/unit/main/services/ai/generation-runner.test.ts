import { describe, expect, it, vi } from 'vitest';

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

describe('GenerationRunnerImpl', () => {
    it('appends a truncation notice when the stream finishes because of length', async () => {
        const browserWindow = {} as never;
        const dispatchTextDelta = vi.fn();
        streamTextMock.mockReturnValue({
            fullStream: (async function* () {
                yield { type: 'finish-step', finishReason: 'length' };
            })(),
        });

        const runner = new GenerationRunnerImpl(false);
        await runner.run({
            browserWindow,
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

        expect(dispatchTextDelta).toHaveBeenCalledWith(
            expect.stringContaining('Response truncated due to length limit'),
        );
    });
});
