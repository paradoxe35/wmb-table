import { describe, expect, it } from 'vitest';
import {
    isLocalProvider,
    isTimeoutReason,
    resolveChatTimeouts,
    resolveSubAgentDeadlines,
    timeoutKindOf,
} from '@main/services/ai/model-timeouts';

describe('isLocalProvider', () => {
    it.each([
        ['ollama', undefined, true],
        ['my-lm-studio', 'http://localhost:1234/v1', true],
        ['my-vllm', 'http://127.0.0.1:8000/v1', true],
        ['my-box', 'http://gpu-box.local:11434/v1', true],
        ['openrouter', 'https://openrouter.ai/api/v1', false],
        ['custom', 'not a url', false],
        ['openai', undefined, false],
    ])('%s at %s is local: %s', (providerId, baseUrl, expected) => {
        expect(isLocalProvider(providerId, baseUrl)).toBe(expected);
    });
});

describe('chat timeouts', () => {
    it('waits longer for the first token of a local model', () => {
        expect(resolveChatTimeouts(true).firstChunkMs).toBeGreaterThan(
            resolveChatTimeouts(false).firstChunkMs * 4,
        );
    });

    it('lets a step outlast the sub-agent it may run', () => {
        for (const local of [true, false]) {
            const timeouts = resolveChatTimeouts(local);
            expect(timeouts.stepMs).toBeGreaterThan(timeouts.agentToolMs);
            expect(timeouts.totalMs).toBeGreaterThan(timeouts.stepMs);
        }
    });
});

describe('timeout reasons', () => {
    it.each([
        ['TimeoutError: First chunk timeout of 100ms exceeded', 'first-chunk'],
        ['TimeoutError: Chunk timeout of 100ms exceeded', 'chunk'],
        ['TimeoutError: Step timeout of 100ms exceeded', 'step'],
        ['TimeoutError: The operation was aborted due to timeout', 'total'],
    ])('reads "%s" as a %s timeout', (reason, kind) => {
        expect(isTimeoutReason(reason)).toBe(true);
        expect(timeoutKindOf(reason)).toBe(kind);
    });

    it('does not take a user stop for a timeout', () => {
        expect(isTimeoutReason('AbortError: This operation was aborted')).toBe(false);
        expect(isTimeoutReason(new DOMException('aborted', 'AbortError'))).toBe(false);
    });
});

describe('resolveSubAgentDeadlines', () => {
    it.each([true, false])(
        'wraps up, then stops, before the chat gives up on the tool call (local: %s)',
        (local) => {
            const timeouts = resolveChatTimeouts(local);
            const { wrapUpAt, deadline } = resolveSubAgentDeadlines(timeouts, 1_000);

            expect(wrapUpAt).toBeGreaterThan(1_000);
            expect(deadline).toBeGreaterThan(wrapUpAt);
            expect(deadline).toBeLessThan(1_000 + timeouts.agentToolMs);
            expect(deadline - wrapUpAt).toBeGreaterThanOrEqual(timeouts.agentToolMs / 5);
        },
    );
});
